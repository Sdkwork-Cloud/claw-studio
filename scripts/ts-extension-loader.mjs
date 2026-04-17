import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isSharedSdkSourceMode } from './shared-sdk-mode.mjs';
import {
  resolveCanonicalWorkspaceRootDir,
  resolveWorkspaceRootDir,
} from './workspace-root.mjs';

const FILE_SUFFIXES = ['.ts', '.tsx', '.js', '.mjs', '.cjs'];
const INDEX_SUFFIXES = ['index.ts', 'index.tsx', 'index.js', 'index.mjs', 'index.cjs'];
const WORKSPACE_PACKAGE_EXPORT_CONDITIONS = ['node', 'import', 'default', 'browser'];
const WORKSPACE_ROOT = resolveWorkspaceRootDir(import.meta.dirname);
const CANONICAL_WORKSPACE_ROOT = resolveCanonicalWorkspaceRootDir(import.meta.dirname);
const WORKSPACE_PACKAGES_ROOT = path.resolve(WORKSPACE_ROOT, 'packages');
const EXTRA_WORKSPACE_PACKAGE_SOURCE_SPECS = [
  {
    packageName: '@sdkwork/craw-chat-backend-sdk',
    packageRoot: path.resolve(
      CANONICAL_WORKSPACE_ROOT,
      '../craw-chat/sdks/sdkwork-craw-chat-sdk/sdkwork-craw-chat-sdk-typescript/generated/server-openapi',
    ),
    entryBySubpath: {
      '.': 'dist/index.js',
    },
  },
  {
    packageName: '@sdkwork/core-pc-react',
    packageRoot: path.resolve(CANONICAL_WORKSPACE_ROOT, '../sdkwork-core/sdkwork-core-pc-react'),
    entryBySubpath: {
      '.': 'src/index.ts',
      './app': 'src/app/index.ts',
      './env': 'src/env/index.ts',
      './hooks': 'src/hooks/index.ts',
      './im': 'src/im/index.ts',
      './preferences': 'src/preferences/index.ts',
      './runtime': path.resolve(
        WORKSPACE_ROOT,
        'scripts/shims/core-pc-react-runtime-node.ts',
      ),
    },
  },
];
const SHARED_SDK_SOURCE_SPECS = [
  {
    packageName: '@sdkwork/app-sdk',
    sourceRoot: path.resolve(
      CANONICAL_WORKSPACE_ROOT,
      '../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript/src',
    ),
  },
  {
    packageName: '@sdkwork/sdk-common',
    sourceRoot: path.resolve(
      CANONICAL_WORKSPACE_ROOT,
      '../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript/src',
    ),
  },
];
let workspacePackageSourceEntries = null;

function resolvePackageExportTarget(exportValue) {
  if (typeof exportValue === 'string') {
    return exportValue;
  }

  if (!exportValue || typeof exportValue !== 'object' || Array.isArray(exportValue)) {
    return null;
  }

  for (const condition of WORKSPACE_PACKAGE_EXPORT_CONDITIONS) {
    const target = resolvePackageExportTarget(exportValue[condition]);
    if (target) {
      return target;
    }
  }

  return null;
}

function resolveWorkspacePackageRootExportPath(packageRoot, packageJson) {
  const exportsField = packageJson?.exports;
  const rootExport = typeof exportsField === 'string'
    ? exportsField
    : exportsField && typeof exportsField === 'object' && !Array.isArray(exportsField)
      ? exportsField['.']
      : null;
  const exportTarget = resolvePackageExportTarget(rootExport);
  if (!exportTarget) {
    return null;
  }

  return findFirstExistingPath(createCandidatePaths(path.resolve(packageRoot, exportTarget)));
}

function isResolvableLocalSpecifier(specifier) {
  return specifier.startsWith('./')
    || specifier.startsWith('../')
    || specifier.startsWith('/')
    || specifier.startsWith('file:')
    || /^[A-Za-z]:[\\/]/.test(specifier);
}

function resolveBasePath(specifier, parentURL) {
  if (specifier.startsWith('file:')) {
    return fileURLToPath(specifier);
  }

  if (path.isAbsolute(specifier)) {
    return specifier;
  }

  const parentPath = parentURL?.startsWith('file:')
    ? fileURLToPath(parentURL)
    : path.join(process.cwd(), 'index.js');

  return path.resolve(path.dirname(parentPath), specifier);
}

function createCandidatePaths(basePath) {
  if (path.extname(basePath)) {
    return [basePath];
  }

  return [
    ...FILE_SUFFIXES.map((suffix) => `${basePath}${suffix}`),
    ...INDEX_SUFFIXES.map((suffix) => path.join(basePath, suffix)),
  ];
}

