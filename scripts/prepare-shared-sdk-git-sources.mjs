import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

export const SHARED_SDK_APP_REPO_URL_ENV_VAR = 'SDKWORK_SHARED_SDK_APP_REPO_URL';
export const SHARED_SDK_COMMON_REPO_URL_ENV_VAR = 'SDKWORK_SHARED_SDK_COMMON_REPO_URL';
export const SHARED_SDK_GIT_REF_ENV_VAR = 'SDKWORK_SHARED_SDK_GIT_REF';
export const SHARED_SDK_GIT_FORCE_SYNC_ENV_VAR = 'SDKWORK_SHARED_SDK_GIT_FORCE_SYNC';
export const DEFAULT_SHARED_SDK_APP_REPO_URL = 'https://github.com/Sdkwork-Cloud/sdkwork-sdk-app.git';
export const DEFAULT_SHARED_SDK_COMMON_REPO_URL = 'https://github.com/Sdkwork-Cloud/sdkwork-sdk-commons.git';

function run(command, args, { cwd = process.cwd(), captureStdout = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: captureStdout ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`,
    );
  }

  return (result.stdout ?? '').trim();
}

function parseBooleanFlag(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function createSourceSpecs(workspaceRootDir) {
  return [
    {
      id: 'app-sdk',
      label: '@sdkwork/app-sdk',
      repoRoot: path.resolve(workspaceRootDir, '../../spring-ai-plus-app-api'),
      packageContainerDirName: 'sdkwork-sdk-app',
      packageDirName: 'sdkwork-app-sdk-typescript',
      monorepoSubmodulePath: 'spring-ai-plus-business/spring-ai-plus-app-api/sdkwork-sdk-app',
      repoUrlEnvVar: SHARED_SDK_APP_REPO_URL_ENV_VAR,
      defaultRepoUrl: DEFAULT_SHARED_SDK_APP_REPO_URL,
    },
    {
      id: 'sdk-common',
      label: '@sdkwork/sdk-common',
      repoRoot: path.resolve(workspaceRootDir, '../../sdk'),
      packageContainerDirName: 'sdkwork-sdk-commons',
      packageDirName: 'sdkwork-sdk-common-typescript',
      monorepoSubmodulePath: 'spring-ai-plus-business/sdk/sdkwork-sdk-commons',
      repoUrlEnvVar: SHARED_SDK_COMMON_REPO_URL_ENV_VAR,
      defaultRepoUrl: DEFAULT_SHARED_SDK_COMMON_REPO_URL,
    },
  ];
}

export function resolveSourcePackageContainerRoot(spec) {
  return path.join(spec.repoRoot, spec.packageContainerDirName);
}

export function resolveSourcePackageRoot(spec) {
  return path.join(resolveSourcePackageContainerRoot(spec), spec.packageDirName);
}

export function resolveMonorepoSubmoduleRoot(spec) {
  return path.join(spec.repoRoot, spec.monorepoSubmodulePath);
}

export function resolveMonorepoPackageRoot(spec) {
  return path.join(resolveMonorepoSubmoduleRoot(spec), spec.packageDirName);
}

function extractRepoName(repoUrl) {
  const normalizedRepoUrl = String(repoUrl ?? '')
    .trim()
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');

  if (normalizedRepoUrl.length === 0) {
    return '';
  }

  const repoName = normalizedRepoUrl.split('/').at(-1) ?? '';
  return repoName.replace(/\.git$/i, '');
}

export function resolveCheckoutRootForRepoUrl(spec, repoUrl) {
  const repoName = extractRepoName(repoUrl);

  if (repoName === spec.packageDirName) {
    return resolveSourcePackageRoot(spec);
  }

  if (repoName === spec.packageContainerDirName) {
    return resolveSourcePackageContainerRoot(spec);
  }

  return spec.repoRoot;
}

export function resolvePackageRootForCheckoutRoot(spec, checkoutRoot) {
  const normalizedCheckoutRoot = path.resolve(checkoutRoot);
  const packageRoot = path.resolve(resolveSourcePackageRoot(spec));

  if (normalizedCheckoutRoot === packageRoot) {
    return packageRoot;
  }

  return packageRoot;
}

export function parseGitSubmodulePaths(gitmodulesContent) {
  const submodulePaths = new Set();
  const matches = String(gitmodulesContent ?? '').matchAll(/^\s*path\s*=\s*(.+)\s*$/gm);

  for (const match of matches) {
    if (match[1]) {
      submodulePaths.add(match[1].trim());
    }
  }

  return submodulePaths;
}

function readGitSubmodulePaths(repoRoot) {
  const gitmodulesPath = path.join(repoRoot, '.gitmodules');
  if (!fs.existsSync(gitmodulesPath)) {
    return new Set();
  }

  return parseGitSubmodulePaths(fs.readFileSync(gitmodulesPath, 'utf8'));
}

function resolveGitDirectoryFromCheckoutRoot(checkoutRoot) {
  const gitEntryPath = path.join(checkoutRoot, '.git');
  if (!fs.existsSync(gitEntryPath)) {
    return '';
  }

  const gitEntryStat = fs.lstatSync(gitEntryPath);
  if (gitEntryStat.isDirectory()) {
    return gitEntryPath;
  }

  if (!gitEntryStat.isFile()) {
    return '';
  }

  const pointerSource = fs.readFileSync(gitEntryPath, 'utf8');
  const pointerMatch = pointerSource.match(/^\s*gitdir:\s*(.+)\s*$/m);
  if (!pointerMatch?.[1]) {
    return '';
  }

  return path.resolve(checkoutRoot, pointerMatch[1].trim());
}

function findGitCheckoutInfo(startPath) {
  let currentPath = path.resolve(startPath);

  while (true) {
    const gitDirectory = resolveGitDirectoryFromCheckoutRoot(currentPath);
    if (gitDirectory) {
      return {
        checkoutRoot: currentPath,
        gitDirectory,
      };
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return null;
    }

    currentPath = parentPath;
  }
}

function readGitConfigSource(startPath) {
  const checkoutInfo = findGitCheckoutInfo(startPath);
  if (!checkoutInfo) {
    return '';
  }

  const configPath = path.join(checkoutInfo.gitDirectory, 'config');
  if (!fs.existsSync(configPath)) {
    return '';
  }

  return fs.readFileSync(configPath, 'utf8');
}

function ensureDirectoryLink(linkPath, targetPath) {
  const normalizedTargetPath = path.resolve(targetPath);

  if (fs.existsSync(linkPath)) {
    const linkStat = fs.lstatSync(linkPath);
    const resolvedExistingPath = path.resolve(fs.realpathSync(linkPath));

    if (resolvedExistingPath === normalizedTargetPath) {
      return;
    }

    if (linkStat.isSymbolicLink()) {
      throw new Error(
        `[prepare-shared-sdk-git-sources] Existing symbolic link at ${linkPath} does not point to ${targetPath}.`,
      );
    }

    throw new Error(
      `[prepare-shared-sdk-git-sources] Cannot materialize ${linkPath} because it already exists and does not point to ${targetPath}.`,
    );
  }

  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(targetPath, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
}

export function materializePackageRootFromMonorepo(spec) {
  const packageRoot = resolveSourcePackageRoot(spec);
  if (fs.existsSync(packageRoot)) {
    return packageRoot;
  }

  const submodulePaths = readGitSubmodulePaths(spec.repoRoot);
  if (!submodulePaths.has(spec.monorepoSubmodulePath)) {
    return packageRoot;
  }

  run('git', [
    '-C',
    spec.repoRoot,
    'submodule',
    'update',
    '--init',
    '--depth',
    '1',
    '--',
    spec.monorepoSubmodulePath,
  ]);

  const monorepoSubmoduleRoot = resolveMonorepoSubmoduleRoot(spec);
  const monorepoPackageRoot = resolveMonorepoPackageRoot(spec);
  if (!fs.existsSync(monorepoPackageRoot)) {
    throw new Error(
      `[prepare-shared-sdk-git-sources] Expected ${spec.label} monorepo package root at ${monorepoPackageRoot}.`,
    );
  }

  ensureDirectoryLink(resolveSourcePackageContainerRoot(spec), monorepoSubmoduleRoot);
  return packageRoot;
}

export function isGitCheckout(repoRoot) {
  return Boolean(findGitCheckoutInfo(repoRoot));
}

export function detectExistingOriginUrl(repoRoot) {
  if (!isGitCheckout(repoRoot)) {
    return '';
  }

  const gitConfigSource = readGitConfigSource(repoRoot);
  const remoteOriginMatch = gitConfigSource.match(
    /\[remote\s+"origin"\][\s\S]*?^\s*url\s*=\s*(.+)\s*$/m,
  );
  if (remoteOriginMatch?.[1]) {
    return remoteOriginMatch[1].trim();
  }

  try {
    return run('git', ['-C', repoRoot, 'remote', 'get-url', 'origin'], {
      captureStdout: true,
    });
  } catch {
    return '';
  }
}

export function resolveRemoteDefaultBranch(repoUrl) {
  // Equivalent git command: git ls-remote --symref <repoUrl> HEAD
  const output = run('git', ['ls-remote', '--symref', repoUrl, 'HEAD'], {
    captureStdout: true,
  });
  const match = output.match(/ref:\s+refs\/heads\/([^\s]+)\s+HEAD/);
  if (match?.[1]) {
    return match[1];
  }

  throw new Error(
    `[prepare-shared-sdk-git-sources] Unable to resolve the remote default branch for ${repoUrl}.`,
  );
}

function resolveRepoUrl(spec, env) {
  const explicitUrl = typeof env?.[spec.repoUrlEnvVar] === 'string'
    ? env[spec.repoUrlEnvVar].trim()
    : '';
  if (explicitUrl.length > 0) {
    return explicitUrl;
  }

  for (const checkoutRoot of [
    resolveSourcePackageRoot(spec),
    resolveSourcePackageContainerRoot(spec),
    spec.repoRoot,
  ]) {
    const existingOriginUrl = detectExistingOriginUrl(checkoutRoot);
    if (existingOriginUrl.length > 0) {
      return existingOriginUrl;
    }
  }

  if (typeof spec.defaultRepoUrl === 'string' && spec.defaultRepoUrl.trim().length > 0) {
    return spec.defaultRepoUrl.trim();
  }

  throw new Error(
    `[prepare-shared-sdk-git-sources] Missing ${spec.repoUrlEnvVar}. ` +
      `Set it to the git remote that should materialize ${spec.label}.`,
  );
}

function resolveCurrentCheckoutRef(repoRoot) {
  if (!isGitCheckout(repoRoot)) {
    return '';
  }

  try {
    return run('git', ['-C', repoRoot, 'branch', '--show-current'], {
      captureStdout: true,
    });
  } catch {
    return '';
  }
}

function resolveTargetRef({ repoUrl, env, checkoutRoot, syncExistingRepos }) {
  const explicitRef = typeof env?.[SHARED_SDK_GIT_REF_ENV_VAR] === 'string'
    ? env[SHARED_SDK_GIT_REF_ENV_VAR].trim()
    : '';
  if (explicitRef.length > 0) {
    return explicitRef;
  }

  if (!syncExistingRepos) {
    const currentCheckoutRef = resolveCurrentCheckoutRef(checkoutRoot);
    if (currentCheckoutRef.length > 0) {
      return currentCheckoutRef;
    }
  }

  return resolveRemoteDefaultBranch(repoUrl);
}

function assertGitCheckoutIsClean(repoRoot, label) {
  const statusOutput = run('git', ['-C', repoRoot, 'status', '--porcelain'], {
    captureStdout: true,
  });
  if (statusOutput.length === 0) {
    return;
  }

  throw new Error(
    `[prepare-shared-sdk-git-sources] Refusing to update ${label} at ${repoRoot} because the checkout has uncommitted changes.`,
  );
}

function cloneSourceRepo({ repoRoot, repoUrl, targetRef }) {
  fs.mkdirSync(path.dirname(repoRoot), { recursive: true });
  // Equivalent git command: git clone --depth 1 --branch <targetRef> <repoUrl> <repoRoot>
  run('git', ['clone', '--depth', '1', '--branch', targetRef, repoUrl, repoRoot]);
}

function syncExistingSourceRepo({ repoRoot, repoUrl, targetRef, label }) {
  assertGitCheckoutIsClean(repoRoot, label);
  run('git', ['-C', repoRoot, 'remote', 'set-url', 'origin', repoUrl]);
  run('git', ['-C', repoRoot, 'fetch', '--depth', '1', 'origin', targetRef]);
  run('git', ['-C', repoRoot, 'checkout', '--force', targetRef]);
  run('git', ['-C', repoRoot, 'reset', '--hard', `origin/${targetRef}`]);
}

function ensureSourceSpecReady(spec, env, syncExistingRepos) {
  const repoUrl = resolveRepoUrl(spec, env);
  const checkoutRoot = resolveCheckoutRootForRepoUrl(spec, repoUrl);
  const hasGitCheckout = isGitCheckout(checkoutRoot);
  const targetRef = resolveTargetRef({
    repoUrl,
    env,
    checkoutRoot,
    syncExistingRepos,
  });

  if (!hasGitCheckout) {
    if (fs.existsSync(checkoutRoot) && fs.readdirSync(checkoutRoot).length > 0) {
      throw new Error(
        `[prepare-shared-sdk-git-sources] Expected ${checkoutRoot} to be a git checkout for ${spec.label}.`,
      );
    }

    cloneSourceRepo({
      repoRoot: checkoutRoot,
      repoUrl,
      targetRef,
    });
  } else if (syncExistingRepos) {
    syncExistingSourceRepo({
      repoRoot: checkoutRoot,
      repoUrl,
      targetRef,
      label: spec.label,
    });
  }

  let packageRoot = resolvePackageRootForCheckoutRoot(spec, checkoutRoot);

  if (!fs.existsSync(packageRoot) && path.resolve(checkoutRoot) === path.resolve(spec.repoRoot)) {
    packageRoot = materializePackageRootFromMonorepo(spec);
  }

  if (!fs.existsSync(packageRoot)) {
    throw new Error(
      `[prepare-shared-sdk-git-sources] Expected ${spec.label} package root at ${packageRoot}.`,
    );
  }

  console.log(
    `[prepare-shared-sdk-git-sources] Ready ${spec.label} from ${repoUrl}#${targetRef}.`,
  );

  return {
    ...spec,
    repoUrl,
    targetRef,
    packageRoot,
  };
}

export function ensureSharedSdkGitSources({
  workspaceRootDir = process.cwd(),
  env = process.env,
  syncExistingRepos = parseBooleanFlag(env?.CI) || parseBooleanFlag(env?.[SHARED_SDK_GIT_FORCE_SYNC_ENV_VAR]),
} = {}) {
  return createSourceSpecs(workspaceRootDir).map((spec) => {
    return ensureSourceSpecReady(spec, env, syncExistingRepos);
  });
}

function main() {
  ensureSharedSdkGitSources();
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
