import { DEFAULT_CHAT_SESSION_TITLE, getChatSessionDisplayTitle } from './chatSessionTitlePresentation.ts';
import { resolveKernelChatSessionState } from './kernelChatSessionState.ts';

type ChatHeaderMessageLike = {
  role?: string;
  content?: string;
};

type ChatHeaderSessionLike = {
  id: string;
  title?: string;
  messages?: ChatHeaderMessageLike[];
  lastMessagePreview?: string;
  model?: string;
  defaultModel?: string | null;
  runId?: string | null;
  kernelSession?: {
    modelBinding?: {
      model?: string | null;
      defaultModel?: string | null;
    } | null;
    activeRunId?: string | null;
  } | null;
};

type ChatHeaderGatewayConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | null
  | undefined;

type ChatHeaderSyncState = 'idle' | 'loading' | 'error' | null | undefined;

export type ChatHeaderStatus =
  | 'ready'
  | 'responding'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'unavailable';

export type ChatHeaderPresentation = {
  title: string;
  status: ChatHeaderStatus;
  detailItems: string[];
};

function normalizeLabel(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function appendUniqueDetailItem(detailItems: string[], value: string | null | undefined) {
  const normalized = normalizeLabel(value);
  if (!normalized) {
    return;
  }

  if (detailItems.includes(normalized)) {
    return;
  }

  detailItems.push(normalized);
}

function resolveChatHeaderStatus(params: {
  isChatSupported: boolean;
  isOpenClawGateway: boolean;
  gatewayConnectionStatus: ChatHeaderGatewayConnectionStatus;
  syncState: ChatHeaderSyncState;
  isActiveSessionGenerating: boolean;
  activeSessionRunId: string | null | undefined;
}): ChatHeaderStatus {
  if (params.isActiveSessionGenerating || normalizeLabel(params.activeSessionRunId)) {
    return 'responding';
  }

  if (!params.isChatSupported) {
    return 'unavailable';
  }

  if (!params.isOpenClawGateway) {
    return 'ready';
  }

  if (
    params.syncState === 'loading' &&
    params.gatewayConnectionStatus !== 'connected'
  ) {
    return 'reconnecting';
  }

  if (
    params.gatewayConnectionStatus === 'connecting' ||
    params.gatewayConnectionStatus === 'reconnecting'
  ) {
    return 'reconnecting';
  }

  if (params.gatewayConnectionStatus === 'connected') {
    return 'connected';
  }

  return 'disconnected';
}

export function presentChatHeader(params: {
  isChatSupported?: boolean;
  activeSession?: ChatHeaderSessionLike | null;
  isOpenClawGateway: boolean;
  gatewayConnectionStatus?: ChatHeaderGatewayConnectionStatus;
  syncState?: ChatHeaderSyncState;
  activeAgentName?: string | null;
  activeModelName?: string | null;
  isActiveSessionGenerating?: boolean;
}): ChatHeaderPresentation {
  const title = params.activeSession
    ? getChatSessionDisplayTitle(params.activeSession)
    : DEFAULT_CHAT_SESSION_TITLE;
  const detailItems: string[] = [];
  const activeSessionState = resolveKernelChatSessionState(params.activeSession);
  const activeSessionModel =
    normalizeLabel(activeSessionState.model) ||
    normalizeLabel(activeSessionState.defaultModel) ||
    null;
  const visibleModelName = activeSessionModel || normalizeLabel(params.activeModelName) || null;

  appendUniqueDetailItem(detailItems, params.activeAgentName);
  appendUniqueDetailItem(detailItems, visibleModelName);

  return {
    title,
    status: resolveChatHeaderStatus({
      isChatSupported: params.isChatSupported !== false,
      isOpenClawGateway: params.isOpenClawGateway,
      gatewayConnectionStatus: params.gatewayConnectionStatus,
      syncState: params.syncState,
      isActiveSessionGenerating: Boolean(params.isActiveSessionGenerating),
      activeSessionRunId: activeSessionState.activeRunId,
    }),
    detailItems,
  };
}
