import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE_PACKAGE_PATTERN = /^@sdkwork\/(claw-[^/]+)$/;
const WORKTREE_WORKSPACE_PACKAGE_PATTERN = /(?:^|[\\/])\.worktrees[\\/][^\\/]+[\\/]packages[\\/](sdkwork-claw-[^\\/]+)([\\/].*)$/;
const WORKTREE_ROOT_PATTERN = /(?:^|[\\/])\.worktrees(?:[\\/]|$)/;
const EXTRA_WORKSPACE_PACKAGE_CONFIGS: Array<{
  packageName: string;
  relativePackageDir: string;
  entryBySubpath: Record<string, string>;
}> = [
  {
    packageName: '@sdkwork/core-pc-react',
    relativePackageDir: '../../sdkwork-core/sdkwork-core-pc-react',
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

function splitSpecifier(specifier: string) {
  const match = specifier.match(/^([^?#]*)(.*)$/);
  return {
    pathname: match?.[1] ?? specifier,
    suffix: match?.[2] ?? '',
  };
}

function stripViteFsPrefix(pathname: string) {
  const normalizedPath = pathname.startsWith('/@fs/')
    ? pathname.slice('/@fs/'.length)
    : pathname;

  return normalizedPath.replace(/^\/([A-Za-z]:[\\/])/, '$1');
}

function normalizeResolvedPath(pathname: string) {
  return stripViteFsPrefix(pathname).replace(/[\\/]+/g, path.sep);
}

function resolveCurrentWorkspacePackagePath(
  packageDirName: string,
  relativeSourcePath: string,
  packagesRootDir: string,
) {
  return path.resolve(packagesRootDir, packageDirName, relativeSourcePath);
}

function resolveExtraWorkspacePackagePath(
  packageName: string,
  subpath: string,
  packagesRootDir: string,
) {
  const config = EXTRA_WORKSPACE_PACKAGE_CONFIGS.find((entry) => entry.packageName === packageName);
  if (!config) {
    return null;
  }

  const relativeSourcePath = config.entryBySubpath[subpath];
  if (!relativeSourcePath) {
    return null;
  }

  return path.resolve(packagesRootDir, config.relativePackageDir, relativeSourcePath);
}

function remapWorktreeWorkspacePath(pathname: string, packagesRootDir: string) {
  const normalizedPath = normalizeResolvedPath(pathname);
  const match = normalizedPath.match(WORKTREE_WORKSPACE_PACKAGE_PATTERN);

  if (!match) {
    return null;
  }

  const packageDirName = match[1];
  const relativeSourcePath = (match[2] || '').replace(/^[\\/]+/, '');
  return resolveCurrentWorkspacePackagePath(
    packageDirName,
    relativeSourcePath,
    packagesRootDir,
  );
}

function isRelativeSpecifier(pathname: string) {
  return /^\.{1,2}(?:[\\/]|$)/.test(pathname);
}

export function shouldAttemptWorkspaceResolverRemap(
  source: string,
  importer?: string,
) {
  const { pathname } = splitSpecifier(source);
  const normalizedPathname = stripViteFsPrefix(pathname);

  if (WORKTREE_ROOT_PATTERN.test(normalizedPathname)) {
    return true;
  }

  if (!importer || !isRelativeSpecifier(pathname)) {
    return false;
  }

  return WORKTREE_ROOT_PATTERN.test(
    stripViteFsPrefix(splitSpecifier(importer).pathname),
  );
}

export function shouldEnableWorktreeWorkspaceResolver(
  workspaceRootDir: string,
  env: Record<string, string | undefined> = {},
) {
  const explicit = String(env.SDKWORK_ENABLE_WORKTREE_RESOLVER ?? '').trim().toLowerCase();
  if (explicit === 'true' || explicit === '1') {
    return true;
  }
  if (explicit === 'false' || explicit === '0') {
    return false;
  }

  return WORKTREE_ROOT_PATTERN.test(workspaceRootDir);
}

export function resolveWorkspacePackageAliases(packagesRootDir: string) {
  const localAliases = !fs.existsSync(packagesRootDir)
    ? []
    : fs.readdirSync(packagesRootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^sdkwork-claw-[^/]+$/.test(entry.name))
    .map((entry) => ({
      find: entry.name.replace(/^sdkwork-/, '@sdkwork/'),
      replacement: path.resolve(packagesRootDir, entry.name, 'src/index.ts'),
    }));

  const extraAliases = EXTRA_WORKSPACE_PACKAGE_CONFIGS.flatMap((config) => {
    return Object.entries(config.entryBySubpath)
      .map(([subpath, relativeSourcePath]) => ({
        find: subpath === '.'
          ? config.packageName
          : `${config.packageName}${subpath.slice(1)}`,
        replacement: path.resolve(packagesRootDir, config.relativePackageDir, relativeSourcePath),
      }));
  });

  return [...localAliases, ...extraAliases]
    .sort((left, right) => {
      const bySpecificity = right.find.length - left.find.length;
      return bySpecificity !== 0 ? bySpecificity : left.find.localeCompare(right.find);
    });
}

export function resolveWorkspacePackageEntry(
  source: string,
  packagesRootDir: string,
) {
  const extraWorkspaceMatch = source.match(/^(@sdkwork\/[^/]+)(\/.*)?$/);
  if (extraWorkspaceMatch) {
    const directExtraEntry = resolveExtraWorkspacePackagePath(
      extraWorkspaceMatch[1],
      extraWorkspaceMatch[2] ? `.${extraWorkspaceMatch[2]}` : '.',
      packagesRootDir,
    );
    if (directExtraEntry) {
      return directExtraEntry;
    }
  }

  const match = source.match(WORKSPACE_PACKAGE_PATTERN);
  if (!match) {
    return null;
  }

  return resolveCurrentWorkspacePackagePath(
    `sdkwork-${match[1]}`,
    'src/index.ts',
    packagesRootDir,
  );
}

export function remapWorktreeWorkspaceImport(
  source: string,
  importer: string | undefined,
  packagesRootDir: string,
) {
  const directWorkspaceEntry = resolveWorkspacePackageEntry(source, packagesRootDir);
  if (directWorkspaceEntry) {
    return directWorkspaceEntry;
  }

  const { pathname, suffix } = splitSpecifier(source);
  const directWorktreePath = remapWorktreeWorkspacePath(pathname, packagesRootDir);
  if (directWorktreePath) {
    return `${directWorktreePath}${suffix}`;
  }

  if (!importer || !isRelativeSpecifier(pathname)) {
    return null;
  }

  const importerPath = normalizeResolvedPath(splitSpecifier(importer).pathname);
  const resolvedRelativePath = path.resolve(
    path.dirname(importerPath),
    pathname.replace(/[\\/]+/g, path.sep),
  );
  const remappedRelativePath = remapWorktreeWorkspacePath(
    resolvedRelativePath,
    packagesRootDir,
  );

  return remappedRelativePath ? `${remappedRelativePath}${suffix}` : null;
}
