type ChatMessageRenderLike = {
  id?: string;
  messageId?: string;
  toolCallId?: string;
  role?: string;
  timestamp?: number;
};

function normalizeSessionRenderScope(sessionId: string | null | undefined) {
  const normalizedSessionId = sessionId?.trim();
  return normalizedSessionId ? `session:${normalizedSessionId}` : 'session:unknown';
}

function resolveBaseMessageRenderKey(message: ChatMessageRenderLike, index: number) {
  const toolCallId = typeof message.toolCallId === 'string' ? message.toolCallId.trim() : '';
  if (toolCallId) {
    return `tool:${toolCallId}`;
  }

  const id = typeof message.id === 'string' ? message.id.trim() : '';
  if (id) {
    return `msg:${id}`;
  }

  const messageId = typeof message.messageId === 'string' ? message.messageId.trim() : '';
  if (messageId) {
    return `msg:${messageId}`;
  }

  const timestamp = typeof message.timestamp === 'number' ? message.timestamp : null;
  const role = typeof message.role === 'string' && message.role.trim() ? message.role : 'unknown';
  if (timestamp !== null) {
    return `msg:${role}:${timestamp}:${index}`;
  }

  return `msg:${role}:${index}`;
}

export function resolveChatMessageRenderKey(params: {
  sessionId: string | null | undefined;
  message: ChatMessageRenderLike;
  index: number;
}) {
  return `${normalizeSessionRenderScope(params.sessionId)}:${resolveBaseMessageRenderKey(
    params.message,
    params.index,
  )}`;
}
