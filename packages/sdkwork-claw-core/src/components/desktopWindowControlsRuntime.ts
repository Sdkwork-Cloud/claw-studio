export const DESKTOP_WINDOW_CONTROLS_PLATFORM_ATTRIBUTE = 'data-app-platform';

interface WindowControlsRuntimeOptions {
  runtimeWindow?: Window | null;
  runtimeDocument?: Document | null;
}

function hasTauriRuntimeSignal(runtimeWindow: Window | null | undefined) {
  if (!runtimeWindow || typeof runtimeWindow !== 'object') {
    return false;
  }

  return typeof (runtimeWindow as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';
}

function readDocumentPlatform(runtimeDocument: Document | null | undefined) {
  if (!runtimeDocument?.documentElement) {
    return null;
  }

  return runtimeDocument.documentElement.getAttribute(
    DESKTOP_WINDOW_CONTROLS_PLATFORM_ATTRIBUTE,
  );
}

export function shouldRenderDesktopWindowControls(
  platformId: 'web' | 'desktop',
  options: WindowControlsRuntimeOptions = {},
) {
  if (platformId === 'desktop') {
    return true;
  }

  if (readDocumentPlatform(options.runtimeDocument ?? globalThis.document) === 'desktop') {
    return true;
  }

  return hasTauriRuntimeSignal(options.runtimeWindow ?? globalThis.window);
}
