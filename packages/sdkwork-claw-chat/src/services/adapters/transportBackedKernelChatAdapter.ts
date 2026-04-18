import type { StudioInstanceRecord } from '@sdkwork/claw-types';
import {
  createKernelChatAuthority,
  createKernelChatSessionRef,
  type KernelChatSession,
} from '@sdkwork/claw-types';
import {
  createKernelChatAdapterCapabilities,
  type KernelChatAdapter,
  type KernelChatAdapterCreateSessionInput,
} from '../kernelChatAdapter.ts';

export interface CreateTransportBackedKernelChatAdapterInput {
  instance: StudioInstanceRecord;
  now?: () => number;
  createSessionId?: () => string;
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function buildTransportSession(input: {
  instance: StudioInstanceRecord;
  sessionId: string;
  timestamp: number;
  title?: string | null;
  model?: string | null;
}): KernelChatSession {
  return {
    ref: createKernelChatSessionRef({
      kernelId: input.instance.runtimeKind,
      instanceId: input.instance.id,
      sessionId: input.sessionId,
    }),
    authority: createKernelChatAuthority({
      kind: 'http',
      durable: false,
    }),
    lifecycle: 'draft',
    title: normalizeOptionalString(input.title) ?? 'New Chat',
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
    messageCount: 0,
    sessionKind: 'transport',
    modelBinding: {
      model: normalizeOptionalString(input.model),
      defaultModel: normalizeOptionalString(input.model),
    },
    activeRunId: null,
  };
}

export function createTransportBackedKernelChatAdapter(
  input: CreateTransportBackedKernelChatAdapterInput,
): KernelChatAdapter {
  const now = input.now ?? (() => Date.now());
  const createSessionId =
    input.createSessionId ??
    (() => `transport-session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const sessionsById = new Map<string, KernelChatSession>();

  async function createSession(
    createInput: KernelChatAdapterCreateSessionInput,
  ): Promise<KernelChatSession> {
    const timestamp = now();
    const session = buildTransportSession({
      instance: input.instance,
      sessionId: createSessionId(),
      timestamp,
      title: createInput.title,
      model: createInput.model,
    });
    sessionsById.set(session.ref.sessionId, session);
    return session;
  }

  return {
    adapterId: 'transportBacked',
    getCapabilities() {
      return createKernelChatAdapterCapabilities({
        adapterId: 'transportBacked',
        authorityKind: 'http',
        durable: false,
        supportsAgentProfiles: false,
      });
    },
    async listSessions(instanceId) {
      if (instanceId !== input.instance.id) {
        return [];
      }

      return [...sessionsById.values()];
    },
    async getSession(instanceId, sessionId) {
      if (instanceId !== input.instance.id) {
        return null;
      }

      return sessionsById.get(sessionId) ?? null;
    },
    createSession,
  };
}
