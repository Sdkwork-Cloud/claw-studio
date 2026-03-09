import React from 'react';
import { MessageSquare, Plus, MoreHorizontal, Trash2 } from 'lucide-react';
import { useChatStore } from '@sdkwork/claw-studio-business/stores/useChatStore';
import { cn } from '@sdkwork/claw-studio-shared-ui/utils';

export function ChatSidebar() {
  const { sessions, activeSessionId, createSession, setActiveSession, deleteSession } = useChatStore();

  const handleNewChat = () => {
    createSession();
  };

  // Group sessions by date (Today, Previous 7 Days, Older)
  const now = Date.now();
  const today = sessions.filter(s => now - s.updatedAt < 86400000);
  const previous7Days = sessions.filter(s => now - s.updatedAt >= 86400000 && now - s.updatedAt < 7 * 86400000);
  const older = sessions.filter(s => now - s.updatedAt >= 7 * 86400000);

  const renderSessionGroup = (title: string, groupSessions: typeof sessions) => {
    if (groupSessions.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="px-4 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
          {title}
        </h3>
        <div className="space-y-1 px-2">
          {groupSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setActiveSession(session.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all group flex items-center justify-between",
                activeSessionId === session.id
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
              )}
            >
              <div className="flex items-center gap-3 truncate">
                <MessageSquare className={cn(
                  "w-4 h-4 flex-shrink-0",
                  activeSessionId === session.id ? "text-primary-500" : "text-zinc-400 dark:text-zinc-500"
                )} />
                <span className="truncate">{session.title}</span>
              </div>
              
              {/* Delete button (visible on hover) */}
              <div 
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(session.id);
                }}
              >
                <Trash2 className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-64 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          New Chat
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        {renderSessionGroup('Today', today)}
        {renderSessionGroup('Previous 7 Days', previous7Days)}
        {renderSessionGroup('Older', older)}

        {sessions.length === 0 && (
          <div className="text-center px-4 py-8">
            <MessageSquare className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">No chat history</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Start a new conversation to see it here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