function findFirstExistingPath(candidatePaths) {
  for (const candidatePath of candidatePaths) {
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function resolveExtraWorkspaceEntryPath(packageRoot, entryPath) {
  return path.isAbsolute(entryPath)
    ? entryPath
    : path.join(packageRoot, entryPath);
}

function getWorkspacePackageSourceEntries() {
  if (workspacePackageSourceEntries) {
    return workspacePackageSourceEntries;
  }

  const entries = new Map();

  if (!fs.existsSync(WORKSPACE_PACKAGES_ROOT)) {
    workspacePackageSourceEntries = entries;
    return entries;
  }

  for (const directoryEntry of fs.readdirSync(WORKSPACE_PACKAGES_ROOT, { withFileTypes: true })) {
    if (!directoryEntry.isDirectory()) {
      continue;
    }

    const packageJsonPath = path.join(
      WORKSPACE_PACKAGES_ROOT,
      directoryEntry.name,
      'package.json',
    );
    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (typeof packageJson.name === 'string' && packageJson.name.startsWith('@sdkwork/')) {
        const packageRoot = path.join(WORKSPACE_PACKAGES_ROOT, directoryEntry.name);
        entries.set(packageJson.name, {
          sourceRoot: path.join(packageRoot, 'src'),
          rootEntryPath: resolveWorkspacePackageRootExportPath(packageRoot, packageJson)
            ?? findFirstExistingPath(createCandidatePaths(path.join(packageRoot, 'src', 'index'))),
        });
      }
    } catch {
      // Ignore malformed package manifests in the test loader cache.
    }
  }

  for (const spec of EXTRA_WORKSPACE_PACKAGE_SOURCE_SPECS) {
    const packageJsonPath = path.join(spec.packageRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    const rootEntryPath = spec.entryBySubpath['.'];
    if (typeof rootEntryPath === 'string') {
      entries.set(spec.packageName, resolveExtraWorkspaceEntryPath(spec.packageRoot, rootEntryPath));
    }
  }

  workspacePackageSourceEntries = entries;
  return entries;
}

function resolveExtraWorkspacePackageSourceAliasPath(specifier) {
  const match = specifier.match(/^(@sdkwork\/[^/]+)(\/.*)?$/);
  if (!match) {
    return null;
  }

  const spec = EXTRA_WORKSPACE_PACKAGE_SOURCE_SPECS.find((entry) => entry.packageName === match[1]);
  if (!spec) {
    return null;
  }

  const subpath = match[2]
    ? `.${match[2]}`
    : '.';
  const relativeEntryPath = spec.entryBySubpath[subpath];
  if (!relativeEntryPath) {
    return null;
  }

  return resolveExtraWorkspaceEntryPath(spec.packageRoot, relativeEntryPath);
}

export function resolveSharedSdkSourceAliasPath(specifier, env = process.env) {
  if (!isSharedSdkSourceMode(env)) {
    return null;
  }

  for (const spec of SHARED_SDK_SOURCE_SPECS) {
    if (specifier === spec.packageName) {
      return findFirstExistingPath(createCandidatePaths(path.join(spec.sourceRoot, 'index')));
    }

    if (!specifier.startsWith(`${spec.packageName}/`)) {
      continue;
    }

    const subpath = specifier.slice(spec.packageName.length + 1);
    return findFirstExistingPath(createCandidatePaths(path.join(spec.sourceRoot, subpath)));
  }

  return null;
}

export function resolveWorkspacePackageSourceAliasPath(specifier) {
  const extraWorkspacePackageSourceAliasPath = resolveExtraWorkspacePackageSourceAliasPath(specifier);
  if (extraWorkspacePackageSourceAliasPath) {
    return extraWorkspacePackageSourceAliasPath;
  }

  const match = specifier.match(/^(@sdkwork\/[^/]+)(\/.*)?$/);
  if (!match) {
    return null;
  }

  const packageSourceEntry = getWorkspacePackageSourceEntries().get(match[1]);
  if (!packageSourceEntry) {
    return null;
  }

  if (!match[2]) {
    return packageSourceEntry.rootEntryPath;
  }

  const subpath = match[2].replace(/^\/+/, '');
  return findFirstExistingPath(createCandidatePaths(path.join(packageSourceEntry.sourceRoot, subpath)));
}

export async function resolve(specifier, context, nextResolve) {
  const sharedSdkSourceAliasPath = resolveSharedSdkSourceAliasPath(specifier);
  if (sharedSdkSourceAliasPath) {
    return nextResolve(pathToFileURL(sharedSdkSourceAliasPath).href, context);
  }

  const workspacePackageSourceAliasPath = resolveWorkspacePackageSourceAliasPath(specifier);
  if (workspacePackageSourceAliasPath) {
    return nextResolve(pathToFileURL(workspacePackageSourceAliasPath).href, context);
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!isResolvableLocalSpecifier(specifier)) {
      throw error;
    }

    const basePath = resolveBasePath(specifier, context.parentURL);
    const resolvedLocalPath = findFirstExistingPath(createCandidatePaths(basePath));
    if (resolvedLocalPath) {
      return nextResolve(pathToFileURL(resolvedLocalPath).href, context);
    }

    throw error;
  }
}
