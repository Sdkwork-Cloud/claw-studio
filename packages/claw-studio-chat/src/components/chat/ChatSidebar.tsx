import React from 'react';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useChatStore, useInstanceStore } from '@sdkwork/claw-studio-business';
import { cn } from '@sdkwork/claw-studio-shared-ui';

export function ChatSidebar() {
  const { sessions, activeSessionId, createSession, setActiveSession, deleteSession } =
    useChatStore();
  const { activeInstanceId } = useInstanceStore();

  const handleNewChat = () => {
    createSession(undefined, activeInstanceId ?? undefined);
  };

  const instanceSessions = sessions.filter(
    (session) =>
      session.instanceId === activeInstanceId || (!session.instanceId && !activeInstanceId),
  );

  const now = Date.now();
  const today = instanceSessions.filter((session) => now - session.updatedAt < 86400000);
  const previous7Days = instanceSessions.filter(
    (session) => now - session.updatedAt >= 86400000 && now - session.updatedAt < 7 * 86400000,
  );
  const older = instanceSessions.filter(
    (session) => now - session.updatedAt >= 7 * 86400000,
  );

  const renderSessionGroup = (title: string, groupSessions: typeof sessions) => {
    if (groupSessions.length === 0) {
      return null;
    }

    return (
      <div className="mb-6">
        <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          {title}
        </h3>
        <div className="space-y-1 px-2">
          {groupSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setActiveSession(session.id)}
              className={cn(
                'group flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all',
                activeSessionId === session.id
                  ? 'border-primary-100 bg-primary-50 text-primary-700 shadow-sm dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-300'
                  : 'border-transparent text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100',
              )}
            >
              <div className="flex truncate items-center gap-3">
                <MessageSquare
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    activeSessionId === session.id
                      ? 'text-primary-500'
                      : 'text-zinc-400 group-hover:text-zinc-500 dark:text-zinc-500 dark:group-hover:text-zinc-400',
                  )}
                />
                <span className="truncate">{session.title}</span>
              </div>

              <div
                className="rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteSession(session.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-zinc-400 transition-colors hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full w-64 flex-shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 p-4 dark:border-zinc-800">
        <button
          onClick={handleNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-zinc-800 hover:shadow-md dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-5 w-5" />
          New Chat
        </button>
      </div>

      <div className="scrollbar-hide flex-1 overflow-y-auto py-4">
        {renderSessionGroup('Today', today)}
        {renderSessionGroup('Previous 7 Days', previous7Days)}
        {renderSessionGroup('Older', older)}

        {instanceSessions.length === 0 && (
          <div className="px-4 py-8 text-center">
            <MessageSquare className="mx-auto mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              No chat history
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Start a new conversation to see it here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
