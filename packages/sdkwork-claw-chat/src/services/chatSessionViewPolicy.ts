import {
  buildOpenClawMainSessionKey,
  filterUserFacingOpenClawSessionsByAgent,
  resolveOpenClawVisibleActiveSessionId,
} from './chatSessionBootstrap.ts';

type ChatSessionLike = {
  id: string;
};

export function resolveChatSessionViewState<T extends ChatSessionLike>(params: {
  sessions: T[];
  activeSessionId: string | null;
  isOpenClawGateway: boolean;
  openClawAgentId?: string | null;
}) {
  const visibleSessions = params.isOpenClawGateway
    ? filterUserFacingOpenClawSessionsByAgent(params.sessions, params.openClawAgentId)
    : params.sessions;

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

export function resolveGatewayVisibleSessionSyncTarget(params: {
  isOpenClawGateway: boolean;
  activeSessionId: string | null;
  effectiveActiveSessionId: string | null;
}) {
  if (!params.isOpenClawGateway || !params.effectiveActiveSessionId) {
    return null;
  }

  return params.activeSessionId === params.effectiveActiveSessionId
    ? null
    : params.effectiveActiveSessionId;
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
