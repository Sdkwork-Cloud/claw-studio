import { create } from 'zustand';
import { studio } from '@sdkwork/claw-infrastructure';
import type { StudioConversationAttachment } from '@sdkwork/claw-types';
import {
  deriveUserMessageTitle,
  getSharedOpenClawGatewayClient,
  resolveInstanceChatRoute,
  type InstanceChatRouteMode,
} from '../services/store/index.ts';
import { connectGatewayInstancesBestEffort } from './connectGatewayInstances.ts';
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
  attachments?: StudioConversationAttachment[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  model: string;
  defaultModel?: string | null;
  instanceId?: string;
  transport?: 'local' | 'openclawGateway';
  isDraft?: boolean;
  runId?: string | null;
  thinkingLevel?: string | null;
  source?: 'studio' | 'openclaw';
  messagesHydrated?: boolean;
  lastMessagePreview?: string;
}

type ScopeMap<T> = Record<string, T>;

export interface ChatState {
  sessions: ChatSession[];
  activeSessionIdByInstance: ScopeMap<string | null>;
  syncStateByInstance: ScopeMap<SyncState>;
  lastErrorByInstance: ScopeMap<string | undefined>;
  instanceRouteModeById: Record<string, InstanceChatRouteMode | undefined>;
  hydrateInstance: (instanceId: string | null | undefined) => Promise<void>;
  connectGatewayInstances: (instanceIds: string[]) => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  createSession: (model?: string, instanceId?: string) => Promise<string>;
  deleteSession: (id: string, instanceId?: string) => Promise<void>;
  setActiveSession: (id: string | null, instanceId?: string) => Promise<void>;
  addMessage: (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (sessionId: string, messageId: string, content: string) => void;
  clearSession: (id: string, instanceId?: string) => Promise<void>;
  flushSession: (id: string) => Promise<void>;
  setGatewaySessionModel: (params: {
    instanceId: string;
    sessionId: string;
    model: string | null;
  }) => Promise<void>;
  sendGatewayMessage: (params: {
    instanceId: string;
    sessionId: string;
    content: string;
    model?: string;
    attachments?: StudioConversationAttachment[];
    requestText?: string;
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

function createSessionId(instanceId?: string) {
  if (instanceId) {
    return `thread:claw-studio:${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  return createId('session');
}

function normalizeMessages(messages: Message[] | undefined) {
  return Array.isArray(messages) ? messages : [];
}

function cloneAttachments(
  attachments: StudioConversationAttachment[] | undefined,
) {
  return attachments?.map((attachment) => ({ ...attachment }));
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
  return gateway.putInstanceConversation(normalizeSession(session));
}

function upsertSessionCollection(sessions: ChatSession[], nextSession: ChatSession) {
  return sortSessions([
    normalizeSession(nextSession),
    ...sessions
      .filter((session) => session.id !== nextSession.id)
      .map(normalizeSession),
  ]);
}

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

const openClawGatewaySessions = new OpenClawGatewaySessionStore({
  getClient: getSharedOpenClawGatewayClient,
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
  async connectGatewayInstances(instanceIds) {
    await connectGatewayInstancesBestEffort({
      instanceIds,
      async resolveRouteMode(instanceId) {
        return (await resolveInstanceRouteMode(instanceId)).mode;
      },
      async hydrateGatewayInstance(instanceId) {
        await openClawGatewaySessions.hydrateInstance(instanceId);
      },
      setRouteMode(instanceId, mode) {
        set((state) => ({
          instanceRouteModeById: {
            ...state.instanceRouteModeById,
            [instanceId]: mode,
          },
          lastErrorByInstance: {
            ...state.lastErrorByInstance,
            [getScopeKey(instanceId)]: undefined,
          },
          syncStateByInstance:
            mode === 'instanceOpenClawGatewayWs'
              ? state.syncStateByInstance
              : {
                  ...state.syncStateByInstance,
                  [getScopeKey(instanceId)]: 'idle',
                },
        }));
      },
      onError(instanceId, error) {
        console.error('Failed to preconnect OpenClaw gateway instance:', error);
        set((state) => ({
          syncStateByInstance: {
            ...state.syncStateByInstance,
            [getScopeKey(instanceId)]: 'error',
          },
          lastErrorByInstance: {
            ...state.lastErrorByInstance,
            [getScopeKey(instanceId)]:
              error instanceof Error
                ? error.message
                : 'Failed to preconnect OpenClaw gateway instance.',
          },
        }));
      },
    });
  },
  async loadSession(id) {
    const session = get().sessions.find((item) => item.id === id);
    if (!session?.instanceId) {
      return;
    }

    const scopeKey = getScopeKey(session.instanceId);
    if (session.messagesHydrated && session.messages.length > 0) {
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
      const gateway = await getStudioConversationGateway();
      const hydrated = await gateway.getInstanceConversation(
        session.instanceId,
        session.id,
        normalizeSession(session),
      );

      set((state) => ({
        sessions: upsertSessionCollection(state.sessions, hydrated),
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
      console.error('Failed to load conversation:', error);
      set((state) => ({
        syncStateByInstance: {
          ...state.syncStateByInstance,
          [scopeKey]: 'error',
        },
        lastErrorByInstance: {
          ...state.lastErrorByInstance,
          [scopeKey]: error?.message || 'Failed to load conversation',
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
        return openClawGatewaySessions.createDraftSession(instanceId, model).id;
      }
    }

    const timestamp = Date.now();
    const session: ChatSession = {
      id: createSessionId(instanceId),
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

    void persistSession(session)
      .then((savedSession) => {
        if (!savedSession) {
          return;
        }
        set((state) => ({
          sessions: upsertSessionCollection(state.sessions, savedSession),
          lastErrorByInstance: {
            ...state.lastErrorByInstance,
            [getScopeKey(instanceId)]: undefined,
          },
        }));
      })
      .catch((error: any) => {
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
      .then((gateway) => gateway.deleteInstanceConversation(id, session.instanceId))
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
          attachments: cloneAttachments(message.attachments),
        };
        const derivedTitle = deriveUserMessageTitle({
          text: message.content,
          attachments: message.attachments ?? [],
        });
        const nextTitle =
          currentMessages.length === 0 && message.role === 'user'
            ? `${derivedTitle.slice(0, 80)}${derivedTitle.length > 80 ? '...' : ''}`
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

    void persistSession(nextSession)
      .then((savedSession) => {
        if (!savedSession) {
          return;
        }
        set((state) => ({
          sessions: upsertSessionCollection(state.sessions, savedSession),
          lastErrorByInstance: {
            ...state.lastErrorByInstance,
            [getScopeKey(nextSession.instanceId)]: undefined,
          },
        }));
      })
      .catch((error: any) => {
        console.error('Failed to persist message:', error);
        set((state) => ({
          lastErrorByInstance: {
            ...state.lastErrorByInstance,
            [getScopeKey(nextSession.instanceId)]: error?.message || 'Failed to persist conversation',
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
    let targetSession: ChatSession | undefined;
    let cleared: ChatSession | undefined;

    set((state) => ({
      sessions: state.sessions.map((currentSession) => {
        if (currentSession.id !== id) {
          return normalizeSession(currentSession);
        }

        targetSession = normalizeSession(currentSession);
        cleared = {
          ...normalizeSession(currentSession),
          messages: [],
          updatedAt: Date.now(),
          lastMessagePreview: undefined,
        };
        return cleared;
      }),
    }));

    if (!cleared) {
      return;
    }

    const scopeKey = getScopeKey(resolvedInstanceId);

    if (targetSession?.source === 'openclaw') {
      void getStudioConversationGateway()
        .then((gateway) => gateway.resetInstanceConversation(cleared!))
        .then((savedSession) => {
          set((state) => ({
            sessions: upsertSessionCollection(state.sessions, savedSession),
            lastErrorByInstance: {
              ...state.lastErrorByInstance,
              [scopeKey]: undefined,
            },
          }));
        })
        .catch((error: any) => {
          console.error('Failed to clear conversation:', error);
          set((state) => ({
            lastErrorByInstance: {
              ...state.lastErrorByInstance,
              [scopeKey]: error?.message || 'Failed to persist conversation',
            },
          }));
        });
      return;
    }

    void persistSession(cleared)
      .then((savedSession) => {
        if (!savedSession) {
          return;
        }
        set((state) => ({
          sessions: upsertSessionCollection(state.sessions, savedSession),
          lastErrorByInstance: {
            ...state.lastErrorByInstance,
            [scopeKey]: undefined,
          },
        }));
      })
      .catch((error: any) => {
        console.error('Failed to clear conversation:', error);
        set((state) => ({
          lastErrorByInstance: {
            ...state.lastErrorByInstance,
            [scopeKey]: error?.message || 'Failed to persist conversation',
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
      const savedSession = await persistSession(session);
      if (savedSession) {
        set((state) => ({
          sessions: upsertSessionCollection(state.sessions, savedSession),
        }));
      }

      if (savedSession?.instanceId) {
        const gateway = await getStudioConversationGateway();
        const hydrated = await gateway.getInstanceConversation(
          savedSession.instanceId,
          savedSession.id,
          savedSession,
        );

        set((state) => ({
          sessions: upsertSessionCollection(state.sessions, hydrated),
          syncStateByInstance: {
            ...state.syncStateByInstance,
            [scopeKey]: 'idle',
          },
          lastErrorByInstance: {
            ...state.lastErrorByInstance,
            [scopeKey]: undefined,
          },
        }));
        return;
      }

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
  async setGatewaySessionModel(params) {
    await openClawGatewaySessions.setSessionModel(params);
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
