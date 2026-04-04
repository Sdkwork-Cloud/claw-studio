import {
  configurePlatformBridge,
  type PlatformBridge,
} from './registry.ts';
import type { RuntimeInfo, RuntimeStartupContext } from './contracts/runtime.ts';
import { WebInternalPlatform, DEFAULT_INTERNAL_BASE_PATH } from './webInternal.ts';
import { WebManagePlatform, DEFAULT_MANAGE_BASE_PATH } from './webManage.ts';
import { WebHostedStudioPlatform, DEFAULT_STUDIO_API_BASE_PATH } from './webHostedStudio.ts';
import { resolveWebPlatformFetch, type WebPlatformFetch } from './webHttp.ts';
import { WebRuntimePlatform } from './webRuntime.ts';

export const SERVER_HOST_MODE_META_NAME = 'sdkwork-claw-host-mode';
export const SERVER_API_BASE_PATH_META_NAME = 'sdkwork-claw-api-base-path';
export const SERVER_MANAGE_BASE_PATH_META_NAME = 'sdkwork-claw-manage-base-path';
export const SERVER_INTERNAL_BASE_PATH_META_NAME = 'sdkwork-claw-internal-base-path';
export const SERVER_BROWSER_SESSION_TOKEN_META_NAME = 'sdkwork-claw-browser-session-token';
const SERVER_BROWSER_SESSION_HEADER_NAME = 'x-claw-browser-session';

export interface ServerBrowserPlatformBridgeConfig {
  mode: 'server' | 'desktopCombined';
  apiBasePath: string;
  manageBasePath: string;
  internalBasePath: string;
  browserBaseUrl: string | null;
  browserSessionToken: string | null;
}

export interface ServerBrowserBridgeMetaElementLike {
  getAttribute(name: string): string | null;
}

export interface ServerBrowserBridgeDocumentLike {
  querySelector(selector: string): ServerBrowserBridgeMetaElementLike | null;
  baseURI?: string | null;
}

export interface ConfigureServerBrowserPlatformBridgeOptions {
  document?: ServerBrowserBridgeDocumentLike | null;
  fetchImpl?: WebPlatformFetch;
  browserBaseUrl?: string | null;
}

export function readServerBrowserPlatformBridgeConfig(
  options: Pick<ConfigureServerBrowserPlatformBridgeOptions, 'document' | 'browserBaseUrl'> = {},
): ServerBrowserPlatformBridgeConfig | null {
  const documentLike = options.document ?? resolveDocumentLike();
  const mode = readMetaContent(documentLike, SERVER_HOST_MODE_META_NAME);

  if (mode !== 'server' && mode !== 'desktopCombined') {
    return null;
  }

  return {
    mode,
    apiBasePath:
      readMetaContent(documentLike, SERVER_API_BASE_PATH_META_NAME) ??
      DEFAULT_STUDIO_API_BASE_PATH,
    manageBasePath:
      readMetaContent(documentLike, SERVER_MANAGE_BASE_PATH_META_NAME) ??
      DEFAULT_MANAGE_BASE_PATH,
    internalBasePath:
      readMetaContent(documentLike, SERVER_INTERNAL_BASE_PATH_META_NAME) ??
      DEFAULT_INTERNAL_BASE_PATH,
    browserBaseUrl:
      normalizeBrowserBaseUrl(options.browserBaseUrl) ??
      resolveBrowserBaseUrl(documentLike),
    browserSessionToken: readMetaContent(
      documentLike,
      SERVER_BROWSER_SESSION_TOKEN_META_NAME,
    ),
  };
}

export function createServerBrowserPlatformBridge(
  config: ServerBrowserPlatformBridgeConfig,
  options: Pick<ConfigureServerBrowserPlatformBridgeOptions, 'fetchImpl'> = {},
): Pick<PlatformBridge, 'manage' | 'internal' | 'runtime' | 'studio'> {
  const fetchImpl = createBrowserSessionAwareFetch(
    options.fetchImpl,
    config.browserSessionToken,
  );

  return {
    studio: new WebHostedStudioPlatform({
      basePath: config.apiBasePath,
      fetchImpl,
    }),
    manage: new WebManagePlatform(config.manageBasePath, fetchImpl),
    internal: new WebInternalPlatform(config.internalBasePath, fetchImpl),
    runtime: new HostedBrowserRuntimePlatform(createHostedBrowserStartupContext(config)),
  };
}

export function configureServerBrowserPlatformBridge(
  options: ConfigureServerBrowserPlatformBridgeOptions = {},
): boolean {
  const config = readServerBrowserPlatformBridgeConfig({
    document: options.document,
    browserBaseUrl: options.browserBaseUrl,
  });

  if (!config) {
    return false;
  }

  configurePlatformBridge(
    createServerBrowserPlatformBridge(config, {
      fetchImpl: options.fetchImpl,
    }),
  );

  return true;
}

function resolveDocumentLike(): ServerBrowserBridgeDocumentLike | null {
  if (typeof document === 'undefined') {
    return null;
  }

  return document as unknown as ServerBrowserBridgeDocumentLike;
}

function readMetaContent(
  documentLike: ServerBrowserBridgeDocumentLike | null,
  name: string,
): string | null {
  return documentLike?.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;
}

function createHostedBrowserStartupContext(
  config: ServerBrowserPlatformBridgeConfig,
): RuntimeStartupContext {
  return {
    hostMode: config.mode,
    packageFamily: config.mode === 'server' ? 'server' : 'desktop',
    startupTarget: config.mode === 'server' ? 'server' : 'desktop',
    hostedBrowser: true,
    apiBasePath: config.apiBasePath,
    manageBasePath: config.manageBasePath,
    internalBasePath: config.internalBasePath,
    browserBaseUrl: config.browserBaseUrl,
  };
}

class HostedBrowserRuntimePlatform extends WebRuntimePlatform {
  private readonly startupContext: RuntimeStartupContext;

  constructor(startupContext: RuntimeStartupContext) {
    super();
    this.startupContext = startupContext;
  }

  async getRuntimeInfo(): Promise<RuntimeInfo> {
    const runtimeInfo = await super.getRuntimeInfo();

    return {
      ...runtimeInfo,
      startup: this.startupContext,
    };
  }
}

function resolveBrowserBaseUrl(
  documentLike: ServerBrowserBridgeDocumentLike | null,
): string | null {
  const globalOrigin =
    typeof location === 'undefined' ? null : normalizeBrowserBaseUrl(location.origin);
  if (globalOrigin) {
    return globalOrigin;
  }

  const baseUri = normalizeBrowserBaseUrl(documentLike?.baseURI ?? null);
  if (!baseUri) {
    return null;
  }

  try {
    return new URL(baseUri).origin;
  } catch {
    return baseUri;
  }
}

function normalizeBrowserBaseUrl(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function createBrowserSessionAwareFetch(
  fetchImpl: WebPlatformFetch | undefined,
  browserSessionToken: string | null,
): WebPlatformFetch | undefined {
  const normalizedToken = normalizeBrowserBaseUrl(browserSessionToken);
  if (!normalizedToken) {
    return fetchImpl;
  }

  const resolvedFetch = fetchImpl;
  if (!resolvedFetch) {
    return async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set(SERVER_BROWSER_SESSION_HEADER_NAME, normalizedToken);
      return resolveWebPlatformFetch()(input, {
        ...init,
        headers,
      });
    };
  }

  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set(SERVER_BROWSER_SESSION_HEADER_NAME, normalizedToken);
    return resolvedFetch(input, {
      ...init,
      headers,
    });
  };
}
