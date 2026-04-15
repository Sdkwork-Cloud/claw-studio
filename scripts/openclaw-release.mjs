import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const releaseConfigPath = path.join(rootDir, 'config', 'openclaw-release.json');

export function loadOpenClawReleaseConfig({
  readFileImpl = (filePath) => fs.readFileSync(filePath, 'utf8'),
} = {}) {
  return JSON.parse(readFileImpl(releaseConfigPath));
}

function normalizeRuntimeSupplementalPackages(value) {
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
function warnUnstableSupplementalPackages(specs) {
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

const releaseConfig = loadOpenClawReleaseConfig();
const normalizedSupplementalPackages = normalizeRuntimeSupplementalPackages(
  releaseConfig.runtimeSupplementalPackages,
);
warnUnstableSupplementalPackages(normalizedSupplementalPackages);

export const OPENCLAW_RELEASE = Object.freeze({
  stableVersion: String(releaseConfig.stableVersion ?? '').trim(),
  nodeVersion: String(releaseConfig.nodeVersion ?? '').trim(),
  packageName: String(releaseConfig.packageName ?? '').trim(),
  runtimeSupplementalPackages: normalizedSupplementalPackages,
});

if (!OPENCLAW_RELEASE.stableVersion) {
  throw new Error(`openclaw release config missing stableVersion: ${releaseConfigPath}`);
}
if (!OPENCLAW_RELEASE.nodeVersion) {
  throw new Error(`openclaw release config missing nodeVersion: ${releaseConfigPath}`);
}
if (!OPENCLAW_RELEASE.packageName) {
  throw new Error(`openclaw release config missing packageName: ${releaseConfigPath}`);
}

export const DEFAULT_OPENCLAW_VERSION =
  process.env.OPENCLAW_VERSION ?? OPENCLAW_RELEASE.stableVersion;
export const DEFAULT_NODE_VERSION =
  process.env.OPENCLAW_NODE_VERSION ?? OPENCLAW_RELEASE.nodeVersion;
export const DEFAULT_OPENCLAW_PACKAGE =
  process.env.OPENCLAW_PACKAGE_NAME ?? OPENCLAW_RELEASE.packageName;
export const DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES =
  OPENCLAW_RELEASE.runtimeSupplementalPackages;

/**
 * Bundled aliases — aligned with packages/sdkwork-claw-types/src/openclawRelease.ts naming.
 * OpenClaw payload constants keep the `BUNDLED_` prefix in script-facing aliases.
 * Node.js uses `DEFAULT_REQUIRED_OPENCLAW_NODE_VERSION` because it is external-only.
 */
export const DEFAULT_BUNDLED_OPENCLAW_VERSION = DEFAULT_OPENCLAW_VERSION;
export const DEFAULT_REQUIRED_OPENCLAW_NODE_VERSION = DEFAULT_NODE_VERSION;
export const DEFAULT_BUNDLED_OPENCLAW_PACKAGE_NAME = DEFAULT_OPENCLAW_PACKAGE;
export const DEFAULT_BUNDLED_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES =
  DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES;
