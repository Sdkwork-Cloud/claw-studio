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

/**
 * Warns if any supplemental package uses an unstable (0.x.x / 0.0.x) version.
 * These are pre-release dependencies that may introduce breaking changes without notice.
 * TODO: Pin to a stable semver (>=1.0.0) once upstream publishes one.
 */
function warnUnstableSupplementalPackages(specs: string[]): void {
  const UNSTABLE_VERSION_PATTERN = /@0\.\d+\.\d+/;
  for (const spec of specs) {
    if (UNSTABLE_VERSION_PATTERN.test(spec)) {
      console.warn(
        `[openclaw-release] WARNING: Supplemental package "${spec}" uses an unstable version (<1.0.0). `
        + 'This dependency may break without notice. Pin to a stable version when available.',
      );
    }
  }
}

const normalizedSupplementalPackages = normalizeRuntimeSupplementalPackages(
  metadata.runtimeSupplementalPackages,
);
warnUnstableSupplementalPackages(normalizedSupplementalPackages);

export const OPENCLAW_RELEASE: Readonly<OpenClawReleaseMetadata> = Object.freeze({
  stableVersion: metadata.stableVersion,
  nodeVersion: metadata.nodeVersion,
  packageName: metadata.packageName,
  runtimeSupplementalPackages: normalizedSupplementalPackages,
});

/**
 * Shared OpenClaw release constants pinned to the central release config.
 *
 * OpenClaw payload constants keep the `DEFAULT_BUNDLED_OPENCLAW_*` naming because
 * the application still ships OpenClaw code assets. Node.js is external-only, so
 * its shared constant must use `DEFAULT_REQUIRED_OPENCLAW_NODE_VERSION`.
 */
export const DEFAULT_BUNDLED_OPENCLAW_VERSION = OPENCLAW_RELEASE.stableVersion;
export const DEFAULT_REQUIRED_OPENCLAW_NODE_VERSION = OPENCLAW_RELEASE.nodeVersion;
export const DEFAULT_BUNDLED_OPENCLAW_PACKAGE_NAME = OPENCLAW_RELEASE.packageName;
export const DEFAULT_BUNDLED_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES =
  OPENCLAW_RELEASE.runtimeSupplementalPackages;
