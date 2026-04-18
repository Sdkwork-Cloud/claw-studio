type KernelAwareChatSessionLike = {
  model?: string | null;
  defaultModel?: string | null;
  runId?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
  sessionKind?: string | null;
  kernelSession?: {
    ref?: {
      agentId?: string | null;
      routingKey?: string | null;
    } | null;
    sessionKind?: string | null;
    modelBinding?: {
      model?: string | null;
      defaultModel?: string | null;
      thinkingLevel?: string | null;
      fastMode?: boolean | null;
      verboseLevel?: string | null;
      reasoningLevel?: string | null;
    } | null;
    activeRunId?: string | null;
  } | null;
};

function trimNullableString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized || null;
}

export function resolveKernelChatSessionState(session: KernelAwareChatSessionLike | null | undefined) {
  const kernelSession = session?.kernelSession ?? null;
  const modelBinding = kernelSession?.modelBinding ?? null;

  return {
    agentId: trimNullableString(kernelSession?.ref?.agentId),
    routingKey: trimNullableString(kernelSession?.ref?.routingKey),
    sessionKind: trimNullableString(kernelSession?.sessionKind) ?? trimNullableString(session?.sessionKind),
    activeRunId: trimNullableString(kernelSession?.activeRunId) ?? trimNullableString(session?.runId),
    model: trimNullableString(modelBinding?.model) ?? trimNullableString(session?.model),
    defaultModel:
      trimNullableString(modelBinding?.defaultModel) ?? trimNullableString(session?.defaultModel),
    thinkingLevel:
      trimNullableString(modelBinding?.thinkingLevel) ?? trimNullableString(session?.thinkingLevel),
    fastMode:
      typeof modelBinding?.fastMode === 'boolean'
        ? modelBinding.fastMode
        : typeof session?.fastMode === 'boolean'
          ? session.fastMode
          : null,
    verboseLevel:
      trimNullableString(modelBinding?.verboseLevel) ?? trimNullableString(session?.verboseLevel),
    reasoningLevel:
      trimNullableString(modelBinding?.reasoningLevel) ?? trimNullableString(session?.reasoningLevel),
  };
}
