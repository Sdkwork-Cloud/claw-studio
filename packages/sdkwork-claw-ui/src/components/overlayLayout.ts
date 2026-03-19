import type { CSSProperties } from 'react';

export const APP_HEADER_HEIGHT_PX = 48;
export const OVERLAY_FRAME_GAP_PX = 16;
export const OVERLAY_SAFE_TOP_PX = APP_HEADER_HEIGHT_PX + OVERLAY_FRAME_GAP_PX;
export const OVERLAY_SAFE_BOTTOM_PX = OVERLAY_FRAME_GAP_PX;

export function getOverlayContainerStyle(): CSSProperties {
  return {
    paddingTop: `${OVERLAY_SAFE_TOP_PX}px`,
    paddingRight: `${OVERLAY_FRAME_GAP_PX}px`,
    paddingBottom: `${OVERLAY_SAFE_BOTTOM_PX}px`,
    paddingLeft: `${OVERLAY_FRAME_GAP_PX}px`,
  };
}

export function getOverlaySurfaceStyle(extraOffsetPx = 0): CSSProperties {
  const occupiedViewport =
    APP_HEADER_HEIGHT_PX + OVERLAY_FRAME_GAP_PX * 2 + Math.max(0, extraOffsetPx);

  return {
    maxHeight: `calc(100dvh - ${occupiedViewport}px)`,
  };
}
