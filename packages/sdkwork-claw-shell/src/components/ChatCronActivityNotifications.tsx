import { useEffect } from 'react';
import {
  detectChatCronActivityNotification,
  type ChatSession,
  useChatStore,
} from '@sdkwork/claw-chat';
import { platform } from '@sdkwork/claw-core';
import { toast } from 'sonner';

function buildSessionMap(sessions: ChatSession[]) {
  return new Map(sessions.map((session) => [session.id, session] as const));
}

function shouldShowSystemNotification() {
  if (typeof document === 'undefined') {
    return false;
  }

  return document.visibilityState !== 'visible' || !document.hasFocus();
}

async function showSystemNotification(title: string, body: string, tag: string) {
  await platform.showNotification({
    title,
    body,
    tag,
  });
}

export function ChatCronActivityNotifications() {
  useEffect(() => {
    return useChatStore.subscribe((state, previousState) => {
      const previousSessions = previousState?.sessions ?? [];
      const nextSessions = state.sessions;
      if (previousSessions === nextSessions) {
        return;
      }

      const previousSessionMap = buildSessionMap(previousSessions);
      for (const nextSession of nextSessions) {
        const previousSession = previousSessionMap.get(nextSession.id);
        const notification = detectChatCronActivityNotification({
          previousSession,
          nextSession,
        });
        if (!notification) {
          continue;
        }

        const toastOptions = {
          description: notification.body,
          duration: notification.kind === 'completed' ? 6000 : 5000,
        };
        if (notification.kind === 'completed') {
          toast.success(notification.title, toastOptions);
        } else {
          toast(notification.title, toastOptions);
        }

        if (shouldShowSystemNotification()) {
          void showSystemNotification(
            notification.title,
            notification.body,
            `chat-cron:${notification.sessionId}:${notification.kind}`,
          ).catch(() => {
            // Notifications are best-effort and should never break chat state updates.
          });
        }
      }
    });
  }, []);

  return null;
}
