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

function normalizeOptionalString(value) {
  const normalized = String(value ?? '').trim();
  return normalized || '';
}

function normalizeOptionalStringArray(values) {
  return Array.isArray(values)
    ? values.map((value) => normalizeOptionalString(value)).filter(Boolean)
    : [];
}

export function normalizeDesktopStartupSmokeLocalAiProxyRuntime(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const lifecycle = normalizeOptionalString(value.lifecycle);
  const observabilityDbPath = normalizeOptionalString(value.observabilityDbPath);
  const snapshotPath = normalizeOptionalString(value.snapshotPath);
  const logPath = normalizeOptionalString(value.logPath);
  const messageCaptureEnabled = value.messageCaptureEnabled;

  if (
    !lifecycle
    || !observabilityDbPath
    || !snapshotPath
    || !logPath
    || typeof messageCaptureEnabled !== 'boolean'
  ) {
    return null;
  }

  return {
    lifecycle,
    messageCaptureEnabled,
    observabilityDbPath,
    snapshotPath,
    logPath,
  };
}

export function normalizeDesktopStartupSmokePackageContext(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const packageProfileId = normalizeOptionalString(value.packageProfileId);
  const includedKernelIds = normalizeOptionalStringArray(value.includedKernelIds);
  const defaultEnabledKernelIds = normalizeOptionalStringArray(
    value.defaultEnabledKernelIds,
  );

  if (
    !packageProfileId
    || includedKernelIds.length === 0
    || defaultEnabledKernelIds.length === 0
    || defaultEnabledKernelIds.some((kernelId) => !includedKernelIds.includes(kernelId))
  ) {
    return null;
  }

  return {
    packageProfileId,
    includedKernelIds,
    defaultEnabledKernelIds,
  };
}
