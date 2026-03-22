import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { RuntimeEventUnsubscribe } from '@sdkwork/claw-infrastructure';
import type { DesktopCommandName, DesktopEventName } from './catalog';

type DesktopBridgeRuntime = 'desktop' | 'web';

interface DesktopBridgeErrorOptions {
  operation: string;
  runtime: DesktopBridgeRuntime;
  command?: DesktopCommandName;
  event?: DesktopEventName;
  cause?: unknown;
}

function formatCause(cause: unknown) {
  if (!cause) {
    return 'Unknown bridge failure';
  }

  if (cause instanceof Error) {
    return cause.message;
  }

  if (typeof cause === 'string') {
    return cause;
  }

  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}

function buildBridgeMessage(options: DesktopBridgeErrorOptions) {
  const scope = options.command ?? options.event ?? options.operation;
  return `${options.operation} failed for ${scope}: ${formatCause(options.cause)}`;
}

export class DesktopBridgeError extends Error {
  readonly operation: string;
  readonly runtime: DesktopBridgeRuntime;
  readonly command?: DesktopCommandName;
  readonly event?: DesktopEventName;
  readonly causeMessage: string;

  constructor(options: DesktopBridgeErrorOptions) {
    super(buildBridgeMessage(options));
    this.name = 'DesktopBridgeError';
    this.operation = options.operation;
    this.runtime = options.runtime;
    this.command = options.command;
    this.event = options.event;
    this.causeMessage = formatCause(options.cause);
  }
}

export function isTauriRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  const tauriWindow = window as Window & {
    __TAURI_INTERNALS__?: unknown;
    isTauri?: boolean;
  };

  if (typeof tauriWindow.__TAURI_INTERNALS__ !== 'undefined') {
    return true;
  }

  if (tauriWindow.isTauri === true) {
    return true;
  }

  return isTauri();
}

export function getDesktopWindow() {
  if (!isTauriRuntime()) {
    return null;
  }

  return getCurrentWindow();
}

export async function invokeDesktopCommand<T>(
  command: DesktopCommandName,
  payload?: Record<string, unknown>,
  options?: { operation?: string },
): Promise<T> {
  const operation = options?.operation ?? command;
  if (!isTauriRuntime()) {
    throw new DesktopBridgeError({
      operation,
      runtime: 'web',
      command,
      cause: 'Tauri runtime is unavailable.',
    });
  }

  try {
    return await invoke<T>(command, payload);
  } catch (cause) {
    throw new DesktopBridgeError({
      operation,
      runtime: 'desktop',
      command,
      cause,
    });
  }
}

export async function listenDesktopEvent<T>(
  event: DesktopEventName,
  listener: (payload: T) => void,
  options?: { operation?: string },
): Promise<RuntimeEventUnsubscribe> {
  if (!isTauriRuntime()) {
    return () => {};
  }

  try {
    return await listen<T>(event, (nextEvent) => {
      listener(nextEvent.payload);
    });
  } catch (cause) {
    throw new DesktopBridgeError({
      operation: options?.operation ?? event,
      runtime: 'desktop',
      event,
      cause,
    });
  }
}

export async function runDesktopOrFallback<T>(
  operation: string,
  desktopCall: () => Promise<T>,
  webFallback: () => Promise<T>,
): Promise<T> {
  if (!isTauriRuntime()) {
    return webFallback();
  }

  try {
    return await desktopCall();
  } catch (cause) {
    if (cause instanceof DesktopBridgeError) {
      throw cause;
    }

    throw new DesktopBridgeError({
      operation,
      runtime: 'desktop',
      cause,
    });
  }
}
