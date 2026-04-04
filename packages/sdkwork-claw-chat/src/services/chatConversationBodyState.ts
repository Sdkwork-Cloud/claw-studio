export type ChatConversationBodyMode = 'loading' | 'empty' | 'messages';

export function resolveChatConversationBodyState(params: {
  messageCount: number;
  isGatewayHistoryLoading: boolean;
}) {
  if (params.messageCount > 0) {
    return {
      mode: 'messages' as const,
    };
  }

  return {
    mode: params.isGatewayHistoryLoading ? ('loading' as const) : ('empty' as const),
  };
}
