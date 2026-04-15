import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveKernelDefinition } from './kernel-definitions.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const profileConfigDir = path.join(rootDir, 'config', 'kernel-profiles');
export const DEFAULT_KERNEL_PACKAGE_PROFILE_ID = 'openclaw-only';

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function normalizeSortOrder(value, profileId) {
  if (value === undefined) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Kernel package profile "${profileId}" must define order as a non-negative integer when present.`);
  }

  return value;
}

function normalizeStringArray(value, fieldName, profileId) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Kernel package profile "${profileId}" must define a non-empty ${fieldName} array.`);
  }

  const normalized = value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);

  if (normalized.length !== value.length) {
    throw new Error(`Kernel package profile "${profileId}" contains blank values in ${fieldName}.`);
  }

  return [...new Set(normalized)];
}

function validateProfile(profile, resolveDefinition) {
  const profileId = String(profile?.profileId ?? '').trim();
  const displayName = String(profile?.displayName ?? '').trim();
  if (!profileId) {
    throw new Error('Kernel package profile is missing profileId.');
  }
  if (!displayName) {
    throw new Error(`Kernel package profile "${profileId}" is missing displayName.`);
  }

  const includedKernelIds = normalizeStringArray(profile.includedKernelIds, 'includedKernelIds', profileId);
  const defaultEnabledKernelIds = normalizeStringArray(
    profile.defaultEnabledKernelIds,
    'defaultEnabledKernelIds',
    profileId,
  );
  for (const kernelId of defaultEnabledKernelIds) {
    if (!includedKernelIds.includes(kernelId)) {
      throw new Error(
        `Kernel package profile "${profileId}" enables "${kernelId}" by default without including it in the package.`,
      );
    }
  }

  const includedKernelDefinitions = includedKernelIds.map((kernelId) =>
    resolveDefinition(kernelId),
  );
  const requiredExternalRuntimes = [
    ...new Set(includedKernelDefinitions.flatMap((definition) => definition.runtimeRequirements)),
  ];
  const optionalExternalRuntimes = [
    ...new Set(includedKernelDefinitions.flatMap((definition) => definition.optionalRuntimeRequirements)),
  ].filter((runtime) => !requiredExternalRuntimes.includes(runtime));
  const launcherKinds = [
    ...new Set(includedKernelDefinitions.flatMap((definition) => definition.launcherKinds)),
  ];
  const kernelPlatformSupport = Object.freeze(
    Object.fromEntries(
      includedKernelDefinitions.map((definition) => [
        definition.kernelId,
        Object.freeze({
          ...definition.platformSupport,
        }),
      ]),
    ),
  );

  return Object.freeze({
    sortOrder: normalizeSortOrder(profile.order, profileId),
    profileId,
    displayName,
    includedKernelIds: Object.freeze(includedKernelIds),
    defaultEnabledKernelIds: Object.freeze(defaultEnabledKernelIds),
    requiredExternalRuntimes: Object.freeze(requiredExternalRuntimes),
    optionalExternalRuntimes: Object.freeze(optionalExternalRuntimes),
    launcherKinds: Object.freeze(launcherKinds),
    kernelPlatformSupport,
  });
}

function listKernelPackageProfileConfigFileNames(targetProfileConfigDir = profileConfigDir) {
  return readdirSync(targetProfileConfigDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function compareKernelPackageProfiles(left, right) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return left.profileId.localeCompare(right.profileId);
}

function buildKernelPackageProfileMap(profiles) {
  const profileMap = new Map();

  for (const profile of profiles) {
    if (profileMap.has(profile.profileId)) {
      throw new Error(`Duplicate kernel package profile: ${profile.profileId}`);
    }
    profileMap.set(profile.profileId, profile);
  }

  return profileMap;
}

function readKernelPackageProfiles(
  targetProfileConfigDir = profileConfigDir,
  resolveDefinition = resolveKernelDefinition,
) {
  return listKernelPackageProfileConfigFileNames(targetProfileConfigDir)
    .map((fileName) => validateProfile(readJson(path.join(targetProfileConfigDir, fileName)), resolveDefinition))
    .sort(compareKernelPackageProfiles);
}

const kernelPackageProfiles = Object.freeze(
  readKernelPackageProfiles(profileConfigDir, resolveKernelDefinition),
);
const kernelPackageProfileMap = buildKernelPackageProfileMap(kernelPackageProfiles);

function cloneKernelPackageProfile(profile) {
  return {
    profileId: profile.profileId,
    displayName: profile.displayName,
    includedKernelIds: [...profile.includedKernelIds],
    defaultEnabledKernelIds: [...profile.defaultEnabledKernelIds],
    requiredExternalRuntimes: [...profile.requiredExternalRuntimes],
    optionalExternalRuntimes: [...profile.optionalExternalRuntimes],
    launcherKinds: [...profile.launcherKinds],
    kernelPlatformSupport: Object.fromEntries(
      Object.entries(profile.kernelPlatformSupport).map(([kernelId, platformSupport]) => [
        kernelId,
        {
          ...platformSupport,
        },
      ]),
    ),
  };
}

export function loadKernelPackageProfiles({
  profileConfigDir: targetProfileConfigDir = profileConfigDir,
  resolveKernelDefinition: resolveDefinition = resolveKernelDefinition,
} = {}) {
  return readKernelPackageProfiles(targetProfileConfigDir, resolveDefinition)
    .map((profile) => cloneKernelPackageProfile(profile));
}

export function listKernelPackageProfiles() {
  return kernelPackageProfiles.map((profile) => cloneKernelPackageProfile(profile));
}

export function resolveKernelPackageProfile(
  profileId = DEFAULT_KERNEL_PACKAGE_PROFILE_ID,
) {
  const normalizedProfileId = String(profileId ?? '').trim() || DEFAULT_KERNEL_PACKAGE_PROFILE_ID;
  const profile = kernelPackageProfileMap.get(normalizedProfileId);
  if (!profile) {
    throw new Error(`Unsupported kernel package profile: ${profileId}`);
  }

  return cloneKernelPackageProfile(profile);
}
