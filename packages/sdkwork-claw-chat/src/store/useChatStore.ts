import { create, type StateCreator } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

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
}

export interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  createSession: (model?: string, instanceId?: string) => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  addMessage: (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (sessionId: string, messageId: string, content: string) => void;
  clearSession: (id: string) => void;
}

const STORAGE_KEY = 'openclaw-chat-storage';
const DEFAULT_MODEL = 'Llama-3-8B-Instruct';
const DEFAULT_TITLE = 'New Conversation';

const noopStorage: StateStorage = {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {},
};

function normalizeRole(role: unknown, sender: unknown): Role {
  if (role === 'user' || role === 'assistant' || role === 'system') {
    return role;
  }

  if (sender === 'user') {
    return 'user';
  }

  if (sender === 'provider') {
    return 'assistant';
  }

  return 'assistant';
}

function normalizeMessages(messages: unknown): Message[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.map((message, index) => {
    const record = message && typeof message === 'object' ? (message as Record<string, unknown>) : {};
    const timestamp =
      typeof record.timestamp === 'number'
        ? record.timestamp
        : typeof record.time === 'number'
          ? record.time
          : Date.now();

    return {
      id:
        typeof record.id === 'string'
          ? record.id
          : `msg-${timestamp}-${Math.random().toString(36).slice(2, 11)}-${index}`,
      role: normalizeRole(record.role, record.sender),
      content:
        typeof record.content === 'string'
          ? record.content
          : typeof record.text === 'string'
            ? record.text
            : '',
      timestamp,
      model: typeof record.model === 'string' ? record.model : undefined,
    };
  });
}

function normalizeSession(session: unknown, index: number): ChatSession {
  const record = session && typeof session === 'object' ? (session as Record<string, unknown>) : {};
  const fallbackTimestamp =
    typeof record.updatedAt === 'number'
      ? record.updatedAt
      : typeof record.createdAt === 'number'
        ? record.createdAt
        : Date.now();

  return {
    id:
      typeof record.id === 'string'
        ? record.id
        : `session-${fallbackTimestamp}-${Math.random().toString(36).slice(2, 11)}-${index}`,
    title: typeof record.title === 'string' && record.title.trim() ? record.title : DEFAULT_TITLE,
    createdAt: typeof record.createdAt === 'number' ? record.createdAt : fallbackTimestamp,
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : fallbackTimestamp,
    messages: normalizeMessages(record.messages),
    model: typeof record.model === 'string' && record.model.trim() ? record.model : DEFAULT_MODEL,
    instanceId: typeof record.instanceId === 'string' ? record.instanceId : undefined,
  };
}

function normalizeSessions(sessions: unknown): ChatSession[] {
  if (!Array.isArray(sessions)) {
    return [];
  }

  return sessions.map(normalizeSession);
}

function normalizeActiveSessionId(activeSessionId: unknown, sessions: ChatSession[]) {
  if (
    typeof activeSessionId === 'string' &&
    sessions.some((session) => session.id === activeSessionId)
  ) {
    return activeSessionId;
  }

  return sessions[0]?.id ?? null;
}

function normalizePersistedState(
  persistedState: unknown,
  currentState: ChatState,
): ChatState {
  const record =
    persistedState && typeof persistedState === 'object'
      ? (persistedState as Partial<ChatState>)
      : {};
  const sessions = normalizeSessions(record.sessions);

  return {
    ...currentState,
    sessions,
    activeSessionId: normalizeActiveSessionId(record.activeSessionId, sessions),
  };
}

function getDefaultStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return noopStorage;
  }

  return window.localStorage;
}

function createPersistOptions(storage?: StateStorage) {
  return {
    name: STORAGE_KEY,
    storage: createJSONStorage(() => storage ?? getDefaultStorage()),
    merge(persistedState: unknown, currentState: ChatState) {
      return normalizePersistedState(persistedState, currentState);
    },
  };
}

const createChatStoreState: StateCreator<ChatState, [], [], ChatState> = (set) => ({
  sessions: [],
  activeSessionId: null,
  createSession(model = DEFAULT_MODEL, instanceId) {
    const timestamp = Date.now();
    const newSession: ChatSession = {
      id: `session-${timestamp}-${Math.random().toString(36).slice(2, 11)}`,
      title: DEFAULT_TITLE,
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [],
      model,
      instanceId,
    };

    set((state) => ({
      sessions: [newSession, ...state.sessions],
      activeSessionId: newSession.id,
    }));

    return newSession.id;
  },
  deleteSession(id) {
    set((state) => {
      const nextSessions = state.sessions.filter((session) => session.id !== id);
      return {
        sessions: nextSessions,
        activeSessionId:
          state.activeSessionId === id ? nextSessions[0]?.id ?? null : state.activeSessionId,
      };
    });
  },
  setActiveSession(id) {
    set({ activeSessionId: id });
  },
  addMessage(sessionId, message) {
    set((state) => {
      const timestamp = Date.now();
      const sessions = state.sessions.map((session, index) => {
        const normalizedSession = normalizeSession(session, index);

        if (normalizedSession.id !== sessionId) {
          return normalizedSession;
        }

        const sessionMessages = normalizedSession.messages;
        let title = normalizedSession.title;
        if (sessionMessages.length === 0 && message.role === 'user') {
          title = message.content.slice(0, 40) + (message.content.length > 40 ? '...' : '');
        }

        return {
          ...normalizedSession,
          title,
          updatedAt: timestamp,
          messages: [
            ...sessionMessages,
            {
              ...message,
              id: `msg-${timestamp}-${Math.random().toString(36).slice(2, 11)}`,
              timestamp,
            },
          ],
        };
      });

      return {
        sessions: sessions.sort((left, right) => right.updatedAt - left.updatedAt),
      };
    });
  },
  updateMessage(sessionId, messageId, content) {
    set((state) => ({
      sessions: state.sessions.map((session, index) => {
        const normalizedSession = normalizeSession(session, index);

        if (normalizedSession.id !== sessionId) {
          return normalizedSession;
        }

        return {
          ...normalizedSession,
          messages: normalizedSession.messages.map((message) =>
            message.id === messageId ? { ...message, content } : message,
          ),
        };
      }),
    }));
  },
  clearSession(id) {
    set((state) => ({
      sessions: state.sessions.map((session, index) => {
        const normalizedSession = normalizeSession(session, index);
        return normalizedSession.id === id
          ? { ...normalizedSession, messages: [], updatedAt: Date.now() }
          : normalizedSession;
      }),
    }));
  },
});

export const useChatStore = create<ChatState>()(
  persist(createChatStoreState, createPersistOptions()),
);
