export const CHAT_NEAR_BOTTOM_THRESHOLD_PX = 450;

type ChatViewportMetrics = {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
};

export function isChatViewportNearBottom(
  params: ChatViewportMetrics & {
    thresholdPx?: number;
  },
) {
  const thresholdPx = params.thresholdPx ?? CHAT_NEAR_BOTTOM_THRESHOLD_PX;
  const distanceFromBottom = params.scrollHeight - params.scrollTop - params.clientHeight;
  return distanceFromBottom < thresholdPx;
}

export function resolveChatAutoScrollDecision(
  params: ChatViewportMetrics & {
    force?: boolean;
    hasAutoScrolled: boolean;
    userNearBottom: boolean;
  },
) {
  const effectiveForce = Boolean(params.force) && !params.hasAutoScrolled;
  const shouldScroll =
    effectiveForce ||
    params.userNearBottom ||
    isChatViewportNearBottom(params);

  return {
    shouldScroll,
    showJumpToLatest: !shouldScroll,
    nextHasAutoScrolled: params.hasAutoScrolled || effectiveForce,
    effectiveForce,
  };
}
