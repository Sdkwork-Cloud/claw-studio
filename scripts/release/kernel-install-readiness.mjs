#!/usr/bin/env node

function normalizeKernelId(kernelId) {
  return String(kernelId ?? '').trim().toLowerCase();
}

function normalizeStringArray(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const normalized = value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);

  if (normalized.length !== value.length) {
    return null;
  }

  return [...new Set(normalized)];
}

function normalizePlatformSupport(value) {
  const windows = String(value?.windows ?? '').trim();
  const macos = String(value?.macos ?? '').trim();
  const linux = String(value?.linux ?? '').trim();

  if (!windows || !macos || !linux) {
    return null;
  }

  return {
    windows,
    macos,
    linux,
  };
}

export function normalizeKernelExternalRuntimePolicy(externalRuntimePolicy) {
  if (
    !externalRuntimePolicy
    || typeof externalRuntimePolicy !== 'object'
    || Array.isArray(externalRuntimePolicy)
  ) {
    return null;
  }

  const packagingPolicy = String(externalRuntimePolicy?.packagingPolicy ?? '').trim();
  const launcherKinds = normalizeStringArray(externalRuntimePolicy?.launcherKinds);
  const platformSupport = normalizePlatformSupport(externalRuntimePolicy?.platformSupport);
  const runtimeRequirements = normalizeStringArray(externalRuntimePolicy?.runtimeRequirements);
  const optionalRuntimeRequirements = Array.isArray(externalRuntimePolicy?.optionalRuntimeRequirements)
    ? [
        ...new Set(
          externalRuntimePolicy.optionalRuntimeRequirements
            .map((entry) => String(entry ?? '').trim())
            .filter(Boolean),
        ),
      ]
    : [];

  if (!packagingPolicy || !launcherKinds || !platformSupport || !runtimeRequirements) {
    return null;
  }

  return {
    packagingPolicy,
    launcherKinds,
    platformSupport,
    runtimeRequirements,
    optionalRuntimeRequirements,
  };
}

export function normalizeKernelInstallReadiness(kernelInstallReadiness) {
  if (
    !kernelInstallReadiness
    || typeof kernelInstallReadiness !== 'object'
    || Array.isArray(kernelInstallReadiness)
  ) {
    return null;
  }

  const normalizedEntries = Object.entries(kernelInstallReadiness)
    .map(([kernelId, readiness]) => [normalizeKernelId(kernelId), readiness])
    .filter(([kernelId, readiness]) => (
      kernelId.length > 0
      && readiness
      && typeof readiness === 'object'
      && !Array.isArray(readiness)
    ))
    .sort(([leftKernelId], [rightKernelId]) => leftKernelId.localeCompare(rightKernelId));

  if (normalizedEntries.length === 0) {
    return null;
  }

  return Object.fromEntries(normalizedEntries);
}

export function readKernelInstallReadiness(kernelInstallReadiness, kernelId) {
  const normalizedKernelInstallReadiness = normalizeKernelInstallReadiness(kernelInstallReadiness);
  const normalizedKernelId = normalizeKernelId(kernelId);

  if (!normalizedKernelInstallReadiness || !normalizedKernelId) {
    return null;
  }

  return normalizedKernelInstallReadiness[normalizedKernelId] ?? null;
}

export function readKernelInstallReadyLayout(kernelInstallReadiness, kernelId) {
  const readiness = readKernelInstallReadiness(kernelInstallReadiness, kernelId);
  const installReadyLayout = readiness?.installReadyLayout;

  if (
    !installReadyLayout
    || typeof installReadyLayout !== 'object'
    || Array.isArray(installReadyLayout)
  ) {
    return null;
  }

  return installReadyLayout;
}

export function readKernelExternalRuntimePolicy(kernelInstallReadiness, kernelId) {
  const readiness = readKernelInstallReadiness(kernelInstallReadiness, kernelId);
  return normalizeKernelExternalRuntimePolicy(readiness?.externalRuntimePolicy);
}

export function writeKernelInstallReadiness(kernelInstallReadiness, kernelId, readiness) {
  const normalizedKernelId = normalizeKernelId(kernelId);
  if (
    !normalizedKernelId
    || !readiness
    || typeof readiness !== 'object'
    || Array.isArray(readiness)
  ) {
    return normalizeKernelInstallReadiness(kernelInstallReadiness);
  }

  return normalizeKernelInstallReadiness({
    ...(normalizeKernelInstallReadiness(kernelInstallReadiness) ?? {}),
    [normalizedKernelId]: readiness,
  });
}

export function writeKernelExternalRuntimePolicy(
  kernelInstallReadiness,
  kernelId,
  externalRuntimePolicy,
) {
  const normalizedKernelId = normalizeKernelId(kernelId);
  const normalizedExternalRuntimePolicy = normalizeKernelExternalRuntimePolicy(
    externalRuntimePolicy,
  );

  if (!normalizedKernelId || !normalizedExternalRuntimePolicy) {
    return normalizeKernelInstallReadiness(kernelInstallReadiness);
  }

  return writeKernelInstallReadiness(kernelInstallReadiness, normalizedKernelId, {
    ...(readKernelInstallReadiness(kernelInstallReadiness, normalizedKernelId) ?? {}),
    externalRuntimePolicy: normalizedExternalRuntimePolicy,
  });
}
