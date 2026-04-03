import type { StudioConversationAttachment } from '@sdkwork/claw-types';
import type {
  OpenClawGatewayChatEvent,
  OpenClawGatewayChatHistoryResult,
  OpenClawGatewayHelloOk,
  OpenClawGatewayConnectionEvent,
  OpenClawGatewayGapEvent,
  OpenClawGatewayModelsListResult,
  OpenClawGatewaySessionMessageEvent,
  OpenClawGatewaySessionsPatchResult,
  OpenClawGatewaySessionsListResult,
} from '../services/store/index.ts';
import {
  OpenClawGatewayRequestError,
  buildOpenClawMainSessionKey,
  buildOpenClawThreadSessionKey,
  buildGatewayAttachments,
  composeOutgoingChatText,
  DEFAULT_CHAT_SESSION_TITLE,
  isGatewayMethodUnavailableError,
  isAnyOpenClawMainSession,
  resolveGatewayErrorDetailCode,
  resolveInitialChatSessionTitle,
  resolveGatewayEventSupport,
  resolveGatewayMethodSupport,
  selectReadableChatSessionTitleCandidates,
} from '../services/store/index.ts';
import {
  resolveOpenClawMessagePresentation,
  type OpenClawMessagePresentationRole,
  type OpenClawToolCard,
} from '../services/index.ts';

export type OpenClawGatewayRole = OpenClawMessagePresentationRole;
export type OpenClawGatewaySyncState = 'idle' | 'loading' | 'error';
export type OpenClawGatewayConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';
type OpenClawGatewayTitleSource = 'default' | 'preview' | 'explicit' | 'firstUser';

export interface OpenClawGatewayMessage {
  id: string;
  role: OpenClawGatewayRole;
  content: string;
  timestamp: number;
  senderLabel?: string | null;
  seq?: number;
  model?: string;
  runId?: string;
  attachments?: StudioConversationAttachment[];
  reasoning?: string | null;
  toolCards?: OpenClawToolCard[];
}

export interface OpenClawGatewayChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: OpenClawGatewayMessage[];
  model: string;
  defaultModel?: string | null;
  instanceId?: string;
  transport?: 'openclawGateway';
  isDraft?: boolean;
  runId?: string | null;
  thinkingLevel?: string | null;
  lastMessagePreview?: string;
  titleSource?: OpenClawGatewayTitleSource;
}

export interface OpenClawGatewayInstanceSnapshot {
  sessions: OpenClawGatewayChatSession[];
  activeSessionId: string | null;
  syncState: OpenClawGatewaySyncState;
  connectionStatus: OpenClawGatewayConnectionStatus;
  lastError?: string;
}

export interface OpenClawGatewayClientLike {
  connect: () => Promise<OpenClawGatewayHelloOk>;
  disconnect: () => void;
  subscribeSessions: () => Promise<unknown>;
  subscribeSessionMessages: (params: { key: string }) => Promise<unknown>;
  unsubscribeSessionMessages: (params: { key: string }) => Promise<unknown>;
  listSessions: (params?: {
    includeGlobal?: boolean;
    includeUnknown?: boolean;
    activeMinutes?: number;
    limit?: number;
    includeDerivedTitles?: boolean;
    includeLastMessage?: boolean;
    agentId?: string;
  }) => Promise<OpenClawGatewaySessionsListResult>;
  getChatHistory: (params: {
    sessionKey: string;
    limit?: number;
    maxChars?: number;
  }) => Promise<OpenClawGatewayChatHistoryResult>;
  listModels: () => Promise<OpenClawGatewayModelsListResult>;
  patchSession: (params: {
    key: string;
    label?: string | null;
    model?: string | null;
    thinkingLevel?: string | null;
    fastMode?: boolean | null;
    verboseLevel?: string | null;
    reasoningLevel?: string | null;
    contextTokens?: number | null;
  }) => Promise<OpenClawGatewaySessionsPatchResult>;
  sendChatMessage: (params: {
    sessionKey: string;
    message: string;
    idempotencyKey?: string;
    deliver?: boolean;
    attachments?: unknown[];
  }) => Promise<{
    runId: string;
    response?: unknown;
  }>;
  abortChatRun: (params: { sessionKey: string; runId?: string }) => Promise<unknown>;
  resetSession: (params: { key: string; reason?: 'new' | 'reset' }) => Promise<unknown>;
  deleteSession: (params: { key: string; deleteTranscript?: boolean }) => Promise<unknown>;
  on(event: 'chat', listener: (payload: OpenClawGatewayChatEvent) => void): () => void;
  on(
    event: 'connection',
    listener: (payload: OpenClawGatewayConnectionEvent) => void,
  ): () => void;
  on(event: 'gap', listener: (payload: OpenClawGatewayGapEvent) => void): () => void;
  on(
    event: 'session.message',
    listener: (payload: OpenClawGatewaySessionMessageEvent) => void,
  ): () => void;
  on(event: 'sessions.changed', listener: (payload: unknown) => void): () => void;
}

interface OpenClawGatewaySessionStoreOptions {
  getClient: (
    instanceId: string,
  ) => OpenClawGatewayClientLike | Promise<OpenClawGatewayClientLike>;
  now?: () => number;
  createSessionKey?: (instanceId: string, agentId?: string | null) => string;
  createRunId?: () => string;
  historyMaxChars?: number;
  resolveHistoryMaxChars?: (instanceId: string) => number | undefined | Promise<number | undefined>;
}

type InternalInstanceState = {
  client: OpenClawGatewayClientLike;
  snapshot: OpenClawGatewayInstanceSnapshot;
  subscribed: boolean;
  sessionsSubscribeUnsupported: boolean;
  sessionMessagesSubscribeUnsupported: boolean;
  subscribedSessionMessageKeys: Set<string>;
  offChat?: () => void;
  offConnection?: () => void;
  offGap?: () => void;
  offSessionMessage?: () => void;
  offSessionsChanged?: () => void;
  refreshVersion: number;
};

type SessionHistoryRequestSnapshot = {
  updatedAt: number;
  runId: string | null;
  messageCount: number;
};

const SILENT_REPLY_PATTERN = /^\s*NO_REPLY\s*$/;
const MISSING_OPERATOR_READ_SCOPE_MESSAGE = 'missing scope: operator.read';
const AUTH_UNAUTHORIZED_DETAIL_CODE = 'AUTH_UNAUTHORIZED';

function createInitialSnapshot(): OpenClawGatewayInstanceSnapshot {
  return {
    sessions: [],
    activeSessionId: null,
    syncState: 'idle',
    connectionStatus: 'disconnected',
    lastError: undefined,
  };
}

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isSilentReplyText(value: string) {
  return SILENT_REPLY_PATTERN.test(value);
}

function isMissingOperatorReadScopeError(error: unknown): boolean {
  if (error instanceof OpenClawGatewayRequestError) {
    const detailCode = resolveGatewayErrorDetailCode(error);
    if (detailCode === AUTH_UNAUTHORIZED_DETAIL_CODE) {
      return true;
    }
  }

  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return message.toLowerCase().includes(MISSING_OPERATOR_READ_SCOPE_MESSAGE);
}

function formatMissingOperatorReadScopeMessage(feature: string) {
  return `This connection is missing operator.read, so ${feature} cannot be loaded yet.`;
}

function normalizeGatewayErrorMessage(message: unknown): string | null {
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  if (message instanceof Error && typeof message.message === 'string' && message.message.trim()) {
    return message.message;
  }

  return null;
}

function formatGatewayConnectError(error: unknown): string | null {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (!error || typeof error !== 'object') {
    return null;
  }

  const message = normalizeGatewayErrorMessage(
    error instanceof Error ? error : (error as { message?: unknown }).message,
  );
  const detailCode = resolveGatewayErrorDetailCode(error as { details?: unknown });

  switch (detailCode) {
    case 'AUTH_TOKEN_MISMATCH':
      return 'gateway token mismatch';
    case AUTH_UNAUTHORIZED_DETAIL_CODE:
      return 'gateway auth failed';
    case 'AUTH_RATE_LIMITED':
      return 'too many failed authentication attempts';
    case 'PAIRING_REQUIRED':
      return 'gateway pairing required';
    case 'CONTROL_UI_DEVICE_IDENTITY_REQUIRED':
      return 'device identity required (use HTTPS/localhost or allow insecure auth explicitly)';
    case 'CONTROL_UI_ORIGIN_NOT_ALLOWED':
      return 'origin not allowed (open the Control UI from the gateway host or allow it in gateway.controlUi.allowedOrigins)';
    case 'AUTH_TOKEN_MISSING':
      return 'gateway token missing';
    default:
      break;
  }

  if (!message) {
    return null;
  }

  const normalized = message.trim().toLowerCase();
  if (
    normalized === 'fetch failed' ||
    normalized === 'failed to fetch' ||
    normalized === 'connect failed'
  ) {
    return 'gateway connect failed';
  }

  return message;
}

function isSilentReplyAssistantPayload(payload: unknown, extractedText: string) {
  if (!extractedText || !isSilentReplyText(extractedText)) {
    return false;
  }

  if (!payload || typeof payload !== 'object') {
    return true;
  }

  const role = (payload as Record<string, unknown>).role;
  if (typeof role !== 'string') {
    return true;
  }

  return role.toLowerCase() === 'assistant';
}

function extractMessagePresentation(payload: unknown) {
  return resolveOpenClawMessagePresentation(payload);
}

function extractMessageText(payload: unknown) {
  return extractMessagePresentation(payload).text;
}

function normalizeTimestamp(payload: unknown, fallback: number) {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const candidate = record.timestamp ?? record.createdAt ?? record.updatedAt ?? record.ts;
  return typeof candidate === 'number' ? candidate : fallback;
}

function normalizeRole(payload: unknown): OpenClawGatewayRole {
  return extractMessagePresentation(payload).role;
}

