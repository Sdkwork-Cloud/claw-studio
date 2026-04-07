import path from 'node:path';

import {
  normalizeDesktopArch,
  normalizeDesktopPlatform,
} from './desktop-targets.mjs';

export const DESKTOP_STARTUP_SMOKE_REPORT_FILENAME =
  'desktop-startup-smoke-report.json';
export const CAPTURED_DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH =
  'diagnostics/desktop-startup-evidence.json';

export function resolveDesktopStartupSmokeReportPath({
  releaseAssetsDir,
  platform,
  arch,
} = {}) {
  return path.join(
    releaseAssetsDir,
    'desktop',
    normalizeDesktopPlatform(platform),
    normalizeDesktopArch(arch),
    DESKTOP_STARTUP_SMOKE_REPORT_FILENAME,
  );
}

export function resolveCapturedDesktopStartupEvidencePath({
  releaseAssetsDir,
  platform,
  arch,
} = {}) {
  return path.join(
    releaseAssetsDir,
    'desktop',
    normalizeDesktopPlatform(platform),
    normalizeDesktopArch(arch),
    CAPTURED_DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH,
  );
}

export function normalizeDesktopStartupSmokeChecks(values) {
  return Array.isArray(values)
    ? values
      .map((value) => ({
        id: String(value?.id ?? '').trim(),
        status: String(value?.status ?? '').trim().toLowerCase(),
        detail: String(value?.detail ?? '').trim(),
      }))
      .filter((value) => value.id.length > 0)
    : [];
}
