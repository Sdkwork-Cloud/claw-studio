import { createSimpleStore } from '@sdkwork/claw-core';
import type { StudioConversationAttachment } from '@sdkwork/claw-types';
import {
  buildOpenClawThreadSessionKey,
  DEFAULT_CHAT_SESSION_TITLE,
  getSharedOpenClawGatewayClient,
  openClawGatewayHistoryConfigService,
  type OpenClawToolCard,
  resolveAuthoritativeInstanceChatRoute,
  resolveInitialChatSessionTitle,
  type InstanceChatRouteMode,
} from '../services/store/index.ts';
import { connectGatewayInstancesBestEffort } from './connectGatewayInstances.ts';
import { OpenClawGatewaySessionStore } from './openClawGatewaySessionStore.ts';

export type Role = 'user' | 'assistant' | 'system' | 'tool';
export type SyncState = 'idle' | 'loading' | 'error';
export type GatewayConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  senderLabel?: string | null;
  model?: string;
  runId?: string;
  attachments?: StudioConversationAttachment[];
  reasoning?: string | null;
  toolCards?: OpenClawToolCard[];
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
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
  lastMessagePreview?: string;
  historyState?: 'idle' | 'loading' | 'ready' | 'error';
  sessionKind?: string | null;
}

type ScopeMap<T> = Record<string, T>;

