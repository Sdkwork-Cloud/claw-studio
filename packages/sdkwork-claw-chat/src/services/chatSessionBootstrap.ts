import type { InstanceChatRouteMode } from './instanceChatRouteService.ts';

export type ChatBootstrapAction =
  | { type: 'wait' }
  | { type: 'create' }
  | { type: 'select'; sessionId: string }
  | { type: 'idle' };

function normalizeOpenClawAgentId(agentId?: string | null) {
  const normalizedAgentId = agentId?.trim().toLowerCase();
  return normalizedAgentId || 'main';
}

function normalizeOpenClawSessionKey(sessionId: string | null | undefined) {
  const normalizedSessionId = sessionId?.trim().toLowerCase();
  return normalizedSessionId || null;
}

export function buildOpenClawMainSessionKey(agentId?: string | null) {
  return `agent:${normalizeOpenClawAgentId(agentId)}:main`;
}

export function buildOpenClawThreadSessionKey(
  agentId: string | null | undefined,
  threadKey: string,
) {
  const normalizedThreadKey = threadKey.trim() || 'claw-studio';
  return `${buildOpenClawMainSessionKey(agentId)}:thread:${normalizedThreadKey}`;
}

function parseOpenClawAgentSessionKey(sessionId: string | null | undefined) {
  const raw = normalizeOpenClawSessionKey(sessionId);
  if (!raw || !raw.startsWith('agent:')) {
    return null;
  }

  const parts = raw.split(':').filter(Boolean);
  if (parts.length < 3) {
    return null;
  }

  return {
    agentId: parts[1] ?? 'main',
    rest: parts.slice(2).join(':'),
  };
}

export function isOpenClawSessionInAgentScope(
  sessionId: string | null | undefined,
  agentId: string | null | undefined,
) {
  const parsed = parseOpenClawAgentSessionKey(sessionId);
  if (!parsed) {
    return false;
  }

  return parsed.agentId === normalizeOpenClawAgentId(agentId);
}

export function filterOpenClawSessionsByAgent<T extends { id: string }>(
  sessions: T[],
  agentId: string | null | undefined,
) {
  return sessions.filter((session) => isOpenClawSessionInAgentScope(session.id, agentId));
}

export function isOpenClawMainSession(
  sessionId: string | null | undefined,
  agentId: string | null | undefined,
) {
  return normalizeOpenClawSessionKey(sessionId) === buildOpenClawMainSessionKey(agentId);
}

export function isAnyOpenClawMainSession(sessionId: string | null | undefined) {
  const normalizedSessionId = normalizeOpenClawSessionKey(sessionId);
  return normalizedSessionId ? /^agent:[^:]+:main$/.test(normalizedSessionId) : false;
}

function isOpenClawLegacyUserFacingSession(sessionId: string | null | undefined) {
  const normalizedSessionId = normalizeOpenClawSessionKey(sessionId);
  return Boolean(normalizedSessionId) && !normalizedSessionId!.startsWith('agent:');
}

export function filterUserFacingOpenClawSessionsByAgent<T extends { id: string }>(
  sessions: T[],
  agentId: string | null | undefined,
) {
  return sessions.filter((session) => {
    if (isOpenClawLegacyUserFacingSession(session.id)) {
      return true;
    }

    return isOpenClawSessionInAgentScope(session.id, agentId);
  });
}

export function resolveOpenClawVisibleActiveSessionId(
  activeSessionId: string | null,
  visibleSessionIds: string[],
) {
  if (activeSessionId && visibleSessionIds.includes(activeSessionId)) {
    return activeSessionId;
  }

  return visibleSessionIds.find((sessionId) => isAnyOpenClawMainSession(sessionId)) ?? visibleSessionIds[0] ?? null;
}

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

  const isOpenClawGateway = params.routeMode === 'instanceOpenClawGatewayWs';
  const hasActiveSession =
    params.activeSessionId !== null && params.sessionIds.includes(params.activeSessionId);

  if (!params.activeSessionId) {
    if (params.sessionIds.length > 0 && !isOpenClawGateway) {
      return { type: 'select', sessionId: params.sessionIds[0] };
    }

    if (params.hasActiveModel && !isOpenClawGateway) {
      return { type: 'create' };
    }

    return { type: 'idle' };
  }

  if (!hasActiveSession) {
    if (params.sessionIds.length > 0 && !isOpenClawGateway) {
      return { type: 'select', sessionId: params.sessionIds[0] };
    }

    if (params.hasActiveModel && !isOpenClawGateway) {
      return { type: 'create' };
    }
  }

  return { type: 'idle' };
}
