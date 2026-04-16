import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const kernelReleaseConfigDir = path.join(rootDir, 'config', 'kernel-releases');

function readJson(filePath, readFileImpl = (targetPath) => readFileSync(targetPath, 'utf8')) {
  return JSON.parse(readFileImpl(filePath));
}

function cloneJsonValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeStringArray(value, fieldName, kernelId) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Kernel release "${kernelId}" must define a non-empty ${fieldName} array.`);
  }

  const normalized = value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);

  if (normalized.length !== value.length) {
    throw new Error(`Kernel release "${kernelId}" contains blank values in ${fieldName}.`);
  }

  return [...new Set(normalized)];
}

function validateKernelReleaseConfig(config, filePath) {
  const kernelId = String(config?.kernelId ?? '').trim();
  const stableVersion = String(config?.stableVersion ?? '').trim();
  const defaultChannel = String(config?.defaultChannel ?? '').trim();

  if (!kernelId) {
    throw new Error(`Kernel release config is missing kernelId: ${filePath}`);
  }
  if (!stableVersion) {
    throw new Error(`Kernel release "${kernelId}" is missing stableVersion: ${filePath}`);
  }

  const supportedChannels = normalizeStringArray(
    config?.supportedChannels,
    'supportedChannels',
    kernelId,
  );
  if (!defaultChannel) {
    throw new Error(`Kernel release "${kernelId}" is missing defaultChannel: ${filePath}`);
  }
  if (!supportedChannels.includes(defaultChannel)) {
    throw new Error(
      `Kernel release "${kernelId}" defaultChannel "${defaultChannel}" must be listed in supportedChannels.`,
    );
  }

  return Object.freeze({
    ...cloneJsonValue(config),
    kernelId,
    stableVersion,
    supportedChannels: Object.freeze(supportedChannels),
    defaultChannel,
  });
}

function listKernelReleaseConfigFileNames(targetKernelReleaseConfigDir = kernelReleaseConfigDir) {
  return readdirSync(targetKernelReleaseConfigDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function buildKernelReleaseConfigMap(releaseConfigs) {
  const releaseConfigMap = new Map();

  for (const releaseConfig of releaseConfigs) {
    if (releaseConfigMap.has(releaseConfig.kernelId)) {
      throw new Error(`Duplicate kernel release config: ${releaseConfig.kernelId}`);
    }
    releaseConfigMap.set(releaseConfig.kernelId, releaseConfig);
  }

  return releaseConfigMap;
}

function readKernelReleaseConfigs(
  targetKernelReleaseConfigDir = kernelReleaseConfigDir,
  readFileImpl = (targetPath) => readFileSync(targetPath, 'utf8'),
) {
  return listKernelReleaseConfigFileNames(targetKernelReleaseConfigDir)
    .map((fileName) => validateKernelReleaseConfig(
      readJson(path.join(targetKernelReleaseConfigDir, fileName), readFileImpl),
      path.join(targetKernelReleaseConfigDir, fileName),
    ));
}

const cachedKernelReleaseConfigs = Object.freeze(
  readKernelReleaseConfigs(kernelReleaseConfigDir),
);
const cachedKernelReleaseConfigMap = buildKernelReleaseConfigMap(cachedKernelReleaseConfigs);

function cloneKernelReleaseConfig(config) {
  return cloneJsonValue(config);
}

export function resolveKernelReleaseConfigPath(
  kernelId,
  {
    workspaceRootDir = rootDir,
  } = {},
) {
  const normalizedKernelId = String(kernelId ?? '').trim();
  if (!normalizedKernelId) {
    throw new Error('resolveKernelReleaseConfigPath requires a kernelId.');
  }

  return path.join(workspaceRootDir, 'config', 'kernel-releases', `${normalizedKernelId}.json`);
}

export function resolveLegacyOpenClawReleaseConfigPath({
  workspaceRootDir = rootDir,
} = {}) {
  return path.join(workspaceRootDir, 'config', 'openclaw-release.json');
}

export function loadKernelReleaseConfigs({
  workspaceRootDir = rootDir,
  readFileImpl = (targetPath) => readFileSync(targetPath, 'utf8'),
} = {}) {
  const targetKernelReleaseConfigDir = path.join(workspaceRootDir, 'config', 'kernel-releases');
  if (
    path.resolve(targetKernelReleaseConfigDir) === path.resolve(kernelReleaseConfigDir)
    && readFileImpl === readFileSync
  ) {
    return cachedKernelReleaseConfigs.map((config) => cloneKernelReleaseConfig(config));
  }

  return readKernelReleaseConfigs(targetKernelReleaseConfigDir, readFileImpl)
    .map((config) => cloneKernelReleaseConfig(config));
}

export function resolveKernelReleaseConfig(
  kernelId,
  {
    workspaceRootDir = rootDir,
    readFileImpl = (targetPath) => readFileSync(targetPath, 'utf8'),
  } = {},
) {
  const normalizedKernelId = String(kernelId ?? '').trim();
  if (!normalizedKernelId) {
    throw new Error('resolveKernelReleaseConfig requires a kernelId.');
  }

  if (
    path.resolve(workspaceRootDir) === path.resolve(rootDir)
    && readFileImpl === readFileSync
  ) {
    const cachedConfig = cachedKernelReleaseConfigMap.get(normalizedKernelId);
    if (!cachedConfig) {
      throw new Error(`Unsupported kernel release config: ${kernelId}`);
    }
    return cloneKernelReleaseConfig(cachedConfig);
  }

  const filePath = resolveKernelReleaseConfigPath(normalizedKernelId, { workspaceRootDir });
  return cloneKernelReleaseConfig(
    validateKernelReleaseConfig(readJson(filePath, readFileImpl), filePath),
  );
}

export function projectLegacyOpenClawReleaseConfig(releaseConfig) {
  return {
    stableVersion: String(releaseConfig?.stableVersion ?? '').trim(),
    nodeVersion: String(releaseConfig?.nodeVersion ?? '').trim(),
    packageName: String(releaseConfig?.packageName ?? '').trim(),
    runtimeSupplementalPackages: Array.isArray(releaseConfig?.runtimeSupplementalPackages)
      ? releaseConfig.runtimeSupplementalPackages.map((entry) => String(entry ?? '').trim()).filter(Boolean)
      : [],
    runtimeSupplementalPackageExceptions: Array.isArray(releaseConfig?.runtimeSupplementalPackageExceptions)
      ? cloneJsonValue(releaseConfig.runtimeSupplementalPackageExceptions)
      : [],
  };
}
