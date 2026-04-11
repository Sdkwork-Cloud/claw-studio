function normalizePathname(pathname: string) {
  return pathname.split(/[?#]/, 1)[0] || pathname;
}

function isColdRoute(pathname: string) {
  return (
    pathname === '/auth' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/login/oauth/callback')
  );
}

function normalizeInstanceIds(instanceIds: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      instanceIds
        .map((instanceId) => instanceId?.trim() || '')
        .filter(Boolean),
    ),
  ).sort();
}

export interface OpenClawGatewayWarmPlan {
  shouldQueryDirectory: boolean;
  instanceIds: string[];
}

export function resolveOpenClawGatewayWarmPlan(params: {
  pathname: string;
  activeInstanceId?: string | null;
  directoryInstanceIds?: string[];
}): OpenClawGatewayWarmPlan {
  const normalizedPathname = normalizePathname(params.pathname);
  if (isColdRoute(normalizedPathname)) {
    return {
      shouldQueryDirectory: false,
      instanceIds: [],
    };
  }

  if (normalizedPathname === '/chat') {
    return {
      shouldQueryDirectory: true,
      instanceIds: normalizeInstanceIds([
        ...(params.directoryInstanceIds ?? []),
        params.activeInstanceId,
      ]),
    };
  }

  return {
    shouldQueryDirectory: false,
    instanceIds: normalizeInstanceIds([params.activeInstanceId]),
  };
}

export function shouldWarmOpenClawGatewayConnections(pathname: string) {
  return !isColdRoute(normalizePathname(pathname));
}
