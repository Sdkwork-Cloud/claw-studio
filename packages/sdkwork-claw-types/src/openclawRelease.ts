import releaseConfig from '../../../config/openclaw-release.json' with { type: 'json' };

export interface OpenClawReleaseMetadata {
  stableVersion: string;
  nodeVersion: string;
  packageName: string;
  runtimeSupplementalPackages: string[];
}

const metadata = releaseConfig as OpenClawReleaseMetadata;

function normalizeRuntimeSupplementalPackages(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);
}

export const OPENCLAW_RELEASE: Readonly<OpenClawReleaseMetadata> = Object.freeze({
  stableVersion: metadata.stableVersion,
  nodeVersion: metadata.nodeVersion,
  packageName: metadata.packageName,
  runtimeSupplementalPackages: normalizeRuntimeSupplementalPackages(
    metadata.runtimeSupplementalPackages,
  ),
});

export const DEFAULT_BUNDLED_OPENCLAW_VERSION = OPENCLAW_RELEASE.stableVersion;
export const DEFAULT_BUNDLED_OPENCLAW_NODE_VERSION = OPENCLAW_RELEASE.nodeVersion;
export const DEFAULT_BUNDLED_OPENCLAW_PACKAGE_NAME = OPENCLAW_RELEASE.packageName;
export const DEFAULT_BUNDLED_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES =
  OPENCLAW_RELEASE.runtimeSupplementalPackages;
