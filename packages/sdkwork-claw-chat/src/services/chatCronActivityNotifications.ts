import { getChatSessionDisplayTitle } from './chatSessionTitlePresentation.ts';
import { resolveKernelChatSessionState } from './kernelChatSessionState.ts';

const CRON_SESSION_ID_PATTERN = /(^cron:|:cron:)/i;
const CRON_TITLE_PREFIX_PATTERN = /^cron(?:\s+job)?\s*:/i;

type ChatCronActivityNotificationSessionLike = {
  id: string;
  title?: string;
  titleSource?: 'default' | 'preview' | 'explicit' | 'firstUser';
  lastMessagePreview?: string;
  runId?: string | null;
  kernelSession?: {
    activeRunId?: string | null;
  } | null;
  messages?: Array<{
    role?: string;
    content?: string;
  }>;
};

export interface ChatCronActivityNotification {
  kind: 'started' | 'completed';
  title: string;
  body: string;
  sessionId: string;
}

function normalizeRunId(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function isCronSession(sessionId: string | null | undefined) {
  return Boolean(sessionId && CRON_SESSION_ID_PATTERN.test(sessionId));
}

function resolveCronNotificationTitle(session: ChatCronActivityNotificationSessionLike) {
  const displayTitle = getChatSessionDisplayTitle(session);
  return CRON_TITLE_PREFIX_PATTERN.test(displayTitle)
    ? displayTitle
    : `Cron: ${displayTitle}`;
}

function resolveCronNotificationBody(
  session: ChatCronActivityNotificationSessionLike,
  kind: ChatCronActivityNotification['kind'],
) {
  const preview = session.lastMessagePreview?.trim();
  if (preview) {
    return preview;
  }

  return kind === 'started' ? 'Cron job started.' : 'Cron job completed.';
}

export function detectChatCronActivityNotification(params: {
  previousSession?: ChatCronActivityNotificationSessionLike | null;
  nextSession?: ChatCronActivityNotificationSessionLike | null;
}): ChatCronActivityNotification | null {
  const previousSession = params.previousSession ?? null;
  const nextSession = params.nextSession ?? null;
  if (!previousSession || !nextSession || previousSession.id !== nextSession.id) {
    return null;
  }

  if (!isCronSession(nextSession.id)) {
    return null;
  }

  const previousRunId = normalizeRunId(resolveKernelChatSessionState(previousSession).activeRunId);
  const nextRunId = normalizeRunId(resolveKernelChatSessionState(nextSession).activeRunId);
  if (!previousRunId && nextRunId) {
    return {
      kind: 'started',
      title: resolveCronNotificationTitle(nextSession),
      body: resolveCronNotificationBody(nextSession, 'started'),
      sessionId: nextSession.id,
    };
  }

  if (previousRunId && !nextRunId) {
    return {
      kind: 'completed',
      title: resolveCronNotificationTitle(nextSession),
      body: resolveCronNotificationBody(nextSession, 'completed'),
      sessionId: nextSession.id,
    };
  }

  return null;
}
