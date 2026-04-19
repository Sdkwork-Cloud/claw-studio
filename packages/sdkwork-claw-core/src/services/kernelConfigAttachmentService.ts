import { projectKernelConfig } from '@sdkwork/local-api-proxy';
import type { KernelConfig } from '@sdkwork/claw-types';

export interface KernelConfigBackedRoute {
  scope: string;
  mode: string;
  target?: string | null;
  authoritative?: boolean;
}

export interface KernelConfigBackedArtifact {
  kind: string;
  location?: string | null;
}

export interface KernelConfigBackedDetail {
  instance?: {
    runtimeKind?: string | null;
    deploymentMode?: string | null;
    isBuiltIn?: boolean | null;
    config?: {
      workspacePath?: string | null;
    } | null;
  } | null;
  config?: {
    workspacePath?: string | null;
  } | null;
  lifecycle?: {
    configWritable?: boolean | null;
  } | null;
  dataAccess?: {
    routes?: KernelConfigBackedRoute[] | null;
  } | null;
  artifacts?: KernelConfigBackedArtifact[] | null;
}

function normalizePath(path?: string | null) {
  return path?.replace(/\\/g, '/').trim() || null;
}

function resolveReportedConfigFile(detail: KernelConfigBackedDetail | null | undefined) {
  const configRoute = detail?.dataAccess?.routes?.find((route) => route.scope === 'config');
  if (configRoute) {
    if (configRoute.mode === 'managedFile' && configRoute.target) {
      return normalizePath(configRoute.target);
    }

    return null;
  }

  const configArtifact = detail?.artifacts?.find(
    (artifact) => artifact.kind === 'configFile' && artifact.location,
  );

  return configArtifact?.location ? normalizePath(configArtifact.location) : null;
}

function resolveWorkspacePath(detail: KernelConfigBackedDetail | null | undefined) {
  const workspaceCandidates = [
    detail?.config?.workspacePath,
    detail?.instance?.config?.workspacePath,
    detail?.dataAccess?.routes?.find((route) => route.scope === 'files')?.target,
    detail?.artifacts?.find((artifact) => artifact.kind === 'workspaceDirectory')?.location,
  ];

  for (const candidate of workspaceCandidates) {
    const normalized = normalizePath(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function resolveAttachedKernelConfig(
  detail: KernelConfigBackedDetail | null | undefined,
): KernelConfig | null {
  const configFile = resolveReportedConfigFile(detail);
  if (!configFile) {
    return null;
  }

  const descriptor = projectKernelConfig({
    kernelId: detail?.instance?.runtimeKind,
    runtimeKind: detail?.instance?.runtimeKind,
    deploymentMode: detail?.instance?.deploymentMode,
    isBuiltIn: detail?.instance?.isBuiltIn,
    configFile,
    workspacePath: resolveWorkspacePath(detail),
    configWritable: detail?.lifecycle?.configWritable === true,
    schemaVersion: null,
  });
  if (!descriptor) {
    return null;
  }

  return {
    kernelId: descriptor.kernelId,
    runtimeKind: descriptor.runtimeKind,
    configFile: descriptor.configFile,
    configRoot: descriptor.configRoot,
    stateRoot: descriptor.stateRoot,
    userRoot: descriptor.userRoot,
    standardStateRoot: descriptor.standardStateRoot,
    standardConfigFile: descriptor.standardConfigFile,
    format: descriptor.format,
    access: descriptor.access,
    provenance: descriptor.provenance,
    writable: descriptor.writable,
    resolved: descriptor.resolved,
    schemaVersion: descriptor.schemaVersion,
    isStandardUserRootLayout: descriptor.isStandardUserRootLayout,
  };
}

export function resolveAttachedKernelConfigFile(
  detail: KernelConfigBackedDetail | null | undefined,
) {
  return resolveAttachedKernelConfig(detail)?.configFile || null;
}
