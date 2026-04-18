import type {
  KernelChatAgentProfile,
  KernelChatAuthorityKind,
  KernelChatMessage,
  KernelChatRun,
  KernelChatSession,
} from '@sdkwork/claw-types';

export interface KernelChatAdapterCapabilities {
  adapterId: string;
  authorityKind: KernelChatAuthorityKind;
  supported: boolean;
  durable: boolean;
  writable: boolean;
  supportsStreaming: boolean;
  supportsRuns: boolean;
  supportsAgentProfiles: boolean;
  supportsSessionMutation: boolean;
  reason: string | null;
}

export interface KernelChatSubscriptionEvent {
  instanceId: string;
  session?: KernelChatSession | null;
  run?: KernelChatRun | null;
  message?: KernelChatMessage | null;
}

export interface KernelChatAdapterCreateSessionInput {
  instanceId: string;
  model?: string | null;
  agentId?: string | null;
  title?: string | null;
}

export interface KernelChatAdapterPatchSessionInput {
  instanceId: string;
  sessionId: string;
  title?: string | null;
  model?: string | null;
}

export interface KernelChatAdapterStartRunInput {
  instanceId: string;
  sessionId: string;
  content: string;
  model?: string | null;
}

export interface KernelChatAdapter {
  adapterId: string;
  getCapabilities(): KernelChatAdapterCapabilities;
  listAgentProfiles?(instanceId: string): Promise<KernelChatAgentProfile[]>;
  listSessions?(instanceId: string): Promise<KernelChatSession[]>;
  getSession?(instanceId: string, sessionId: string): Promise<KernelChatSession | null>;
  createSession?(input: KernelChatAdapterCreateSessionInput): Promise<KernelChatSession>;
  patchSession?(input: KernelChatAdapterPatchSessionInput): Promise<KernelChatSession>;
  deleteSession?(instanceId: string, sessionId: string): Promise<void>;
  startRun?(input: KernelChatAdapterStartRunInput): Promise<KernelChatRun>;
  abortRun?(instanceId: string, sessionId: string, runId?: string | null): Promise<boolean>;
  loadMessages?(instanceId: string, sessionId: string): Promise<KernelChatMessage[]>;
  subscribe?(listener: (event: KernelChatSubscriptionEvent) => void): () => void;
}

export interface CreateKernelChatAdapterCapabilitiesInput {
  adapterId: string;
  authorityKind: KernelChatAuthorityKind;
  supported?: boolean;
  durable?: boolean;
  writable?: boolean;
  supportsStreaming?: boolean;
  supportsRuns?: boolean;
  supportsAgentProfiles?: boolean;
  supportsSessionMutation?: boolean;
  reason?: string | null;
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function createKernelChatAdapterCapabilities(
  input: CreateKernelChatAdapterCapabilitiesInput,
): KernelChatAdapterCapabilities {
  const isProjectionAuthority = input.authorityKind === 'localProjection';

  return {
    adapterId: input.adapterId,
    authorityKind: input.authorityKind,
    supported: input.supported ?? true,
    durable: input.durable ?? !isProjectionAuthority,
    writable: input.writable ?? true,
    supportsStreaming: input.supportsStreaming ?? true,
    supportsRuns: input.supportsRuns ?? true,
    supportsAgentProfiles: input.supportsAgentProfiles ?? true,
    supportsSessionMutation: input.supportsSessionMutation ?? true,
    reason: normalizeOptionalString(input.reason),
  };
}
