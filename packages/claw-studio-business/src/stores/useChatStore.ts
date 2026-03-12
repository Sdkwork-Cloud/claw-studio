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

const noopStorage: StateStorage = {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {},
};

function createPersistOptions(storage?: StateStorage) {
  return {
    name: STORAGE_KEY,
    storage: createJSONStorage(() => storage ?? noopStorage),
  };
}

const createChatStoreState: StateCreator<ChatState, [], [], ChatState> = (set) => ({
  sessions: [],
  activeSessionId: null,
  createSession(model = 'Llama-3-8B-Instruct', instanceId) {
    const timestamp = Date.now();
    const newSession: ChatSession = {
      id: `session-${timestamp}-${Math.random().toString(36).slice(2, 11)}`,
      title: 'New Conversation',
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
      const sessions = state.sessions.map((session) => {
        if (session.id !== sessionId) {
          return session;
        }

        let title = session.title;
        if (session.messages.length === 0 && message.role === 'user') {
          title = message.content.slice(0, 40) + (message.content.length > 40 ? '...' : '');
        }

        return {
          ...session,
          title,
          updatedAt: timestamp,
          messages: [
            ...session.messages,
            {
              ...message,
              id: `msg-${timestamp}-${Math.random().toString(36).slice(2, 11)}`,
              timestamp,
            },
          ],
        };
      });

      return {
        sessions: sessions.sort((a, b) => b.updatedAt - a.updatedAt),
      };
    });
  },
  updateMessage(sessionId, messageId, content) {
    set((state) => ({
      sessions: state.sessions.map((session) => {
        if (session.id !== sessionId) {
          return session;
        }

        return {
          ...session,
          messages: session.messages.map((message) =>
            message.id === messageId ? { ...message, content } : message,
          ),
        };
      }),
    }));
  },
  clearSession(id) {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id ? { ...session, messages: [], updatedAt: Date.now() } : session,
      ),
    }));
  },
});

export const useChatStore = create<ChatState>()(
  persist(createChatStoreState, createPersistOptions()),
);
