import { projectKernelConfig, type KernelConfigProjectionInput } from '@sdkwork/local-api-proxy';
import type { KernelConfig } from '@sdkwork/claw-types';

export type BuildKernelConfigProjectionInput = KernelConfigProjectionInput;

export function buildKernelConfigProjection(
  input: BuildKernelConfigProjectionInput,
): KernelConfig | null {
  const descriptor = projectKernelConfig(input);
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
