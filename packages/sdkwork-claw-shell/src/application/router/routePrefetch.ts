const sidebarRoutePrefetchers = [
  ['/apps', () => import('@sdkwork/claw-apps')],
  ['/market', () => import('@sdkwork/claw-market')],
  ['/agents', () => import('@sdkwork/claw-agent')],
  ['/mall', () => import('@sdkwork/claw-mall')],
  ['/install', () => import('@sdkwork/claw-install')],
  ['/claw-center', () => import('@sdkwork/claw-center')],
  ['/community', () => import('@sdkwork/claw-community')],
  ['/github', () => import('@sdkwork/claw-github')],
  ['/huggingface', () => import('@sdkwork/claw-huggingface')],
  ['/instances', () => import('@sdkwork/claw-instances')],
  ['/kernel', () => import('../../lazy/settings.ts')],
  ['/nodes', () => import('@sdkwork/claw-instances')],
  ['/api-router', () => import('../../lazy/settings.ts')],
  ['/model-purchase', () => import('@sdkwork/claw-model-purchase')],
  ['/extensions', () => import('@sdkwork/claw-extensions')],
  ['/channels', () => import('@sdkwork/claw-channels')],
  ['/tasks', () => import('@sdkwork/claw-tasks')],
] as const;

const prefetchedSidebarRoutes = new Map<string, Promise<unknown>>();

function normalizeRoutePath(pathname: string) {
  return pathname.split(/[?#]/, 1)[0] || pathname;
}

function resolveSidebarRoutePrefetcher(pathname: string) {
  const normalizedPath = normalizeRoutePath(pathname);
  return sidebarRoutePrefetchers.find(([prefix]) => (
    normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  ));
}

export function prefetchSidebarRoute(pathname: string) {
  const match = resolveSidebarRoutePrefetcher(pathname);
  if (!match) {
    return;
  }

  const [routePrefix, loadRoute] = match;
  if (prefetchedSidebarRoutes.has(routePrefix)) {
    return;
  }

  const pending = loadRoute().catch((error) => {
    prefetchedSidebarRoutes.delete(routePrefix);
    throw error;
  });

  prefetchedSidebarRoutes.set(routePrefix, pending);
}
