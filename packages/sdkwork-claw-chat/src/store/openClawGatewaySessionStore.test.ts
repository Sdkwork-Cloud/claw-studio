import assert from 'node:assert/strict';
import {
  OpenClawGatewaySessionStore,
  type OpenClawGatewayClientLike,
} from './openClawGatewaySessionStore.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

async function waitFor(check: () => boolean, timeoutMs = 1_000) {
  const startedAt = Date.now();
  while (!check()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for condition.');
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

type ListenerRegistry = {
  chat: Array<(payload: Record<string, unknown>) => void>;
  connection: Array<(payload: Record<string, unknown>) => void>;
  'sessions.changed': Array<(payload: unknown) => void>;
};

class MockGatewayClient implements OpenClawGatewayClientLike {
  readonly listeners: ListenerRegistry = {
    chat: [],
    connection: [],
    'sessions.changed': [],
  };
  readonly modelsListCalls: Array<Record<string, unknown>> = [];
  readonly patchCalls: Array<Record<string, unknown>> = [];
  readonly sendCalls: Array<Record<string, unknown>> = [];
  readonly deleteCalls: Array<Record<string, unknown>> = [];
  readonly resetCalls: Array<Record<string, unknown>> = [];
  subscribeCount = 0;
  subscribeError: Error | null = null;
  shouldFailDelete = false;
  shouldFailReset = false;
  private connectHello: {
    type: 'hello-ok';
    protocol: number;
    features?: {
      methods?: string[];
      events?: string[];
    };
  } = {
    type: 'hello-ok',
    protocol: 3,
  };
  private sessionsResult: {
    ts: number;
    path: string;
    count: number;
    defaults: {
      modelProvider: string | null;
      model: string | null;
      contextTokens: number | null;
    };
    sessions: Array<Record<string, unknown>>;
  };
  private histories: Record<
    string,
    {
      thinkingLevel?: string | null;
      messages?: Array<Record<string, unknown>>;
    }
  >;

  constructor(
    sessionsResult: {
      ts: number;
      path: string;
      count: number;
      defaults: {
        modelProvider: string | null;
        model: string | null;
        contextTokens: number | null;
      };
      sessions: Array<Record<string, unknown>>;
    },
    histories: Record<
      string,
      {
        thinkingLevel?: string | null;
        messages?: Array<Record<string, unknown>>;
      }
    >,
  ) {
    this.sessionsResult = sessionsResult;
    this.histories = histories;
  }

  async connect() {
    return this.connectHello;
  }

  on(event: keyof ListenerRegistry, listener: any) {
    this.listeners[event].push(listener);
    return () => {
      this.listeners[event] = this.listeners[event].filter((entry) => entry !== listener) as any;
    };
  }

  async subscribeSessions() {
    this.subscribeCount += 1;
    if (this.subscribeError) {
      throw this.subscribeError;
    }
    return { ok: true };
  }

  async listSessions() {
    return this.sessionsResult;
  }

  async getChatHistory(params: { sessionKey: string }) {
    return this.histories[params.sessionKey] ?? { messages: [], thinkingLevel: null };
  }

  async listModels(params?: Record<string, unknown>) {
    this.modelsListCalls.push(params ?? {});
    return {
      models: [
        {
          id: 'openai/gpt-4.1',
          name: 'GPT-4.1',
          provider: 'openai',
        },
      ],
    };
  }

  async patchSession(params: Record<string, unknown>) {
    this.patchCalls.push(params);
    return {
      ok: true,
    };
  }

  async sendChatMessage(params: Record<string, unknown>) {
    this.sendCalls.push(params);
    return {
      runId: 'run-1',
    };
  }

  async abortChatRun() {
    return { aborted: true };
  }

  async resetSession(params: Record<string, unknown>) {
    this.resetCalls.push(params);
    if (this.shouldFailReset) {
      throw new Error('reset failed');
    }
    return { ok: true };
  }

  async deleteSession(params: Record<string, unknown>) {
    this.deleteCalls.push(params);
    if (this.shouldFailDelete) {
      throw new Error('delete failed');
    }
    return { ok: true };
  }

  disconnect() {}

  emitChat(payload: Record<string, unknown>) {
    for (const listener of this.listeners.chat) {
      listener(payload);
    }
  }

  emitSessionsChanged(payload: unknown) {
    for (const listener of this.listeners['sessions.changed']) {
      listener(payload);
    }
  }

  emitConnection(payload: Record<string, unknown>) {
    for (const listener of this.listeners.connection) {
      listener(payload);
    }
  }

  replaceSessions(
    sessions: Array<Record<string, unknown>>,
    count = sessions.length,
  ) {
    this.sessionsResult = {
      ...this.sessionsResult,
      count,
      sessions,
    };
  }

  setHistory(
    sessionKey: string,
    history: { thinkingLevel?: string | null; messages?: Array<Record<string, unknown>> },
  ) {
    this.histories[sessionKey] = history;
  }

  setConnectHello(value: {
    type: 'hello-ok';
    protocol: number;
    features?: {
      methods?: string[];
      events?: string[];
    };
  }) {
    this.connectHello = value;
  }
}

await runTest(
  'openclaw gateway session store isolates sessions per instance and treats gateway state as authoritative',
  async () => {
    const clientA = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 2,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'claw-studio:instance-a:session-1',
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: 'claw-studio:instance-a:session-2',
            label: 'A Two',
            updatedAt: 190,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        'claw-studio:instance-a:session-1': {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A' }],
              timestamp: 210,
            },
          ],
        },
      },
    );

    const clientB = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-b.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'claw-studio:instance-b:session-1',
            label: 'B One',
            updatedAt: 150,
            kind: 'direct',
            model: 'OpenClaw B',
          },
        ],
      },
      {
        'claw-studio:instance-b:session-1': {
          thinkingLevel: 'medium',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from B' }],
              timestamp: 150,
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient(instanceId) {
        return instanceId === 'instance-a' ? clientA : clientB;
      },
      now: () => 300,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-1`;
      },
    });

    await store.hydrateInstance('instance-a');
    let snapshotA = store.getSnapshot('instance-a');
    assert.deepEqual(
      snapshotA.sessions.map((session) => session.id),
      ['claw-studio:instance-a:session-1', 'claw-studio:instance-a:session-2'],
    );
    assert.equal(snapshotA.activeSessionId, 'claw-studio:instance-a:session-1');
    assert.equal(snapshotA.sessions[0]?.messages[0]?.content, 'hello from A');
    assert.equal(clientA.subscribeCount, 1);

    await store.hydrateInstance('instance-b');
    const snapshotB = store.getSnapshot('instance-b');
    snapshotA = store.getSnapshot('instance-a');
    assert.deepEqual(snapshotB.sessions.map((session) => session.id), [
      'claw-studio:instance-b:session-1',
    ]);
    assert.equal(snapshotB.activeSessionId, 'claw-studio:instance-b:session-1');
    assert.equal(snapshotB.sessions[0]?.messages[0]?.content, 'hello from B');
    assert.deepEqual(
      snapshotA.sessions.map((session) => session.id),
      ['claw-studio:instance-a:session-1', 'claw-studio:instance-a:session-2'],
    );

    const draft = store.createDraftSession('instance-a', 'OpenClaw A');
    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'stream to A',
      model: 'OpenClaw A',
    });
    snapshotA = store.getSnapshot('instance-a');
    const draftSessionAfterSend = snapshotA.sessions.find((session) => session.id === draft.id);
    assert.ok(draftSessionAfterSend);
    assert.deepEqual(
      draftSessionAfterSend.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [{ role: 'user', content: 'stream to A' }],
    );
    assert.deepEqual(clientA.sendCalls, [
      {
        sessionKey: 'claw-studio:instance-a:draft-1',
        message: 'stream to A',
        deliver: false,
        idempotencyKey: 'run-1',
      },
    ]);
    assert.deepEqual(clientA.patchCalls, []);

    await store.setSessionModel({
      instanceId: 'instance-a',
      sessionId: 'claw-studio:instance-a:session-1',
      model: 'openai/gpt-4.1',
    });
    snapshotA = store.getSnapshot('instance-a');
    assert.equal(
      snapshotA.sessions.find((session) => session.id === 'claw-studio:instance-a:session-1')?.model,
      'openai/gpt-4.1',
    );
    assert.deepEqual(clientA.patchCalls, [
      {
        key: 'claw-studio:instance-a:session-1',
        model: 'openai/gpt-4.1',
      },
    ]);

    await store.setSessionModel({
      instanceId: 'instance-a',
      sessionId: 'claw-studio:instance-a:session-1',
      model: null,
    });
    snapshotA = store.getSnapshot('instance-a');
    assert.equal(
      snapshotA.sessions.find((session) => session.id === 'claw-studio:instance-a:session-1')?.model,
      'OpenClaw A',
    );
    assert.deepEqual(clientA.patchCalls, [
      {
        key: 'claw-studio:instance-a:session-1',
        model: 'openai/gpt-4.1',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        model: null,
      },
    ]);

    clientA.emitChat({
      runId: 'run-1',
      sessionKey: 'claw-studio:instance-a:draft-1',
      state: 'delta',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'partial reply' }],
      },
    });
    snapshotA = store.getSnapshot('instance-a');
    assert.deepEqual(
      snapshotA.sessions
        .find((session) => session.id === draft.id)
        ?.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      [
        { role: 'user', content: 'stream to A' },
        { role: 'assistant', content: 'partial reply' },
      ],
    );

    clientA.emitChat({
      runId: 'run-1',
      sessionKey: 'claw-studio:instance-a:draft-1',
      state: 'final',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'final reply' }],
      },
    });
    snapshotA = store.getSnapshot('instance-a');
    assert.equal(
      snapshotA.sessions.find((session) => session.id === draft.id)?.messages.at(-1)?.content,
      'final reply',
    );

    const remoteSessionId = 'claw-studio:instance-a:session-1';
    const remoteSessionBeforeReset = snapshotA.sessions.find(
      (session) => session.id === remoteSessionId,
    );
    assert.ok(remoteSessionBeforeReset);
    clientA.shouldFailReset = true;
    assert.equal(
      await store.resetSession({ instanceId: 'instance-a', sessionId: remoteSessionId }),
      false,
    );
    snapshotA = store.getSnapshot('instance-a');
    assert.equal(
      snapshotA.sessions.find((session) => session.id === remoteSessionId)?.messages.length,
      remoteSessionBeforeReset.messages.length,
    );

    clientA.shouldFailReset = false;
    clientA.setHistory(remoteSessionId, { messages: [], thinkingLevel: 'off' });
    assert.equal(
      await store.resetSession({ instanceId: 'instance-a', sessionId: remoteSessionId }),
      true,
    );
    snapshotA = store.getSnapshot('instance-a');
    assert.deepEqual(
      snapshotA.sessions.find((session) => session.id === remoteSessionId)?.messages,
      [],
    );

    clientA.shouldFailDelete = true;
    assert.equal(
      await store.deleteSession({ instanceId: 'instance-a', sessionId: remoteSessionId }),
      false,
    );
    snapshotA = store.getSnapshot('instance-a');
    assert.ok(snapshotA.sessions.some((session) => session.id === remoteSessionId));

    clientA.shouldFailDelete = false;
    clientA.replaceSessions([
      {
        key: 'claw-studio:instance-a:draft-1',
        label: 'Draft Promoted',
        updatedAt: 320,
        kind: 'direct',
        model: 'OpenClaw A',
      },
      {
        key: 'claw-studio:instance-a:session-2',
        label: 'A Two',
        updatedAt: 190,
        kind: 'direct',
        model: 'OpenClaw A',
      },
    ]);
    assert.equal(
      await store.deleteSession({ instanceId: 'instance-a', sessionId: remoteSessionId }),
      true,
    );
    snapshotA = store.getSnapshot('instance-a');
    assert.ok(!snapshotA.sessions.some((session) => session.id === remoteSessionId));

    clientB.emitSessionsChanged({ source: 'remote-b' });
    assert.deepEqual(
      store.getSnapshot('instance-a').sessions.map((session) => session.id),
      ['claw-studio:instance-a:draft-1', 'claw-studio:instance-a:session-2'],
    );
  },
);

await runTest(
  'openclaw gateway session store normalizes remote model provider references during hydration',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: 'openai',
          model: 'gpt-4.1',
          contextTokens: null,
        },
        sessions: [
          {
            key: 'claw-studio:instance-a:session-1',
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            modelProvider: 'openai',
            model: 'gpt-4.1',
          },
        ],
      },
      {
        'claw-studio:instance-a:session-1': {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A' }],
              timestamp: 210,
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 500,
    });

    await store.hydrateInstance('instance-a');
    const snapshot = store.getSnapshot('instance-a');
    assert.equal(snapshot.sessions[0]?.model, 'openai/gpt-4.1');
    assert.equal(snapshot.sessions[0]?.defaultModel, 'openai/gpt-4.1');
  },
);

await runTest(
  'openclaw gateway session store prefers derived titles or readable previews over opaque session ids during hydration',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-readable.json',
        count: 3,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'agent:research:main',
            derivedTitle: 'Weekly API Router audit',
            updatedAt: 310,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: 'claw-studio:instance-a:session-2',
            lastMessagePreview: '  Summarize the current install flow issues across macOS and Windows  ',
            updatedAt: 300,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: 'claw-studio:instance-a:session-3',
            updatedAt: 290,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        'agent:research:main': {
          thinkingLevel: 'low',
          messages: [],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 510,
    });

    await store.hydrateInstance('instance-a');
    const snapshot = store.getSnapshot('instance-a');

    assert.deepEqual(
      snapshot.sessions.map((session) => ({
        id: session.id,
        title: session.title,
      })),
      [
        {
          id: 'agent:research:main',
          title: 'Weekly API Router audit',
        },
        {
          id: 'claw-studio:instance-a:session-2',
          title: 'Summarize the current install flow issues across macOS and Windows',
        },
        {
          id: 'claw-studio:instance-a:session-3',
          title: 'New Conversation',
        },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store ignores weak technical runtime labels and shows readable preview titles during hydration',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-technical-labels.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'thread:claw-studio:install-audit',
            displayName: 'openclaw-tui',
            label: 'main',
            lastMessagePreview:
              '  Use the first user message as a ChatGPT-style title instead of runtime labels  ',
            updatedAt: 315,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        'thread:claw-studio:install-audit': {
          thinkingLevel: 'medium',
          messages: [],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 520,
    });

    await store.hydrateInstance('instance-a');
    const snapshot = store.getSnapshot('instance-a');

    assert.equal(
      snapshot.sessions[0]?.title,
      'Use the first user message as a ChatGPT-style title instead of runtime labels',
    );
  },
);

await runTest(
  'openclaw gateway session store skips sessions.subscribe when hello capabilities say it is unavailable',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'claw-studio:instance-a:session-1',
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        'claw-studio:instance-a:session-1': {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A' }],
              timestamp: 210,
            },
          ],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: ['sessions.list', 'chat.history', 'chat.send'],
      },
    });
    client.subscribeError = new Error('subscribe should not be called');

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 410,
    });

    await store.hydrateInstance('instance-a');
    const snapshot = store.getSnapshot('instance-a');
    assert.equal(client.subscribeCount, 0);
    assert.equal(snapshot.syncState, 'idle');
    assert.equal(snapshot.lastError, undefined);
    assert.deepEqual(snapshot.sessions.map((session) => session.id), [
      'claw-studio:instance-a:session-1',
    ]);
    assert.equal(snapshot.sessions[0]?.messages[0]?.content, 'hello from A');
  },
);

await runTest(
  'openclaw gateway session store tolerates unknown sessions.subscribe errors from older runtimes',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'claw-studio:instance-a:session-1',
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        'claw-studio:instance-a:session-1': {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A' }],
              timestamp: 210,
            },
          ],
        },
      },
    );
    client.subscribeError = new Error('unknown method: sessions.subscribe');

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 420,
    });

    await store.hydrateInstance('instance-a');
    const snapshot = store.getSnapshot('instance-a');
    assert.equal(client.subscribeCount, 1);
    assert.equal(snapshot.syncState, 'idle');
    assert.equal(snapshot.lastError, undefined);
    assert.deepEqual(snapshot.sessions.map((session) => session.id), [
      'claw-studio:instance-a:session-1',
    ]);

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: 'claw-studio:instance-a:session-1',
      content: 'send despite missing subscribe',
      model: 'OpenClaw A',
    });
    assert.deepEqual(client.sendCalls, [
      {
        sessionKey: 'claw-studio:instance-a:session-1',
        message: 'send despite missing subscribe',
        deliver: false,
        idempotencyKey: 'run-1',
      },
    ]);
  },
);

await runTest(
  'openclaw gateway session store re-subscribes session updates after reconnect and refreshes final history from gateway',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'claw-studio:instance-a:session-1',
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        'claw-studio:instance-a:session-1': {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A' }],
              timestamp: 210,
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 400,
    });

    await store.hydrateInstance('instance-a');
    assert.equal(client.subscribeCount, 1);

    client.emitConnection({
      status: 'connected',
    });
    await waitFor(() => client.subscribeCount === 2);

    client.setHistory('claw-studio:instance-a:session-1', {
      thinkingLevel: 'low',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'hello from A' }],
          timestamp: 210,
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'authoritative final reply' }],
          timestamp: 211,
        },
      ],
    });

    client.emitChat({
      runId: 'run-final',
      sessionKey: 'claw-studio:instance-a:session-1',
      state: 'final',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'event-only final reply' }],
      },
    });

    await waitFor(
      () =>
        store
          .getSnapshot('instance-a')
          .sessions.find((session) => session.id === 'claw-studio:instance-a:session-1')
          ?.messages.at(-1)?.content === 'authoritative final reply',
    );
  },
);

await runTest(
  'openclaw gateway session store keeps attachment-only user messages and forwards attachment payloads',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 600,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-attachment`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');
    const attachment = {
      id: 'attachment-1',
      kind: 'screenshot' as const,
      name: 'dashboard-shot.png',
      url: 'https://cdn.example.com/dashboard-shot.png',
      previewUrl: 'https://cdn.example.com/dashboard-shot.png',
      mimeType: 'image/png',
      sizeBytes: 2048,
      objectKey: 'chat/2026/03/22/dashboard-shot.png',
    };

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: '',
      model: 'OpenClaw A',
      requestText: 'The user sent attachments without additional text.',
      attachments: [attachment],
    });

    const snapshot = store.getSnapshot('instance-a');
    const session = snapshot.sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.equal(session?.title, 'dashboard-shot.png');
    assert.deepEqual(session?.messages, [
      {
        id: session?.messages[0]?.id,
        role: 'user',
        content: '',
        timestamp: 600,
        attachments: [attachment],
      },
    ]);
    assert.deepEqual(client.sendCalls, [
      {
        sessionKey: 'claw-studio:instance-a:draft-attachment',
        message: 'The user sent attachments without additional text.',
        deliver: false,
        idempotencyKey: 'run-1',
        attachments: [
          {
            id: 'attachment-1',
            kind: 'screenshot',
            name: 'dashboard-shot.png',
            mimeType: 'image/png',
            sizeBytes: 2048,
            url: 'https://cdn.example.com/dashboard-shot.png',
            previewUrl: 'https://cdn.example.com/dashboard-shot.png',
            objectKey: 'chat/2026/03/22/dashboard-shot.png',
          },
        ],
      },
    ]);
  },
);

await runTest(
  'openclaw gateway session store accepts explicit upstream agent main session ids for new drafts',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 720,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:should-not-be-used`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A', {
      sessionId: 'agent:research:main',
    });
    assert.equal(draft.id, 'agent:research:main');

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'hello research',
      model: 'anthropic/claude-3-7-sonnet',
    });

    assert.deepEqual(client.sendCalls, [
      {
        sessionKey: 'agent:research:main',
        message: 'hello research',
        deliver: false,
        idempotencyKey: 'run-1',
      },
    ]);
  },
);
