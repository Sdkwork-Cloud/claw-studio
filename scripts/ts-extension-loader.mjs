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
const WORKSPACE_ROOT = resolveWorkspaceRootDir(import.meta.dirname);
const CANONICAL_WORKSPACE_ROOT = resolveCanonicalWorkspaceRootDir(import.meta.dirname);
const WORKSPACE_PACKAGES_ROOT = path.resolve(WORKSPACE_ROOT, 'packages');
const EXTRA_WORKSPACE_PACKAGE_SOURCE_SPECS = [
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
      './runtime': 'src/runtime/index.ts',
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
        entries.set(packageJson.name, path.join(WORKSPACE_PACKAGES_ROOT, directoryEntry.name, 'src'));
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
      entries.set(spec.packageName, path.join(spec.packageRoot, rootEntryPath));
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

  return path.join(spec.packageRoot, relativeEntryPath);
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

  const packageSourceRoot = getWorkspacePackageSourceEntries().get(match[1]);
  if (!packageSourceRoot) {
    return null;
  }

  const subpath = match[2]
    ? match[2].replace(/^\/+/, '')
    : 'index';
  return findFirstExistingPath(createCandidatePaths(path.join(packageSourceRoot, subpath)));
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
