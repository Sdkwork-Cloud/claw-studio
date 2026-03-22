import type {
  OpenClawGatewayChatEvent,
  OpenClawGatewayChatHistoryResult,
  OpenClawGatewayHelloOk,
  OpenClawGatewayConnectionEvent,
  OpenClawGatewaySessionsListResult,
} from '../services/store/index.ts';

export type OpenClawGatewayRole = 'user' | 'assistant' | 'system';
export type OpenClawGatewaySyncState = 'idle' | 'loading' | 'error';

export interface OpenClawGatewayMessage {
  id: string;
  role: OpenClawGatewayRole;
  content: string;
  timestamp: number;
  model?: string;
  runId?: string;
}

export interface OpenClawGatewayChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: OpenClawGatewayMessage[];
  model: string;
  instanceId?: string;
  transport?: 'openclawGateway';
  isDraft?: boolean;
  runId?: string | null;
  thinkingLevel?: string | null;
}

export interface OpenClawGatewayInstanceSnapshot {
  sessions: OpenClawGatewayChatSession[];
  activeSessionId: string | null;
  syncState: OpenClawGatewaySyncState;
  lastError?: string;
}

export interface OpenClawGatewayClientLike {
  connect: () => Promise<OpenClawGatewayHelloOk>;
  disconnect: () => void;
  subscribeSessions: () => Promise<unknown>;
  listSessions: (params?: {
    includeGlobal?: boolean;
    includeUnknown?: boolean;
    activeMinutes?: number;
    limit?: number;
  }) => Promise<OpenClawGatewaySessionsListResult>;
  getChatHistory: (params: {
    sessionKey: string;
    limit?: number;
  }) => Promise<OpenClawGatewayChatHistoryResult>;
  sendChatMessage: (params: {
    sessionKey: string;
    message: string;
    idempotencyKey?: string;
    deliver?: boolean;
    attachments?: unknown[];
  }) => Promise<{
    runId: string;
    response?: unknown;
  }>;
  abortChatRun: (params: { sessionKey: string; runId?: string }) => Promise<unknown>;
  resetSession: (params: { key: string }) => Promise<unknown>;
  deleteSession: (params: { key: string; deleteTranscript?: boolean }) => Promise<unknown>;
  on: (
    event: 'chat' | 'connection' | 'sessions.changed',
    listener: ((payload: any) => void) | ((payload: unknown) => void),
  ) => () => void;
}

interface OpenClawGatewaySessionStoreOptions {
  getClient: (
    instanceId: string,
  ) => OpenClawGatewayClientLike | Promise<OpenClawGatewayClientLike>;
  now?: () => number;
  createSessionKey?: (instanceId: string) => string;
  createRunId?: () => string;
}

type InternalInstanceState = {
  client: OpenClawGatewayClientLike;
  snapshot: OpenClawGatewayInstanceSnapshot;
  subscribed: boolean;
  offChat?: () => void;
  offConnection?: () => void;
  offSessionsChanged?: () => void;
  refreshVersion: number;
};

function createInitialSnapshot(): OpenClawGatewayInstanceSnapshot {
  return {
    sessions: [],
    activeSessionId: null,
    syncState: 'idle',
    lastError: undefined,
  };
}

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTextContent(payload: unknown): string[] {
  if (typeof payload === 'string') {
    return payload ? [payload] : [];
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => normalizeTextContent(entry));
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.text === 'string' && record.text) {
    return [record.text];
  }

  if (typeof record.content === 'string' && record.content) {
    return [record.content];
  }

  if (Array.isArray(record.content)) {
    return record.content.flatMap((entry) => normalizeTextContent(entry));
  }

  if (record.message) {
    return normalizeTextContent(record.message);
  }

  if (record.delta) {
    return normalizeTextContent(record.delta);
  }

  return [];
}

function extractMessageText(payload: unknown) {
  return normalizeTextContent(payload).join('\n\n').trim();
}

function normalizeTimestamp(payload: unknown, fallback: number) {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const candidate = record.timestamp ?? record.createdAt ?? record.updatedAt ?? record.ts;
  return typeof candidate === 'number' ? candidate : fallback;
}

function normalizeRole(payload: unknown): OpenClawGatewayRole {
  if (!payload || typeof payload !== 'object') {
    return 'assistant';
  }

  const role = (payload as Record<string, unknown>).role;
  return role === 'user' || role === 'assistant' || role === 'system' ? role : 'assistant';
}

