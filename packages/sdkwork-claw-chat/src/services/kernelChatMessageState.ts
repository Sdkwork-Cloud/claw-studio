import type { KernelChatMessage, StudioConversationAttachment } from '@sdkwork/claw-types';
import type { OpenClawToolCard } from './openClawMessagePresentation.ts';

type KernelChatMessageStateSource = {
  id?: string;
  role?: string | null;
  content?: string;
  timestamp?: number;
  senderLabel?: string | null;
  model?: string | null;
  runId?: string | null;
  attachments?: StudioConversationAttachment[];
  reasoning?: string | null;
  toolCards?: OpenClawToolCard[];
  kernelMessage?: KernelChatMessage | null;
};

export type KernelChatMessageState = {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  senderLabel: string | null;
  model?: string;
  runId?: string;
  attachments: StudioConversationAttachment[];
  reasoning: string | null;
  toolCards: OpenClawToolCard[];
};

function trimNullableString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeRole(value: string | null | undefined): KernelChatMessageState['role'] {
  const normalized = trimNullableString(value);
  switch (normalized) {
    case 'user':
    case 'assistant':
    case 'system':
    case 'tool':
      return normalized;
    case 'runtime':
      return 'system';
    default:
      return 'assistant';
  }
}

function cloneAttachments(attachments: StudioConversationAttachment[] | undefined) {
  return attachments?.map((attachment) => ({ ...attachment })) ?? [];
}

function cloneToolCards(toolCards: OpenClawToolCard[] | undefined) {
  return toolCards?.map((toolCard) => ({ ...toolCard })) ?? [];
}

function resolveKernelContent(kernelMessage: KernelChatMessage) {
  const textParts = kernelMessage.parts
    .filter((part) => part.kind === 'text')
    .map((part) => part.text);
  if (textParts.length > 0) {
    return textParts.join('\n\n');
  }

  return kernelMessage.text;
}

function resolveKernelReasoning(kernelMessage: KernelChatMessage) {
  const reasoningParts = kernelMessage.parts
    .filter((part) => part.kind === 'reasoning')
    .map((part) => trimNullableString(part.text))
    .filter((value): value is string => Boolean(value));
  return reasoningParts.length > 0 ? reasoningParts.join('\n\n') : null;
}

function resolveKernelAttachments(kernelMessage: KernelChatMessage) {
  return kernelMessage.parts
    .filter((part) => part.kind === 'attachment')
    .map((part) => ({ ...part.attachment }));
}

function resolveKernelToolCards(kernelMessage: KernelChatMessage): OpenClawToolCard[] {
  const toolCards: OpenClawToolCard[] = [];

  for (const part of kernelMessage.parts) {
    if (part.kind === 'toolCall') {
      toolCards.push({
        kind: 'call',
        name: part.toolName,
        ...(trimNullableString(part.detail) ? { detail: trimNullableString(part.detail) ?? undefined } : {}),
      });
      continue;
    }

    if (part.kind === 'toolResult') {
      toolCards.push({
        kind: 'result',
        name: part.toolName,
        ...(trimNullableString(part.preview) ? { preview: trimNullableString(part.preview) ?? undefined } : {}),
      });
    }
  }

  return toolCards;
}

export function resolveKernelChatMessageState(
  message: KernelChatMessageStateSource | null | undefined,
): KernelChatMessageState {
  const kernelMessage = message?.kernelMessage ?? null;
  const kernelTimestamp =
    typeof kernelMessage?.updatedAt === 'number'
      ? kernelMessage.updatedAt
      : typeof kernelMessage?.createdAt === 'number'
        ? kernelMessage.createdAt
        : null;

  return {
    id: trimNullableString(kernelMessage?.id) ?? trimNullableString(message?.id) ?? undefined,
    role: normalizeRole(kernelMessage?.role ?? message?.role),
    content: kernelMessage ? resolveKernelContent(kernelMessage) : message?.content ?? '',
    timestamp:
      kernelTimestamp ??
      (typeof message?.timestamp === 'number' ? message.timestamp : 0),
    senderLabel:
      trimNullableString(kernelMessage?.senderLabel) ?? trimNullableString(message?.senderLabel),
    model:
      trimNullableString(kernelMessage?.model) ??
      trimNullableString(message?.model) ??
      undefined,
    runId:
      trimNullableString(kernelMessage?.runId) ??
      trimNullableString(message?.runId) ??
      undefined,
    attachments: kernelMessage
      ? resolveKernelAttachments(kernelMessage)
      : cloneAttachments(message?.attachments),
    reasoning: kernelMessage
      ? resolveKernelReasoning(kernelMessage)
      : trimNullableString(message?.reasoning),
    toolCards: kernelMessage
      ? resolveKernelToolCards(kernelMessage)
      : cloneToolCards(message?.toolCards),
  };
}
