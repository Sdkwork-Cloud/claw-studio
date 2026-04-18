function trimRequiredString(value: string, fieldName: string) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new Error(`Kernel chat field "${fieldName}" must not be empty.`);
  }
  return normalized;
}

function trimOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

export const KERNEL_CHAT_MESSAGE_ROLES = [
  'system',
  'user',
  'assistant',
  'tool',
  'runtime',
] as const;

export type KernelChatMessageRole = (typeof KERNEL_CHAT_MESSAGE_ROLES)[number];

export const KERNEL_CHAT_MESSAGE_PART_KINDS = [
  'text',
  'reasoning',
  'toolCall',
  'toolResult',
  'attachment',
  'notice',
] as const;

export type KernelChatMessagePartKind = (typeof KERNEL_CHAT_MESSAGE_PART_KINDS)[number];

export const KERNEL_CHAT_AUTHORITY_KINDS = [
  'gateway',
  'sqlite',
  'http',
  'localProjection',
] as const;

export type KernelChatAuthorityKind = (typeof KERNEL_CHAT_AUTHORITY_KINDS)[number];

export const KERNEL_CHAT_RUN_STATUSES = [
  'queued',
  'running',
  'streaming',
  'completed',
  'aborted',
  'failed',
] as const;

export type KernelChatRunStatus = (typeof KERNEL_CHAT_RUN_STATUSES)[number];

export type KernelChatAuthoritySource = 'kernel' | 'studioProjection';

export interface KernelChatAttachment {
  id: string;
  kind: 'file' | 'image' | 'audio' | 'video' | 'screenshot' | 'screen-recording' | 'link';
  name: string;
  url?: string;
  previewUrl?: string;
  objectKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  fileId?: string;
  originalUrl?: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface KernelChatAgentProfile {
  kernelId: string;
  instanceId: string;
  agentId: string;
  label: string;
  description?: string | null;
  source: 'kernelCatalog' | 'workbenchProjection' | 'sessionBinding';
  systemPrompt?: string | null;
  avatar?: string | null;
  creator?: string | null;
}

export interface KernelChatSessionRef {
  kernelId: string;
  instanceId: string;
  sessionId: string;
  nativeSessionId?: string | null;
  routingKey?: string | null;
  agentId?: string | null;
}

export interface KernelChatAuthority {
  kind: KernelChatAuthorityKind;
  source: KernelChatAuthoritySource;
  durable: boolean;
  writable: boolean;
}

export interface KernelChatActorBinding {
  agentId?: string | null;
  profileId?: string | null;
  label?: string | null;
}

export interface KernelChatModelBinding {
  model?: string | null;
  defaultModel?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
}

export type KernelChatMessagePart =
  | {
      kind: 'text';
      text: string;
    }
  | {
      kind: 'reasoning';
      text: string;
    }
  | {
      kind: 'toolCall';
      toolName: string;
      detail?: string | null;
    }
  | {
      kind: 'toolResult';
      toolName: string;
      preview?: string | null;
    }
  | {
      kind: 'attachment';
      attachment: KernelChatAttachment;
    }
  | {
      kind: 'notice';
      code: string;
      text: string;
    };

export interface KernelChatSession {
  ref: KernelChatSessionRef;
  authority: KernelChatAuthority;
  lifecycle: 'draft' | 'ready' | 'running' | 'error' | 'archived';
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastMessagePreview?: string | null;
  sessionKind?: string | null;
  actorBinding?: KernelChatActorBinding | null;
  modelBinding?: KernelChatModelBinding | null;
  capabilities?: string[];
  activeRunId?: string | null;
}

export interface KernelChatRun {
  id: string;
  sessionRef: KernelChatSessionRef;
  status: KernelChatRunStatus;
  createdAt: number;
  updatedAt: number;
  abortable: boolean;
}

export interface KernelChatMessage {
  id: string;
  sessionRef: KernelChatSessionRef;
  role: KernelChatMessageRole;
  status: 'complete' | 'streaming' | 'error';
  createdAt: number;
  updatedAt: number;
  text: string;
  parts: KernelChatMessagePart[];
  runId?: string | null;
  model?: string | null;
  senderLabel?: string | null;
}

export function createKernelChatSessionRef(input: KernelChatSessionRef): KernelChatSessionRef {
  return {
    kernelId: trimRequiredString(input.kernelId, 'kernelId'),
    instanceId: trimRequiredString(input.instanceId, 'instanceId'),
    sessionId: trimRequiredString(input.sessionId, 'sessionId'),
    nativeSessionId: trimOptionalString(input.nativeSessionId),
    routingKey: trimOptionalString(input.routingKey),
    agentId: trimOptionalString(input.agentId),
  };
}

export function createKernelChatAuthority(input: {
  kind: KernelChatAuthorityKind;
  source?: KernelChatAuthoritySource;
  durable?: boolean;
  writable?: boolean;
}): KernelChatAuthority {
  const isProjection = input.kind === 'localProjection';
  return {
    kind: input.kind,
    source: input.source ?? (isProjection ? 'studioProjection' : 'kernel'),
    durable: input.durable ?? !isProjection,
    writable: input.writable ?? !isProjection,
  };
}
