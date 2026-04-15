import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const kernelConfigDir = path.join(rootDir, 'config', 'kernels');

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function normalizeSortOrder(value, kernelId) {
  if (value === undefined) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Kernel definition "${kernelId}" must define order as a non-negative integer when present.`);
  }

  return value;
}

function normalizeStringArray(value, fieldName, kernelId) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Kernel definition "${kernelId}" must define a non-empty ${fieldName} array.`);
  }

  const normalized = value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);

  if (normalized.length !== value.length) {
    throw new Error(`Kernel definition "${kernelId}" contains blank values in ${fieldName}.`);
  }

  return [...new Set(normalized)];
}

function normalizeOptionalStringArray(value, fieldName, kernelId) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`Kernel definition "${kernelId}" must define ${fieldName} as an array when present.`);
  }

  const normalized = value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);

  if (normalized.length !== value.length) {
    throw new Error(`Kernel definition "${kernelId}" contains blank values in ${fieldName}.`);
  }

  return [...new Set(normalized)];
}

function normalizePlatformSupport(value, kernelId) {
  const windows = String(value?.windows ?? '').trim();
  const macos = String(value?.macos ?? '').trim();
  const linux = String(value?.linux ?? '').trim();

  if (!windows || !macos || !linux) {
    throw new Error(`Kernel definition "${kernelId}" must define platformSupport.windows/macos/linux.`);
  }

  return Object.freeze({
    windows,
    macos,
    linux,
  });
}

function validateKernelDefinition(definition) {
  const kernelId = String(definition?.kernelId ?? '').trim();
  const displayName = String(definition?.displayName ?? '').trim();
  const vendor = String(definition?.vendor ?? '').trim();
  const installStrategy = String(definition?.installStrategy ?? '').trim();
  const managementTransport = String(definition?.managementTransport ?? '').trim();
  const repositoryUrl = String(definition?.sourceMetadata?.repositoryUrl ?? '').trim();
  const docsUrl = String(definition?.sourceMetadata?.docsUrl ?? '').trim();
  const packagingPolicy = String(definition?.sourceMetadata?.packagingPolicy ?? '').trim();

  if (!kernelId) {
    throw new Error('Kernel definition is missing kernelId.');
  }
  if (!displayName) {
    throw new Error(`Kernel definition "${kernelId}" is missing displayName.`);
  }
  if (!vendor) {
    throw new Error(`Kernel definition "${kernelId}" is missing vendor.`);
  }
  if (!installStrategy) {
    throw new Error(`Kernel definition "${kernelId}" is missing installStrategy.`);
  }
  if (!managementTransport) {
    throw new Error(`Kernel definition "${kernelId}" is missing managementTransport.`);
  }
  if (!repositoryUrl || !docsUrl || !packagingPolicy) {
    throw new Error(`Kernel definition "${kernelId}" is missing sourceMetadata fields.`);
  }

  return Object.freeze({
    sortOrder: normalizeSortOrder(definition.order, kernelId),
    kernelId,
    displayName,
    vendor,
    launcherKinds: Object.freeze(
      normalizeStringArray(definition.launcherKinds, 'launcherKinds', kernelId),
    ),
    platformSupport: normalizePlatformSupport(definition.platformSupport, kernelId),
    runtimeRequirements: Object.freeze(
      normalizeStringArray(definition.runtimeRequirements, 'runtimeRequirements', kernelId),
    ),
    optionalRuntimeRequirements: Object.freeze(
      normalizeOptionalStringArray(
        definition.optionalRuntimeRequirements,
        'optionalRuntimeRequirements',
        kernelId,
      ),
    ),
    installStrategy,
    managementTransport,
    capabilityMatrix: Object.freeze(
      normalizeStringArray(definition.capabilityMatrix, 'capabilityMatrix', kernelId),
    ),
    sourceMetadata: Object.freeze({
      repositoryUrl,
      docsUrl,
      packagingPolicy,
    }),
  });
}

function listKernelDefinitionConfigFileNames(targetKernelConfigDir = kernelConfigDir) {
  return readdirSync(targetKernelConfigDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function compareKernelDefinitions(left, right) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return left.kernelId.localeCompare(right.kernelId);
}

function buildKernelDefinitionMap(definitions) {
  const definitionMap = new Map();

  for (const definition of definitions) {
    if (definitionMap.has(definition.kernelId)) {
      throw new Error(`Duplicate kernel definition: ${definition.kernelId}`);
    }
    definitionMap.set(definition.kernelId, definition);
  }

  return definitionMap;
}

function readKernelDefinitions(targetKernelConfigDir = kernelConfigDir) {
  return listKernelDefinitionConfigFileNames(targetKernelConfigDir)
    .map((fileName) => validateKernelDefinition(readJson(path.join(targetKernelConfigDir, fileName))))
    .sort(compareKernelDefinitions);
}

const kernelDefinitions = Object.freeze(readKernelDefinitions(kernelConfigDir));
const kernelDefinitionMap = buildKernelDefinitionMap(kernelDefinitions);

function cloneKernelDefinition(definition) {
  return {
    kernelId: definition.kernelId,
    displayName: definition.displayName,
    vendor: definition.vendor,
    launcherKinds: [...definition.launcherKinds],
    platformSupport: {
      ...definition.platformSupport,
    },
    runtimeRequirements: [...definition.runtimeRequirements],
    optionalRuntimeRequirements: [...definition.optionalRuntimeRequirements],
    installStrategy: definition.installStrategy,
    managementTransport: definition.managementTransport,
    capabilityMatrix: [...definition.capabilityMatrix],
    sourceMetadata: {
      ...definition.sourceMetadata,
    },
  };
}

export function loadKernelDefinitions({
  kernelConfigDir: targetKernelConfigDir = kernelConfigDir,
} = {}) {
  return readKernelDefinitions(targetKernelConfigDir).map((definition) => cloneKernelDefinition(definition));
}

export function listKernelDefinitions() {
  return kernelDefinitions.map((definition) => cloneKernelDefinition(definition));
}

export function resolveKernelDefinition(kernelId) {
  const normalizedKernelId = String(kernelId ?? '').trim();
  const definition = kernelDefinitionMap.get(normalizedKernelId);
  if (!definition) {
    throw new Error(`Unsupported kernel definition: ${kernelId}`);
  }

  return cloneKernelDefinition(definition);
}
