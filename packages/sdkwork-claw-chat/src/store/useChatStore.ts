import { create } from 'zustand';
import { studio } from '@sdkwork/claw-infrastructure';
import {
  OpenClawGatewayClient,
  resolveInstanceChatRoute,
  type InstanceChatRouteMode,
} from '../services/store/index.ts';
import { resolveOpenClawCreateSessionTarget } from '../services/chatSessionBootstrap.ts';
import { OpenClawGatewaySessionStore } from './openClawGatewaySessionStore.ts';

export type Role = 'user' | 'assistant' | 'system';
export type SyncState = 'idle' | 'loading' | 'error';

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  model?: string;
  runId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  model: string;
  instanceId?: string;
  transport?: 'local' | 'openclawGateway';
  isDraft?: boolean;
  runId?: string | null;
  thinkingLevel?: string | null;
}

type ScopeMap<T> = Record<string, T>;

export interface ChatState {
  sessions: ChatSession[];
  activeSessionIdByInstance: ScopeMap<string | null>;
  syncStateByInstance: ScopeMap<SyncState>;
  lastErrorByInstance: ScopeMap<string | undefined>;
  instanceRouteModeById: Record<string, InstanceChatRouteMode | undefined>;
  hydrateInstance: (instanceId: string | null | undefined) => Promise<void>;
  createSession: (model?: string, instanceId?: string) => Promise<string>;
  deleteSession: (id: string, instanceId?: string) => Promise<void>;
  setActiveSession: (id: string | null, instanceId?: string) => Promise<void>;
  addMessage: (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (sessionId: string, messageId: string, content: string) => void;
  clearSession: (id: string, instanceId?: string) => Promise<void>;
  flushSession: (id: string) => Promise<void>;
  sendGatewayMessage: (params: {
    instanceId: string;
    sessionId: string;
    content: string;
    model?: string;
  }) => Promise<{ runId: string }>;
  abortSession: (params: { instanceId: string; sessionId: string }) => Promise<boolean>;
}

const DEFAULT_MODEL = 'Llama-3-8B-Instruct';
const DEFAULT_TITLE = 'New Conversation';
const DIRECT_SCOPE_KEY = '__direct__';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getScopeKey(instanceId: string | null | undefined) {
  return instanceId ?? DIRECT_SCOPE_KEY;
}

function normalizeMessages(messages: Message[] | undefined) {
  return Array.isArray(messages) ? messages : [];
}

function normalizeSession(session: ChatSession): ChatSession {
  return {
    ...session,
    transport: session.transport ?? 'local',
    messages: normalizeMessages(session.messages),
  };
}

function sortSessions(sessions: ChatSession[]) {
  return sessions.sort((left, right) => right.updatedAt - left.updatedAt);
}

function listScopeSessions(sessions: ChatSession[], instanceId: string | null | undefined) {
  return sessions.filter((session) =>
    instanceId ? session.instanceId === instanceId : !session.instanceId,
  );
}

function replaceInstanceSessions(
  sessions: ChatSession[],
  instanceId: string | null | undefined,
  nextSessions: ChatSession[],
) {
  return [
    ...sessions.filter((session) =>
      instanceId ? session.instanceId !== instanceId : Boolean(session.instanceId),
    ),
    ...nextSessions.map(normalizeSession),
  ].sort((left, right) => right.updatedAt - left.updatedAt);
}

async function getStudioConversationGateway() {
  return import('./studioConversationGateway.ts');
}

async function persistSession(session: ChatSession) {
  if (session.transport === 'openclawGateway') {
    return;
  }

  const gateway = await getStudioConversationGateway();
  await gateway.putInstanceConversation(normalizeSession(session));
}

type CachedOpenClawClientEntry = {
  client: OpenClawGatewayClient;
  authToken: string | null;
  websocketUrl: string;
};

const openClawClientByInstance = new Map<string, CachedOpenClawClientEntry>();

async function resolveInstanceRouteMode(instanceId: string | null | undefined) {
  if (!instanceId) {
    return { mode: 'directLlm' as const, instance: null };
  }

  const instance = await studio.getInstance(instanceId);
  return {
    mode: resolveInstanceChatRoute(instance).mode,
    instance,
  };
}

async function getOpenClawGatewayClient(instanceId: string) {
  const instance = await studio.getInstance(instanceId);
  const route = resolveInstanceChatRoute(instance);
  if (route.mode !== 'instanceOpenClawGatewayWs' || !route.websocketUrl) {
    throw new Error('The selected instance is not backed by an OpenClaw Gateway WebSocket.');
  }

  const authToken = instance.config.authToken ?? null;
  const cached = openClawClientByInstance.get(instanceId);
  if (
    cached &&
    cached.websocketUrl === route.websocketUrl &&
    cached.authToken === authToken
  ) {
    return cached.client;
  }

  cached?.client.disconnect();
  const client = new OpenClawGatewayClient({
    url: route.websocketUrl,
    authToken,
    instanceId,
  });

  openClawClientByInstance.set(instanceId, {
    client,
    authToken,
    websocketUrl: route.websocketUrl,
  });
  return client;
}

const openClawGatewaySessions = new OpenClawGatewaySessionStore({
  getClient: getOpenClawGatewayClient,
  createSessionKey(instanceId) {
    return `claw-studio:${instanceId}:${createId('session')}`;
  },
});

function applyOpenClawSnapshot(
  state: ChatState,
  instanceId: string,
  snapshot: ReturnType<typeof openClawGatewaySessions.getSnapshot>,
) {
  const scopeKey = getScopeKey(instanceId);
  return {
    sessions: replaceInstanceSessions(state.sessions, instanceId, snapshot.sessions as ChatSession[]),
    activeSessionIdByInstance: {
      ...state.activeSessionIdByInstance,
      [scopeKey]: snapshot.activeSessionId,
    },
    syncStateByInstance: {
      ...state.syncStateByInstance,
      [scopeKey]: snapshot.syncState,
    },
    lastErrorByInstance: {
      ...state.lastErrorByInstance,
      [scopeKey]: snapshot.lastError,
    },
  } satisfies Partial<ChatState>;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  sessions: [],
  activeSessionIdByInstance: {},
  syncStateByInstance: {},
  lastErrorByInstance: {},
  instanceRouteModeById: {},
  async hydrateInstance(instanceId) {
    const scopeKey = getScopeKey(instanceId);

    if (!instanceId) {
      set((state) => ({
        activeSessionIdByInstance: {
          ...state.activeSessionIdByInstance,
          [scopeKey]: null,
        },
        syncStateByInstance: {
          ...state.syncStateByInstance,
          [scopeKey]: 'idle',
        },
      }));
      return;
    }

    set((state) => ({
      syncStateByInstance: {
        ...state.syncStateByInstance,
        [scopeKey]: 'loading',
      },
      lastErrorByInstance: {
        ...state.lastErrorByInstance,
        [scopeKey]: undefined,
      },
    }));

    try {
      const instance = await studio.getInstance(instanceId);
      const route = resolveInstanceChatRoute(instance);
      set((state) => ({
        instanceRouteModeById: {
          ...state.instanceRouteModeById,
          [instanceId]: route.mode,
        },
      }));

      if (route.mode === 'instanceOpenClawGatewayWs') {
        await openClawGatewaySessions.hydrateInstance(instanceId);
        return;
      }

      const gateway = await getStudioConversationGateway();
      const sessions = await gateway.listInstanceConversations(instanceId);
      set((state) => {
        const nextSessions = replaceInstanceSessions(state.sessions, instanceId, sessions);
        const nextScopeSessions = listScopeSessions(nextSessions, instanceId);
        const currentActiveSessionId =
          state.activeSessionIdByInstance[getScopeKey(instanceId)] ?? null;
        const nextActiveSessionId = nextScopeSessions.some(
          (session) => session.id === currentActiveSessionId,
        )
          ? currentActiveSessionId
          : nextScopeSessions[0]?.id ?? null;

        return {
          sessions: nextSessions,
          activeSessionIdByInstance: {
            ...state.activeSessionIdByInstance,
            [getScopeKey(instanceId)]: nextActiveSessionId,
          },
          syncStateByInstance: {
            ...state.syncStateByInstance,
            [getScopeKey(instanceId)]: 'idle',
          },
          lastErrorByInstance: {
            ...state.lastErrorByInstance,
            [getScopeKey(instanceId)]: undefined,
          },
        };
      });
    } catch (error: any) {
      console.error('Failed to hydrate conversations:', error);
      set((state) => ({
        syncStateByInstance: {
          ...state.syncStateByInstance,
          [scopeKey]: 'error',
        },
        lastErrorByInstance: {
          ...state.lastErrorByInstance,
          [scopeKey]: error?.message || 'Failed to hydrate conversations',
        },
      }));
    }
  },
  async createSession(model = DEFAULT_MODEL, instanceId) {
    if (instanceId) {
      const routeMode =
        get().instanceRouteModeById[instanceId] ??
        (await resolveInstanceRouteMode(instanceId)).mode;
      set((state) => ({
        instanceRouteModeById: {
          ...state.instanceRouteModeById,
          [instanceId]: routeMode,
        },
      }));

      if (routeMode === 'instanceOpenClawGatewayWs') {
        await openClawGatewaySessions.hydrateInstance(instanceId);
        const snapshot = openClawGatewaySessions.getSnapshot(instanceId);
        const target = resolveOpenClawCreateSessionTarget(snapshot);
        if (target.type === 'reuse') {
          await openClawGatewaySessions.setActiveSession({
            instanceId,
            sessionId: target.sessionId,
          });
          return target.sessionId;
        }

        return openClawGatewaySessions.createDraftSession(instanceId, model).id;
      }
    }

    const timestamp = Date.now();
    const session: ChatSession = {
      id: createId('session'),
      title: DEFAULT_TITLE,
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [],
      model,
      instanceId,
      transport: 'local',
    };

    set((state) => ({
      sessions: sortSessions([session, ...state.sessions.map(normalizeSession)]),
      activeSessionIdByInstance: {
        ...state.activeSessionIdByInstance,
        [getScopeKey(instanceId)]: session.id,
      },
      lastErrorByInstance: {
        ...state.lastErrorByInstance,
        [getScopeKey(instanceId)]: undefined,
      },
    }));

    void persistSession(session).catch((error: any) => {
      console.error('Failed to persist session:', error);
      set((state) => ({
        lastErrorByInstance: {
          ...state.lastErrorByInstance,
          [getScopeKey(instanceId)]: error?.message || 'Failed to persist conversation',
        },
      }));
    });

    return session.id;
  },
  async deleteSession(id, instanceId) {
    const session = get().sessions.find((item) => item.id === id);
    const resolvedInstanceId = instanceId ?? session?.instanceId;
    if (session?.transport === 'openclawGateway' && resolvedInstanceId) {
      await openClawGatewaySessions.deleteSession({
        instanceId: resolvedInstanceId,
        sessionId: id,
      });
      return;
    }

    const scopeKey = getScopeKey(resolvedInstanceId);
    set((state) => {
      const nextSessions = state.sessions.filter((item) => item.id !== id);
      const nextScopeSessions = listScopeSessions(nextSessions, resolvedInstanceId);
      const currentActiveSessionId = state.activeSessionIdByInstance[scopeKey] ?? null;

      return {
        sessions: nextSessions,
        activeSessionIdByInstance: {
          ...state.activeSessionIdByInstance,
          [scopeKey]:
            currentActiveSessionId === id ? nextScopeSessions[0]?.id ?? null : currentActiveSessionId,
        },
      };
    });

    if (!session) {
      return;
    }

    void getStudioConversationGateway()
      .then((gateway) => gateway.deleteInstanceConversation(id))
      .catch((error: any) => {
        console.error('Failed to delete conversation:', error);
        set((state) => ({
          lastErrorByInstance: {
            ...state.lastErrorByInstance,
            [scopeKey]: error?.message || 'Failed to delete conversation',
          },
        }));
      });
  },
  async setActiveSession(id, instanceId) {
    const resolvedInstanceId =
      instanceId ?? get().sessions.find((session) => session.id === id)?.instanceId ?? null;
    if (
      resolvedInstanceId &&
      get().instanceRouteModeById[resolvedInstanceId] === 'instanceOpenClawGatewayWs'
    ) {
      await openClawGatewaySessions.setActiveSession({
        instanceId: resolvedInstanceId,
        sessionId: id,
      });
      return;
    }

    set((state) => ({
      activeSessionIdByInstance: {
        ...state.activeSessionIdByInstance,
        [getScopeKey(resolvedInstanceId)]: id,
      },
    }));
  },
  addMessage(sessionId, message) {
    let nextSession: ChatSession | undefined;

    set((state) => {
      const timestamp = Date.now();
      const sessions = state.sessions.map((session) => {
        if (session.id !== sessionId) {
          return normalizeSession(session);
        }

        if (session.transport === 'openclawGateway') {
          return normalizeSession(session);
        }

        const currentMessages = normalizeMessages(session.messages);
        const nextMessage: Message = {
          ...message,
          id: createId('msg'),
          timestamp,
        };
        const nextTitle =
          currentMessages.length === 0 && message.role === 'user'
            ? `${message.content.slice(0, 40)}${message.content.length > 40 ? '...' : ''}`
            : session.title;

        nextSession = {
          ...normalizeSession(session),
          title: nextTitle,
          updatedAt: timestamp,
          messages: [...currentMessages, nextMessage],
        };

        return nextSession;
      });

      return {
        sessions: sortSessions(sessions),
      };
    });

    if (!nextSession) {
      return;
    }

    void persistSession(nextSession).catch((error: any) => {
      console.error('Failed to persist message:', error);
      set((state) => ({
        lastErrorByInstance: {
          ...state.lastErrorByInstance,
          [getScopeKey(nextSession?.instanceId)]: error?.message || 'Failed to persist conversation',
        },
      }));
    });
  },
  updateMessage(sessionId, messageId, content) {
    set((state) => {
      const timestamp = Date.now();
      const sessions = state.sessions.map((session) =>
        session.id === sessionId && session.transport !== 'openclawGateway'
          ? {
              ...normalizeSession(session),
              updatedAt: timestamp,
              messages: normalizeMessages(session.messages).map((message) =>
                message.id === messageId ? { ...message, content, timestamp } : message,
              ),
            }
          : normalizeSession(session),
      );

      return {
        sessions: sortSessions(sessions),
      };
    });
  },
  async clearSession(id, instanceId) {
    const session = get().sessions.find((item) => item.id === id);
    const resolvedInstanceId = instanceId ?? session?.instanceId;
    if (session?.transport === 'openclawGateway' && resolvedInstanceId) {
      await openClawGatewaySessions.resetSession({
        instanceId: resolvedInstanceId,
        sessionId: id,
      });
      return;
    }

    let cleared: ChatSession | undefined;

    set((state) => ({
      sessions: state.sessions.map((currentSession) => {
        if (currentSession.id !== id) {
          return normalizeSession(currentSession);
        }

        cleared = {
          ...normalizeSession(currentSession),
          messages: [],
          updatedAt: Date.now(),
        };
        return cleared;
      }),
    }));

    if (!cleared) {
      return;
    }

    void persistSession(cleared).catch((error: any) => {
      console.error('Failed to clear conversation:', error);
      set((state) => ({
        lastErrorByInstance: {
          ...state.lastErrorByInstance,
          [getScopeKey(resolvedInstanceId)]: error?.message || 'Failed to persist conversation',
        },
      }));
    });
  },
  async flushSession(id) {
    const session = get().sessions.find((item) => item.id === id);
    if (!session || session.transport === 'openclawGateway') {
      return;
    }

    const scopeKey = getScopeKey(session.instanceId);

    try {
      await persistSession(session);
      set((state) => ({
        syncStateByInstance: {
          ...state.syncStateByInstance,
          [scopeKey]: 'idle',
        },
        lastErrorByInstance: {
          ...state.lastErrorByInstance,
          [scopeKey]: undefined,
        },
      }));
    } catch (error: any) {
      console.error('Failed to flush conversation:', error);
      set((state) => ({
        syncStateByInstance: {
          ...state.syncStateByInstance,
          [scopeKey]: 'error',
        },
        lastErrorByInstance: {
          ...state.lastErrorByInstance,
          [scopeKey]: error?.message || 'Failed to flush conversation',
        },
      }));
    }
  },
  async sendGatewayMessage(params) {
    return openClawGatewaySessions.sendMessage(params);
  },
  async abortSession(params) {
    return openClawGatewaySessions.abortRun(params);
  },
}));

openClawGatewaySessions.subscribe((instanceId, snapshot) => {
  useChatStore.setState((state) => applyOpenClawSnapshot(state, instanceId, snapshot));
});