function normalizeAttachmentKind(value: unknown): StudioConversationAttachment['kind'] {
  return value === 'image' ||
    value === 'audio' ||
    value === 'video' ||
    value === 'screenshot' ||
    value === 'screen-recording' ||
    value === 'link'
    ? value
    : 'file';
}

function normalizeAttachment(payload: unknown): StudioConversationAttachment | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const idCandidate = record.id ?? record.fileId ?? record.objectKey ?? record.url;
  const nameCandidate = record.name ?? record.fileName ?? record.label ?? record.objectKey;
  const id = typeof idCandidate === 'string' && idCandidate.trim()
    ? idCandidate.trim()
    : null;
  const name = typeof nameCandidate === 'string' && nameCandidate.trim()
    ? nameCandidate.trim()
    : 'Attachment';

  if (!id) {
    return null;
  }

  const sizeBytesCandidate = record.sizeBytes ?? record.size ?? record.fileSize;
  const widthCandidate = record.width;
  const heightCandidate = record.height;
  const durationMsCandidate = record.durationMs ?? record.duration;

  return {
    id,
    kind: normalizeAttachmentKind(record.kind ?? record.type),
    name,
    url: typeof record.url === 'string' ? record.url : undefined,
    previewUrl:
      typeof record.previewUrl === 'string'
        ? record.previewUrl
        : typeof record.url === 'string'
          ? record.url
          : undefined,
    objectKey: typeof record.objectKey === 'string' ? record.objectKey : undefined,
    mimeType:
      typeof record.mimeType === 'string'
        ? record.mimeType
        : typeof record.contentType === 'string'
          ? record.contentType
          : undefined,
    sizeBytes: typeof sizeBytesCandidate === 'number' ? sizeBytesCandidate : undefined,
    fileId: typeof record.fileId === 'string' ? record.fileId : undefined,
    originalUrl:
      typeof record.originalUrl === 'string' ? record.originalUrl : undefined,
    width: typeof widthCandidate === 'number' ? widthCandidate : undefined,
    height: typeof heightCandidate === 'number' ? heightCandidate : undefined,
    durationMs:
      typeof durationMsCandidate === 'number' ? durationMsCandidate : undefined,
  };
}

function resolveInlineAttachmentName(url: string | undefined, fallback: string) {
  if (!url) {
    return fallback;
  }

  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.trim();
    const lastSegment = pathname.split('/').filter(Boolean).at(-1);
    return lastSegment || fallback;
  } catch {
    return fallback;
  }
}

function resolveInlineAttachmentDataUrl(source: Record<string, unknown>) {
  if (typeof source.data !== 'string' || !source.data.trim()) {
    return null;
  }

  const data = source.data.trim();
  if (data.startsWith('data:')) {
    return data;
  }

  const mediaType =
    typeof source.media_type === 'string' && source.media_type.trim()
      ? source.media_type.trim()
      : 'image/png';

  return `data:${mediaType};base64,${data}`;
}

function normalizeInlineContentAttachment(
  payload: unknown,
  index: number,
): StudioConversationAttachment | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const type = typeof record.type === 'string' ? record.type.toLowerCase() : '';
  if (type === 'image') {
    const source =
      record.source && typeof record.source === 'object' && !Array.isArray(record.source)
        ? (record.source as Record<string, unknown>)
        : null;
    const inlineUrl =
      (source ? resolveInlineAttachmentDataUrl(source) : null) ||
      (typeof record.url === 'string' && record.url.trim() ? record.url.trim() : null);
    if (!inlineUrl) {
      return null;
    }

    const mimeType =
      typeof source?.media_type === 'string' && source.media_type.trim()
        ? source.media_type.trim()
        : undefined;

    return {
      id:
        (typeof record.id === 'string' && record.id.trim()) ||
        (typeof record.fileId === 'string' && record.fileId.trim()) ||
        inlineUrl ||
        `inline-image-${index}`,
      kind: 'image',
      name:
        (typeof record.name === 'string' && record.name.trim()) ||
        resolveInlineAttachmentName(
          typeof record.url === 'string' ? record.url : undefined,
          'Image',
        ),
      url: inlineUrl.startsWith('data:') ? undefined : inlineUrl,
      previewUrl: inlineUrl,
      mimeType,
    };
  }

  if (type === 'image_url') {
    const imageUrl =
      record.image_url && typeof record.image_url === 'object' && !Array.isArray(record.image_url)
        ? (record.image_url as Record<string, unknown>)
        : null;
    const url =
      typeof imageUrl?.url === 'string' && imageUrl.url.trim() ? imageUrl.url.trim() : null;
    if (!url) {
      return null;
    }

    return {
      id:
        (typeof record.id === 'string' && record.id.trim()) ||
        (typeof record.fileId === 'string' && record.fileId.trim()) ||
        url ||
        `inline-image-url-${index}`,
      kind: 'image',
      name:
        (typeof record.name === 'string' && record.name.trim()) ||
        resolveInlineAttachmentName(url, 'Image'),
      url,
      previewUrl: url,
    };
  }

  return null;
}

function normalizeAttachments(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const attachmentItems = Array.isArray(record.attachments) ? record.attachments : [];
  const contentItems = Array.isArray(record.content) ? record.content : [];
  const attachments = [
    ...attachmentItems.map((attachment) => normalizeAttachment(attachment)),
    ...contentItems.map((item, index) => normalizeInlineContentAttachment(item, index)),
  ]
    .filter((attachment): attachment is StudioConversationAttachment => attachment !== null);

  return attachments.length > 0 ? attachments : undefined;
}

function cloneAttachments(
  attachments: StudioConversationAttachment[] | undefined,
) {
  if (!attachments || attachments.length === 0) {
    return undefined;
  }

  return attachments.map((attachment) => ({ ...attachment }));
}

function cloneToolCards(toolCards: OpenClawToolCard[] | undefined) {
  if (!toolCards || toolCards.length === 0) {
    return undefined;
  }

  return toolCards.map((toolCard) => ({ ...toolCard }));
}

function normalizeSenderLabelValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveSenderLabel(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (normalizeSenderLabelValue(record.senderLabel)) {
    return normalizeSenderLabelValue(record.senderLabel);
  }

  if (normalizeSenderLabelValue(record.sender_label)) {
    return normalizeSenderLabelValue(record.sender_label);
  }

  const openClawMeta =
    record.__openclaw && typeof record.__openclaw === 'object' && !Array.isArray(record.__openclaw)
      ? (record.__openclaw as Record<string, unknown>)
      : null;
  if (normalizeSenderLabelValue(openClawMeta?.senderLabel)) {
    return normalizeSenderLabelValue(openClawMeta?.senderLabel);
  }

  return normalizeSenderLabelValue(openClawMeta?.sender_label);
}

function createGatewayMessage(input: {
  id: string;
  role: OpenClawGatewayRole;
  content: string;
  timestamp: number;
  senderLabel?: string | null;
  seq?: number;
  model?: string;
  runId?: string;
  attachments?: StudioConversationAttachment[];
  reasoning?: string | null;
  toolCards?: OpenClawToolCard[];
}): OpenClawGatewayMessage {
  const attachments = cloneAttachments(input.attachments);
  const toolCards = cloneToolCards(input.toolCards);

  return {
    id: input.id,
    role: input.role,
    content: input.content,
    timestamp: input.timestamp,
    ...(input.senderLabel !== undefined ? { senderLabel: input.senderLabel } : {}),
    ...(typeof input.seq === 'number' ? { seq: input.seq } : {}),
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.runId !== undefined ? { runId: input.runId } : {}),
    ...(attachments ? { attachments } : {}),
    ...(input.reasoning !== undefined ? { reasoning: input.reasoning } : {}),
    ...(toolCards ? { toolCards } : {}),
  };
}

function resolveMessagePreview(message: {
  content: string;
  attachments?: StudioConversationAttachment[];
  toolCards?: OpenClawToolCard[];
}) {
  const text = message.content.trim();
  if (text) {
    return text;
  }

  const attachmentName = message.attachments?.[0]?.name?.trim();
  if (attachmentName) {
    return attachmentName;
  }

  const primaryToolCard = message.toolCards?.[0];
  if (!primaryToolCard) {
    return undefined;
  }

  const toolPreview = primaryToolCard.detail || primaryToolCard.preview || primaryToolCard.name;
  return toolPreview.trim() || undefined;
}

function normalizeMessage(
  payload: unknown,
  fallbackTimestamp: number,
  fallbackIdPrefix: string,
): OpenClawGatewayMessage | null {
  const presentation = extractMessagePresentation(payload);
  const content = presentation.text;
  const attachments = normalizeAttachments(payload);
  const toolCards = cloneToolCards(presentation.toolCards);
  if (!content && (!attachments || attachments.length === 0) && (!toolCards || toolCards.length === 0)) {
    return null;
  }

  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const role = presentation.role;
  if (role === 'assistant' && isSilentReplyText(content)) {
    return null;
  }

  const idCandidate = record.id ?? record.messageId;
  return createGatewayMessage({
    id: typeof idCandidate === 'string' && idCandidate ? idCandidate : createMessageId(fallbackIdPrefix),
    role,
    content,
    timestamp: normalizeTimestamp(payload, fallbackTimestamp),
    senderLabel: resolveSenderLabel(record),
    seq: typeof record.seq === 'number' ? record.seq : undefined,
    model: typeof record.model === 'string' ? record.model : undefined,
    runId: typeof record.runId === 'string' ? record.runId : undefined,
    attachments,
    reasoning: presentation.reasoning,
    toolCards,
  });
}