function normalizeMessage(
  payload: unknown,
  fallbackTimestamp: number,
  fallbackIdPrefix: string,
): OpenClawGatewayMessage | null {
  const content = extractMessageText(payload);
  if (!content) {
    return null;
  }

  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const idCandidate = record.id ?? record.messageId;
  return {
    id: typeof idCandidate === 'string' && idCandidate ? idCandidate : createMessageId(fallbackIdPrefix),
    role: normalizeRole(payload),
    content,
    timestamp: normalizeTimestamp(payload, fallbackTimestamp),
    model: typeof record.model === 'string' ? record.model : undefined,
    runId: typeof record.runId === 'string' ? record.runId : undefined,
  };
}

function deriveSessionTitle(existingTitle: string, messageContent: string, isFirstUserMessage: boolean) {
  if (!isFirstUserMessage) {
    return existingTitle;
  }

  const trimmed = messageContent.trim();
  if (!trimmed) {
    return existingTitle;
  }

  return `${trimmed.slice(0, 40)}${trimmed.length > 40 ? '...' : ''}`;
}

function buildSessionTitle(row: Record<string, unknown>) {
  const label = typeof row.label === 'string' ? row.label.trim() : '';
  if (label) {
    return label;
  }

  const displayName = typeof row.displayName === 'string' ? row.displayName.trim() : '';
  if (displayName) {
    return displayName;
  }

  return typeof row.key === 'string' ? row.key : 'OpenClaw Conversation';
}

function cloneSession(session: OpenClawGatewayChatSession): OpenClawGatewayChatSession {
  return {
    ...session,
    messages: session.messages.map((message) => ({ ...message })),
  };
}

export class OpenClawGatewaySessionStore {
  private readonly getClient: OpenClawGatewaySessionStoreOptions['getClient'];
  private readonly now: () => number;
  private readonly createSessionKey: (instanceId: string) => string;
  private readonly createRunId: () => string;
  private readonly instances = new Map<string, InternalInstanceState>();
  private readonly listeners = new Set<
    (instanceId: string, snapshot: OpenClawGatewayInstanceSnapshot) => void
  >();
  private runCounter = 0;

  constructor(options: OpenClawGatewaySessionStoreOptions) {
    this.getClient = options.getClient;
    this.now = options.now ?? (() => Date.now());
    this.createSessionKey =
      options.createSessionKey ??
      ((instanceId) => `claw-studio:${instanceId}:${Math.random().toString(36).slice(2, 10)}`);
    this.createRunId =
      options.createRunId ??
      (() => {
        this.runCounter += 1;
        return `run-${this.runCounter}`;
      });
  }

