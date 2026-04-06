import path from 'node:path';

import {
  normalizeDesktopArch,
  normalizeDesktopPlatform,
} from './desktop-targets.mjs';

export const DESKTOP_INSTALLER_SMOKE_REPORT_FILENAME = 'installer-smoke-report.json';

const INSTALLABLE_SUFFIXES = {
  windows: ['.exe', '.msi'],
  linux: ['.deb', '.rpm', '.appimage'],
  macos: ['.dmg'],
};

function endsWithAny(value, suffixes) {
  const normalizedValue = String(value ?? '').trim().toLowerCase();
  return suffixes.some((suffix) => normalizedValue.endsWith(suffix));
}

function resolveInstallableArtifacts(manifest, releasePlatform) {
  return manifest.artifacts.filter((artifact) =>
    endsWithAny(
      String(artifact?.relativePath ?? ''),
      INSTALLABLE_SUFFIXES[releasePlatform],
    ));
}

export function resolveInstallableArtifactRelativePaths(manifest, releasePlatform) {
  return resolveInstallableArtifacts(manifest, releasePlatform)
    .map((artifact) => String(artifact?.relativePath ?? '').trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

export function resolveDesktopInstallerSmokeReportPath({
  releaseAssetsDir,
  platform,
  arch,
} = {}) {
  const platformId = normalizeDesktopPlatform(platform);
  const archId = normalizeDesktopArch(arch);

  return path.join(
    releaseAssetsDir,
    'desktop',
    platformId,
    archId,
    DESKTOP_INSTALLER_SMOKE_REPORT_FILENAME,
  );
}
