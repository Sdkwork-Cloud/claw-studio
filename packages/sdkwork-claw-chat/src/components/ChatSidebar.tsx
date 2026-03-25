import React from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Plus, Trash2, X } from 'lucide-react';
import { useInstanceStore } from '@sdkwork/claw-core';
import { cn } from '@sdkwork/claw-ui';
import { getChatSessionDisplayTitle } from '../services';
import { useChatStore } from '../store/useChatStore';

function getScopeKey(instanceId: string | null | undefined) {
  return instanceId ?? '__direct__';
}

export function ChatSidebar({
  className,
  onSessionSelect,
  onClose,
  isOpenClawGateway = false,
  openClawAgentId = null,
  openClawTargetSessionId = null,
}: {
  className?: string;
  onSessionSelect?: () => void;
  onClose?: () => void;
  isOpenClawGateway?: boolean;
  openClawAgentId?: string | null;
  openClawTargetSessionId?: string | null;
}) {
  const {
    sessions,
    activeSessionIdByInstance,
    createSession,
    setActiveSession,
    deleteSession,
  } = useChatStore();
  const { activeInstanceId } = useInstanceStore();
  const { t } = useTranslation();
  const activeSessionId = activeSessionIdByInstance[getScopeKey(activeInstanceId)] ?? null;

  const handleNewChat = () => {
    if (activeInstanceId) {
      if (isOpenClawGateway && openClawTargetSessionId) {
        void setActiveSession(openClawTargetSessionId, activeInstanceId);
        onSessionSelect?.();
        return;
      }

      void createSession(undefined, activeInstanceId, {
        openClawAgentId,
      });
      onSessionSelect?.();
    }
  };

  const instanceSessions = sessions.filter(
    (session) =>
      session.instanceId === activeInstanceId || (!session.instanceId && !activeInstanceId),
  );

  const now = Date.now();
  const today = instanceSessions.filter((session) => now - session.updatedAt < 86_400_000);
  const previous7Days = instanceSessions.filter(
    (session) =>
      now - session.updatedAt >= 86_400_000 && now - session.updatedAt < 7 * 86_400_000,
  );
  const older = instanceSessions.filter((session) => now - session.updatedAt >= 7 * 86_400_000);

  const renderSessionGroup = (title: string, groupSessions: typeof sessions) => {
    if (groupSessions.length === 0) {
      return null;
    }

    return (
      <div className="mb-6">
        <h3 className="mb-2 px-4 text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          {title}
        </h3>
        <div className="space-y-0.5 px-2">
          {groupSessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                'group relative flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition-colors',
                activeSessionId === session.id
                  ? 'bg-primary-100 font-semibold text-primary-900 dark:bg-primary-900/30 dark:text-primary-100'
                  : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/50',
              )}
              onClick={() => {
                void setActiveSession(session.id, activeInstanceId ?? undefined);
                onSessionSelect?.();
              }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                <MessageSquare
                  className={cn(
                    'h-4 w-4 shrink-0',
                    activeSessionId === session.id
                      ? 'text-primary-500'
                      : 'text-zinc-400 dark:text-zinc-500',
                  )}
                />
                <span className="truncate text-[13px] font-medium">
                  {getChatSessionDisplayTitle(session)}
                </span>
              </div>

              <button
                className="ml-2 shrink-0 rounded-md p-1.5 opacity-100 transition-opacity hover:bg-zinc-200 md:opacity-0 md:group-hover:opacity-100 dark:hover:bg-zinc-700"
                onClick={(event) => {
                  event.stopPropagation();
                  void deleteSession(session.id, activeInstanceId ?? undefined);
                }}
                title={t('chat.sidebar.deleteChat')}
              >
                <Trash2 className="h-3.5 w-3.5 text-zinc-400 transition-colors hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-col border-r border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50',
        className,
      )}
    >
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={handleNewChat}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 font-medium text-zinc-900 shadow-sm transition-all hover:bg-zinc-50 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
        >
          <Plus className="h-4 w-4" />
          <span className="text-[14px]">{t('chat.sidebar.newChat')}</span>
        </button>
        {onClose ? (
          <button
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 lg:hidden"
            title={t('common.close')}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="scrollbar-hide flex-1 overflow-y-auto py-4">
        {renderSessionGroup(t('chat.sidebar.today'), today)}
        {renderSessionGroup(t('chat.sidebar.previous7Days'), previous7Days)}
        {renderSessionGroup(t('chat.sidebar.older'), older)}

        {instanceSessions.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <MessageSquare className="mx-auto mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t('chat.sidebar.noHistory')}
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              {t('chat.sidebar.noHistoryDescription')}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
