import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  
  // Actions
  createSession: (model?: string, instanceId?: string) => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  addMessage: (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (sessionId: string, messageId: string, content: string) => void;
  clearSession: (id: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,

      createSession: (model = 'Llama-3-8B-Instruct', instanceId) => {
        const newSession: ChatSession = {
          id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: 'New Conversation',
          createdAt: Date.now(),
          updatedAt: Date.now(),
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

      deleteSession: (id) => {
        set((state) => {
          const newSessions = state.sessions.filter((s) => s.id !== id);
          return {
            sessions: newSessions,
            activeSessionId: state.activeSessionId === id 
              ? (newSessions[0]?.id || null) 
              : state.activeSessionId,
          };
        });
      },

      setActiveSession: (id) => {
        set({ activeSessionId: id });
      },

      addMessage: (sessionId, message) => {
        set((state) => {
          const sessions = state.sessions.map((session) => {
            if (session.id === sessionId) {
              // Auto-generate title from first user message if it's "New Conversation"
              let title = session.title;
              if (session.messages.length === 0 && message.role === 'user') {
                title = message.content.slice(0, 40) + (message.content.length > 40 ? '...' : '');
              }

              return {
                ...session,
                title,
                updatedAt: Date.now(),
                messages: [
                  ...session.messages,
                  {
                    ...message,
                    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: Date.now(),
                  },
                ],
              };
            }
            return session;
          });

          // Sort sessions by updatedAt descending
          return {
            sessions: sessions.sort((a, b) => b.updatedAt - a.updatedAt),
          };
        });
      },

      updateMessage: (sessionId, messageId, content) => {
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id === sessionId) {
              return {
                ...session,
                messages: session.messages.map((msg) =>
                  msg.id === messageId ? { ...msg, content } : msg
                ),
              };
            }
            return session;
          }),
        }));
      },

      clearSession: (id) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === id ? { ...session, messages: [], updatedAt: Date.now() } : session
          ),
        }));
      },
    }),
    {
      name: 'openclaw-chat-storage',
    }
  )
);
