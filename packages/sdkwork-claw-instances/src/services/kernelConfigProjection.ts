import type { KernelConfig } from '@sdkwork/claw-types';

interface BuildKernelConfigProjectionInput {
  runtimeKind?: string | null;
  configPath?: string | null;
  configWritable?: boolean;
  schemaVersion?: string | null;
}

function normalizePath(path?: string | null) {
  return (path || '').trim().replace(/\\/g, '/');
}

function getDirectoryName(path: string) {
  const normalized = normalizePath(path).replace(/\/+$/g, '');
  const lastSeparatorIndex = normalized.lastIndexOf('/');
  return lastSeparatorIndex >= 0 ? normalized.slice(0, lastSeparatorIndex) : '';
}

function deriveUserRoot(configPath: string) {
  const normalized = normalizePath(configPath).replace(/\/+$/g, '');
  if (normalized.endsWith('/.openclaw/openclaw.json')) {
    return getDirectoryName(getDirectoryName(normalized));
  }
  return getDirectoryName(getDirectoryName(normalized));
}

export function buildKernelConfigProjection({
  runtimeKind,
  configPath,
  configWritable,
  schemaVersion,
}: BuildKernelConfigProjectionInput): KernelConfig | null {
  const normalizedConfigPath = normalizePath(configPath);
  if (!normalizedConfigPath) {
    return null;
  }

  void runtimeKind;

  return {
    configFile: normalizedConfigPath,
    configRoot: getDirectoryName(normalizedConfigPath),
    userRoot: deriveUserRoot(normalizedConfigPath),
    format: 'json',
    access: 'localFs',
    provenance: 'standardUserRoot',
    writable: configWritable === true,
    resolved: true,
    schemaVersion: schemaVersion || null,
  };
}
