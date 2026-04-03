import {
  configurePlatformBridge,
  type PlatformBridge,
} from './registry.ts';
import { WebInternalPlatform, DEFAULT_INTERNAL_BASE_PATH } from './webInternal.ts';
import { WebManagePlatform, DEFAULT_MANAGE_BASE_PATH } from './webManage.ts';
import type { WebPlatformFetch } from './webHttp.ts';

export const SERVER_HOST_MODE_META_NAME = 'sdkwork-claw-host-mode';
export const SERVER_MANAGE_BASE_PATH_META_NAME = 'sdkwork-claw-manage-base-path';
export const SERVER_INTERNAL_BASE_PATH_META_NAME = 'sdkwork-claw-internal-base-path';

export interface ServerBrowserPlatformBridgeConfig {
  mode: 'server';
  manageBasePath: string;
  internalBasePath: string;
}

export interface ServerBrowserBridgeMetaElementLike {
  getAttribute(name: string): string | null;
}

export interface ServerBrowserBridgeDocumentLike {
  querySelector(selector: string): ServerBrowserBridgeMetaElementLike | null;
}

export interface ConfigureServerBrowserPlatformBridgeOptions {
  document?: ServerBrowserBridgeDocumentLike | null;
  fetchImpl?: WebPlatformFetch;
}

export function readServerBrowserPlatformBridgeConfig(
  options: Pick<ConfigureServerBrowserPlatformBridgeOptions, 'document'> = {},
): ServerBrowserPlatformBridgeConfig | null {
  const documentLike = options.document ?? resolveDocumentLike();
  const mode = readMetaContent(documentLike, SERVER_HOST_MODE_META_NAME);

  if (mode !== 'server') {
    return null;
  }

  return {
    mode,
    manageBasePath:
      readMetaContent(documentLike, SERVER_MANAGE_BASE_PATH_META_NAME) ??
      DEFAULT_MANAGE_BASE_PATH,
    internalBasePath:
      readMetaContent(documentLike, SERVER_INTERNAL_BASE_PATH_META_NAME) ??
      DEFAULT_INTERNAL_BASE_PATH,
  };
}

export function createServerBrowserPlatformBridge(
  config: ServerBrowserPlatformBridgeConfig,
  options: Pick<ConfigureServerBrowserPlatformBridgeOptions, 'fetchImpl'> = {},
): Pick<PlatformBridge, 'manage' | 'internal'> {
  return {
    manage: new WebManagePlatform(config.manageBasePath, options.fetchImpl),
    internal: new WebInternalPlatform(config.internalBasePath, options.fetchImpl),
  };
}

export function configureServerBrowserPlatformBridge(
  options: ConfigureServerBrowserPlatformBridgeOptions = {},
): boolean {
  const config = readServerBrowserPlatformBridgeConfig({
    document: options.document,
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