function normalizeSessionMessage(
  payload: OpenClawGatewaySessionMessageEvent,
  fallbackTimestamp: number,
) {
  const record = payload as Record<string, unknown>;
  const messageRecord =
    record.message && typeof record.message === 'object' && !Array.isArray(record.message)
      ? ({ ...(record.message as Record<string, unknown>) } satisfies Record<string, unknown>)
      : {};
  const openClawMeta =
    messageRecord.__openclaw &&
    typeof messageRecord.__openclaw === 'object' &&
    !Array.isArray(messageRecord.__openclaw)
      ? (messageRecord.__openclaw as Record<string, unknown>)
      : null;
  const normalizedPayload: Record<string, unknown> = {
    ...messageRecord,
    ...(typeof record.messageId === 'string' && !messageRecord.id
      ? { id: record.messageId }
      : {}),
    ...(typeof record.messageSeq === 'number' && messageRecord.seq === undefined
      ? { seq: record.messageSeq }
      : {}),
    ...(typeof record.model === 'string' && typeof messageRecord.model !== 'string'
      ? { model: record.model }
      : {}),
    ...(normalizeSenderLabelValue(record.senderLabel) && !normalizeSenderLabelValue(messageRecord.senderLabel)
      ? { senderLabel: normalizeSenderLabelValue(record.senderLabel) }
      : {}),
    ...(normalizeSenderLabelValue(record.sender_label) &&
    !normalizeSenderLabelValue(messageRecord.senderLabel) &&
    !normalizeSenderLabelValue(messageRecord.sender_label)
      ? { sender_label: normalizeSenderLabelValue(record.sender_label) }
      : {}),
    ...(typeof openClawMeta?.id === 'string' && !messageRecord.id ? { id: openClawMeta.id } : {}),
    ...(typeof openClawMeta?.seq === 'number' && messageRecord.seq === undefined
      ? { seq: openClawMeta.seq }
      : {}),
  };
  return normalizeMessage(normalizedPayload, fallbackTimestamp, 'session-message');
}

function deriveSessionTitle(
  existingTitle: string,
  messageContent: string,
  attachments: StudioConversationAttachment[],
  isFirstUserMessage: boolean,
) {
  return resolveInitialChatSessionTitle({
    existingTitle,
    text: messageContent,
    attachments,
    isFirstUserMessage,
  });
}

function buildSessionTitle(row: Record<string, unknown>) {
  return selectReadableChatSessionTitleCandidates(
    [
      typeof row.derivedTitle === 'string' ? row.derivedTitle : undefined,
      typeof row.displayName === 'string' ? row.displayName : undefined,
      typeof row.label === 'string' ? row.label : undefined,
      typeof row.lastMessagePreview === 'string' ? row.lastMessagePreview : undefined,
      typeof row.key === 'string' ? row.key : undefined,
    ],
    DEFAULT_CHAT_SESSION_TITLE,
  );
}

function buildSessionTitleState(row: Record<string, unknown>) {
  const explicitTitle = selectReadableChatSessionTitleCandidates(
    [
      typeof row.derivedTitle === 'string' ? row.derivedTitle : undefined,
      typeof row.displayName === 'string' ? row.displayName : undefined,
      typeof row.label === 'string' ? row.label : undefined,
    ],
    '',
  );

  if (explicitTitle) {
    return {
      title: explicitTitle,
      source: 'explicit' as const,
    };
  }

  const previewTitle = selectReadableChatSessionTitleCandidates(
    [typeof row.lastMessagePreview === 'string' ? row.lastMessagePreview : undefined],
    '',
  );
  if (previewTitle) {
    return {
      title: previewTitle,
      source: 'preview' as const,
    };
  }

  return {
    title: buildSessionTitle(row),
    source: 'default' as const,
  };
}

