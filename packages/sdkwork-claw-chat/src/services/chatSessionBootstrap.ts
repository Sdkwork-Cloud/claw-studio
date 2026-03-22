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
  void snapshot;
  return { type: 'draft' as const };
}
