import { create } from 'zustand';

export type Role = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  model?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  model: string;
  instanceId?: string;
  source?: 'studio' | 'openclaw';
  messagesHydrated?: boolean;
  lastMessagePreview?: string;
}

type SyncState = 'idle' | 'loading' | 'error';

export interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  syncState: SyncState;
  lastError?: string;
  hydrateInstance: (instanceId: string | null | undefined) => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  createSession: (model?: string, instanceId?: string) => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  addMessage: (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (sessionId: string, messageId: string, content: string) => void;
  clearSession: (id: string) => void;
  flushSession: (id: string) => Promise<void>;
}

const DEFAULT_MODEL = 'Llama-3-8B-Instruct';
const DEFAULT_TITLE = 'New Conversation';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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

function normalizeSession(session: ChatSession): ChatSession {
  return {
    ...session,
    messages: normalizeMessages(session.messages),
  };
}

function sortSessions(sessions: ChatSession[]) {
  return sessions.sort((left, right) => right.updatedAt - left.updatedAt);
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

export const useChatStore = create<ChatState>()((set, get) => ({
  sessions: [],
  activeSessionId: null,
  syncState: 'idle',
  lastError: undefined,
  async hydrateInstance(instanceId) {
    if (!instanceId) {
      set({ activeSessionId: null, syncState: 'idle' });
      return;
    }

    set({ syncState: 'loading', lastError: undefined });

    try {
      const gateway = await getStudioConversationGateway();
      const sessions = await gateway.listInstanceConversations(instanceId);
      set((state) => {
        const nextSessions = replaceInstanceSessions(state.sessions, instanceId, sessions);
        const currentActiveBelongsToInstance =
          state.activeSessionId &&
          nextSessions.some(
            (session) =>
              session.id === state.activeSessionId && session.instanceId === instanceId,
          );

        return {
          sessions: nextSessions,
          activeSessionId: currentActiveBelongsToInstance
            ? state.activeSessionId
            : sessions[0]?.id ?? null,
          syncState: 'idle',
          lastError: undefined,
        };
      });
    } catch (error: any) {
      console.error('Failed to hydrate conversations:', error);
      set({
        syncState: 'error',
        lastError: error?.message || 'Failed to hydrate conversations',
      });
    }
  },
  async loadSession(id) {
    const session = get().sessions.find((item) => item.id === id);
    if (!session?.instanceId) {
      return;
    }

    if (session.messagesHydrated && session.messages.length > 0) {
      return;
    }

    try {
      const gateway = await getStudioConversationGateway();
      const hydrated = await gateway.getInstanceConversation(
        session.instanceId,
        session.id,
        normalizeSession(session),
      );

      set((state) => ({
        sessions: upsertSessionCollection(state.sessions, hydrated),
        lastError: undefined,
      }));
    } catch (error: any) {
      console.error('Failed to load conversation:', error);
      set({
        syncState: 'error',
        lastError: error?.message || 'Failed to load conversation',
      });
    }
  },
  createSession(model = DEFAULT_MODEL, instanceId) {
    const timestamp = Date.now();
    const session: ChatSession = {
      id: createSessionId(instanceId),
      title: DEFAULT_TITLE,
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [],
      model,
      instanceId,
    };

    set((state) => ({
      sessions: sortSessions([session, ...state.sessions.map(normalizeSession)]),
      activeSessionId: session.id,
      lastError: undefined,
    }));

    void persistSession(session)
      .then((savedSession) => {
        set((state) => ({
          sessions: upsertSessionCollection(state.sessions, savedSession),
          lastError: undefined,
        }));
      })
      .catch((error: any) => {
        console.error('Failed to persist session:', error);
        set({ lastError: error?.message || 'Failed to persist conversation' });
      });

    return session.id;
  },
  deleteSession(id) {
    const session = get().sessions.find((item) => item.id === id);
    set((state) => {
      const nextSessions = state.sessions.filter((item) => item.id !== id);
      return {
        sessions: nextSessions,
        activeSessionId:
          state.activeSessionId === id ? nextSessions[0]?.id ?? null : state.activeSessionId,
      };
    });

    if (!session) {
      return;
    }

    void getStudioConversationGateway()
      .then((gateway) => gateway.deleteInstanceConversation(id, session.instanceId))
      .catch((error: any) => {
        console.error('Failed to delete conversation:', error);
        set({ lastError: error?.message || 'Failed to delete conversation' });
      });
  },
  setActiveSession(id) {
    set({ activeSessionId: id });
  },
  addMessage(sessionId, message) {
    let nextSession: ChatSession | undefined;

    set((state) => {
      const timestamp = Date.now();
      const sessions = state.sessions.map((session) => {
        if (session.id !== sessionId) {
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

    void persistSession(nextSession)
      .then((savedSession) => {
        set((state) => ({
          sessions: upsertSessionCollection(state.sessions, savedSession),
          lastError: undefined,
        }));
      })
      .catch((error: any) => {
        console.error('Failed to persist message:', error);
        set({ lastError: error?.message || 'Failed to persist conversation' });
      });
  },
  updateMessage(sessionId, messageId, content) {
    set((state) => {
      const timestamp = Date.now();
      const sessions = state.sessions.map((session) =>
        session.id === sessionId
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
  clearSession(id) {
    let targetSession: ChatSession | undefined;
    let cleared: ChatSession | undefined;

    set((state) => ({
      sessions: state.sessions.map((session) => {
        if (session.id !== id) {
          return normalizeSession(session);
        }

        targetSession = normalizeSession(session);
        cleared = {
          ...normalizeSession(session),
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

    if (targetSession?.source === 'openclaw') {
      void getStudioConversationGateway()
        .then((gateway) => gateway.resetInstanceConversation(cleared!))
        .then((savedSession) => {
          set((state) => ({
            sessions: upsertSessionCollection(state.sessions, savedSession),
            lastError: undefined,
          }));
        })
        .catch((error: any) => {
          console.error('Failed to clear conversation:', error);
          set({ lastError: error?.message || 'Failed to persist conversation' });
        });
      return;
    }

    void persistSession(cleared)
      .then((savedSession) => {
        set((state) => ({
          sessions: upsertSessionCollection(state.sessions, savedSession),
          lastError: undefined,
        }));
      })
      .catch((error: any) => {
        console.error('Failed to clear conversation:', error);
        set({ lastError: error?.message || 'Failed to persist conversation' });
      });
  },
  async flushSession(id) {
    const session = get().sessions.find((item) => item.id === id);
    if (!session) {
      return;
    }

    try {
      const savedSession = await persistSession(session);
      set((state) => ({
        sessions: upsertSessionCollection(state.sessions, savedSession),
      }));

      if (savedSession.instanceId) {
        const gateway = await getStudioConversationGateway();
        const hydrated = await gateway.getInstanceConversation(
          savedSession.instanceId,
          savedSession.id,
          savedSession,
        );

        set((state) => ({
          sessions: upsertSessionCollection(state.sessions, hydrated),
          syncState: 'idle',
          lastError: undefined,
        }));
        return;
      }

      set({ syncState: 'idle', lastError: undefined });
    } catch (error: any) {
      console.error('Failed to flush conversation:', error);
      set({
        syncState: 'error',
        lastError: error?.message || 'Failed to flush conversation',
      });
    }
  },
}));