function createAttachmentMatchKey(attachment: StudioConversationAttachment) {
  return [
    attachment.id,
    attachment.objectKey,
    attachment.fileId,
    attachment.url,
    attachment.name,
    attachment.kind,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('::');
}

function areAttachmentsSemanticallyEqual(
  left: StudioConversationAttachment[] | undefined,
  right: StudioConversationAttachment[] | undefined,
) {
  const leftAttachments = left ?? [];
  const rightAttachments = right ?? [];
  if (leftAttachments.length !== rightAttachments.length) {
    return false;
  }

  return leftAttachments.every((attachment, index) => {
    const rightAttachment = rightAttachments[index];
    if (!rightAttachment) {
      return false;
    }

    return createAttachmentMatchKey(attachment) === createAttachmentMatchKey(rightAttachment);
  });
}

function areToolCardsSemanticallyEqual(
  left: OpenClawToolCard[] | undefined,
  right: OpenClawToolCard[] | undefined,
) {
  const leftCards = left ?? [];
  const rightCards = right ?? [];
  if (leftCards.length !== rightCards.length) {
    return false;
  }

  return leftCards.every((toolCard, index) => {
    const rightToolCard = rightCards[index];
    if (!rightToolCard) {
      return false;
    }

    return (
      toolCard.kind === rightToolCard.kind &&
      toolCard.name === rightToolCard.name &&
      (toolCard.detail ?? '') === (rightToolCard.detail ?? '') &&
      (toolCard.preview ?? '') === (rightToolCard.preview ?? '')
    );
  });
}

function areMessagesSemanticallyEqual(
  left: OpenClawGatewayMessage,
  right: OpenClawGatewayMessage,
) {
  return (
    left.role === right.role &&
    (left.senderLabel?.trim() || '') === (right.senderLabel?.trim() || '') &&
    left.content.trim() === right.content.trim() &&
    areAttachmentsSemanticallyEqual(left.attachments, right.attachments) &&
    areToolCardsSemanticallyEqual(left.toolCards, right.toolCards)
  );
}

function cloneMessage(message: OpenClawGatewayMessage): OpenClawGatewayMessage {
  return createGatewayMessage({
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    senderLabel: message.senderLabel,
    seq: message.seq,
    model: message.model,
    runId: message.runId,
    attachments: message.attachments,
    reasoning: message.reasoning,
    toolCards: message.toolCards,
  });
}

function findExistingMessageIndex(
  messages: OpenClawGatewayMessage[],
  candidate: OpenClawGatewayMessage,
) {
  const normalizedId = candidate.id.trim();
  if (normalizedId) {
    const idMatchIndex = messages.findIndex((message) => message.id === normalizedId);
    if (idMatchIndex >= 0) {
      return idMatchIndex;
    }
  }

  if (typeof candidate.seq === 'number') {
    const seqMatchIndex = messages.findIndex((message) => message.seq === candidate.seq);
    if (seqMatchIndex >= 0) {
      return seqMatchIndex;
    }
  }

  return -1;
}

function upsertSessionMessage(
  messages: OpenClawGatewayMessage[],
  candidate: OpenClawGatewayMessage,
) {
  const existingIndex = findExistingMessageIndex(messages, candidate);
  if (existingIndex < 0) {
    return [...messages, cloneMessage(candidate)];
  }

  return messages.map((message, index) =>
    index === existingIndex
      ? {
          ...message,
          ...cloneMessage(candidate),
          attachments: cloneAttachments(candidate.attachments) ?? cloneAttachments(message.attachments),
        }
      : message,
  );
}

function shouldPreserveLocalMessageInHistoryMerge(
  message: OpenClawGatewayMessage,
  preserveAssistantRunId?: string | null,
) {
  if (message.role === 'user') {
    return true;
  }

  const normalizedAssistantRunId = preserveAssistantRunId?.trim() || null;
  return (
    Boolean(normalizedAssistantRunId) &&
    (message.role === 'assistant' || message.role === 'tool') &&
    (message.runId?.trim() || null) === normalizedAssistantRunId
  );
}

function shouldSkipLocalAssistantForRemoteTerminalMessage(params: {
  localMessage: OpenClawGatewayMessage;
  remoteMessages: OpenClawGatewayMessage[];
  remoteIndex: number;
  preserveAssistantRunId?: string | null;
  preferRemoteTerminalAssistantMessage?: boolean;
}) {
  const {
    localMessage,
    remoteMessages,
    remoteIndex,
    preserveAssistantRunId,
    preferRemoteTerminalAssistantMessage,
  } = params;
  if (
    !preferRemoteTerminalAssistantMessage ||
    localMessage.role !== 'assistant' ||
    !shouldPreserveLocalMessageInHistoryMerge(localMessage, preserveAssistantRunId)
  ) {
    return false;
  }

  for (let index = remoteIndex; index < remoteMessages.length; index += 1) {
    if (remoteMessages[index]?.role === 'assistant') {
      return true;
    }
  }

  return false;
}

function hasSemanticallyMatchingMessage(
  messages: OpenClawGatewayMessage[],
  candidate: OpenClawGatewayMessage,
) {
  return messages.some((message) => {
    const byIdentity = findExistingMessageIndex([message], candidate) >= 0;
    return byIdentity || areMessagesSemanticallyEqual(message, candidate);
  });
}

function mergeHistoryWithLocalMessages(
  localMessages: OpenClawGatewayMessage[],
  remoteMessages: OpenClawGatewayMessage[],
  options?: {
    preserveAssistantRunId?: string | null;
    preserveFromIndex?: number | null;
    preferRemoteTerminalAssistantMessage?: boolean;
  },
) {
  const preserveAssistantRunId = options?.preserveAssistantRunId;
  const preserveFromIndex = options?.preserveFromIndex;
  const preferRemoteTerminalAssistantMessage = options?.preferRemoteTerminalAssistantMessage;
  const mergeableLocalMessages =
    typeof preserveFromIndex === 'number'
      ? localMessages.slice(0, preserveFromIndex)
      : localMessages;
  const appendedLocalMessages =
    typeof preserveFromIndex === 'number'
      ? localMessages.slice(preserveFromIndex)
      : [];

  if (mergeableLocalMessages.length === 0 && appendedLocalMessages.length > 0) {
    const mergedMessages = remoteMessages.map((message) => cloneMessage(message));
    for (const localMessage of appendedLocalMessages) {
      if (!hasSemanticallyMatchingMessage(mergedMessages, localMessage)) {
        mergedMessages.push(cloneMessage(localMessage));
      }
    }
    return mergedMessages;
  }

  if (mergeableLocalMessages.length === 0 || remoteMessages.length === 0) {
    return remoteMessages.length === 0
      ? [...mergeableLocalMessages, ...appendedLocalMessages]
          .filter((message) =>
            shouldPreserveLocalMessageInHistoryMerge(message, preserveAssistantRunId),
          )
          .map((message) => cloneMessage(message))
      : [
          ...remoteMessages.map((message) => cloneMessage(message)),
          ...appendedLocalMessages
            .filter((message) => !hasSemanticallyMatchingMessage(remoteMessages, message))
            .map((message) => cloneMessage(message)),
        ];
  }

  const dp = Array.from({ length: mergeableLocalMessages.length + 1 }, () =>
    Array<number>(remoteMessages.length + 1).fill(0),
  );

  for (let localIndex = mergeableLocalMessages.length - 1; localIndex >= 0; localIndex -= 1) {
    for (let remoteIndex = remoteMessages.length - 1; remoteIndex >= 0; remoteIndex -= 1) {
      dp[localIndex]![remoteIndex] = areMessagesSemanticallyEqual(
        mergeableLocalMessages[localIndex]!,
        remoteMessages[remoteIndex]!,
      )
        ? 1 + dp[localIndex + 1]![remoteIndex + 1]!
        : Math.max(dp[localIndex + 1]![remoteIndex]!, dp[localIndex]![remoteIndex + 1]!);
    }
  }

  const mergedMessages: OpenClawGatewayMessage[] = [];
  let localIndex = 0;
  let remoteIndex = 0;

  while (localIndex < mergeableLocalMessages.length && remoteIndex < remoteMessages.length) {
    const localMessage = mergeableLocalMessages[localIndex]!;
    const remoteMessage = remoteMessages[remoteIndex]!;
    if (areMessagesSemanticallyEqual(localMessage, remoteMessage)) {
      mergedMessages.push(remoteMessage);
      localIndex += 1;
      remoteIndex += 1;
      continue;
    }

    if (dp[localIndex + 1]![remoteIndex]! >= dp[localIndex]![remoteIndex + 1]!) {
      if (
        shouldPreserveLocalMessageInHistoryMerge(localMessage, preserveAssistantRunId) &&
        !shouldSkipLocalAssistantForRemoteTerminalMessage({
          localMessage,
          remoteMessages,
          remoteIndex,
          preserveAssistantRunId,
          preferRemoteTerminalAssistantMessage,
        })
      ) {
        mergedMessages.push(cloneMessage(localMessage));
      }
      localIndex += 1;
      continue;
    }

    mergedMessages.push(remoteMessage);
    remoteIndex += 1;
  }

  while (localIndex < mergeableLocalMessages.length) {
    const localMessage = mergeableLocalMessages[localIndex]!;
    if (
      shouldPreserveLocalMessageInHistoryMerge(localMessage, preserveAssistantRunId) &&
      !shouldSkipLocalAssistantForRemoteTerminalMessage({
        localMessage,
        remoteMessages,
        remoteIndex,
        preserveAssistantRunId,
        preferRemoteTerminalAssistantMessage,
      })
    ) {
      mergedMessages.push(cloneMessage(localMessage));
    }
    localIndex += 1;
  }

  while (remoteIndex < remoteMessages.length) {
    mergedMessages.push(remoteMessages[remoteIndex]!);
    remoteIndex += 1;
  }

  for (const localMessage of appendedLocalMessages) {
    if (
      preferRemoteTerminalAssistantMessage &&
      localMessage.role === 'assistant' &&
      mergedMessages.at(-1)?.role === 'assistant'
    ) {
      continue;
    }
    if (!hasSemanticallyMatchingMessage(mergedMessages, localMessage)) {
      mergedMessages.push(cloneMessage(localMessage));
    }
  }

  return mergedMessages;
}

function shouldMergeTranscriptIntoActiveAssistant(params: {
  sessionRunId?: string | null;
  lastMessage?: OpenClawGatewayMessage;
  transcriptMessage: OpenClawGatewayMessage;
}) {
  const sessionRunId = params.sessionRunId?.trim() || null;
  const { lastMessage, transcriptMessage } = params;
  if (
    !sessionRunId ||
    !lastMessage ||
    lastMessage.role !== 'assistant' ||
    transcriptMessage.role !== 'assistant' ||
    (lastMessage.runId?.trim() || null) !== sessionRunId
  ) {
    return false;
  }

  const lastContent = lastMessage.content.trim();
  const transcriptContent = transcriptMessage.content.trim();
  if (!lastContent || !transcriptContent) {
    return false;
  }

  return (
    lastContent === transcriptContent ||
    lastContent.startsWith(transcriptContent) ||
    transcriptContent.startsWith(lastContent)
  );
}

function cloneSession(session: OpenClawGatewayChatSession): OpenClawGatewayChatSession {
  return {
    ...session,
    messages: session.messages.map((message) => cloneMessage(message)),
  };
}

function normalizeSessionModelRef(params: {
  provider?: string | null;
  model?: string | null;
}) {
  const provider = params.provider?.trim();
  const model = params.model?.trim();
  if (!model) {
    return null;
  }

  return provider ? `${provider}/${model}` : model;
}

function resolveSessionMessageSupport(
  hello: Pick<OpenClawGatewayHelloOk, 'features'> | null | undefined,
) {
  const subscribeSupport = resolveGatewayMethodSupport(hello, 'sessions.messages.subscribe');
  const unsubscribeSupport = resolveGatewayMethodSupport(hello, 'sessions.messages.unsubscribe');
  const eventSupport = resolveGatewayEventSupport(hello, 'session.message');

  if (subscribeSupport === false || unsubscribeSupport === false || eventSupport === false) {
    return false;
  }

  if (subscribeSupport === true && unsubscribeSupport === true && eventSupport === true) {
    return true;
  }

  return null;
}

function resolveConnectionEventErrorMessage(event: OpenClawGatewayConnectionEvent): string | null {
  if (event.error?.message?.trim()) {
    return event.error.message.trim();
  }

  const reason = event.reason?.trim() || 'no reason';
  if (typeof event.code === 'number') {
    return `Gateway disconnected (${event.code}): ${reason}`;
  }

  return reason === 'no reason' ? null : reason;
}

export class OpenClawGatewaySessionStore {
  private readonly getClient: OpenClawGatewaySessionStoreOptions['getClient'];
  private readonly now: () => number;
  private readonly createSessionKey: (instanceId: string, agentId?: string | null) => string;
  private readonly createRunId: () => string;
  private readonly historyMaxChars: number | undefined;
  private readonly resolveHistoryMaxChars:
    (instanceId: string) => number | undefined | Promise<number | undefined>;
  private readonly instances = new Map<string, InternalInstanceState>();
  private readonly listeners = new Set<
    (instanceId: string, snapshot: OpenClawGatewayInstanceSnapshot) => void
  >();
  private runCounter = 0;

  constructor(options: OpenClawGatewaySessionStoreOptions) {
    this.getClient = options.getClient;
    this.now = options.now ?? (() => Date.now());
    this.createSessionKey =
      options.createSessionKey ??
      ((instanceId, agentId) =>
        buildOpenClawThreadSessionKey(
          agentId,
          `claw-studio:${instanceId}:${Math.random().toString(36).slice(2, 10)}`,
        ));
    this.createRunId =
      options.createRunId ??
      (() => {
        this.runCounter += 1;
        return `run-${this.runCounter}`;
      });
    this.historyMaxChars = options.historyMaxChars;
    this.resolveHistoryMaxChars =
      options.resolveHistoryMaxChars ??
      (() => this.historyMaxChars);
  }

  subscribe(listener: (instanceId: string, snapshot: OpenClawGatewayInstanceSnapshot) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(instanceId: string): OpenClawGatewayInstanceSnapshot {
    const snapshot = this.instances.get(instanceId)?.snapshot ?? createInitialSnapshot();
    return {
      ...snapshot,
      sessions: snapshot.sessions.map(cloneSession),
    };
  }

  async hydrateInstance(instanceId: string) {
    return this.refreshInstance(instanceId, {
      preserveActiveSessionId: true,
      reloadActiveHistory: true,
    });
  }

  createDraftSession(
    instanceId: string,
    model?: string,
    options?: {
      sessionId?: string | null;
      agentId?: string | null;
    },
  ) {
    const state = this.getOrCreatePlaceholderState(instanceId);
    const timestamp = this.now();
    const normalizedModel = model?.trim() || '';
    const session: OpenClawGatewayChatSession = {
      id: options?.sessionId?.trim() || this.createSessionKey(instanceId, options?.agentId),
      title: DEFAULT_CHAT_SESSION_TITLE,
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [],
      model: normalizedModel,
      instanceId,
      transport: 'openclawGateway',
      isDraft: true,
      runId: null,
      thinkingLevel: null,
      lastMessagePreview: undefined,
      titleSource: 'default',
    };

    state.snapshot.sessions = [session, ...state.snapshot.sessions.filter((item) => item.id !== session.id)];
    state.snapshot.activeSessionId = session.id;
    state.snapshot.lastError = undefined;
    this.sortSessions(state.snapshot);
    this.emit(instanceId);
    void this.synchronizeSessionMessageSubscription(instanceId, state);
    return cloneSession(session);
  }

  async setActiveSession(params: { instanceId: string; sessionId: string | null }) {
    const state = await this.ensureState(params.instanceId);
    state.snapshot.activeSessionId = params.sessionId;
    state.snapshot.lastError = undefined;

    if (!params.sessionId) {
      this.emit(params.instanceId);
      void this.synchronizeSessionMessageSubscription(params.instanceId, state);
      return this.getSnapshot(params.instanceId);
    }

    const session = state.snapshot.sessions.find((entry) => entry.id === params.sessionId);
    this.emit(params.instanceId);
    void this.synchronizeSessionMessageSubscription(params.instanceId, state);

    if (session && !session.isDraft) {
      await this.refreshSessionHistory(params.instanceId, params.sessionId);
    }

    return this.getSnapshot(params.instanceId);
  }

  async setSessionModel(params: {
    instanceId: string;
    sessionId: string;
    model: string | null;
  }) {
    const state = await this.ensureState(params.instanceId);
    const session = this.findSession(state, params.sessionId);
    if (!session) {
      throw new Error(`OpenClaw session not found: ${params.sessionId}`);
    }

    if (session.isDraft) {
      session.model = params.model?.trim() || session.defaultModel || session.model;
      session.updatedAt = this.now();
      state.snapshot.lastError = undefined;
      this.sortSessions(state.snapshot);
      this.emit(params.instanceId);
      return this.getSnapshot(params.instanceId);
    }

    try {
      const result = await state.client.patchSession({
        key: params.sessionId,
        model: params.model?.trim() || null,
      });
      const resolvedModel = normalizeSessionModelRef({
        provider: result.resolved?.modelProvider,
        model: result.resolved?.model,
      });
      if (params.model?.trim()) {
        session.model = params.model.trim();
      } else {
        session.model = resolvedModel || session.defaultModel || session.model;
        if (resolvedModel) {
          session.defaultModel = resolvedModel;
        }
      }
      session.updatedAt = this.now();
      state.snapshot.lastError = undefined;
      this.sortSessions(state.snapshot);
      this.emit(params.instanceId);
      return this.getSnapshot(params.instanceId);
    } catch (error) {
      state.snapshot.lastError = this.toErrorMessage(
        error,
        'Failed to update the OpenClaw session model.',
      );
      this.emit(params.instanceId);
      throw error;
    }
  }

  async sendMessage(params: {
    instanceId: string;
    sessionId: string;
    content: string;
    model?: string;
    attachments?: StudioConversationAttachment[];
    requestText?: string;
  }) {
    const state = await this.ensureState(params.instanceId);
    const session = this.findSession(state, params.sessionId);
    if (!session) {
      throw new Error(`OpenClaw session not found: ${params.sessionId}`);
    }

    const requestedModel = params.model?.trim() || null;
    const effectiveDefaultModel = session.defaultModel || session.model;
    if (
      requestedModel &&
      requestedModel !== session.model &&
      requestedModel !== effectiveDefaultModel
    ) {
      await this.setSessionModel({
        instanceId: params.instanceId,
        sessionId: params.sessionId,
        model: requestedModel,
      });
    }

    const timestamp = this.now();
    const attachments = cloneAttachments(params.attachments);
    const outgoingAttachments = attachments ?? [];
    const outgoingText =
      params.requestText?.trim() ||
      composeOutgoingChatText(params.content, outgoingAttachments);
    const userMessage = createGatewayMessage({
      id: createMessageId('msg'),
      role: 'user',
      content: params.content,
      timestamp,
      attachments,
    });

    session.messages = [...session.messages, userMessage];
    session.updatedAt = timestamp;
    session.model = requestedModel || session.model;
    session.title = deriveSessionTitle(
      session.title,
      params.content,
      outgoingAttachments,
      session.messages.length === 1,
    );
    if (session.messages.length === 1) {
      session.titleSource = 'firstUser';
    }
    session.lastMessagePreview =
      resolveMessagePreview(userMessage) || session.lastMessagePreview;
    state.snapshot.activeSessionId = session.id;
    state.snapshot.lastError = undefined;
    this.sortSessions(state.snapshot);
    this.emit(params.instanceId);

    try {
      const runId = this.createRunId();
      const result = await state.client.sendChatMessage({
        sessionKey: session.id,
        message: outgoingText,
        deliver: false,
        idempotencyKey: runId,
        ...(outgoingAttachments.length > 0
          ? { attachments: buildGatewayAttachments(outgoingAttachments) }
          : {}),
      });
      session.runId = result.runId || runId;
      this.emit(params.instanceId);
      return {
        runId: session.runId,
      };
    } catch (error) {
      const errorMessage = this.toErrorMessage(error, 'Failed to send OpenClaw message.');
      const errorTimestamp = this.now();
      session.messages = [
        ...session.messages,
        {
          id: createMessageId('assistant'),
          role: 'assistant',
          content: `Error: ${errorMessage}`,
          timestamp: errorTimestamp,
        },
      ];
      session.runId = null;
      session.updatedAt = errorTimestamp;
      session.lastMessagePreview = `Error: ${errorMessage}`;
      this.sortSessions(state.snapshot);
      state.snapshot.lastError = errorMessage;
      this.emit(params.instanceId);
      throw error;
    }
  }

  async abortRun(params: { instanceId: string; sessionId: string }) {
    const state = await this.ensureState(params.instanceId);
    const session = this.findSession(state, params.sessionId);
    if (!session) {
      return false;
    }

    try {
      await state.client.abortChatRun({
        sessionKey: params.sessionId,
        runId: session.runId ?? undefined,
      });
      await this.refreshSessionHistory(params.instanceId, params.sessionId);
      return true;
    } catch (error) {
      state.snapshot.lastError = this.toErrorMessage(error, 'Failed to abort OpenClaw response.');
      this.emit(params.instanceId);
      return false;
    }
  }

  async resetSession(params: { instanceId: string; sessionId: string }) {
    const state = await this.ensureState(params.instanceId);
    try {
      await state.client.resetSession({ key: params.sessionId });
      await this.refreshSessionHistory(params.instanceId, params.sessionId);
      return true;
    } catch (error) {
      state.snapshot.lastError = this.toErrorMessage(error, 'Failed to reset OpenClaw session.');
      this.emit(params.instanceId);
      return false;
    }
  }

  async startNewSession(params: {
    instanceId: string;
    agentId?: string | null;
    model?: string;
  }) {
    const state = await this.ensureState(params.instanceId);
    const sessionId = buildOpenClawMainSessionKey(params.agentId);
    const previousActiveSessionId = state.snapshot.activeSessionId;
    state.snapshot.activeSessionId = sessionId;
    state.snapshot.lastError = undefined;
    this.emit(params.instanceId);

    try {
      await state.client.resetSession({
        key: sessionId,
        reason: 'new',
      });
      await this.refreshInstance(params.instanceId, {
        preserveActiveSessionId: true,
        reloadActiveHistory: true,
      });
    } catch (error) {
      state.snapshot.activeSessionId = previousActiveSessionId;
      state.snapshot.lastError = this.toErrorMessage(
        error,
        'Failed to start a new OpenClaw session.',
      );
      this.emit(params.instanceId);
      return null;
    }

    const requestedModel = params.model?.trim() || null;
    const nextSession = this.getSnapshot(params.instanceId).sessions.find(
      (session) => session.id === sessionId,
    );
    const nextDefaultModel = nextSession?.defaultModel?.trim() || null;
    if (
      requestedModel &&
      nextSession &&
      requestedModel !== nextSession.model &&
      requestedModel !== nextDefaultModel
    ) {
      try {
        await this.setSessionModel({
          instanceId: params.instanceId,
          sessionId,
          model: requestedModel,
        });
      } catch {
        // setSessionModel already records the gateway error state for the UI
      }
    }

    return sessionId;
  }

  async deleteSession(params: { instanceId: string; sessionId: string }) {
    const state = await this.ensureState(params.instanceId);
    try {
      await state.client.deleteSession({
        key: params.sessionId,
        deleteTranscript: true,
      });
      await this.refreshInstance(params.instanceId, {
        preserveActiveSessionId: false,
        reloadActiveHistory: true,
      });
      return true;
    } catch (error) {
      state.snapshot.lastError = this.toErrorMessage(error, 'Failed to delete OpenClaw session.');
      this.emit(params.instanceId);
      return false;
    }
  }

  private async ensureState(instanceId: string) {
    const existing = this.instances.get(instanceId);
    if (existing) {
      return existing;
    }

    const client = await Promise.resolve(this.getClient(instanceId));
    const state: InternalInstanceState = {
      client,
      snapshot: createInitialSnapshot(),
      subscribed: false,
      sessionsSubscribeUnsupported: false,
      sessionMessagesSubscribeUnsupported: false,
      subscribedSessionMessageKeys: new Set<string>(),
      refreshVersion: 0,
    };
    state.offChat = client.on('chat', (payload: OpenClawGatewayChatEvent) => {
      this.handleChatEvent(instanceId, payload);
    });
    state.offSessionMessage = client.on(
      'session.message',
      (payload: OpenClawGatewaySessionMessageEvent) => {
        this.handleSessionMessageEvent(instanceId, payload);
      },
    );
    state.offConnection = client.on('connection', (event: OpenClawGatewayConnectionEvent) => {
      state.snapshot.connectionStatus = event.status;
      if (event.status === 'connected') {
        state.snapshot.lastError = undefined;
      } else {
        const errorMessage = resolveConnectionEventErrorMessage(event);
        if (errorMessage) {
          state.snapshot.lastError = errorMessage;
        }
      }

      if (event.status === 'reconnecting' || event.status === 'disconnected') {
        state.subscribed = false;
        state.sessionsSubscribeUnsupported = false;
        state.sessionMessagesSubscribeUnsupported = false;
        state.subscribedSessionMessageKeys.clear();
        this.emit(instanceId);
      }

      if (event.status === 'connecting') {
        this.emit(instanceId);
      }

      if (event.status === 'connected') {
        state.subscribed = false;
        state.sessionsSubscribeUnsupported = false;
        state.sessionMessagesSubscribeUnsupported = false;
        state.subscribedSessionMessageKeys.clear();
        if (state.snapshot.syncState === 'loading') {
          this.emit(instanceId);
          return;
        }

        this.emit(instanceId);
        void this.refreshInstance(instanceId, {
          preserveActiveSessionId: true,
          reloadActiveHistory: true,
        });
      }
    });
    state.offGap = client.on('gap', (_event: OpenClawGatewayGapEvent) => {
      if (state.snapshot.syncState === 'loading') {
        return;
      }

      void this.refreshInstance(instanceId, {
        preserveActiveSessionId: true,
        reloadActiveHistory: true,
      });
    });
    state.offSessionsChanged = client.on('sessions.changed', (payload: unknown) => {
      if (this.shouldIgnoreSessionsChangedRefresh(state, payload)) {
        return;
      }

      void this.refreshInstance(instanceId, {
        preserveActiveSessionId: true,
        reloadActiveHistory: true,
      });
    });
    this.instances.set(instanceId, state);
    return state;
  }

  private getOrCreatePlaceholderState(instanceId: string) {
    const existing = this.instances.get(instanceId);
    if (existing) {
      return existing;
    }

    const state: InternalInstanceState = {
      client: {
        connect: async () => ({ type: 'hello-ok', protocol: 3 }),
        disconnect: () => {},
        subscribeSessions: async () => ({ ok: true }),
        subscribeSessionMessages: async ({ key }) => ({ subscribed: true, key }),
        unsubscribeSessionMessages: async ({ key }) => ({ subscribed: false, key }),
        listSessions: async () => ({
          ts: this.now(),
          path: '',
          count: 0,
          defaults: {},
          sessions: [],
        }),
        getChatHistory: async () => ({ messages: [], thinkingLevel: null }),
        listModels: async () => ({ models: [] }),
        patchSession: async () => ({ ok: true }),
        sendChatMessage: async () => ({ runId: this.createRunId() }),
        abortChatRun: async () => ({ aborted: true }),
        resetSession: async () => ({ ok: true }),
        deleteSession: async () => ({ ok: true }),
        on: () => () => {},
      },
      snapshot: createInitialSnapshot(),
      subscribed: false,
      sessionsSubscribeUnsupported: false,
      sessionMessagesSubscribeUnsupported: false,
      subscribedSessionMessageKeys: new Set<string>(),
      refreshVersion: 0,
    };
    this.instances.set(instanceId, state);
    return state;
  }

  private async refreshInstance(
    instanceId: string,
    options: {
      preserveActiveSessionId: boolean;
      reloadActiveHistory: boolean;
    },
  ) {
    const state = await this.ensureState(instanceId);
    const refreshVersion = state.refreshVersion + 1;
    state.refreshVersion = refreshVersion;
    state.snapshot.syncState = 'loading';
    if (state.snapshot.connectionStatus === 'disconnected') {
      state.snapshot.connectionStatus = 'connecting';
    }
    state.snapshot.lastError = undefined;
    this.emit(instanceId);

    try {
      const hello = await state.client.connect();
      state.snapshot.connectionStatus = 'connected';
      const sessionsSubscribeSupport = resolveGatewayMethodSupport(hello, 'sessions.subscribe');
      if (sessionsSubscribeSupport === false) {
        state.sessionsSubscribeUnsupported = true;
        state.subscribed = false;
      } else if (sessionsSubscribeSupport === true) {
        state.sessionsSubscribeUnsupported = false;
      }

      const sessionMessageSupport = resolveSessionMessageSupport(hello);
      if (sessionMessageSupport === false) {
        state.sessionMessagesSubscribeUnsupported = true;
        state.subscribedSessionMessageKeys.clear();
      } else if (sessionMessageSupport === true) {
        state.sessionMessagesSubscribeUnsupported = false;
      }

      if (!state.subscribed && !state.sessionsSubscribeUnsupported) {
        try {
          await state.client.subscribeSessions();
          state.subscribed = true;
        } catch (error) {
          if (this.isSessionsSubscribeUnsupportedError(error)) {
            state.sessionsSubscribeUnsupported = true;
            state.subscribed = false;
          } else {
            throw error;
          }
        }
      }

      const result = await state.client.listSessions({
        includeGlobal: false,
        includeDerivedTitles: true,
        includeLastMessage: true,
      });
      if (!this.isLatestRefresh(state, refreshVersion)) {
        return this.getSnapshot(instanceId);
      }

      const existingSessions = new Map(
        state.snapshot.sessions.map((session) => [session.id, session] as const),
      );
      const draftSessions = state.snapshot.sessions.filter(
        (session) => session.isDraft && !result.sessions.some((row) => row.key === session.id),
      );
      const nextSessions = result.sessions.map((row) => {
        const record = row as Record<string, unknown>;
        const existing = existingSessions.get(String(record.key));
        const rowTitleState = buildSessionTitleState(record);
        const rowLastMessagePreview =
          typeof record.lastMessagePreview === 'string' ? record.lastMessagePreview : undefined;
        const updatedAt =
          typeof record.updatedAt === 'number' ? record.updatedAt : existing?.updatedAt ?? this.now();
        const resolvedModel =
          normalizeSessionModelRef({
            provider: typeof record.modelProvider === 'string' ? record.modelProvider : null,
            model: typeof record.model === 'string' ? record.model : null,
          }) ||
          normalizeSessionModelRef({
            provider: result.defaults.modelProvider,
            model: result.defaults.model,
          });
        const shouldKeepExistingTitle =
          rowTitleState.source !== 'explicit' &&
          (existing?.titleSource === 'firstUser' || existing?.titleSource === 'explicit') &&
          Boolean(existing?.title);

        return {
          id: String(record.key),
          title: shouldKeepExistingTitle ? existing!.title : rowTitleState.title,
          createdAt: existing?.createdAt ?? updatedAt,
          updatedAt,
          messages: existing?.messages ?? [],
          model: resolvedModel || existing?.model || 'OpenClaw Gateway',
          defaultModel:
            existing?.defaultModel ??
            (resolvedModel || existing?.model || 'OpenClaw Gateway'),
          instanceId,
          transport: 'openclawGateway' as const,
          isDraft: existing?.isDraft && !result.sessions.some((entry) => entry.key === record.key)
            ? true
            : undefined,
          runId: existing?.runId ?? null,
          thinkingLevel: existing?.thinkingLevel ?? null,
          lastMessagePreview: rowLastMessagePreview ?? existing?.lastMessagePreview,
          titleSource: shouldKeepExistingTitle ? existing?.titleSource : rowTitleState.source,
        } satisfies OpenClawGatewayChatSession;
      });

      state.snapshot.sessions = [...nextSessions, ...draftSessions].map((session) => ({
        ...session,
        instanceId,
        transport: 'openclawGateway',
      }));
      this.sortSessions(state.snapshot);

      const nextActiveSessionId = this.resolveActiveSessionId(
        state.snapshot,
        options.preserveActiveSessionId ? state.snapshot.activeSessionId : null,
      );
      state.snapshot.activeSessionId = nextActiveSessionId;
      state.snapshot.syncState = 'idle';
      state.snapshot.lastError = undefined;

      if (options.reloadActiveHistory && nextActiveSessionId) {
        const activeSession = state.snapshot.sessions.find(
          (session) => session.id === nextActiveSessionId,
        );
        if (activeSession && !activeSession.isDraft) {
          await this.refreshSessionHistory(instanceId, nextActiveSessionId, refreshVersion);
          await this.synchronizeSessionMessageSubscription(instanceId, state, hello);
          return this.getSnapshot(instanceId);
        }
      }

      await this.synchronizeSessionMessageSubscription(instanceId, state, hello);
      this.emit(instanceId);
      return this.getSnapshot(instanceId);
    } catch (error) {
      state.snapshot.connectionStatus = 'disconnected';
      state.snapshot.syncState = 'error';
      state.snapshot.lastError = this.toErrorMessage(
        error,
        'Failed to synchronize OpenClaw sessions.',
      );
      this.emit(instanceId);
      return this.getSnapshot(instanceId);
    }
  }

  private async refreshSessionHistory(
    instanceId: string,
    sessionId: string,
    refreshVersion?: number,
    options?: {
      preserveLocalUserMessages?: boolean;
      preserveLocalAssistantRunId?: string | null;
      preserveLocalMessagesFromIndex?: number | null;
      preserveRunId?: string | null;
      preferRemoteTerminalAssistantMessage?: boolean;
    },
  ) {
    const state = await this.ensureState(instanceId);
    try {
      const historyMaxChars = await this.resolveHistoryMaxChars(instanceId);
      const requestSnapshot = this.captureSessionHistoryRequestSnapshot(state, sessionId);
      const history = await state.client.getChatHistory({
        sessionKey: sessionId,
        limit: 200,
        ...(historyMaxChars !== undefined ? { maxChars: historyMaxChars } : {}),
      });
      if (refreshVersion !== undefined && !this.isLatestRefresh(state, refreshVersion)) {
        return;
      }

      const session = this.findSession(state, sessionId);
      if (!session) {
        return;
      }
      const advancedSinceRequest =
        requestSnapshot &&
        this.hasSessionStateAdvancedSinceHistoryRequest(session, requestSnapshot);
      const effectiveOptions = advancedSinceRequest
        ? {
            preserveLocalUserMessages: true,
            preserveLocalAssistantRunId:
              options?.preserveLocalAssistantRunId ?? (session.runId?.trim() || null),
            preserveLocalMessagesFromIndex: requestSnapshot.messageCount,
            preserveRunId: options?.preserveRunId ?? (session.runId?.trim() || null),
            preferRemoteTerminalAssistantMessage:
              options?.preferRemoteTerminalAssistantMessage,
          }
        : options;

      this.applyHistory(session, history, effectiveOptions);
      state.snapshot.syncState = 'idle';
      state.snapshot.lastError = undefined;
      this.sortSessions(state.snapshot);
      await this.synchronizeSessionMessageSubscription(instanceId, state);
      this.emit(instanceId);
    } catch (error) {
      state.snapshot.syncState = 'error';
      const session = this.findSession(state, sessionId);
      if (session && isMissingOperatorReadScopeError(error)) {
        session.messages = [];
        session.thinkingLevel = null;
        state.snapshot.lastError = formatMissingOperatorReadScopeMessage('existing chat history');
      } else {
        state.snapshot.lastError = this.toErrorMessage(
          error,
          'Failed to load OpenClaw history.',
        );
      }
      this.emit(instanceId);
    }
  }

  private applyHistory(
    session: OpenClawGatewayChatSession,
    history: OpenClawGatewayChatHistoryResult,
    options?: {
      preserveLocalUserMessages?: boolean;
      preserveLocalAssistantRunId?: string | null;
      preserveLocalMessagesFromIndex?: number | null;
      preserveRunId?: string | null;
      preferRemoteTerminalAssistantMessage?: boolean;
    },
  ) {
    const baseTimestamp = this.now();
    const remoteMessages = Array.isArray(history.messages)
      ? history.messages
          .map((message, index) => normalizeMessage(message, baseTimestamp + index, 'history'))
          .filter((message): message is OpenClawGatewayMessage => message !== null)
      : [];
    session.messages =
      options?.preserveLocalUserMessages || options?.preserveLocalAssistantRunId
        ? mergeHistoryWithLocalMessages(session.messages, remoteMessages, {
            preserveAssistantRunId: options?.preserveLocalAssistantRunId,
            preserveFromIndex: options?.preserveLocalMessagesFromIndex,
            preferRemoteTerminalAssistantMessage:
              options?.preferRemoteTerminalAssistantMessage,
          })
        : remoteMessages;
    session.thinkingLevel = history.thinkingLevel ?? null;
    session.runId =
      options && 'preserveRunId' in options
        ? options.preserveRunId ?? null
        : null;
    session.isDraft = false;
    session.lastMessagePreview =
      (session.messages.at(-1) ? resolveMessagePreview(session.messages.at(-1)!) : undefined) ||
      session.lastMessagePreview;
    session.updatedAt =
      session.messages.at(-1)?.timestamp ?? session.updatedAt ?? baseTimestamp;
    if (session.messages.length > 0) {
      const firstUserMessage = session.messages.find((message) => message.role === 'user');
      if (firstUserMessage && session.titleSource !== 'explicit') {
        session.title = deriveSessionTitle(
          DEFAULT_CHAT_SESSION_TITLE,
          firstUserMessage.content,
          firstUserMessage.attachments ?? [],
          true,
        );
        session.titleSource = 'firstUser';
      }
    }
  }

  private shouldIgnoreSessionsChangedRefresh(state: InternalInstanceState, payload: unknown) {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const record = payload as Record<string, unknown>;
    return (
      record.phase === 'message' &&
      typeof record.sessionKey === 'string' &&
      state.subscribedSessionMessageKeys.has(record.sessionKey)
    );
  }

  private async synchronizeSessionMessageSubscription(
    instanceId: string,
    state: InternalInstanceState,
    hello?: Pick<OpenClawGatewayHelloOk, 'features'> | null,
  ) {
    try {
      await this.syncSessionMessageSubscription(state, hello);
    } catch (error) {
      state.snapshot.lastError = this.toErrorMessage(
        error,
        'Failed to synchronize OpenClaw transcript updates.',
      );
      this.emit(instanceId);
    }
  }

  private async syncSessionMessageSubscription(
    state: InternalInstanceState,
    hello?: Pick<OpenClawGatewayHelloOk, 'features'> | null,
  ) {
    const support =
      hello === undefined ? null : resolveSessionMessageSupport(hello);
    if (support === false) {
      state.sessionMessagesSubscribeUnsupported = true;
      state.subscribedSessionMessageKeys.clear();
    } else if (support === true) {
      state.sessionMessagesSubscribeUnsupported = false;
    }

    if (state.sessionMessagesSubscribeUnsupported) {
      return;
    }

    const desiredKeys = state.snapshot.sessions
      .filter((session) => !session.isDraft)
      .map((session) => session.id);
    const desiredKeySet = new Set(desiredKeys);
    const subscribedKeys = [...state.subscribedSessionMessageKeys];

    for (const key of subscribedKeys) {
      if (desiredKeySet.has(key)) {
        continue;
      }

      try {
        await state.client.unsubscribeSessionMessages({ key });
      } catch (error) {
        if (!this.isSessionMessagesSubscribeUnsupportedError(error)) {
          throw error;
        }
        state.sessionMessagesSubscribeUnsupported = true;
        state.subscribedSessionMessageKeys.clear();
        return;
      }

      state.subscribedSessionMessageKeys.delete(key);
    }

    for (const key of desiredKeys) {
      if (state.subscribedSessionMessageKeys.has(key)) {
        continue;
      }

      try {
        await state.client.subscribeSessionMessages({ key });
      } catch (error) {
        if (!this.isSessionMessagesSubscribeUnsupportedError(error)) {
          throw error;
        }
        state.sessionMessagesSubscribeUnsupported = true;
        state.subscribedSessionMessageKeys.clear();
        return;
      }

      state.subscribedSessionMessageKeys.add(key);
    }
  }

  private handleSessionMessageEvent(
    instanceId: string,
    payload: OpenClawGatewaySessionMessageEvent,
  ) {
    const state = this.instances.get(instanceId);
    if (
      !state ||
      !payload?.sessionKey ||
      !state.subscribedSessionMessageKeys.has(payload.sessionKey)
    ) {
      return;
    }

    const session = this.findSession(state, payload.sessionKey);
    if (!session) {
      return;
    }

    const hadUserMessageBefore = session.messages.some((message) => message.role === 'user');
    const normalizedMessage = normalizeSessionMessage(payload, this.now());
    if (!normalizedMessage) {
      return;
    }
    const lastMessage = session.messages.at(-1);
    if (
      shouldMergeTranscriptIntoActiveAssistant({
        sessionRunId: session.runId,
        lastMessage,
        transcriptMessage: normalizedMessage,
      })
    ) {
      const mergedContent =
        normalizedMessage.content.length >= (lastMessage?.content.length ?? 0)
          ? normalizedMessage.content
          : lastMessage?.content ?? normalizedMessage.content;
      if (lastMessage) {
        lastMessage.id = normalizedMessage.id;
        if (typeof normalizedMessage.seq === 'number') {
          lastMessage.seq = normalizedMessage.seq;
        }
        lastMessage.content = mergedContent;
        lastMessage.timestamp = Math.max(lastMessage.timestamp, normalizedMessage.timestamp);
        if (normalizedMessage.senderLabel !== undefined) {
          lastMessage.senderLabel = normalizedMessage.senderLabel;
        }
        if (normalizedMessage.model) {
          lastMessage.model = normalizedMessage.model;
        }
        if (normalizedMessage.attachments) {
          lastMessage.attachments = cloneAttachments(normalizedMessage.attachments);
        }
        lastMessage.reasoning = normalizedMessage.reasoning;
        lastMessage.toolCards = cloneToolCards(normalizedMessage.toolCards);
      }
    } else {
      session.messages = upsertSessionMessage(session.messages, normalizedMessage);
    }
    session.updatedAt = Math.max(session.updatedAt, normalizedMessage.timestamp);
    session.isDraft = false;
    session.lastMessagePreview =
      resolveMessagePreview(normalizedMessage) ||
      session.lastMessagePreview;

    const payloadRecord = payload as Record<string, unknown>;
    const resolvedModel = normalizeSessionModelRef({
      provider:
        typeof payloadRecord.modelProvider === 'string' ? payloadRecord.modelProvider : null,
      model: typeof payloadRecord.model === 'string' ? payloadRecord.model : null,
    });
    if (resolvedModel) {
      session.model = resolvedModel;
      session.defaultModel = session.defaultModel ?? resolvedModel;
    }
    if (
      typeof payloadRecord.thinkingLevel === 'string' ||
      payloadRecord.thinkingLevel === null
    ) {
      session.thinkingLevel = payloadRecord.thinkingLevel as string | null;
    }
    if (!hadUserMessageBefore && normalizedMessage.role === 'user' && session.titleSource !== 'explicit') {
      session.title = deriveSessionTitle(
        DEFAULT_CHAT_SESSION_TITLE,
        normalizedMessage.content,
        normalizedMessage.attachments ?? [],
        true,
      );
      session.titleSource = 'firstUser';
    }

    this.sortSessions(state.snapshot);
    this.emit(instanceId);
  }

  private handleChatEvent(instanceId: string, payload: OpenClawGatewayChatEvent) {
    const state = this.instances.get(instanceId);
    if (!state || !payload?.sessionKey) {
      return;
    }

    const timestamp = this.now();
    const presentation = extractMessagePresentation(payload.message);
    const content = presentation.text;
    const attachments = normalizeAttachments(payload.message);
    const toolCards = cloneToolCards(presentation.toolCards);
    const payloadRole = presentation.role;
    const isSilentAssistantMessage = isSilentReplyAssistantPayload(payload.message, content);
    const payloadRecord = payload as Record<string, unknown>;
    const hasRenderableMessage =
      !isSilentAssistantMessage &&
      (payloadRole === 'assistant' || payloadRole === 'tool') &&
      (Boolean(content) || Boolean(attachments?.length) || Boolean(toolCards?.length));
    let createdLiveSession = false;
    let session = this.findSession(state, payload.sessionKey);
    if (!session) {
      session = this.createLivePlaceholderSession({
        instanceId,
        state,
        sessionId: payload.sessionKey,
        timestamp,
        role: payloadRole,
        content,
        attachments,
        toolCards,
        payload: payloadRecord,
        isSilentAssistantMessage,
      });
      createdLiveSession = Boolean(session);
    }
    if (!session) {
      return;
    }

    const lastMessage = session.messages.at(-1);
    const activeRunId = session.runId?.trim() || null;
    const incomingRunId =
      typeof payload.runId === 'string' && payload.runId.trim().length > 0
        ? payload.runId
        : null;
    const isOtherRunEvent = Boolean(activeRunId && incomingRunId && activeRunId !== incomingRunId);

    if (isOtherRunEvent) {
      if (payload.state !== 'final') {
        return;
      }

      if (!hasRenderableMessage) {
        void this.refreshSessionHistory(instanceId, session.id, undefined, {
          preserveLocalUserMessages: true,
          preserveLocalAssistantRunId: activeRunId,
          preserveRunId: activeRunId,
        });
        return;
      }

      session.messages = [
        ...session.messages,
        createGatewayMessage({
          id: createMessageId(payloadRole),
          role: payloadRole,
          content,
          timestamp,
          runId: incomingRunId ?? undefined,
          attachments,
          reasoning: presentation.reasoning,
          toolCards,
        }),
      ];
      session.updatedAt = timestamp;
      session.isDraft = false;
      session.lastMessagePreview =
        resolveMessagePreview(session.messages.at(-1)!) || session.lastMessagePreview;
      this.sortSessions(state.snapshot);
      this.emit(instanceId);
      if (createdLiveSession) {
        void this.synchronizeSessionMessageSubscription(instanceId, state);
      }
      return;
    }

    if (payload.state === 'delta') {
      if (!hasRenderableMessage) {
        return;
      }

      if (
        payloadRole === 'assistant' &&
        (!toolCards || toolCards.length === 0) &&
        lastMessage &&
        lastMessage.role === 'assistant' &&
        lastMessage.runId === payload.runId
      ) {
        if (!lastMessage.content || content.length >= lastMessage.content.length) {
          lastMessage.content = content;
        }
        lastMessage.timestamp = timestamp;
        if (attachments) {
          lastMessage.attachments = attachments;
        }
        lastMessage.reasoning = presentation.reasoning;
        lastMessage.toolCards = toolCards;
      } else {
        session.messages = [
          ...session.messages,
          createGatewayMessage({
            id: createMessageId(payloadRole),
            role: payloadRole,
            content,
            timestamp,
            runId: payload.runId,
            attachments,
            reasoning: presentation.reasoning,
            toolCards,
          }),
        ];
      }
      session.runId = incomingRunId ?? session.runId ?? null;
      session.updatedAt = timestamp;
      session.isDraft = false;
      session.lastMessagePreview =
        (session.messages.at(-1) ? resolveMessagePreview(session.messages.at(-1)!) : undefined) ||
        session.lastMessagePreview;
      this.sortSessions(state.snapshot);
      this.emit(instanceId);
      if (createdLiveSession) {
        void this.synchronizeSessionMessageSubscription(instanceId, state);
        void this.refreshSessionHistory(instanceId, session.id, undefined, {
          preserveLocalAssistantRunId: incomingRunId,
          preserveRunId: incomingRunId,
        });
      }
      return;
    }

    if (payload.state === 'final' || payload.state === 'aborted') {
      const terminalRunId = incomingRunId ?? activeRunId;
      if (
        hasRenderableMessage &&
        payloadRole === 'assistant' &&
        (!toolCards || toolCards.length === 0) &&
        lastMessage &&
        lastMessage.role === 'assistant' &&
        lastMessage.runId === payload.runId
      ) {
        lastMessage.content = content;
        lastMessage.timestamp = timestamp;
        lastMessage.attachments = attachments;
        lastMessage.reasoning = presentation.reasoning;
        lastMessage.toolCards = toolCards;
      } else if (hasRenderableMessage) {
        session.messages = [
          ...session.messages,
          createGatewayMessage({
            id: createMessageId(payloadRole),
            role: payloadRole,
            content,
            timestamp,
            runId: payload.runId,
            attachments,
            reasoning: presentation.reasoning,
            toolCards,
          }),
        ];
      }
      session.runId = null;
      session.isDraft = false;
      session.updatedAt = timestamp;
      session.lastMessagePreview =
        (hasRenderableMessage && session.messages.at(-1)
          ? resolveMessagePreview(session.messages.at(-1)!)
          : undefined) || session.lastMessagePreview;
      this.sortSessions(state.snapshot);
      this.emit(instanceId);
      if (createdLiveSession) {
        void this.synchronizeSessionMessageSubscription(instanceId, state);
      }
      void this.refreshSessionHistory(instanceId, session.id, undefined, {
        preserveLocalUserMessages: true,
        preserveLocalAssistantRunId: terminalRunId,
        preferRemoteTerminalAssistantMessage: payload.state === 'final',
      });
      return;
    }

    if (payload.state === 'error') {
      const failedRunId = incomingRunId ?? activeRunId;
      if (failedRunId) {
        session.messages = session.messages.filter(
          (message) => !(message.role === 'assistant' && message.runId === failedRunId),
        );
      }
      session.runId = null;
      session.updatedAt = timestamp;
      session.lastMessagePreview =
        (session.messages.at(-1) ? resolveMessagePreview(session.messages.at(-1)!) : undefined) ||
        session.lastMessagePreview;
      state.snapshot.lastError = payload.errorMessage ?? 'OpenClaw chat error.';
      this.emit(instanceId);
      if (createdLiveSession) {
        void this.synchronizeSessionMessageSubscription(instanceId, state);
      }
    }
  }

  private createLivePlaceholderSession(params: {
    instanceId: string;
    state: InternalInstanceState;
    sessionId: string;
    timestamp: number;
    role: OpenClawGatewayRole;
    content: string;
    attachments: StudioConversationAttachment[] | undefined;
    toolCards: OpenClawToolCard[] | undefined;
    payload: Record<string, unknown>;
    isSilentAssistantMessage: boolean;
  }) {
    const hasRenderableContent =
      Boolean(params.content) ||
      Boolean(params.attachments?.length) ||
      Boolean(params.toolCards?.length);
    if (!hasRenderableContent || params.isSilentAssistantMessage) {
      return null;
    }

    const resolvedModel = normalizeSessionModelRef({
      provider:
        typeof params.payload.modelProvider === 'string'
          ? params.payload.modelProvider
          : null,
      model: typeof params.payload.model === 'string' ? params.payload.model : null,
    });
    const session: OpenClawGatewayChatSession = {
      id: params.sessionId,
      title:
        params.role === 'user'
          ? deriveSessionTitle(
              DEFAULT_CHAT_SESSION_TITLE,
              params.content,
              params.attachments ?? [],
              true,
            )
          : DEFAULT_CHAT_SESSION_TITLE,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
      messages: [],
      model: resolvedModel ?? '',
      defaultModel: resolvedModel ?? null,
      instanceId: params.instanceId,
      transport: 'openclawGateway',
      isDraft: false,
      runId: null,
      thinkingLevel: null,
      lastMessagePreview: resolveMessagePreview({
        content: params.content,
        attachments: params.attachments,
        toolCards: params.toolCards,
      }),
      titleSource: params.role === 'user' ? 'firstUser' : 'default',
    };

    params.state.snapshot.sessions = [session, ...params.state.snapshot.sessions];
    params.state.snapshot.activeSessionId = session.id;
    return session;
  }

  private resolveActiveSessionId(
    snapshot: OpenClawGatewayInstanceSnapshot,
    preservedSessionId: string | null,
  ) {
    if (preservedSessionId && snapshot.sessions.some((session) => session.id === preservedSessionId)) {
      return preservedSessionId;
    }

    return (
      snapshot.sessions.find((session) => isAnyOpenClawMainSession(session.id))?.id ??
      snapshot.sessions[0]?.id ??
      null
    );
  }

  private findSession(state: InternalInstanceState, sessionId: string) {
    return state.snapshot.sessions.find((session) => session.id === sessionId);
  }

  private captureSessionHistoryRequestSnapshot(
    state: InternalInstanceState,
    sessionId: string,
  ): SessionHistoryRequestSnapshot | null {
    const session = this.findSession(state, sessionId);
    if (!session) {
      return null;
    }

    return {
      updatedAt: session.updatedAt,
      runId: session.runId?.trim() || null,
      messageCount: session.messages.length,
    };
  }

  private hasSessionStateAdvancedSinceHistoryRequest(
    session: OpenClawGatewayChatSession,
    snapshot: SessionHistoryRequestSnapshot,
  ) {
    return (
      session.updatedAt !== snapshot.updatedAt ||
      (session.runId?.trim() || null) !== snapshot.runId ||
      session.messages.length !== snapshot.messageCount
    );
  }

  private isLatestRefresh(state: InternalInstanceState, refreshVersion: number) {
    return state.refreshVersion === refreshVersion;
  }

  private sortSessions(snapshot: OpenClawGatewayInstanceSnapshot) {
    snapshot.sessions.sort((left, right) => right.updatedAt - left.updatedAt);
  }

  private emit(instanceId: string) {
    const snapshot = this.getSnapshot(instanceId);
    for (const listener of this.listeners) {
      listener(instanceId, snapshot);
    }
  }

  private toErrorMessage(error: unknown, fallback: string) {
    const formatted = formatGatewayConnectError(error);
    if (formatted) {
      return formatted;
    }

    return fallback;
  }

  private isSessionsSubscribeUnsupportedError(error: unknown) {
    return isGatewayMethodUnavailableError(error, 'sessions.subscribe');
  }

  private isSessionMessagesSubscribeUnsupportedError(error: unknown) {
    return (
      isGatewayMethodUnavailableError(error, 'sessions.messages.subscribe') ||
      isGatewayMethodUnavailableError(error, 'sessions.messages.unsubscribe')
    );
  }
}
