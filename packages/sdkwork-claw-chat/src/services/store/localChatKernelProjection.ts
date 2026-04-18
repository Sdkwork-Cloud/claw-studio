import type {
  KernelChatAuthority,
  KernelChatMessage,
  KernelChatSession,
  KernelChatSessionRef,
  StudioConversationAttachment,
} from '@sdkwork/claw-types';
import {
  createKernelChatAuthority,
  createKernelChatSessionRef,
} from '@sdkwork/claw-types';
import type { OpenClawToolCard } from '../openClawMessagePresentation.ts';
import {
  buildKernelChatMessageParts,
  trimOptionalString,
} from '../kernelChatProjectionParts.ts';

export const LOCAL_CHAT_PROJECTION_KERNEL_ID = 'studio-direct';
export const LOCAL_CHAT_PROJECTION_INSTANCE_ID = 'local-built-in';
export const LOCAL_CHAT_PROJECTION_SESSION_KIND = 'direct';

export interface LocalChatKernelProjectionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  senderLabel?: string | null;
  model?: string;
  runId?: string;
  attachments?: StudioConversationAttachment[];
  reasoning?: string | null;
  toolCards?: OpenClawToolCard[];
}

export interface LocalChatKernelProjectionSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: LocalChatKernelProjectionMessage[];
  model: string;
  instanceId?: string;
  defaultModel?: string | null;
  runId?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
  lastMessagePreview?: string;
  sessionKind?: string | null;
}

export type LocalChatProjectedMessage<T extends LocalChatKernelProjectionMessage =
  LocalChatKernelProjectionMessage> = T & {
  kernelMessage: KernelChatMessage;
};

export type LocalChatProjectedSession<T extends LocalChatKernelProjectionSession =
  LocalChatKernelProjectionSession> = Omit<T, 'messages'> & {
  messages: Array<LocalChatProjectedMessage<T['messages'][number]>>;
  kernelSession: KernelChatSession;
};

function normalizeTimestamp(value: number | undefined) {
  return typeof value === 'number' ? value : 0;
}

function resolveLocalProjectionInstanceId(instanceId: string | undefined) {
  return trimOptionalString(instanceId) ?? LOCAL_CHAT_PROJECTION_INSTANCE_ID;
}

function resolveSessionKind(sessionKind: string | null | undefined) {
  return trimOptionalString(sessionKind) ?? LOCAL_CHAT_PROJECTION_SESSION_KIND;
}

function resolveLastMessagePreview(session: LocalChatKernelProjectionSession) {
  const previewFromSession = trimOptionalString(session.lastMessagePreview);
  if (previewFromSession) {
    return previewFromSession;
  }

  return trimOptionalString(session.messages[session.messages.length - 1]?.content.slice(0, 120));
}

export function buildLocalChatKernelChatAuthority(): KernelChatAuthority {
  return createKernelChatAuthority({
    kind: 'localProjection',
    durable: true,
    writable: true,
  });
}

export function buildLocalChatKernelChatSessionRef(input: {
  sessionId: string;
  instanceId?: string;
}): KernelChatSessionRef {
  return createKernelChatSessionRef({
    kernelId: LOCAL_CHAT_PROJECTION_KERNEL_ID,
    instanceId: resolveLocalProjectionInstanceId(input.instanceId),
    sessionId: input.sessionId,
  });
}

export function buildLocalChatKernelChatSession(input: {
  session: LocalChatKernelProjectionSession;
}): KernelChatSession {
  const sessionRef = buildLocalChatKernelChatSessionRef({
    sessionId: input.session.id,
    instanceId: input.session.instanceId,
  });

  return {
    ref: sessionRef,
    authority: buildLocalChatKernelChatAuthority(),
    lifecycle: input.session.runId ? 'running' : input.session.messages.length === 0 ? 'draft' : 'ready',
    title: input.session.title,
    createdAt: normalizeTimestamp(input.session.createdAt),
    updatedAt: normalizeTimestamp(input.session.updatedAt),
    messageCount: input.session.messages.length,
    lastMessagePreview: resolveLastMessagePreview(input.session),
    sessionKind: resolveSessionKind(input.session.sessionKind),
    actorBinding: null,
    modelBinding: {
      model: trimOptionalString(input.session.model),
      defaultModel: trimOptionalString(input.session.defaultModel),
      thinkingLevel: trimOptionalString(input.session.thinkingLevel),
      fastMode: input.session.fastMode ?? null,
      verboseLevel: trimOptionalString(input.session.verboseLevel),
      reasoningLevel: trimOptionalString(input.session.reasoningLevel),
    },
    activeRunId: trimOptionalString(input.session.runId),
  };
}

export function buildLocalChatKernelChatMessage(input: {
  sessionRef: KernelChatSessionRef;
  message: LocalChatKernelProjectionMessage;
}): KernelChatMessage {
  return {
    id: input.message.id,
    sessionRef: input.sessionRef,
    role: input.message.role,
    status: input.message.runId ? 'streaming' : 'complete',
    createdAt: normalizeTimestamp(input.message.timestamp),
    updatedAt: normalizeTimestamp(input.message.timestamp),
    text: input.message.content,
    parts: buildKernelChatMessageParts(input.message),
    runId: trimOptionalString(input.message.runId),
    model: trimOptionalString(input.message.model),
    senderLabel: trimOptionalString(input.message.senderLabel),
  };
}

export function hydrateLocalChatKernelProjection<
  TSession extends LocalChatKernelProjectionSession,
>(input: {
  session: TSession;
}): LocalChatProjectedSession<TSession> {
  const kernelSession = buildLocalChatKernelChatSession(input);
  const messages = input.session.messages.map((message) => ({
    ...message,
    kernelMessage: buildLocalChatKernelChatMessage({
      sessionRef: kernelSession.ref,
      message,
    }),
  })) as Array<LocalChatProjectedMessage<TSession['messages'][number]>>;

  return {
    ...input.session,
    messages,
    kernelSession,
  };
}