  subscribe(listener: (instanceId: string, snapshot: OpenClawGatewayInstanceSnapshot) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(instanceId: string): OpenClawGatewayInstanceSnapshot {
    const snapshot = this.instances.get(instanceId)?.snapshot ?? createInitialSnapshot();
    return {
      ...snapshot,
      sessions: snapshot.sessions.map(cloneSession),
    };
  }

  async hydrateInstance(instanceId: string) {
    return this.refreshInstance(instanceId, {
      preserveActiveSessionId: true,
      reloadActiveHistory: true,
    });
  }

  createDraftSession(instanceId: string, model = 'OpenClaw Gateway') {
    const state = this.getOrCreatePlaceholderState(instanceId);
    const timestamp = this.now();
    const session: OpenClawGatewayChatSession = {
      id: this.createSessionKey(instanceId),
      title: 'New Conversation',
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [],
      model,
      instanceId,
      transport: 'openclawGateway',
      isDraft: true,
      runId: null,
      thinkingLevel: null,
    };

    state.snapshot.sessions = [session, ...state.snapshot.sessions.filter((item) => item.id !== session.id)];
    state.snapshot.activeSessionId = session.id;
    state.snapshot.lastError = undefined;
    this.sortSessions(state.snapshot);
    this.emit(instanceId);
    return cloneSession(session);
  }

  async setActiveSession(params: { instanceId: string; sessionId: string | null }) {
    const state = await this.ensureState(params.instanceId);
    state.snapshot.activeSessionId = params.sessionId;
    state.snapshot.lastError = undefined;

    if (!params.sessionId) {
      this.emit(params.instanceId);
      return this.getSnapshot(params.instanceId);
    }

    const session = state.snapshot.sessions.find((entry) => entry.id === params.sessionId);
    if (session && !session.isDraft) {
      await this.refreshSessionHistory(params.instanceId, params.sessionId);
    } else {
      this.emit(params.instanceId);
    }

    return this.getSnapshot(params.instanceId);
  }

  async sendMessage(params: {
    instanceId: string;
    sessionId: string;
    content: string;
    model?: string;
  }) {
    const state = await this.ensureState(params.instanceId);
    const session = this.findSession(state, params.sessionId);
    if (!session) {
      throw new Error(`OpenClaw session not found: ${params.sessionId}`);
    }

    const timestamp = this.now();
    const userMessage: OpenClawGatewayMessage = {
      id: createMessageId('msg'),
      role: 'user',
      content: params.content,
      timestamp,
    };

    session.messages = [...session.messages, userMessage];
    session.updatedAt = timestamp;
    session.model = params.model ?? session.model;
    session.title = deriveSessionTitle(session.title, params.content, session.messages.length === 1);
    state.snapshot.activeSessionId = session.id;
    state.snapshot.lastError = undefined;
    this.sortSessions(state.snapshot);
    this.emit(params.instanceId);

    try {
      const runId = this.createRunId();
      const result = await state.client.sendChatMessage({
        sessionKey: session.id,
        message: params.content,
        deliver: false,
        idempotencyKey: runId,
      });
      session.runId = result.runId || runId;
      this.emit(params.instanceId);
      return {
        runId: session.runId,
      };
    } catch (error) {
      state.snapshot.lastError = this.toErrorMessage(error, 'Failed to send OpenClaw message.');
      this.emit(params.instanceId);
      throw error;
    }
  }

  async abortRun(params: { instanceId: string; sessionId: string }) {
    const state = await this.ensureState(params.instanceId);
    const session = this.findSession(state, params.sessionId);
    if (!session) {
      return false;
    }

    try {
      await state.client.abortChatRun({
        sessionKey: params.sessionId,
        runId: session.runId ?? undefined,
      });
      await this.refreshSessionHistory(params.instanceId, params.sessionId);
      return true;
    } catch (error) {
      state.snapshot.lastError = this.toErrorMessage(error, 'Failed to abort OpenClaw response.');
      this.emit(params.instanceId);
      return false;
    }
  }

  async resetSession(params: { instanceId: string; sessionId: string }) {
    const state = await this.ensureState(params.instanceId);
    try {
      await state.client.resetSession({ key: params.sessionId });
      await this.refreshSessionHistory(params.instanceId, params.sessionId);
      return true;
    } catch (error) {
      state.snapshot.lastError = this.toErrorMessage(error, 'Failed to reset OpenClaw session.');
      this.emit(params.instanceId);
      return false;
    }
  }

  async deleteSession(params: { instanceId: string; sessionId: string }) {
    const state = await this.ensureState(params.instanceId);
    try {
      await state.client.deleteSession({
        key: params.sessionId,
        deleteTranscript: true,
      });
      await this.refreshInstance(params.instanceId, {
        preserveActiveSessionId: false,
        reloadActiveHistory: true,
      });
      return true;
    } catch (error) {
      state.snapshot.lastError = this.toErrorMessage(error, 'Failed to delete OpenClaw session.');
      this.emit(params.instanceId);
      return false;
    }
  }

  private async ensureState(instanceId: string) {
    const existing = this.instances.get(instanceId);
    if (existing) {
      return existing;
    }

    const client = await Promise.resolve(this.getClient(instanceId));
    const state: InternalInstanceState = {
      client,
      snapshot: createInitialSnapshot(),
      subscribed: false,
      refreshVersion: 0,
    };
    state.offChat = client.on('chat', (payload: OpenClawGatewayChatEvent) => {
      this.handleChatEvent(instanceId, payload);
    });
    state.offConnection = client.on('connection', (event: OpenClawGatewayConnectionEvent) => {
      if (event.status === 'reconnecting' || event.status === 'disconnected') {
        state.subscribed = false;
      }

      if (event.status === 'connected') {
        state.subscribed = false;
        if (state.snapshot.syncState === 'loading') {
          return;
        }

        void this.refreshInstance(instanceId, {
          preserveActiveSessionId: true,
          reloadActiveHistory: true,
        });
      }
    });
    state.offSessionsChanged = client.on('sessions.changed', () => {
      void this.refreshInstance(instanceId, {
        preserveActiveSessionId: true,
        reloadActiveHistory: true,
      });
    });
    this.instances.set(instanceId, state);
    return state;
  }

  private getOrCreatePlaceholderState(instanceId: string) {
    const existing = this.instances.get(instanceId);
    if (existing) {
      return existing;
    }

    const state: InternalInstanceState = {
      client: {
        connect: async () => ({ type: 'hello-ok', protocol: 3 }),
        disconnect: () => {},
        subscribeSessions: async () => ({ ok: true }),
        listSessions: async () => ({
          ts: this.now(),
          path: '',
          count: 0,
          defaults: {},
          sessions: [],
        }),
        getChatHistory: async () => ({ messages: [], thinkingLevel: null }),
        sendChatMessage: async () => ({ runId: this.createRunId() }),
        abortChatRun: async () => ({ aborted: true }),
        resetSession: async () => ({ ok: true }),
        deleteSession: async () => ({ ok: true }),
        on: () => () => {},
      },
      snapshot: createInitialSnapshot(),
      subscribed: false,
      refreshVersion: 0,
    };
    this.instances.set(instanceId, state);
    return state;
  }

  private async refreshInstance(
    instanceId: string,
    options: {
      preserveActiveSessionId: boolean;
      reloadActiveHistory: boolean;
    },
  ) {
    const state = await this.ensureState(instanceId);
    const refreshVersion = state.refreshVersion + 1;
    state.refreshVersion = refreshVersion;
    state.snapshot.syncState = 'loading';
    state.snapshot.lastError = undefined;
    this.emit(instanceId);

    try {
      await state.client.connect();
      if (!state.subscribed) {
        await state.client.subscribeSessions();
        state.subscribed = true;
      }

      const result = await state.client.listSessions({
        includeGlobal: false,
      });
      if (!this.isLatestRefresh(state, refreshVersion)) {
        return this.getSnapshot(instanceId);
      }

      const existingSessions = new Map(
        state.snapshot.sessions.map((session) => [session.id, session] as const),
      );
      const draftSessions = state.snapshot.sessions.filter(
        (session) => session.isDraft && !result.sessions.some((row) => row.key === session.id),
      );
      const nextSessions = result.sessions.map((row) => {
        const record = row as Record<string, unknown>;
        const existing = existingSessions.get(String(record.key));
        const updatedAt =
          typeof record.updatedAt === 'number' ? record.updatedAt : existing?.updatedAt ?? this.now();
        return {
          id: String(record.key),
          title: buildSessionTitle(record),
          createdAt: existing?.createdAt ?? updatedAt,
          updatedAt,
          messages: existing?.messages ?? [],
          model:
            (typeof record.model === 'string' && record.model) ||
            existing?.model ||
            'OpenClaw Gateway',
          instanceId,
          transport: 'openclawGateway' as const,
          isDraft: existing?.isDraft && !result.sessions.some((entry) => entry.key === record.key)
            ? true
            : undefined,
          runId: existing?.runId ?? null,
          thinkingLevel: existing?.thinkingLevel ?? null,
        } satisfies OpenClawGatewayChatSession;
      });

      state.snapshot.sessions = [...nextSessions, ...draftSessions].map((session) => ({
        ...session,
        instanceId,
        transport: 'openclawGateway',
      }));
      this.sortSessions(state.snapshot);

      const nextActiveSessionId = this.resolveActiveSessionId(
        state.snapshot,
        options.preserveActiveSessionId ? state.snapshot.activeSessionId : null,
      );
      state.snapshot.activeSessionId = nextActiveSessionId;
      state.snapshot.syncState = 'idle';
      state.snapshot.lastError = undefined;

      if (options.reloadActiveHistory && nextActiveSessionId) {
        const activeSession = state.snapshot.sessions.find(
          (session) => session.id === nextActiveSessionId,
        );
        if (activeSession && !activeSession.isDraft) {
          await this.refreshSessionHistory(instanceId, nextActiveSessionId, refreshVersion);
          return this.getSnapshot(instanceId);
        }
      }

      this.emit(instanceId);
      return this.getSnapshot(instanceId);
    } catch (error) {
      state.snapshot.syncState = 'error';
      state.snapshot.lastError = this.toErrorMessage(
        error,
        'Failed to synchronize OpenClaw sessions.',
      );
      this.emit(instanceId);
      return this.getSnapshot(instanceId);
    }
  }

  private async refreshSessionHistory(
    instanceId: string,
    sessionId: string,
    refreshVersion?: number,
  ) {
    const state = await this.ensureState(instanceId);
    try {
      const history = await state.client.getChatHistory({
        sessionKey: sessionId,
        limit: 200,
      });
      if (refreshVersion !== undefined && !this.isLatestRefresh(state, refreshVersion)) {
        return;
      }

      const session = this.findSession(state, sessionId);
      if (!session) {
        return;
      }

      this.applyHistory(session, history);
      state.snapshot.syncState = 'idle';
      state.snapshot.lastError = undefined;
      this.sortSessions(state.snapshot);
      this.emit(instanceId);
    } catch (error) {
      state.snapshot.syncState = 'error';
      state.snapshot.lastError = this.toErrorMessage(
        error,
        'Failed to load OpenClaw history.',
      );
      this.emit(instanceId);
    }
  }

  private applyHistory(session: OpenClawGatewayChatSession, history: OpenClawGatewayChatHistoryResult) {
    const baseTimestamp = this.now();
    session.messages = Array.isArray(history.messages)
      ? history.messages
          .map((message, index) => normalizeMessage(message, baseTimestamp + index, 'history'))
          .filter((message): message is OpenClawGatewayMessage => message !== null)
      : [];
    session.thinkingLevel = history.thinkingLevel ?? null;
    session.runId = null;
    session.isDraft = false;
    session.updatedAt =
      session.messages.at(-1)?.timestamp ?? session.updatedAt ?? baseTimestamp;
    if (session.messages.length > 0) {
      const firstUserMessage = session.messages.find((message) => message.role === 'user');
      if (firstUserMessage) {
        session.title = deriveSessionTitle(session.title, firstUserMessage.content, true);
      }
    }
  }

  private handleChatEvent(instanceId: string, payload: OpenClawGatewayChatEvent) {
    const state = this.instances.get(instanceId);
    if (!state || !payload?.sessionKey) {
      return;
    }

    const session = this.findSession(state, payload.sessionKey);
    if (!session) {
      return;
    }

    const timestamp = this.now();
    const content = extractMessageText(payload.message);
    const lastMessage = session.messages.at(-1);

    if (payload.state === 'delta') {
      if (!content) {
        return;
      }

      if (
        lastMessage &&
        lastMessage.role === 'assistant' &&
        lastMessage.runId === payload.runId
      ) {
        lastMessage.content = content;
        lastMessage.timestamp = timestamp;
      } else {
        session.messages = [
          ...session.messages,
          {
            id: createMessageId('assistant'),
            role: 'assistant',
            content,
            timestamp,
            runId: payload.runId,
          },
        ];
      }
      session.runId = payload.runId ?? session.runId ?? null;
      session.updatedAt = timestamp;
      session.isDraft = false;
      this.sortSessions(state.snapshot);
      this.emit(instanceId);
      return;
    }

    if (payload.state === 'final' || payload.state === 'aborted') {
      if (
        content &&
        lastMessage &&
        lastMessage.role === 'assistant' &&
        lastMessage.runId === payload.runId
      ) {
        lastMessage.content = content;
        lastMessage.timestamp = timestamp;
      } else if (content) {
        session.messages = [
          ...session.messages,
          {
            id: createMessageId('assistant'),
            role: 'assistant',
            content,
            timestamp,
            runId: payload.runId,
          },
        ];
      }
      session.runId = null;
      session.isDraft = false;
      session.updatedAt = timestamp;
      this.sortSessions(state.snapshot);
      this.emit(instanceId);
      void this.refreshSessionHistory(instanceId, session.id);
      return;
    }

    if (payload.state === 'error') {
      session.runId = null;
      state.snapshot.lastError = payload.errorMessage ?? 'OpenClaw chat error.';
      this.emit(instanceId);
    }
  }

  private resolveActiveSessionId(
    snapshot: OpenClawGatewayInstanceSnapshot,
    preservedSessionId: string | null,
  ) {
    if (preservedSessionId && snapshot.sessions.some((session) => session.id === preservedSessionId)) {
      return preservedSessionId;
    }

    return snapshot.sessions[0]?.id ?? null;
  }

  private findSession(state: InternalInstanceState, sessionId: string) {
    return state.snapshot.sessions.find((session) => session.id === sessionId);
  }

  private isLatestRefresh(state: InternalInstanceState, refreshVersion: number) {
    return state.refreshVersion === refreshVersion;
  }

  private sortSessions(snapshot: OpenClawGatewayInstanceSnapshot) {
    snapshot.sessions.sort((left, right) => right.updatedAt - left.updatedAt);
  }

  private emit(instanceId: string) {
    const snapshot = this.getSnapshot(instanceId);
    for (const listener of this.listeners) {
      listener(instanceId, snapshot);
    }
  }

  private toErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim()) {
      return error;
    }

    return fallback;
  }
}
