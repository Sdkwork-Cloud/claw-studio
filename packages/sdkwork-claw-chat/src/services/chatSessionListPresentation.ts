import type { StudioConversationAttachment } from '@sdkwork/claw-types';
import { getChatSessionDisplayTitle, normalizeChatSessionTitle } from './chatSessionTitlePresentation.ts';

const DEFAULT_PREVIEW_LENGTH = 96;

type ChatSessionListMessageLike = {
  role?: string;
  content?: string;
  attachments?: StudioConversationAttachment[];
};

type ChatSessionListSessionLike = {
  id: string;
  title?: string;
  updatedAt: number;
  lastMessagePreview?: string;
  messages?: ChatSessionListMessageLike[];
  runId?: string | null;
};

export type ChatSessionListItemPresentation = {
  displayTitle: string;
  preview: string | null;
  relativeTimeLabel: string;
  isRunning: boolean;
  isPinned: boolean;
  showDeleteAction: boolean;
};

function normalizePreviewCandidate(value: string | null | undefined) {
  return normalizeChatSessionTitle(value, DEFAULT_PREVIEW_LENGTH);
}

function listAttachmentPreviewNames(attachments: StudioConversationAttachment[] | undefined) {
  return normalizePreviewCandidate(
    (attachments ?? [])
      .map((attachment) => attachment.name.trim())
      .filter(Boolean)
      .join(', '),
  );
}

function collectMessagePreviewCandidates(messages: ChatSessionListMessageLike[] | undefined) {
  const normalizedMessages = Array.isArray(messages) ? [...messages] : [];
  const candidates: string[] = [];

  for (let index = normalizedMessages.length - 1; index >= 0; index -= 1) {
    const message = normalizedMessages[index];
    const contentCandidate = normalizePreviewCandidate(message?.content);
    if (contentCandidate) {
      candidates.push(contentCandidate);
    }

    const attachmentCandidate = listAttachmentPreviewNames(message?.attachments);
    if (attachmentCandidate) {
      candidates.push(attachmentCandidate);
    }
  }

  return candidates;
}

function resolvePreview(
  session: ChatSessionListSessionLike,
  displayTitle: string,
) {
  const normalizedTitle = normalizePreviewCandidate(displayTitle).toLowerCase();
  const previewCandidates = [
    ...collectMessagePreviewCandidates(session.messages),
    normalizePreviewCandidate(session.lastMessagePreview),
  ];

  for (const candidate of previewCandidates) {
    if (!candidate) {
      continue;
    }

    if (candidate.toLowerCase() === normalizedTitle) {
      continue;
    }

    return candidate;
  }

  return null;
}

export function formatChatSessionRelativeTime(params: {
  updatedAt: number;
  now?: number;
  locale?: string;
}) {
  const now = params.now ?? Date.now();
  const updatedAt = Math.min(params.updatedAt, now);
  const deltaMs = Math.max(0, now - updatedAt);

  if (deltaMs < 60_000) {
    return 'now';
  }

  if (deltaMs < 3_600_000) {
    return `${Math.floor(deltaMs / 60_000)}m`;
  }

  if (deltaMs < 86_400_000) {
    return `${Math.floor(deltaMs / 3_600_000)}h`;
  }

  if (deltaMs < 7 * 86_400_000) {
    return `${Math.floor(deltaMs / 86_400_000)}d`;
  }

  try {
    return new Intl.DateTimeFormat(params.locale, {
      month: 'short',
      day: 'numeric',
    }).format(updatedAt);
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(updatedAt);
  }
}

export function presentChatSessionListItem(params: {
  session: ChatSessionListSessionLike;
  now?: number;
  locale?: string;
  isGatewayMainSession?: boolean;
}): ChatSessionListItemPresentation {
  const displayTitle = getChatSessionDisplayTitle(params.session);
  const isPinned = Boolean(params.isGatewayMainSession);

  return {
    displayTitle,
    preview: resolvePreview(params.session, displayTitle),
    relativeTimeLabel: formatChatSessionRelativeTime({
      updatedAt: params.session.updatedAt,
      now: params.now,
      locale: params.locale,
    }),
    isRunning: Boolean(params.session.runId?.trim()),
    isPinned,
    showDeleteAction: !isPinned,
  };
}
