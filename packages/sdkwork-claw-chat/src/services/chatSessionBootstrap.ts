import type { InstanceChatRouteMode } from './instanceChatRouteService.ts';

export type ChatBootstrapAction =
  | { type: 'wait' }
  | { type: 'create' }
  | { type: 'select'; sessionId: string }
  | { type: 'idle' };

export function resolveChatBootstrapAction(params: {
  activeInstanceId: string | null | undefined;
  routeMode: InstanceChatRouteMode | undefined;
  syncState: 'idle' | 'loading' | 'error';
  hasActiveModel: boolean;
  activeSessionId: string | null;
  sessionIds: string[];
}): ChatBootstrapAction {
  if (!params.activeInstanceId) {
    return { type: 'idle' };
  }

  if (!params.routeMode || params.syncState === 'loading') {
    return { type: 'wait' };
  }

  const hasActiveSession =
    params.activeSessionId !== null && params.sessionIds.includes(params.activeSessionId);

  if (!params.activeSessionId) {
    if (params.sessionIds.length > 0) {
      return { type: 'select', sessionId: params.sessionIds[0] };
    }

    if (params.hasActiveModel && params.routeMode !== 'instanceOpenClawGatewayWs') {
      return { type: 'create' };
    }

    return { type: 'idle' };
  }

  if (!hasActiveSession) {
    if (params.sessionIds.length > 0) {
      return { type: 'select', sessionId: params.sessionIds[0] };
    }

    if (params.hasActiveModel && params.routeMode !== 'instanceOpenClawGatewayWs') {
      return { type: 'create' };
    }
  }

  return { type: 'idle' };
}

export function resolveOpenClawCreateSessionTarget(snapshot: {
  activeSessionId: string | null;
  sessions: Array<{
    id: string;
    isDraft?: boolean;
  }>;
}) {
  const activeRemoteSession =
    snapshot.activeSessionId !== null
      ? snapshot.sessions.find(
          (session) => session.id === snapshot.activeSessionId && !session.isDraft,
        )
      : undefined;
  if (activeRemoteSession) {
    return {
      type: 'reuse' as const,
      sessionId: activeRemoteSession.id,
    };
  }

  const firstRemoteSession = snapshot.sessions.find((session) => !session.isDraft);
  if (firstRemoteSession) {
    return {
      type: 'reuse' as const,
      sessionId: firstRemoteSession.id,
    };
  }

  const activeDraftSession =
    snapshot.activeSessionId !== null
      ? snapshot.sessions.find((session) => session.id === snapshot.activeSessionId)
      : undefined;
  if (activeDraftSession) {
    return {
      type: 'reuse' as const,
      sessionId: activeDraftSession.id,
    };
  }

  if (snapshot.sessions[0]) {
    return {
      type: 'reuse' as const,
      sessionId: snapshot.sessions[0].id,
    };
  }

  return { type: 'draft' as const };
}
