#!/usr/bin/env node

function normalizeKernelId(kernelId) {
  return String(kernelId ?? '').trim().toLowerCase();
}

export function normalizeKernelInstallContracts(kernelInstallContracts) {
  if (
    !kernelInstallContracts
    || typeof kernelInstallContracts !== 'object'
    || Array.isArray(kernelInstallContracts)
  ) {
    return null;
  }

  const normalizedEntries = Object.entries(kernelInstallContracts)
    .map(([kernelId, contract]) => [normalizeKernelId(kernelId), contract])
    .filter(([kernelId, contract]) => (
      kernelId.length > 0
      && contract
      && typeof contract === 'object'
      && !Array.isArray(contract)
    ))
    .sort(([leftKernelId], [rightKernelId]) => leftKernelId.localeCompare(rightKernelId));

  if (normalizedEntries.length === 0) {
    return null;
  }

  return Object.fromEntries(normalizedEntries);
}

export function readKernelInstallContract(kernelInstallContracts, kernelId) {
  const normalizedKernelInstallContracts = normalizeKernelInstallContracts(kernelInstallContracts);
  const normalizedKernelId = normalizeKernelId(kernelId);

  if (!normalizedKernelInstallContracts || !normalizedKernelId) {
    return null;
  }

  return normalizedKernelInstallContracts[normalizedKernelId] ?? null;
}

export function writeKernelInstallContract(kernelInstallContracts, kernelId, contract) {
  const normalizedKernelId = normalizeKernelId(kernelId);
  if (
    !normalizedKernelId
    || !contract
    || typeof contract !== 'object'
    || Array.isArray(contract)
  ) {
    return normalizeKernelInstallContracts(kernelInstallContracts);
  }

  return normalizeKernelInstallContracts({
    ...(normalizeKernelInstallContracts(kernelInstallContracts) ?? {}),
    [normalizedKernelId]: contract,
  });
}

export function manifestIncludesKernel(manifest, kernelId) {
  const normalizedKernelId = normalizeKernelId(kernelId);
  if (!normalizedKernelId) {
    return false;
  }

  if (Array.isArray(manifest?.includedKernelIds)) {
    return manifest.includedKernelIds.some(
      (entry) => normalizeKernelId(entry) === normalizedKernelId,
    );
  }

  return normalizedKernelId === 'openclaw';
}
