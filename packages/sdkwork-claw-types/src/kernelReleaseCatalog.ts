import hermesReleaseConfig from '../../../config/kernel-releases/hermes.json' with { type: 'json' };
import openclawReleaseConfig from '../../../config/kernel-releases/openclaw.json' with { type: 'json' };

export interface KernelReleaseSupplementalPackageException {
  spec: string;
  reason: string;
  reviewedAt: string;
}

export interface KernelReleaseConfig {
  kernelId: string;
  stableVersion: string;
  defaultChannel: string;
  supportedChannels: string[];
  packageName?: string;
  nodeVersion?: string;
  runtimeRequirements?: {
    required?: string[];
    optional?: string[];
  };
  runtimeSupplementalPackages?: string[];
  runtimeSupplementalPackageExceptions?: KernelReleaseSupplementalPackageException[];
  sourcePath: string;
}

const kernelReleaseCatalog = Object.freeze<ReadonlyArray<KernelReleaseConfig>>([
  {
    ...(openclawReleaseConfig as Omit<KernelReleaseConfig, 'sourcePath'>),
    sourcePath: 'config/kernel-releases/openclaw.json',
  },
  {
    ...(hermesReleaseConfig as Omit<KernelReleaseConfig, 'sourcePath'>),
    sourcePath: 'config/kernel-releases/hermes.json',
  },
]);

export function listKernelReleaseConfigs(): KernelReleaseConfig[] {
  return kernelReleaseCatalog.map((entry) => ({
    ...entry,
    supportedChannels: [...entry.supportedChannels],
    runtimeRequirements: entry.runtimeRequirements
      ? {
          required: [...(entry.runtimeRequirements.required ?? [])],
          optional: [...(entry.runtimeRequirements.optional ?? [])],
        }
      : undefined,
    runtimeSupplementalPackages: [...(entry.runtimeSupplementalPackages ?? [])],
    runtimeSupplementalPackageExceptions: [...(entry.runtimeSupplementalPackageExceptions ?? [])],
  }));
}

export function resolveKernelReleaseConfig(kernelId: string): KernelReleaseConfig {
  const normalizedKernelId = String(kernelId ?? '').trim();
  const config = kernelReleaseCatalog.find((entry) => entry.kernelId === normalizedKernelId);
  if (!config) {
    throw new Error(`Unsupported kernel release config: ${kernelId}`);
  }

  return {
    ...config,
    supportedChannels: [...config.supportedChannels],
    runtimeRequirements: config.runtimeRequirements
      ? {
          required: [...(config.runtimeRequirements.required ?? [])],
          optional: [...(config.runtimeRequirements.optional ?? [])],
        }
      : undefined,
    runtimeSupplementalPackages: [...(config.runtimeSupplementalPackages ?? [])],
    runtimeSupplementalPackageExceptions: [...(config.runtimeSupplementalPackageExceptions ?? [])],
  };
}
