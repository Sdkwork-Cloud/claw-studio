export function resolveChatGenerationViewState(params: {
  effectiveActiveSessionId: string | null;
  pendingSendSessionId: string | null;
  activeSessionRunId: string | null | undefined;
  runningSessionId: string | null;
}) {
  const stopSessionId =
    params.pendingSendSessionId ||
    (params.activeSessionRunId ? params.effectiveActiveSessionId : null) ||
    params.runningSessionId;
  const isActiveSessionGenerating =
    Boolean(params.activeSessionRunId) ||
    Boolean(
      params.effectiveActiveSessionId &&
      params.pendingSendSessionId === params.effectiveActiveSessionId,
    );

  return {
    isComposerLocked: Boolean(
      params.pendingSendSessionId || params.runningSessionId || params.activeSessionRunId,
    ),
    isActiveSessionGenerating,
    stopSessionId,
  };
}
