import path from 'node:path';

const WORKSPACE_PACKAGE_PATTERN = /^@sdkwork\/(claw-[^/]+)$/;
const WORKTREE_WORKSPACE_PACKAGE_PATTERN = /(?:^|[\\/])\.worktrees[\\/][^\\/]+[\\/]packages[\\/](sdkwork-claw-[^\\/]+)([\\/].*)$/;

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

export function resolveWorkspacePackageEntry(
  source: string,
  packagesRootDir: string,
) {
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
