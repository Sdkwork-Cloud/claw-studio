import assert from 'node:assert/strict';
import {
  OpenClawGatewayClient,
  type OpenClawGatewayConnectionEvent,
} from './openClawGatewayClient.ts';

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

type MockSocketHandler = (event?: {
  code?: number;
  data?: string;
  reason?: string;
}) => void;

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;

  readonly url: string;
  readonly handlers: Record<string, MockSocketHandler[]> = {
    close: [],
    error: [],
    message: [],
    open: [],
  };
  readonly sent: string[] = [];
  readyState = MockWebSocket.CONNECTING;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, handler: MockSocketHandler) {
    this.handlers[type] = this.handlers[type] ?? [];
    this.handlers[type].push(handler);
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', { code, reason });
  }

  emitOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.emit('open');
  }

  emitMessage(payload: unknown) {
    this.emit('message', {
      data: typeof payload === 'string' ? payload : JSON.stringify(payload),
    });
  }

  emitClose(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', { code, reason });
  }

  private emit(type: string, event?: { code?: number; data?: string; reason?: string }) {
    for (const handler of this.handlers[type] ?? []) {
      handler(event);
    }
  }
}

function parseFrame(socket: MockWebSocket, index = socket.sent.length - 1) {
  return JSON.parse(socket.sent[index] ?? '{}') as {
    id?: string;
    method?: string;
    params?: Record<string, unknown>;
  };
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

await runTest(
  'openclaw gateway client completes the connect handshake, correlates requests, and forwards gateway events',
  async () => {
    const sockets: MockWebSocket[] = [];
    const signedPayloads: string[] = [];
    const connectionEvents: OpenClawGatewayConnectionEvent[] = [];
    const chatEvents: Array<Record<string, unknown>> = [];
    const sessionsChangedPayloads: unknown[] = [];

    let requestCounter = 0;

    const client = new OpenClawGatewayClient({
      url: 'ws://127.0.0.1:18789',
      authToken: 'shared-auth-token',
      instanceId: 'instance-alpha',
      clientId: 'claw-studio',
      clientVersion: 'test-client',
      platform: 'test-platform',
      locale: 'zh-CN',
      userAgent: 'claw-studio-tests',
      createRequestId: () => `req-${++requestCounter}`,
      now: () => 1_700_000_000_000,
      webSocketFactory: (url) => {
        const socket = new MockWebSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      deviceIdentityProvider: {
        async loadOrCreate() {
          return {
            deviceId: 'device-alpha',
            publicKey: 'public-key-alpha',
            async sign(payload) {
              signedPayloads.push(payload);
              return 'signature-alpha';
            },
          };
        },
      },
    });

    client.on('connection', (event) => {
      connectionEvents.push(event);
    });
    client.on('chat', (event) => {
      chatEvents.push(event as Record<string, unknown>);
    });
    client.on('sessions.changed', (payload) => {
      sessionsChangedPayloads.push(payload);
    });

    const connectPromise = client.connect();
    assert.equal(sockets.length, 1);

    const socket = sockets[0];
    socket.emitOpen();
    socket.emitMessage({
      type: 'event',
      event: 'connect.challenge',
      payload: {
        nonce: 'nonce-1',
      },
    });

    await waitFor(() => socket.sent.length === 1);
    assert.equal(socket.sent.length, 1);
    const connectFrame = parseFrame(socket);
    assert.equal(connectFrame.method, 'connect');
    assert.deepEqual(connectFrame.params?.auth, {
      token: 'shared-auth-token',
    });
    assert.equal(connectFrame.params?.role, 'operator');
    assert.deepEqual(connectFrame.params?.scopes, [
      'operator.admin',
      'operator.read',
      'operator.write',
      'operator.approvals',
      'operator.pairing',
    ]);
    assert.deepEqual(connectFrame.params?.caps, ['tool-events']);
    assert.deepEqual(connectFrame.params?.client, {
      id: 'claw-studio',
      version: 'test-client',
      platform: 'test-platform',
      mode: 'webchat',
      instanceId: 'instance-alpha',
    });
    assert.deepEqual(connectFrame.params?.device, {
      id: 'device-alpha',
      publicKey: 'public-key-alpha',
      signature: 'signature-alpha',
      signedAt: 1_700_000_000_000,
      nonce: 'nonce-1',
    });

    socket.emitMessage({
      type: 'res',
      id: connectFrame.id,
      ok: true,
      payload: {
        type: 'hello-ok',
        protocol: 3,
        auth: {
          deviceToken: 'device-token-alpha',
          role: 'operator',
          scopes: ['operator.read', 'operator.write'],
        },
      },
    });

    const hello = await connectPromise;
    assert.equal(hello.protocol, 3);
    assert.equal(signedPayloads.length, 1);
    assert.match(
      signedPayloads[0],
      /^v2\|device-alpha\|claw-studio\|webchat\|operator\|operator.admin,operator.read,operator.write,operator.approvals,operator.pairing\|1700000000000\|shared-auth-token\|nonce-1$/,
    );

    const sessionsPromise = client.listSessions({ includeGlobal: false, limit: 20 });
    await waitFor(() => socket.sent.length === 2);
    const sessionsFrame = parseFrame(socket);
    assert.equal(sessionsFrame.method, 'sessions.list');
    assert.deepEqual(sessionsFrame.params, {
      includeGlobal: false,
      limit: 20,
    });
    socket.emitMessage({
      type: 'res',
      id: sessionsFrame.id,
      ok: true,
      payload: {
        ts: 1,
        path: 'sessions.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'claw-studio:instance-alpha:session-1',
            label: 'Alpha Session',
            updatedAt: 1,
            kind: 'direct',
          },
        ],
      },
    });
    const sessions = await sessionsPromise;
    assert.equal(sessions.count, 1);
    assert.equal(sessions.sessions[0]?.key, 'claw-studio:instance-alpha:session-1');

    const historyPromise = client.getChatHistory({
      sessionKey: 'claw-studio:instance-alpha:session-1',
      limit: 200,
    });
    await waitFor(() => socket.sent.length === 3);
    const historyFrame = parseFrame(socket);
    assert.equal(historyFrame.method, 'chat.history');
    assert.deepEqual(historyFrame.params, {
      sessionKey: 'claw-studio:instance-alpha:session-1',
      limit: 200,
    });
    socket.emitMessage({
      type: 'res',
      id: historyFrame.id,
      ok: true,
      payload: {
        thinkingLevel: 'low',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'hello' }],
          },
        ],
      },
    });
    const history = await historyPromise;
    assert.equal(history.thinkingLevel, 'low');
    assert.equal(history.messages?.length, 1);

    const modelsPromise = client.listModels();
    await waitFor(() => socket.sent.length === 4);
    const modelsFrame = parseFrame(socket);
    assert.equal(modelsFrame.method, 'models.list');
    assert.deepEqual(modelsFrame.params, {});
    socket.emitMessage({
      type: 'res',
      id: modelsFrame.id,
      ok: true,
      payload: {
        models: [
          {
            id: 'gpt-4.1',
            name: 'GPT-4.1',
            provider: 'openai',
            contextWindow: 128_000,
          },
        ],
      },
    });
    const models = await modelsPromise;
    assert.equal(models.models.length, 1);
    assert.equal(models.models[0]?.id, 'gpt-4.1');

    const sendPromise = client.sendChatMessage({
      sessionKey: 'claw-studio:instance-alpha:session-1',
      message: 'ping gateway',
      idempotencyKey: 'run-1',
      attachments: [
        {
          id: 'attachment-1',
          kind: 'image',
          name: 'architecture.png',
          url: 'https://cdn.example.com/architecture.png',
        },
      ],
    });
    await waitFor(() => socket.sent.length === 5);
    const sendFrame = parseFrame(socket);
    assert.equal(sendFrame.method, 'chat.send');
    assert.deepEqual(sendFrame.params, {
      sessionKey: 'claw-studio:instance-alpha:session-1',
      message: 'ping gateway',
      deliver: false,
      idempotencyKey: 'run-1',
      attachments: [
        {
          id: 'attachment-1',
          kind: 'image',
          name: 'architecture.png',
          url: 'https://cdn.example.com/architecture.png',
        },
      ],
    });
    socket.emitMessage({
      type: 'res',
      id: sendFrame.id,
      ok: true,
      payload: {
        accepted: true,
      },
    });
    const sendResult = await sendPromise;
    assert.equal(sendResult.runId, 'run-1');

    const patchPromise = client.patchSession({
      key: 'claw-studio:instance-alpha:session-1',
      model: 'openai/gpt-4.1',
    });
    await waitFor(() => socket.sent.length === 6);
    const patchFrame = parseFrame(socket);
    assert.equal(patchFrame.method, 'sessions.patch');
    assert.deepEqual(patchFrame.params, {
      key: 'claw-studio:instance-alpha:session-1',
      model: 'openai/gpt-4.1',
    });
    socket.emitMessage({
      type: 'res',
      id: patchFrame.id,
      ok: true,
      payload: {
        ok: true,
        resolved: {
          modelProvider: 'openai',
          model: 'gpt-4.1',
        },
      },
    });
    assert.deepEqual(await patchPromise, {
      ok: true,
      resolved: {
        modelProvider: 'openai',
        model: 'gpt-4.1',
      },
    });

    const clearPatchPromise = client.patchSession({
      key: 'claw-studio:instance-alpha:session-1',
      model: null,
    });
    await waitFor(() => socket.sent.length === 7);
    const clearPatchFrame = parseFrame(socket);
    assert.equal(clearPatchFrame.method, 'sessions.patch');
    assert.deepEqual(clearPatchFrame.params, {
      key: 'claw-studio:instance-alpha:session-1',
      model: null,
    });
    socket.emitMessage({
      type: 'res',
      id: clearPatchFrame.id,
      ok: true,
      payload: {
        ok: true,
      },
    });
    assert.deepEqual(await clearPatchPromise, {
      ok: true,
    });

    const abortPromise = client.abortChatRun({
      sessionKey: 'claw-studio:instance-alpha:session-1',
      runId: 'run-1',
    });
    await waitFor(() => socket.sent.length === 8);
    const abortFrame = parseFrame(socket);
    assert.equal(abortFrame.method, 'chat.abort');
    assert.deepEqual(abortFrame.params, {
      sessionKey: 'claw-studio:instance-alpha:session-1',
      runId: 'run-1',
    });
    socket.emitMessage({
      type: 'res',
      id: abortFrame.id,
      ok: true,
      payload: {
        aborted: true,
      },
    });
    assert.deepEqual(await abortPromise, { aborted: true });

    const resetPromise = client.resetSession({
      key: 'claw-studio:instance-alpha:session-1',
    });
    await waitFor(() => socket.sent.length === 9);
    const resetFrame = parseFrame(socket);
    assert.equal(resetFrame.method, 'sessions.reset');
    assert.deepEqual(resetFrame.params, {
      key: 'claw-studio:instance-alpha:session-1',
    });
    socket.emitMessage({
      type: 'res',
      id: resetFrame.id,
      ok: true,
      payload: {
        ok: true,
      },
    });
    assert.deepEqual(await resetPromise, { ok: true });

    const deletePromise = client.deleteSession({
      key: 'claw-studio:instance-alpha:session-1',
    });
    await waitFor(() => socket.sent.length === 10);
    const deleteFrame = parseFrame(socket);
    assert.equal(deleteFrame.method, 'sessions.delete');
    assert.deepEqual(deleteFrame.params, {
      key: 'claw-studio:instance-alpha:session-1',
      deleteTranscript: true,
    });
    socket.emitMessage({
      type: 'res',
      id: deleteFrame.id,
      ok: true,
      payload: {
        ok: true,
      },
    });
    assert.deepEqual(await deletePromise, { ok: true });

    socket.emitMessage({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run-1',
        sessionKey: 'claw-studio:instance-alpha:session-1',
        state: 'delta',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'pong' }],
        },
      },
    });
    socket.emitMessage({
      type: 'event',
      event: 'sessions.changed',
      payload: {
        source: 'remote-refresh',
      },
    });

    assert.equal(chatEvents.length, 1);
    assert.equal(chatEvents[0]?.sessionKey, 'claw-studio:instance-alpha:session-1');
    assert.deepEqual(sessionsChangedPayloads, [{ source: 'remote-refresh' }]);
    assert.deepEqual(
      connectionEvents.map((event) => event.status),
      ['connecting', 'connected'],
    );

    client.disconnect();
  },
);

