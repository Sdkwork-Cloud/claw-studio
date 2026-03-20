import type {
  HubInstallCatalogEntry,
  HubInstallCatalogHostPlatform,
  HubInstallCatalogRuntimePlatform,
  HubInstallCatalogVariant,
  HubInstallRequest,
  RuntimeInfo,
} from '@sdkwork/claw-infrastructure';

export type AppInstallHostPlatform = HubInstallCatalogHostPlatform;
export type AppInstallRuntimePlatform = HubInstallCatalogRuntimePlatform;
export type AppInstallDefinition = HubInstallCatalogEntry;
export type AppInstallVariantDefinition = HubInstallCatalogVariant;

export interface AppInstallContext {
  hostPlatform?: AppInstallHostPlatform;
  runtimeInfo?: RuntimeInfo | null;
  variantId?: string;
  requestId?: string;
  installScope?: HubInstallRequest['installScope'];
  containerRuntimePreference?: HubInstallRequest['containerRuntimePreference'];
  wslDistribution?: string;
  dockerContext?: string;
  dockerHost?: string;
  dryRun?: boolean;
  verbose?: boolean;
  sudo?: boolean;
  timeoutMs?: number;
  installerHome?: string;
  installRoot?: string;
  workRoot?: string;
  binDir?: string;
  dataRoot?: string;
  variables?: Record<string, string>;
}

export interface AppResolvedInstallTarget {
  appId: string;
  title: string;
  summary: string;
  hostPlatform: AppInstallHostPlatform;
  runtimePlatform: AppInstallRuntimePlatform;
  softwareName: string;
  variant: AppInstallVariantDefinition;
  request: HubInstallRequest;
}

export function resolveAppHostPlatform(
  input?: string | RuntimeInfo | AppInstallContext | null,
): AppInstallHostPlatform {
  if (input && typeof input === 'object' && 'hostPlatform' in input && input.hostPlatform) {
    return input.hostPlatform;
  }

  const runtimeInfo =
    input && typeof input === 'object' && 'platform' in input ? input : undefined;
  const value =
    typeof input === 'string'
      ? input
      : runtimeInfo?.system?.os ??
        (typeof navigator !== 'undefined' ? navigator.userAgent : undefined) ??
        '';
  const normalized = value.toLowerCase();

  if (normalized.includes('win')) {
    return 'windows';
  }

  if (normalized.includes('mac') || normalized.includes('darwin')) {
    return 'macos';
  }

  if (normalized.includes('ubuntu') || normalized.includes('linux')) {
    return 'ubuntu';
  }

  return 'windows';
}

export function getAppInstallDefinition(
  definitions: AppInstallDefinition[],
  appId: string,
): AppInstallDefinition {
  const definition = definitions.find((item) => item.appId === appId);
  if (!definition) {
    throw new Error(`No installer catalog entry exists for app: ${appId}`);
  }

  return definition;
}

export function resolveAppInstallTarget(
  definition: AppInstallDefinition,
  context: AppInstallContext = {},
): AppResolvedInstallTarget {
  const hostPlatform = resolveAppHostPlatform(context);
  const compatibleVariants = definition.variants.filter((item) =>
    item.hostPlatforms.includes(hostPlatform),
  );
  const defaultVariant =
    compatibleVariants.find((item) => item.id === definition.defaultVariantId) ??
    compatibleVariants[0];
  const variant = context.variantId
    ? compatibleVariants.find((item) => item.id === context.variantId)
    : defaultVariant;

  if (!variant) {
    if (context.variantId) {
      throw new Error(
        `Install variant "${context.variantId}" is not available for app: ${definition.appId} on ${hostPlatform}.`,
      );
    }

    throw new Error(`No install variant is available for app: ${definition.appId}`);
  }

  const request: HubInstallRequest = {
    ...variant.request,
    requestId: context.requestId ?? variant.request.requestId,
    installScope: context.installScope ?? variant.request.installScope,
    containerRuntimePreference:
      context.containerRuntimePreference ?? variant.request.containerRuntimePreference,
    wslDistribution: context.wslDistribution ?? variant.request.wslDistribution,
    dockerContext: context.dockerContext ?? variant.request.dockerContext,
    dockerHost: context.dockerHost ?? variant.request.dockerHost,
    dryRun: context.dryRun ?? variant.request.dryRun,
    verbose: context.verbose ?? variant.request.verbose,
    sudo: context.sudo ?? variant.request.sudo,
    timeoutMs: context.timeoutMs ?? variant.request.timeoutMs,
    installerHome: context.installerHome ?? variant.request.installerHome,
    installRoot: context.installRoot ?? variant.request.installRoot,
    workRoot: context.workRoot ?? variant.request.workRoot,
    binDir: context.binDir ?? variant.request.binDir,
    dataRoot: context.dataRoot ?? variant.request.dataRoot,
    variables: {
      ...(variant.request.variables ?? {}),
      ...(context.variables ?? {}),
    },
  };

  return {
    appId: definition.appId,
    title: definition.title,
    summary: definition.summary,
    hostPlatform,
    runtimePlatform: variant.runtimePlatform,
    softwareName: variant.softwareName,
    variant,
    request,
  };
}
