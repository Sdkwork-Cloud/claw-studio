import {
  normalizeDesktopArch,
  normalizeDesktopPlatform,
  parseDesktopTargetTriple,
} from './desktop-targets.mjs';

export const DEFAULT_RELEASE_PROFILE_ID = 'claw-studio';
export const RELEASE_ASSET_MANIFEST_FILE_NAME = 'release-asset-manifest.json';

const CLAW_STUDIO_RELEASE_PROFILE = Object.freeze({
  id: 'claw-studio',
  productName: 'Claw Studio',
  desktop: {
    matrix: Object.freeze([
      Object.freeze({
        runner: 'windows-2022',
        platform: 'windows',
        arch: 'x64',
        target: 'x86_64-pc-windows-msvc',
        bundles: Object.freeze(['nsis']),
      }),
      Object.freeze({
        runner: 'windows-11-arm',
        platform: 'windows',
        arch: 'arm64',
        target: 'aarch64-pc-windows-msvc',
        bundles: Object.freeze(['nsis']),
      }),
      Object.freeze({
        runner: 'ubuntu-24.04',
        platform: 'linux',
        arch: 'x64',
        target: 'x86_64-unknown-linux-gnu',
        bundles: Object.freeze(['deb', 'rpm']),
      }),
      Object.freeze({
        runner: 'ubuntu-24.04-arm',
        platform: 'linux',
        arch: 'arm64',
        target: 'aarch64-unknown-linux-gnu',
        bundles: Object.freeze(['deb', 'rpm']),
      }),
      Object.freeze({
        runner: 'macos-15-intel',
        platform: 'macos',
        arch: 'x64',
        target: 'x86_64-apple-darwin',
        bundles: Object.freeze(['app', 'dmg']),
      }),
      Object.freeze({
        runner: 'macos-15',
        platform: 'macos',
        arch: 'arm64',
        target: 'aarch64-apple-darwin',
        bundles: Object.freeze(['app', 'dmg']),
      }),
    ]),
    allowedBundlesByPlatform: Object.freeze({
      windows: Object.freeze(['nsis', 'msi']),
      linux: Object.freeze(['deb', 'rpm', 'appimage']),
      macos: Object.freeze(['app', 'dmg']),
    }),
  },
  release: Object.freeze({
    manifestFileName: 'release-manifest.json',
    partialManifestFileName: RELEASE_ASSET_MANIFEST_FILE_NAME,
    globalChecksumsFileName: 'SHA256SUMS.txt',
    enableArtifactAttestations: true,
  }),
});

const RELEASE_PROFILES = new Map([
  [CLAW_STUDIO_RELEASE_PROFILE.id, CLAW_STUDIO_RELEASE_PROFILE],
]);

export function resolveReleaseProfile(profileId = DEFAULT_RELEASE_PROFILE_ID) {
  const resolvedProfileId = String(profileId ?? '').trim() || DEFAULT_RELEASE_PROFILE_ID;
  const profile = RELEASE_PROFILES.get(resolvedProfileId);
  if (!profile) {
    throw new Error(`Unsupported release profile: ${profileId}`);
  }

  return profile;
}

export function buildDesktopReleaseMatrix(profileId = DEFAULT_RELEASE_PROFILE_ID) {
  return resolveReleaseProfile(profileId).desktop.matrix.map((entry) => ({
    ...entry,
    bundles: [...entry.bundles],
  }));
}

export function normalizeBundleTargets(bundleTargets) {
  const nextTargets = Array.isArray(bundleTargets)
    ? bundleTargets
    : String(bundleTargets ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

  return [...new Set(nextTargets)];
}

export function serializeBundleTargets(bundleTargets) {
  return normalizeBundleTargets(bundleTargets).join(',');
}

export function resolveDesktopBundleTargets({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  platform,
  arch,
  targetTriple,
  bundleTargets,
} = {}) {
  const normalizedRequestedTargets = normalizeBundleTargets(bundleTargets);
  const profile = resolveReleaseProfile(profileId);

  const targetSpec = String(targetTriple ?? '').trim().length > 0
    ? parseDesktopTargetTriple(targetTriple)
    : {
        platform: normalizeDesktopPlatform(platform),
        arch: normalizeDesktopArch(arch),
      };

  const supportedBundleTargets =
    profile.desktop.allowedBundlesByPlatform[targetSpec.platform] ?? [];

  if (normalizedRequestedTargets.length > 0) {
    for (const bundleTarget of normalizedRequestedTargets) {
      if (!supportedBundleTargets.includes(bundleTarget)) {
        throw new Error(
          `Unsupported ${targetSpec.platform} bundle target "${bundleTarget}" for release profile "${profile.id}"`,
        );
      }
    }

    return normalizedRequestedTargets;
  }

  const matrixEntry = profile.desktop.matrix.find(
    (entry) => entry.platform === targetSpec.platform && entry.arch === targetSpec.arch,
  );

  if (!matrixEntry) {
    throw new Error(
      `Release profile "${profile.id}" does not define a desktop release matrix entry for ${targetSpec.platform}-${targetSpec.arch}`,
    );
  }

  return [...matrixEntry.bundles];
}