await runTest(
  'openclaw gateway client uses the control-ui client id by default for browser webchat compatibility',
  async () => {
    const sockets: MockWebSocket[] = [];
    let requestCounter = 0;

    const client = new OpenClawGatewayClient({
      url: 'ws://127.0.0.1:18789',
      createRequestId: () => `req-${++requestCounter}`,
      now: () => 1_700_000_000_000,
      webSocketFactory: (url) => {
        const socket = new MockWebSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      deviceIdentityProvider: {
        async loadOrCreate() {
          return null;
        },
      },
    });

    const connectPromise = client.connect();
    const socket = sockets[0];
    assert.ok(socket);
    socket.emitOpen();
    socket.emitMessage({
      type: 'event',
      event: 'connect.challenge',
      payload: {
        nonce: 'nonce-default',
      },
    });

    await waitFor(() => socket.sent.length === 1);
    const connectFrame = parseFrame(socket);
    assert.equal(connectFrame.params?.client?.id, 'openclaw-control-ui');

    socket.emitMessage({
      type: 'res',
      id: connectFrame.id,
      ok: true,
      payload: {
        type: 'hello-ok',
        protocol: 3,
      },
    });

    await connectPromise;
    client.disconnect();
  },
);

await runTest(
  'openclaw gateway client retries one time with a cached device token after AUTH_TOKEN_MISMATCH',
  async () => {
    const sockets: MockWebSocket[] = [];
    const storageState = new Map<string, string>([
      [
        'claw-studio.openclaw.device-token.v1',
        JSON.stringify({
          version: 1,
          tokens: {
            'device-alpha:operator': {
              token: 'cached-device-token',
              scopes: ['operator.read', 'operator.write'],
              updatedAtMs: 1_700_000_000_000,
            },
          },
        }),
      ],
    ]);

    let requestCounter = 0;

    const client = new OpenClawGatewayClient({
      url: 'ws://127.0.0.1:18789',
      authToken: 'shared-auth-token',
      instanceId: 'instance-alpha',
      reconnectBaseMs: 1,
      reconnectMaxMs: 1,
      createRequestId: () => `req-${++requestCounter}`,
      now: () => 1_700_000_000_000,
      storage: {
        getItem(key) {
          return storageState.get(key) ?? null;
        },
        removeItem(key) {
          storageState.delete(key);
        },
        setItem(key, value) {
          storageState.set(key, value);
        },
      },
      webSocketFactory: (url) => {
        const socket = new MockWebSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      deviceIdentityProvider: {
        async loadOrCreate() {
          return {
            deviceId: 'device-alpha',
            publicKey: 'public-key-alpha',
            async sign() {
              return 'signature-alpha';
            },
          };
        },
      },
    });

    const connectPromise = client.connect();
    const firstSocket = sockets[0];
    assert.ok(firstSocket);
    firstSocket.emitOpen();
    firstSocket.emitMessage({
      type: 'event',
      event: 'connect.challenge',
      payload: {
        nonce: 'nonce-1',
      },
    });

    await waitFor(() => firstSocket.sent.length === 1);
    const firstConnectFrame = parseFrame(firstSocket);
    assert.deepEqual(firstConnectFrame.params?.auth, {
      token: 'shared-auth-token',
    });

    firstSocket.emitMessage({
      type: 'res',
      id: firstConnectFrame.id,
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'token mismatch',
        details: {
          code: 'AUTH_TOKEN_MISMATCH',
          canRetryWithDeviceToken: true,
          recommendedNextStep: 'retry_with_device_token',
        },
      },
    });

    await waitFor(() => sockets.length === 2);
    const secondSocket = sockets[1];
    secondSocket.emitOpen();
    secondSocket.emitMessage({
      type: 'event',
      event: 'connect.challenge',
      payload: {
        nonce: 'nonce-2',
      },
    });

    await waitFor(() => secondSocket.sent.length === 1);
    const secondConnectFrame = parseFrame(secondSocket);
    assert.deepEqual(secondConnectFrame.params?.auth, {
      token: 'shared-auth-token',
      deviceToken: 'cached-device-token',
    });

    secondSocket.emitMessage({
      type: 'res',
      id: secondConnectFrame.id,
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'token mismatch',
        details: {
          code: 'AUTH_TOKEN_MISMATCH',
          canRetryWithDeviceToken: true,
          recommendedNextStep: 'retry_with_device_token',
        },
      },
    });

    await assert.rejects(connectPromise, /token mismatch/);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(sockets.length, 2);
  },
);
