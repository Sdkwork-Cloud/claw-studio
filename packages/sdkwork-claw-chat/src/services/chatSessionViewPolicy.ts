import {
  buildOpenClawMainSessionKey,
  filterUserFacingOpenClawSessionsByAgent,
  resolveOpenClawVisibleActiveSessionId,
  shouldKeepHiddenOpenClawSessionVisible,
} from './chatSessionBootstrap.ts';

type ChatSessionLike = {
  id: string;
  sessionKind?: string | null;
};

type ChatRunningSessionLike = {
  id: string;
  runId?: string | null;
};

export function resolveChatSessionViewState<T extends ChatSessionLike>(params: {
  sessions: T[];
  activeSessionId: string | null;
  isChatSupported?: boolean;
  isOpenClawGateway: boolean;
  openClawAgentId?: string | null;
}) {
  if (params.isChatSupported === false) {
    return {
      visibleSessions: [],
      selectableSessions: [],
      effectiveActiveSessionId: null,
    };
  }

  const baseVisibleSessions = params.isOpenClawGateway
    ? filterUserFacingOpenClawSessionsByAgent(params.sessions, params.openClawAgentId)
    : params.sessions;
  const hiddenActiveSession =
    params.isOpenClawGateway && params.activeSessionId
      ? params.sessions.find((session) => session.id === params.activeSessionId)
      : undefined;
  const visibleSessions =
    params.isOpenClawGateway &&
    shouldKeepHiddenOpenClawSessionVisible(hiddenActiveSession) &&
    hiddenActiveSession &&
    !baseVisibleSessions.some((session) => session.id === hiddenActiveSession.id)
      ? [...baseVisibleSessions, hiddenActiveSession]
      : baseVisibleSessions;

  return {
    visibleSessions,
    selectableSessions: params.isOpenClawGateway ? visibleSessions : params.sessions,
    effectiveActiveSessionId: params.isOpenClawGateway
      ? resolveOpenClawVisibleActiveSessionId(
          params.activeSessionId,
          visibleSessions.map((session) => session.id),
        )
      : params.activeSessionId,
  };
}

export function resolveChatSendSessionId(params: {
  activeSessionId: string | null;
  effectiveActiveSessionId: string | null;
  isOpenClawGateway: boolean;
}) {
  return params.isOpenClawGateway ? params.effectiveActiveSessionId : params.activeSessionId;
}

export function resolveChatRunningSessionId<T extends ChatRunningSessionLike>(params: {
  isOpenClawGateway: boolean;
  selectableSessions: T[];
}) {
  if (!params.isOpenClawGateway) {
    return null;
  }

  return params.selectableSessions.find((session) => Boolean(session.runId))?.id ?? null;
}

export function resolveGatewayVisibleSessionSyncTarget(params: {
  isOpenClawGateway: boolean;
  activeSessionId: string | null;
  effectiveActiveSessionId: string | null;
}) {
  if (!params.isOpenClawGateway || !params.effectiveActiveSessionId) {
    return null;
  }

  if (params.activeSessionId) {
    return null;
  }

  return params.effectiveActiveSessionId;
}

export function resolveNewChatSessionModel(params: {
  isOpenClawGateway: boolean;
  activeModelId?: string | null;
  activeModelName?: string | null;
}) {
  const modelValue = params.isOpenClawGateway ? params.activeModelId : params.activeModelName;
  const normalizedModel = modelValue?.trim();
  return normalizedModel || undefined;
}

export function resolveOpenClawDraftSessionId(params: {
  isOpenClawGateway: boolean;
  openClawAgentId?: string | null;
}) {
  if (!params.isOpenClawGateway) {
    return undefined;
  }

  return buildOpenClawMainSessionKey(params.openClawAgentId);
}