export interface ChatState {
  sessions: ChatSession[];
  activeSessionIdByInstance: ScopeMap<string | null>;
  syncStateByInstance: ScopeMap<SyncState>;
  gatewayConnectionStatusByInstance: ScopeMap<GatewayConnectionStatus | undefined>;
  lastErrorByInstance: ScopeMap<string | undefined>;
  instanceRouteModeById: Record<string, InstanceChatRouteMode | undefined>;
  hydrateInstance: (instanceId: string | null | undefined) => Promise<void>;
  connectGatewayInstances: (instanceIds: string[]) => Promise<void>;
  createSession: (
    model?: string,
    instanceId?: string,
    options?: {
      openClawAgentId?: string | null;
      openClawSessionId?: string | null;
    },
  ) => Promise<string>;
  startNewSession: (
    model?: string,
    instanceId?: string,
    options?: {
      openClawAgentId?: string | null;
    },
  ) => Promise<string | null>;
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
  setGatewaySessionThinkingLevel: (params: {
    instanceId: string;
    sessionId: string;
    thinkingLevel: string | null;
  }) => Promise<void>;
  setGatewaySessionFastMode: (params: {
    instanceId: string;
    sessionId: string;
    fastMode: boolean | null;
  }) => Promise<void>;
  setGatewaySessionVerboseLevel: (params: {
    instanceId: string;
    sessionId: string;
    verboseLevel: string | null;
  }) => Promise<void>;
  setGatewaySessionReasoningLevel: (params: {
    instanceId: string;
    sessionId: string;
    reasoningLevel: string | null;
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
const DEFAULT_TITLE = DEFAULT_CHAT_SESSION_TITLE;
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

function listScopeLocalSessions(sessions: ChatSession[], instanceId: string | null | undefined) {
  return listScopeSessions(sessions, instanceId)
    .map(normalizeSession)
    .filter((session) => session.transport !== 'openclawGateway');
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

function clearChatInstanceScopeState(
  state: ChatState,
  instanceId: string,
  options: {
    syncState?: SyncState;
    lastError?: string | undefined;
  } = {},
) {
  const scopeKey = getScopeKey(instanceId);

  return {
    sessions: replaceInstanceSessions(state.sessions, instanceId, []),
    activeSessionIdByInstance: {
      ...state.activeSessionIdByInstance,
      [scopeKey]: null,
    },
    syncStateByInstance: {
      ...state.syncStateByInstance,
      [scopeKey]: options.syncState ?? 'idle',
    },
    gatewayConnectionStatusByInstance: {
      ...state.gatewayConnectionStatusByInstance,
      [scopeKey]: undefined,
    },
    lastErrorByInstance: {
      ...state.lastErrorByInstance,
      [scopeKey]: options.lastError,
    },
  } satisfies Partial<ChatState>;
}

function buildUnsupportedChatRouteError(reason?: string) {
  return reason
    ? `This instance does not expose a supported chat route yet. ${reason}`
    : 'This instance does not expose a supported chat route yet.';
}

function resolveScopeActiveSessionId(params: {
  sessions: ChatSession[];
  preferredActiveSessionId?: string | null;
  fallbackActiveSessionId?: string | null;
}) {
  const preferredActiveSessionId = params.preferredActiveSessionId ?? null;
  if (
    preferredActiveSessionId &&
    params.sessions.some((session) => session.id === preferredActiveSessionId)
  ) {
    return preferredActiveSessionId;
  }

  const fallbackActiveSessionId = params.fallbackActiveSessionId ?? null;
  if (
    fallbackActiveSessionId &&
    params.sessions.some((session) => session.id === fallbackActiveSessionId)
  ) {
    return fallbackActiveSessionId;
  }

  return params.sessions[0]?.id ?? null;
}

function applyLocalInstanceScopeState(
  state: ChatState,
  instanceId: string,
  options: {
    baseSessions?: ChatSession[];
    preservedLocalSessions?: ChatSession[];
    preferredActiveSessionId?: string | null;
    lastError?: string | undefined;
    syncState?: SyncState;
  } = {},
) {
  const scopeKey = getScopeKey(instanceId);
  const baseSessions = options.baseSessions ?? state.sessions;
  const preservedLocalSessions =
    options.preservedLocalSessions ?? listScopeLocalSessions(baseSessions, instanceId);

  return {
    sessions: replaceInstanceSessions(baseSessions, instanceId, preservedLocalSessions),
    activeSessionIdByInstance: {
      ...state.activeSessionIdByInstance,
      [scopeKey]: resolveScopeActiveSessionId({
        sessions: preservedLocalSessions,
        preferredActiveSessionId: options.preferredActiveSessionId,
        fallbackActiveSessionId: state.activeSessionIdByInstance[scopeKey] ?? null,
      }),
    },
    syncStateByInstance: {
      ...state.syncStateByInstance,
      [scopeKey]: options.syncState ?? 'idle',
    },
    gatewayConnectionStatusByInstance: {
      ...state.gatewayConnectionStatusByInstance,
      [scopeKey]: undefined,
    },
    lastErrorByInstance: {
      ...state.lastErrorByInstance,
      [scopeKey]: options.lastError,
    },
  } satisfies Partial<ChatState>;
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
  const { instance, route } = await resolveAuthoritativeInstanceChatRoute(instanceId);
  return {
    mode: route.mode,
    reason: route.reason,
    instance,
  };
}

const openClawGatewaySessions = new OpenClawGatewaySessionStore({
  getClient: getSharedOpenClawGatewayClient,
  createSessionKey(_instanceId, agentId) {
    return buildOpenClawThreadSessionKey(agentId, `claw-studio:${createId('session')}`);
  },
  resolveHistoryMaxChars(instanceId) {
    return openClawGatewayHistoryConfigService.getHistoryMaxChars(instanceId);
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
    gatewayConnectionStatusByInstance: {
      ...state.gatewayConnectionStatusByInstance,
      [scopeKey]: snapshot.connectionStatus,
    },
    lastErrorByInstance: {
      ...state.lastErrorByInstance,
      [scopeKey]: snapshot.lastError,
    },
  } satisfies Partial<ChatState>;
}

export const chatStore = createSimpleStore<ChatState>((set, get) => ({
  sessions: [],
  activeSessionIdByInstance: {},
  syncStateByInstance: {},
  gatewayConnectionStatusByInstance: {},
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
        gatewayConnectionStatusByInstance: {
          ...state.gatewayConnectionStatusByInstance,
          [scopeKey]: undefined,
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
      const { route } = await resolveAuthoritativeInstanceChatRoute(instanceId);
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

      if (route.mode === 'unsupported') {
        openClawGatewaySessions.releaseInstance(instanceId);
        set((state) => clearChatInstanceScopeState(state, instanceId));
        return;
      }

      openClawGatewaySessions.releaseInstance(instanceId);

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
          gatewayConnectionStatusByInstance: {
            ...state.gatewayConnectionStatusByInstance,
            [getScopeKey(instanceId)]: undefined,
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
      releaseGatewayInstance(instanceId) {
        openClawGatewaySessions.releaseInstance(instanceId);
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
          gatewayConnectionStatusByInstance:
            mode === 'instanceOpenClawGatewayWs'
              ? state.gatewayConnectionStatusByInstance
              : {
                  ...state.gatewayConnectionStatusByInstance,
                  [getScopeKey(instanceId)]: undefined,
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
  async createSession(model, instanceId, options) {
    const requestedModel = model?.trim() || undefined;
    if (instanceId) {
      const resolvedRoute = await resolveInstanceRouteMode(instanceId);
      const routeMode = resolvedRoute.mode;
      set((state) => ({
        instanceRouteModeById: {
          ...state.instanceRouteModeById,
          [instanceId]: routeMode,
        },
      }));

      if (routeMode === 'instanceOpenClawGatewayWs') {
        await openClawGatewaySessions.hydrateInstance(instanceId);
        return openClawGatewaySessions.createDraftSession(instanceId, requestedModel, {
          agentId: options?.openClawAgentId,
          sessionId: options?.openClawSessionId,
        }).id;
      }

      if (routeMode === 'unsupported') {
        const scopeKey = getScopeKey(instanceId);
        const nextError = buildUnsupportedChatRouteError(resolvedRoute.reason);
        openClawGatewaySessions.releaseInstance(instanceId);
        set((state) => clearChatInstanceScopeState(state, instanceId, { lastError: nextError }));
        return '';
      }

      openClawGatewaySessions.releaseInstance(instanceId);
    }

    const resolvedModel = requestedModel || DEFAULT_MODEL;
    const timestamp = Date.now();
    const session: ChatSession = {
      id: createSessionId(instanceId),
      title: DEFAULT_TITLE,
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [],
      model: resolvedModel,
      instanceId,
      transport: 'local',
    };

    set((state) => {
      const nextSessions = sortSessions([session, ...state.sessions.map(normalizeSession)]);
      if (!instanceId) {
        return {
          sessions: nextSessions,
          activeSessionIdByInstance: {
            ...state.activeSessionIdByInstance,
            [getScopeKey(instanceId)]: session.id,
          },
          lastErrorByInstance: {
            ...state.lastErrorByInstance,
            [getScopeKey(instanceId)]: undefined,
          },
        };
      }

      const scopeKey = getScopeKey(instanceId);
      const nextLocalSessions = listScopeLocalSessions(nextSessions, instanceId);
      return applyLocalInstanceScopeState(state, instanceId, {
        baseSessions: nextSessions,
        preservedLocalSessions: nextLocalSessions,
        preferredActiveSessionId: session.id,
        syncState: state.syncStateByInstance[scopeKey] ?? 'idle',
        lastError: undefined,
      });
    });

    void persistSession(session)
      .then((savedSession) => {
        if (!savedSession) {
          return;
        }
        set((state) => {
          const nextSessions = upsertSessionCollection(state.sessions, savedSession);
          if (!savedSession.instanceId) {
            return {
              sessions: nextSessions,
              lastErrorByInstance: {
                ...state.lastErrorByInstance,
                [getScopeKey(instanceId)]: undefined,
              },
            };
          }

          const localScopeKey = getScopeKey(savedSession.instanceId);
          const nextLocalSessions = listScopeLocalSessions(nextSessions, savedSession.instanceId);
          return applyLocalInstanceScopeState(state, savedSession.instanceId, {
            baseSessions: nextSessions,
            preservedLocalSessions: nextLocalSessions,
            preferredActiveSessionId: savedSession.id,
            syncState: state.syncStateByInstance[localScopeKey] ?? 'idle',
            lastError: undefined,
          });
        });
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
  async startNewSession(model, instanceId, options) {
    const requestedModel = model?.trim() || undefined;
    if (instanceId) {
      const resolvedRoute = await resolveInstanceRouteMode(instanceId);
      const routeMode = resolvedRoute.mode;
      set((state) => ({
        instanceRouteModeById: {
          ...state.instanceRouteModeById,
          [instanceId]: routeMode,
        },
      }));

      if (routeMode === 'instanceOpenClawGatewayWs') {
        return openClawGatewaySessions.startNewSession({
          instanceId,
          agentId: options?.openClawAgentId,
          model: requestedModel,
        });
      }

      if (routeMode === 'unsupported') {
        const nextError = buildUnsupportedChatRouteError(resolvedRoute.reason);
        openClawGatewaySessions.releaseInstance(instanceId);
        set((state) => clearChatInstanceScopeState(state, instanceId, { lastError: nextError }));
        return null;
      }

      openClawGatewaySessions.releaseInstance(instanceId);
    }

    return get().createSession(model, instanceId, {
      openClawAgentId: options?.openClawAgentId,
    });
  },
  async deleteSession(id, instanceId) {
    const session = get().sessions.find((item) => item.id === id);
    const resolvedInstanceId = instanceId ?? session?.instanceId;
    const scopeKey = getScopeKey(resolvedInstanceId);
    const deleteLocalConversation = () => {
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
    };

    if (session?.transport === 'openclawGateway' && resolvedInstanceId) {
      const resolvedRoute = await resolveInstanceRouteMode(resolvedInstanceId);
      const routeMode = resolvedRoute.mode;
      set((state) => ({
        instanceRouteModeById: {
          ...state.instanceRouteModeById,
          [resolvedInstanceId]: routeMode,
        },
      }));

      if (routeMode === 'instanceOpenClawGatewayWs') {
        await openClawGatewaySessions.deleteSession({
          instanceId: resolvedInstanceId,
          sessionId: id,
        });
        return;
      }

      openClawGatewaySessions.releaseInstance(resolvedInstanceId);

      if (routeMode === 'unsupported') {
        set((state) =>
          clearChatInstanceScopeState(state, resolvedInstanceId, {
            lastError: buildUnsupportedChatRouteError(resolvedRoute.reason),
          }),
        );
        return;
      }

      set((state) => applyLocalInstanceScopeState(state, resolvedInstanceId));
      return;
    }

    if (resolvedInstanceId) {
      const resolvedRoute = await resolveInstanceRouteMode(resolvedInstanceId);
      const routeMode = resolvedRoute.mode;
      set((state) => ({
        instanceRouteModeById: {
          ...state.instanceRouteModeById,
          [resolvedInstanceId]: routeMode,
        },
      }));

      if (routeMode === 'unsupported') {
        openClawGatewaySessions.releaseInstance(resolvedInstanceId);
        set((state) =>
          clearChatInstanceScopeState(state, resolvedInstanceId, {
            lastError: buildUnsupportedChatRouteError(resolvedRoute.reason),
          }),
        );
        deleteLocalConversation();
        return;
      }

      if (routeMode !== 'instanceOpenClawGatewayWs') {
        openClawGatewaySessions.releaseInstance(resolvedInstanceId);
        set((state) => {
          const nextSessions = state.sessions.filter((item) => item.id !== id);
          const nextLocalSessions = listScopeLocalSessions(nextSessions, resolvedInstanceId);
          return applyLocalInstanceScopeState(state, resolvedInstanceId, {
            baseSessions: nextSessions,
            preservedLocalSessions: nextLocalSessions,
          });
        });
        deleteLocalConversation();
        return;
      }
    }

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

    deleteLocalConversation();
  },
  async setActiveSession(id, instanceId) {
    const resolvedInstanceId =
      instanceId ?? get().sessions.find((session) => session.id === id)?.instanceId ?? null;
    if (resolvedInstanceId) {
      const resolvedRoute = await resolveInstanceRouteMode(resolvedInstanceId);
      const routeMode = resolvedRoute.mode;
      const preservedLocalSessions = listScopeLocalSessions(get().sessions, resolvedInstanceId);

      set((state) => ({
        instanceRouteModeById: {
          ...state.instanceRouteModeById,
          [resolvedInstanceId]: routeMode,
        },
      }));

      if (routeMode === 'instanceOpenClawGatewayWs') {
        await openClawGatewaySessions.setActiveSession({
          instanceId: resolvedInstanceId,
          sessionId: id,
        });
        return;
      }

      openClawGatewaySessions.releaseInstance(resolvedInstanceId);

      if (routeMode === 'unsupported') {
        set((state) =>
          clearChatInstanceScopeState(state, resolvedInstanceId, {
            lastError: buildUnsupportedChatRouteError(resolvedRoute.reason),
          }),
        );
        return;
      }

      set((state) =>
        applyLocalInstanceScopeState(state, resolvedInstanceId, {
          preservedLocalSessions,
          preferredActiveSessionId: id,
        }),
      );
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
        const nextTitle =
          currentMessages.length === 0 && message.role === 'user'
            ? resolveInitialChatSessionTitle({
                existingTitle: session.title,
                text: message.content,
                attachments: message.attachments ?? [],
                isFirstUserMessage: true,
              })
            : session.title;

        nextSession = {
          ...normalizeSession(session),
          title: nextTitle,
          updatedAt: timestamp,
          messages: [...currentMessages, nextMessage],
        };

        return nextSession;
      });

      const nextSessions = sortSessions(sessions);
      if (!nextSession?.instanceId) {
        return {
          sessions: nextSessions,
        };
      }

      const scopeKey = getScopeKey(nextSession.instanceId);
      const nextLocalSessions = listScopeLocalSessions(nextSessions, nextSession.instanceId);
      return {
        ...applyLocalInstanceScopeState(state, nextSession.instanceId, {
          baseSessions: nextSessions,
          preservedLocalSessions: nextLocalSessions,
          syncState: state.syncStateByInstance[scopeKey] ?? 'idle',
          lastError: state.lastErrorByInstance[scopeKey],
        }),
      };
    });

    if (!nextSession) {
      return;
    }

    const persistedSession = nextSession;

    void persistSession(persistedSession)
      .then((savedSession) => {
        if (!savedSession) {
          return;
        }
        set((state) => {
          const nextSessions = upsertSessionCollection(state.sessions, savedSession);
          if (!savedSession.instanceId) {
            return {
              sessions: nextSessions,
              lastErrorByInstance: {
                ...state.lastErrorByInstance,
                [getScopeKey(persistedSession.instanceId)]: undefined,
              },
            };
          }

          const localScopeKey = getScopeKey(savedSession.instanceId);
          const nextLocalSessions = listScopeLocalSessions(nextSessions, savedSession.instanceId);
          return applyLocalInstanceScopeState(state, savedSession.instanceId, {
            baseSessions: nextSessions,
            preservedLocalSessions: nextLocalSessions,
            syncState: state.syncStateByInstance[localScopeKey] ?? 'idle',
            lastError: undefined,
          });
        });
      })
      .catch((error: any) => {
        console.error('Failed to persist message:', error);
        set((state) => ({
          lastErrorByInstance: {
            ...state.lastErrorByInstance,
            [getScopeKey(persistedSession.instanceId)]: error?.message || 'Failed to persist conversation',
          },
        }));
      });
  },
  updateMessage(sessionId, messageId, content) {
    set((state) => {
      const timestamp = Date.now();
      let updatedInstanceId: string | null | undefined;
      const sessions = state.sessions.map((session) => {
        if (session.id === sessionId && session.transport !== 'openclawGateway') {
          updatedInstanceId = session.instanceId;
          return {
            ...normalizeSession(session),
            updatedAt: timestamp,
            messages: normalizeMessages(session.messages).map((message) =>
              message.id === messageId ? { ...message, content, timestamp } : message,
            ),
          };
        }

        return normalizeSession(session);
      });

      const nextSessions = sortSessions(sessions);
      if (!updatedInstanceId) {
        return {
          sessions: nextSessions,
        };
      }

      const scopeKey = getScopeKey(updatedInstanceId);
      const nextLocalSessions = listScopeLocalSessions(nextSessions, updatedInstanceId);
      return {
        ...applyLocalInstanceScopeState(state, updatedInstanceId, {
          baseSessions: nextSessions,
          preservedLocalSessions: nextLocalSessions,
          syncState: state.syncStateByInstance[scopeKey] ?? 'idle',
          lastError: state.lastErrorByInstance[scopeKey],
        }),
      };
    });
  },
  async clearSession(id, instanceId) {
    const session = get().sessions.find((item) => item.id === id);
    const resolvedInstanceId = instanceId ?? session?.instanceId;
    if (session?.transport === 'openclawGateway' && resolvedInstanceId) {
      const resolvedRoute = await resolveInstanceRouteMode(resolvedInstanceId);
      const routeMode = resolvedRoute.mode;
      set((state) => ({
        instanceRouteModeById: {
          ...state.instanceRouteModeById,
          [resolvedInstanceId]: routeMode,
        },
      }));

      if (routeMode === 'instanceOpenClawGatewayWs') {
        await openClawGatewaySessions.resetSession({
          instanceId: resolvedInstanceId,
          sessionId: id,
        });
        return;
      }

      openClawGatewaySessions.releaseInstance(resolvedInstanceId);

      if (routeMode === 'unsupported') {
        set((state) =>
          clearChatInstanceScopeState(state, resolvedInstanceId, {
            lastError: buildUnsupportedChatRouteError(resolvedRoute.reason),
          }),
        );
        return;
      }

      set((state) => applyLocalInstanceScopeState(state, resolvedInstanceId));
      return;
    }
    let cleared: ChatSession | undefined;

    set((state) => {
      const nextSessions = state.sessions.map((currentSession) => {
        if (currentSession.id !== id) {
          return normalizeSession(currentSession);
        }

        cleared = {
          ...normalizeSession(currentSession),
          messages: [],
          updatedAt: Date.now(),
          lastMessagePreview: undefined,
        };
        return cleared;
      });

      if (!resolvedInstanceId || !cleared) {
        return {
          sessions: nextSessions,
        };
      }

      const localScopeKey = getScopeKey(resolvedInstanceId);
      const nextLocalSessions = listScopeLocalSessions(nextSessions, resolvedInstanceId);
      return applyLocalInstanceScopeState(state, resolvedInstanceId, {
        baseSessions: nextSessions,
        preservedLocalSessions: nextLocalSessions,
        preferredActiveSessionId: id,
        syncState: state.syncStateByInstance[localScopeKey] ?? 'idle',
        lastError: state.lastErrorByInstance[localScopeKey],
      });
    });

    if (!cleared) {
      return;
    }

    const scopeKey = getScopeKey(resolvedInstanceId);

    void persistSession(cleared)
      .then((savedSession) => {
        if (!savedSession) {
          return;
        }
        set((state) => {
          const nextSessions = upsertSessionCollection(state.sessions, savedSession);
          if (!savedSession.instanceId) {
            return {
              sessions: nextSessions,
              lastErrorByInstance: {
                ...state.lastErrorByInstance,
                [scopeKey]: undefined,
              },
            };
          }

          const localScopeKey = getScopeKey(savedSession.instanceId);
          const nextLocalSessions = listScopeLocalSessions(nextSessions, savedSession.instanceId);
          return applyLocalInstanceScopeState(state, savedSession.instanceId, {
            baseSessions: nextSessions,
            preservedLocalSessions: nextLocalSessions,
            preferredActiveSessionId: savedSession.id,
            syncState: state.syncStateByInstance[localScopeKey] ?? 'idle',
            lastError: undefined,
          });
        });
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
        set((state) => {
          const nextSessions = upsertSessionCollection(state.sessions, savedSession);
          if (!savedSession.instanceId) {
            return {
              sessions: nextSessions,
            };
          }

          const localScopeKey = getScopeKey(savedSession.instanceId);
          const nextLocalSessions = listScopeLocalSessions(nextSessions, savedSession.instanceId);
          return applyLocalInstanceScopeState(state, savedSession.instanceId, {
            baseSessions: nextSessions,
            preservedLocalSessions: nextLocalSessions,
            preferredActiveSessionId: savedSession.id,
            syncState: state.syncStateByInstance[localScopeKey] ?? 'idle',
            lastError: state.lastErrorByInstance[localScopeKey],
          });
        });
      }

      if (savedSession?.instanceId) {
        const hydratedInstanceId = savedSession.instanceId;
        const gateway = await getStudioConversationGateway();
        const hydrated = await gateway.getInstanceConversation(
          hydratedInstanceId,
          savedSession.id,
          savedSession,
        );

        set((state) => {
          const nextSessions = upsertSessionCollection(state.sessions, hydrated);
          const nextLocalSessions = listScopeLocalSessions(nextSessions, hydratedInstanceId);
          return applyLocalInstanceScopeState(state, hydratedInstanceId, {
            baseSessions: nextSessions,
            preservedLocalSessions: nextLocalSessions,
            preferredActiveSessionId: hydrated.id,
            syncState: 'idle',
            lastError: undefined,
          });
        });
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
  async setGatewaySessionThinkingLevel(params) {
    await openClawGatewaySessions.setSessionThinkingLevel(params);
  },
  async setGatewaySessionFastMode(params) {
    await openClawGatewaySessions.setSessionFastMode(params);
  },
  async setGatewaySessionVerboseLevel(params) {
    await openClawGatewaySessions.setSessionVerboseLevel(params);
  },
  async setGatewaySessionReasoningLevel(params) {
    await openClawGatewaySessions.setSessionReasoningLevel(params);
  },
  async sendGatewayMessage(params) {
    return openClawGatewaySessions.sendMessage(params);
  },
  async abortSession(params) {
    return openClawGatewaySessions.abortRun(params);
  },
}));

openClawGatewaySessions.subscribe((instanceId, snapshot) => {
  chatStore.setState((state) => applyOpenClawSnapshot(state, instanceId, snapshot));
});
