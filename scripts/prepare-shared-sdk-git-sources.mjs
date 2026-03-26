import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

export const SHARED_SDK_APP_REPO_URL_ENV_VAR = 'SDKWORK_SHARED_SDK_APP_REPO_URL';
export const SHARED_SDK_COMMON_REPO_URL_ENV_VAR = 'SDKWORK_SHARED_SDK_COMMON_REPO_URL';
export const SHARED_SDK_GIT_REF_ENV_VAR = 'SDKWORK_SHARED_SDK_GIT_REF';
export const SHARED_SDK_GIT_FORCE_SYNC_ENV_VAR = 'SDKWORK_SHARED_SDK_GIT_FORCE_SYNC';

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
      packageRoot: path.resolve(
        workspaceRootDir,
        '../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript',
      ),
      repoUrlEnvVar: SHARED_SDK_APP_REPO_URL_ENV_VAR,
    },
    {
      id: 'sdk-common',
      label: '@sdkwork/sdk-common',
      repoRoot: path.resolve(workspaceRootDir, '../../sdk'),
      packageRoot: path.resolve(
        workspaceRootDir,
        '../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript',
      ),
      repoUrlEnvVar: SHARED_SDK_COMMON_REPO_URL_ENV_VAR,
    },
  ];
}

export function isGitCheckout(repoRoot) {
  if (!fs.existsSync(repoRoot)) {
    return false;
  }

  try {
    const output = run('git', ['-C', repoRoot, 'rev-parse', '--is-inside-work-tree'], {
      captureStdout: true,
    });
    return output.trim() === 'true';
  } catch {
    return false;
  }
}

export function detectExistingOriginUrl(repoRoot) {
  if (!isGitCheckout(repoRoot)) {
    return '';
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

  const existingOriginUrl = detectExistingOriginUrl(spec.repoRoot);
  if (existingOriginUrl.length > 0) {
    return existingOriginUrl;
  }

  throw new Error(
    `[prepare-shared-sdk-git-sources] Missing ${spec.repoUrlEnvVar}. ` +
      `Set it to the git remote that should materialize ${spec.label}.`,
  );
}

function resolveTargetRef(repoUrl, env) {
  const explicitRef = typeof env?.[SHARED_SDK_GIT_REF_ENV_VAR] === 'string'
    ? env[SHARED_SDK_GIT_REF_ENV_VAR].trim()
    : '';
  if (explicitRef.length > 0) {
    return explicitRef;
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
  const targetRef = resolveTargetRef(repoUrl, env);
  const hasGitCheckout = isGitCheckout(spec.repoRoot);

  if (!hasGitCheckout) {
    if (fs.existsSync(spec.repoRoot) && fs.readdirSync(spec.repoRoot).length > 0) {
      throw new Error(
        `[prepare-shared-sdk-git-sources] Expected ${spec.repoRoot} to be a git checkout for ${spec.label}.`,
      );
    }

    cloneSourceRepo({
      repoRoot: spec.repoRoot,
      repoUrl,
      targetRef,
    });
  } else if (syncExistingRepos) {
    syncExistingSourceRepo({
      repoRoot: spec.repoRoot,
      repoUrl,
      targetRef,
      label: spec.label,
    });
  }

  if (!fs.existsSync(spec.packageRoot)) {
    throw new Error(
      `[prepare-shared-sdk-git-sources] Expected ${spec.label} package root at ${spec.packageRoot}.`,
    );
  }

  console.log(
    `[prepare-shared-sdk-git-sources] Ready ${spec.label} from ${repoUrl}#${targetRef}.`,
  );

  return {
    ...spec,
    repoUrl,
    targetRef,
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
