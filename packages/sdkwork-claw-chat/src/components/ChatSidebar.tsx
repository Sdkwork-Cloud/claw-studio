import React from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Plus, Trash2, X } from 'lucide-react';
import { useInstanceStore } from '@sdkwork/claw-core';
import { cn } from '@sdkwork/claw-ui';
import {
  getChatSessionDisplayTitle,
  isOpenClawMainSession,
  presentChatSessionListItem,
  resolveChatSessionViewState,
} from '../services';
import { useChatStore } from '../store/useChatStore';

function getScopeKey(instanceId: string | null | undefined) {
  return instanceId ?? '__direct__';
}

export function ChatSidebar({
  className,
  onSessionSelect,
  onClose,
  isChatSupported = true,
  isOpenClawGateway = false,
  openClawAgentId = null,
  newSessionModel,
}: {
  className?: string;
  onSessionSelect?: () => void;
  onClose?: () => void;
  isChatSupported?: boolean;
  isOpenClawGateway?: boolean;
  openClawAgentId?: string | null;
  newSessionModel?: string;
}) {
  const {
    sessions,
    activeSessionIdByInstance,
    createSession,
    startNewSession,
    setActiveSession,
    deleteSession,
  } = useChatStore();
  const { activeInstanceId } = useInstanceStore();
  const { t, i18n } = useTranslation();
  const activeSessionId = activeSessionIdByInstance[getScopeKey(activeInstanceId)] ?? null;

  const handleNewChat = () => {
    if (!activeInstanceId || !isChatSupported) {
      return;
    }

    if (isOpenClawGateway) {
      void startNewSession(newSessionModel, activeInstanceId, {
        openClawAgentId,
      });
    } else {
      void createSession(newSessionModel, activeInstanceId, {
        openClawAgentId,
      });
    }
    onSessionSelect?.();
  };

  const instanceSessions = sessions.filter(
    (session) =>
      session.instanceId === activeInstanceId || (!session.instanceId && !activeInstanceId),
  );
  const { visibleSessions, effectiveActiveSessionId } = resolveChatSessionViewState({
    sessions: instanceSessions,
    activeSessionId,
    isChatSupported,
    isOpenClawGateway,
    openClawAgentId,
  });

  const now = Date.now();
  const today = visibleSessions.filter((session) => now - session.updatedAt < 86_400_000);
  const previous7Days = visibleSessions.filter(
    (session) =>
      now - session.updatedAt >= 86_400_000 && now - session.updatedAt < 7 * 86_400_000,
  );
  const older = visibleSessions.filter((session) => now - session.updatedAt >= 7 * 86_400_000);

  const renderSessionGroup = (title: string, groupSessions: typeof sessions) => {
    if (groupSessions.length === 0) {
      return null;
    }

    return (
      <div className="mb-6">
        <h3 className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
          {title}
        </h3>
        <div className="space-y-1 px-2">
          {groupSessions.map((session) => {
            const isGatewayMainSession =
              isOpenClawGateway && isOpenClawMainSession(session.id, openClawAgentId);
            const presentation = presentChatSessionListItem({
              session,
              now,
              locale: i18n.resolvedLanguage,
              isGatewayMainSession,
            });
            const displayTitle = presentation.displayTitle || getChatSessionDisplayTitle(session);
            const showStatusDot = presentation.isRunning || presentation.isPinned;

            return (
              <div
                key={session.id}
                className={cn(
                  'group relative flex cursor-pointer items-start rounded-xl px-3 py-2.5 transition-all',
                  effectiveActiveSessionId === session.id
                    ? 'bg-white text-zinc-900 ring-1 ring-zinc-200/80 shadow-sm dark:bg-zinc-900/80 dark:text-zinc-100 dark:ring-zinc-800'
                    : 'text-zinc-700 hover:bg-zinc-100/80 dark:text-zinc-300 dark:hover:bg-zinc-800/50',
                )}
                onClick={() => {
                  void setActiveSession(session.id, activeInstanceId ?? undefined);
                  onSessionSelect?.();
                }}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {showStatusDot ? (
                      <span
                        className={cn(
                          'mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full',
                          presentation.isRunning
                            ? 'animate-pulse bg-emerald-500'
                            : 'bg-primary-400/80 dark:bg-primary-300/80',
                        )}
                      />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-5">
                      {displayTitle}
                    </span>
                    <span className="shrink-0 text-[10px] font-medium tabular-nums text-zinc-400 dark:text-zinc-500">
                      {presentation.relativeTimeLabel}
                    </span>
                  </div>
                  {presentation.preview ? (
                    <div className="truncate text-[11px] leading-5 text-zinc-400 dark:text-zinc-500">
                      {presentation.preview}
                    </div>
                  ) : null}
                </div>

                {presentation.showDeleteAction ? (
                  <button
                    className="ml-2 mt-0.5 shrink-0 rounded-md p-1 opacity-100 transition-opacity hover:bg-zinc-200 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-zinc-700"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteSession(session.id, activeInstanceId ?? undefined);
                    }}
                    title={t('chat.sidebar.deleteChat')}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-zinc-400 transition-colors hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400" />
                  </button>
                ) : null}
              </div>
            );
          })}
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
          disabled={!activeInstanceId || !isChatSupported}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 font-medium text-zinc-900 shadow-sm transition-all hover:bg-zinc-50 hover:shadow-md disabled:cursor-not-allowed disabled:border-zinc-200/70 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:shadow-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 dark:disabled:border-zinc-800 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-500"
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

        {visibleSessions.length === 0 ? (
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
