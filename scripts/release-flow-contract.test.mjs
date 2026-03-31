import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');
const desktopBundleOverlayConfig = path.join(
  'src-tauri',
  'generated',
  'tauri.bundle.overlay.json',
);
const desktopPackageDir = path.join('packages', 'sdkwork-claw-desktop');

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('repository exposes a cross-platform claw-studio release workflow', () => {
  const workflowPath = path.join(rootDir, '.github', 'workflows', 'release.yml');
  const reusableWorkflowPath = path.join(rootDir, '.github', 'workflows', 'release-reusable.yml');
  assert.equal(existsSync(workflowPath), true, 'missing .github/workflows/release.yml');
  assert.equal(existsSync(reusableWorkflowPath), true, 'missing .github/workflows/release-reusable.yml');

  const workflow = read('.github/workflows/release.yml');
  const reusableWorkflow = read('.github/workflows/release-reusable.yml');
  const gitSourcePreparationCount =
    reusableWorkflow.match(/node scripts\/prepare-shared-sdk-git-sources\.mjs/g)?.length ?? 0;
  const sharedSdkPreparationCount =
    reusableWorkflow.match(/pnpm prepare:shared-sdk/g)?.length ?? 0;

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /push:\s*[\s\S]*tags:\s*[\s\S]*release-\*/);
  assert.match(workflow, /uses:\s*\.\/\.github\/workflows\/release-reusable\.yml/);
  assert.match(workflow, /release_profile:\s*claw-studio/);
  assert.match(reusableWorkflow, /workflow_call:/);
  assert.match(reusableWorkflow, /concurrency:/);
  assert.match(reusableWorkflow, /verify-release:/);
  assert.match(reusableWorkflow, /SDKWORK_SHARED_SDK_MODE:\s*git/);
  assert.match(reusableWorkflow, /SDKWORK_SHARED_SDK_GIT_REF:\s*main/);
  assert.match(reusableWorkflow, /SDKWORK_SHARED_SDK_APP_REPO_URL:\s*https:\/\/github\.com\/Sdkwork-Cloud\/sdkwork-sdk-app\.git/);
  assert.match(reusableWorkflow, /SDKWORK_SHARED_SDK_COMMON_REPO_URL:\s*https:\/\/github\.com\/Sdkwork-Cloud\/sdkwork-sdk-commons\.git/);
  assert.equal(gitSourcePreparationCount, 3);
  assert.match(reusableWorkflow, /pnpm install --frozen-lockfile/);
  assert.equal(sharedSdkPreparationCount, 3);
  assert.match(reusableWorkflow, /submodules:\s*recursive/);
  assert.match(reusableWorkflow, /libgtk-3-dev/);
  assert.match(reusableWorkflow, /libpipewire-0\.3-dev/);
  assert.match(reusableWorkflow, /libssl-dev/);
  assert.match(reusableWorkflow, /libfuse2t64/);
  assert.match(reusableWorkflow, /libgbm-dev/);
  assert.match(reusableWorkflow, /file/);
  assert.match(reusableWorkflow, /pkg-config/);
  assert.match(reusableWorkflow, /libwayland-dev/);
  assert.match(reusableWorkflow, /libxkbcommon-dev/);
  assert.match(reusableWorkflow, /pnpm build/);
  assert.match(reusableWorkflow, /pnpm docs:build/);
  assert.match(reusableWorkflow, /node scripts\/release\/resolve-release-plan\.mjs --profile \$\{\{ inputs\.release_profile \}\}/);
  assert.match(reusableWorkflow, /node scripts\/run-desktop-release-build\.mjs --profile \$\{\{ inputs\.release_profile \}\} --phase sync --target \$\{\{ matrix\.target \}\} --release/);
  assert.match(reusableWorkflow, /node scripts\/run-desktop-release-build\.mjs --profile \$\{\{ inputs\.release_profile \}\} --phase prepare-target --target \$\{\{ matrix\.target \}\}/);
  assert.match(reusableWorkflow, /node scripts\/run-desktop-release-build\.mjs --profile \$\{\{ inputs\.release_profile \}\} --phase prepare-openclaw --target \$\{\{ matrix\.target \}\}/);
  assert.match(reusableWorkflow, /node scripts\/run-desktop-release-build\.mjs --profile \$\{\{ inputs\.release_profile \}\} --phase prepare-api-router --target \$\{\{ matrix\.target \}\}/);
  assert.match(reusableWorkflow, /node scripts\/run-desktop-release-build\.mjs --profile \$\{\{ inputs\.release_profile \}\} --phase bundle --target \$\{\{ matrix\.target \}\}/);
  assert.match(reusableWorkflow, /node scripts\/release\/package-release-assets\.mjs desktop --profile \$\{\{ inputs\.release_profile \}\} --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\}/);
  assert.match(reusableWorkflow, /node scripts\/release\/package-release-assets\.mjs web --profile \$\{\{ inputs\.release_profile \}\}/);
  assert.match(reusableWorkflow, /node scripts\/release\/finalize-release-assets\.mjs --profile \$\{\{ inputs\.release_profile \}\}/);
  assert.match(reusableWorkflow, /actions\/attest-build-provenance@v3/);
  assert.match(reusableWorkflow, /attestations:\s*write/);
  assert.match(reusableWorkflow, /id-token:\s*write/);
  assert.match(reusableWorkflow, /softprops\/action-gh-release@/);
  assert.match(reusableWorkflow, /CMAKE_GENERATOR:\s*Visual Studio 17 2022/);
  assert.match(reusableWorkflow, /needs:\s*\[\s*prepare,\s*verify-release\s*\]/);
});

test('desktop tauri build script treats sdkwork-api-router prebuilt artifacts as optional metadata across the full release matrix', () => {
  const buildScript = read('packages/sdkwork-claw-desktop/src-tauri/build.rs');

  assert.match(buildScript, /\("linux", "aarch64"\)\s*=>\s*"linux-arm64"/);
  assert.match(buildScript, /\("macos", "x86_64"\)\s*=>\s*"macos-x64"/);
  assert.match(buildScript, /cargo:warning=/);
  assert.doesNotMatch(buildScript, /prebuilt integration does not yet support target/);
});

test('root package exposes release helper scripts for desktop and asset packaging', () => {
  const rootPackage = JSON.parse(read('package.json'));

  assert.match(rootPackage.scripts['check:release-flow'], /node scripts\/release-flow-contract\.test\.mjs/);
  assert.match(rootPackage.scripts['check:release-flow'], /node scripts\/release\/release-profiles\.test\.mjs/);
  assert.match(rootPackage.scripts['check:release-flow'], /node scripts\/release\/finalize-release-assets\.test\.mjs/);
  assert.match(rootPackage.scripts['check:ci-flow'], /node scripts\/ci-flow-contract\.test\.mjs/);
  assert.match(rootPackage.scripts['check:automation'], /pnpm check:release-flow && pnpm check:ci-flow/);
  assert.match(rootPackage.scripts['lint'], /pnpm check:automation/);
  assert.match(rootPackage.scripts['release:desktop'], /node scripts\/run-desktop-release-build\.mjs/);
  assert.match(rootPackage.scripts['release:package:desktop'], /node scripts\/release\/package-release-assets\.mjs desktop/);
  assert.match(rootPackage.scripts['release:package:web'], /node scripts\/release\/package-release-assets\.mjs web/);
  assert.match(rootPackage.scripts['release:finalize'], /node scripts\/release\/finalize-release-assets\.mjs/);
});

test('shared sdk mode helper defaults to source mode and supports git trunk release mode', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'shared-sdk-mode.mjs');
  assert.equal(existsSync(helperPath), true, 'missing scripts/shared-sdk-mode.mjs');

  const helper = await import(pathToFileURL(helperPath).href);
  assert.equal(typeof helper.resolveSharedSdkMode, 'function');
  assert.equal(typeof helper.isSharedSdkSourceMode, 'function');
  assert.equal(typeof helper.SHARED_SDK_MODE_ENV_VAR, 'string');

  assert.equal(helper.SHARED_SDK_MODE_ENV_VAR, 'SDKWORK_SHARED_SDK_MODE');
  assert.equal(helper.resolveSharedSdkMode({}), 'source');
  assert.equal(helper.resolveSharedSdkMode({ SDKWORK_SHARED_SDK_MODE: 'source' }), 'source');
  assert.equal(helper.resolveSharedSdkMode({ SDKWORK_SHARED_SDK_MODE: 'git' }), 'git');
  assert.equal(helper.isSharedSdkSourceMode({}), true);
  assert.equal(helper.isSharedSdkSourceMode({ SDKWORK_SHARED_SDK_MODE: 'git' }), false);
});

test('shared sdk package preparation resolves the workspace root consistently from repo root and package directories', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'prepare-shared-sdk-packages.mjs');
  assert.equal(existsSync(helperPath), true, 'missing scripts/prepare-shared-sdk-packages.mjs');

  const helper = await import(pathToFileURL(helperPath).href);
  assert.equal(typeof helper.resolveWorkspaceRootDir, 'function');
  assert.equal(typeof helper.createSharedSdkPackageContext, 'function');

  const packageDir = path.join(rootDir, 'packages', 'sdkwork-claw-web');
  assert.equal(helper.resolveWorkspaceRootDir(rootDir), rootDir);
  assert.equal(helper.resolveWorkspaceRootDir(packageDir), rootDir);

  assert.deepEqual(
    helper.createSharedSdkPackageContext({
      currentWorkingDir: packageDir,
      env: { SDKWORK_SHARED_SDK_MODE: 'git' },
    }),
    {
      workspaceRoot: rootDir,
      sharedAppSdkRoot: path.resolve(
        rootDir,
        '../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript',
      ),
      sharedSdkCommonRoot: path.resolve(
        rootDir,
        '../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript',
      ),
      mode: 'git',
    },
  );
});

test('git-backed shared sdk source detection resolves origin from nested directories inside an existing git checkout', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'prepare-shared-sdk-git-sources.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  assert.equal(typeof helper.isGitCheckout, 'function');
  assert.equal(typeof helper.detectExistingOriginUrl, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-shared-sdk-'));
  const repoRoot = path.join(tempRoot, 'shared-sdk-repo');
  const nestedPackageRoot = path.join(repoRoot, 'packages', 'sdkwork-app-sdk');

  mkdirSync(repoRoot, { recursive: true });
  mkdirSync(nestedPackageRoot, { recursive: true });

  const runGit = (args) => {
    const result = spawnSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });

    assert.equal(result.status, 0, result.stderr || result.stdout || `git ${args.join(' ')} failed`);
  };

  try {
    runGit(['init']);
    runGit(['remote', 'add', 'origin', 'https://example.com/shared-sdk.git']);

    assert.equal(helper.isGitCheckout(nestedPackageRoot), true);
    assert.equal(
      helper.detectExistingOriginUrl(nestedPackageRoot),
      'https://example.com/shared-sdk.git',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('git-backed shared sdk source helper parses monorepo submodule layouts and resolves legacy package roots', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'prepare-shared-sdk-git-sources.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  assert.equal(typeof helper.resolveSourcePackageContainerRoot, 'function');
  assert.equal(typeof helper.resolveSourcePackageRoot, 'function');
  assert.equal(typeof helper.resolveMonorepoSubmoduleRoot, 'function');
  assert.equal(typeof helper.resolveMonorepoPackageRoot, 'function');
  assert.equal(typeof helper.resolveCheckoutRootForRepoUrl, 'function');
  assert.equal(typeof helper.resolvePackageRootForCheckoutRoot, 'function');
  assert.equal(typeof helper.parseGitSubmodulePaths, 'function');
  assert.equal(typeof helper.materializePackageRootFromMonorepo, 'function');
  assert.equal(helper.DEFAULT_SHARED_SDK_APP_REPO_URL, 'https://github.com/Sdkwork-Cloud/sdkwork-sdk-app.git');
  assert.equal(helper.DEFAULT_SHARED_SDK_COMMON_REPO_URL, 'https://github.com/Sdkwork-Cloud/sdkwork-sdk-commons.git');

  const repoRoot = path.join(rootDir, '.tmp', 'shared-sdk-layout');
  const spec = {
    repoRoot,
    packageContainerDirName: 'sdkwork-sdk-app',
    packageDirName: 'sdkwork-app-sdk-typescript',
    monorepoSubmodulePath: 'spring-ai-plus-business/spring-ai-plus-app-api/sdkwork-sdk-app',
  };

  assert.equal(
    helper.resolveSourcePackageContainerRoot(spec).replaceAll('\\', '/'),
    path.join(repoRoot, 'sdkwork-sdk-app').replaceAll('\\', '/'),
  );
  assert.equal(
    helper.resolveSourcePackageRoot(spec).replaceAll('\\', '/'),
    path.join(repoRoot, 'sdkwork-sdk-app', 'sdkwork-app-sdk-typescript').replaceAll('\\', '/'),
  );
  assert.equal(
    helper.resolveMonorepoSubmoduleRoot(spec).replaceAll('\\', '/'),
    path.join(repoRoot, 'spring-ai-plus-business', 'spring-ai-plus-app-api', 'sdkwork-sdk-app').replaceAll('\\', '/'),
  );
  assert.equal(
    helper.resolveMonorepoPackageRoot(spec).replaceAll('\\', '/'),
    path.join(
      repoRoot,
      'spring-ai-plus-business',
      'spring-ai-plus-app-api',
      'sdkwork-sdk-app',
      'sdkwork-app-sdk-typescript',
    ).replaceAll('\\', '/'),
  );
  assert.equal(
    helper.resolveCheckoutRootForRepoUrl(
      spec,
      'https://github.com/Sdkwork-Cloud/sdkwork-sdk-app.git',
    ).replaceAll('\\', '/'),
    path.join(repoRoot, 'sdkwork-sdk-app').replaceAll('\\', '/'),
  );
  assert.equal(
    helper.resolveCheckoutRootForRepoUrl(
      spec,
      'https://github.com/Sdkwork-Cloud/sdkwork-app-sdk-typescript.git',
    ).replaceAll('\\', '/'),
    path.join(repoRoot, 'sdkwork-sdk-app', 'sdkwork-app-sdk-typescript').replaceAll('\\', '/'),
  );
  assert.equal(
    helper.resolvePackageRootForCheckoutRoot(
      spec,
      path.join(repoRoot, 'sdkwork-sdk-app'),
    ).replaceAll('\\', '/'),
    path.join(repoRoot, 'sdkwork-sdk-app', 'sdkwork-app-sdk-typescript').replaceAll('\\', '/'),
  );

  const parsedPaths = helper.parseGitSubmodulePaths(`
[submodule "spring-ai-plus-business/sdk/sdkwork-sdk-commons"]
    path = spring-ai-plus-business/sdk/sdkwork-sdk-commons
[submodule "spring-ai-plus-business/spring-ai-plus-app-api/sdkwork-sdk-app"]
    path = spring-ai-plus-business/spring-ai-plus-app-api/sdkwork-sdk-app
`);
  assert.deepEqual([...parsedPaths], [
    'spring-ai-plus-business/sdk/sdkwork-sdk-commons',
    'spring-ai-plus-business/spring-ai-plus-app-api/sdkwork-sdk-app',
  ]);

  const helperSource = read('scripts/prepare-shared-sdk-git-sources.mjs');
  assert.match(helperSource, /submodule/);
  assert.match(helperSource, /--init/);
  assert.match(helperSource, /symlinkSync/);
  assert.match(helperSource, /monorepoSubmodulePath/);
});

test('desktop release build runner injects the supported Visual Studio generator only on Windows', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  assert.equal(existsSync(runnerPath), true, 'missing scripts/run-desktop-release-build.mjs');

  const runner = await import(pathToFileURL(runnerPath).href);
  assert.equal(typeof runner.createDesktopReleaseBuildPlan, 'function');

  const windowsPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'win32',
    env: {},
  });
  const linuxPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    env: {},
  });

  assert.equal(windowsPlan.command, 'pnpm');
  assert.deepEqual(windowsPlan.args, ['--filter', '@sdkwork/claw-desktop', 'run', 'tauri:build']);
  assert.equal(windowsPlan.env.CMAKE_GENERATOR, 'Visual Studio 17 2022');
  assert.equal(windowsPlan.env.HOST_CMAKE_GENERATOR, 'Visual Studio 17 2022');

  assert.equal(linuxPlan.command, 'pnpm');
  assert.deepEqual(linuxPlan.args, ['--filter', '@sdkwork/claw-desktop', 'run', 'tauri:build']);
  assert.equal(Object.hasOwn(linuxPlan.env, 'CMAKE_GENERATOR'), false);
  assert.equal(windowsPlan.env.SDKWORK_VITE_MODE, 'production');
  assert.equal(linuxPlan.env.SDKWORK_VITE_MODE, 'production');
});

test('desktop release build runner can override the vite mode for test bundles while keeping production as the default', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  const defaultPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    env: {},
  });
  const testPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    env: {},
    viteMode: 'test',
  });

  assert.equal(defaultPlan.env.SDKWORK_VITE_MODE, 'production');
  assert.equal(testPlan.env.SDKWORK_VITE_MODE, 'test');
});

test('desktop release target helpers resolve platform and architecture from explicit target triples', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'desktop-targets.mjs');
  assert.equal(existsSync(helperPath), true, 'missing scripts/release/desktop-targets.mjs');

  const helper = await import(pathToFileURL(helperPath).href);
  assert.equal(typeof helper.parseDesktopTargetTriple, 'function');
  assert.equal(typeof helper.resolveDesktopReleaseTarget, 'function');

  assert.deepEqual(
    helper.parseDesktopTargetTriple('aarch64-pc-windows-msvc'),
    {
      platform: 'windows',
      arch: 'arm64',
      targetTriple: 'aarch64-pc-windows-msvc',
    },
  );
  assert.deepEqual(
    helper.parseDesktopTargetTriple('x86_64-apple-darwin'),
    {
      platform: 'macos',
      arch: 'x64',
      targetTriple: 'x86_64-apple-darwin',
    },
  );
  assert.deepEqual(
    helper.resolveDesktopReleaseTarget({
      env: {
        SDKWORK_DESKTOP_TARGET: 'x86_64-unknown-linux-gnu',
      },
    }),
    {
      platform: 'linux',
      arch: 'x64',
      targetTriple: 'x86_64-unknown-linux-gnu',
    },
  );
});

test('desktop release build runner forwards explicit target triples to tauri build', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  const arm64WindowsPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'win32',
    env: {},
    targetTriple: 'aarch64-pc-windows-msvc',
  });

  assert.deepEqual(arm64WindowsPlan.args, [
    '--filter',
    '@sdkwork/claw-desktop',
    'run',
    'tauri:build',
    '--',
    '--target',
    'aarch64-pc-windows-msvc',
  ]);
  assert.equal(arm64WindowsPlan.env.SDKWORK_DESKTOP_TARGET, 'aarch64-pc-windows-msvc');
  assert.equal(arm64WindowsPlan.env.SDKWORK_DESKTOP_TARGET_PLATFORM, 'windows');
  assert.equal(arm64WindowsPlan.env.SDKWORK_DESKTOP_TARGET_ARCH, 'arm64');
});

test('desktop release bundle phase merges the generated Windows bundle overlay config and limits CI installers to the stable profile bundle set', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  const windowsBundlePlan = runner.createDesktopReleaseBuildPlan({
    platform: 'win32',
    env: {},
    phase: 'bundle',
    targetTriple: 'x86_64-pc-windows-msvc',
  });

  assert.equal(windowsBundlePlan.command, process.execPath);
  assert.deepEqual(windowsBundlePlan.args, [
    'scripts/run-windows-tauri-bundle.mjs',
    '--profile',
    'claw-studio',
    '--config',
    path.join(desktopPackageDir, desktopBundleOverlayConfig),
    '--bundles',
    'nsis',
  ]);

  const windowsBundleModulePath = path.join(rootDir, 'scripts', 'run-windows-tauri-bundle.mjs');
  const windowsBundleModule = await import(pathToFileURL(windowsBundleModulePath).href);
  const windowsCommand = windowsBundleModule.buildWindowsTauriBundleCommand();

  assert.match(windowsCommand.args.join(' '), /--bundles nsis/);
});

test('desktop release build runner exposes granular release phases for CI diagnostics', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  const syncPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    env: {},
    phase: 'sync',
    targetTriple: 'aarch64-unknown-linux-gnu',
  });
  const prepareTargetPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    env: {},
    phase: 'prepare-target',
    targetTriple: 'aarch64-unknown-linux-gnu',
  });
  const openClawPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    env: {},
    phase: 'prepare-openclaw',
    targetTriple: 'aarch64-unknown-linux-gnu',
  });
  const apiRouterPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    env: {},
    phase: 'prepare-api-router',
    targetTriple: 'aarch64-unknown-linux-gnu',
  });
  const bundlePlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    env: {},
    phase: 'bundle',
    targetTriple: 'aarch64-unknown-linux-gnu',
  });

  assert.match(syncPlan.args.join(' '), /sync-bundled-components\.mjs --no-fetch --release/);
  assert.match(prepareTargetPlan.args.join(' '), /ensure-tauri-target-clean\.mjs/);
  assert.match(openClawPlan.args.join(' '), /prepare-openclaw-runtime\.mjs/);
  assert.match(apiRouterPlan.args.join(' '), /prepare-sdkwork-api-router-runtime\.mjs/);
  assert.deepEqual(bundlePlan.args, [
    '--dir',
    desktopPackageDir,
    'exec',
    'tauri',
    'build',
    '--config',
    desktopBundleOverlayConfig,
    '--bundles',
    'deb,rpm',
    '--target',
    'aarch64-unknown-linux-gnu',
  ]);
  assert.equal(bundlePlan.env.SDKWORK_DESKTOP_TARGET, 'aarch64-unknown-linux-gnu');
  assert.equal(bundlePlan.env.SDKWORK_DESKTOP_TARGET_PLATFORM, 'linux');
  assert.equal(bundlePlan.env.SDKWORK_DESKTOP_TARGET_ARCH, 'arm64');
});

test('desktop release build runner requests standard macOS dmg and app bundle outputs in CI', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  const macosBundlePlan = runner.createDesktopReleaseBuildPlan({
    platform: 'darwin',
    hostArch: 'x64',
    env: {},
    phase: 'bundle',
    targetTriple: 'x86_64-apple-darwin',
  });

  assert.deepEqual(macosBundlePlan.args, [
    '--dir',
    desktopPackageDir,
    'exec',
    'tauri',
    'build',
    '--config',
    desktopBundleOverlayConfig,
    '--bundles',
    'app,dmg',
  ]);
  assert.equal(macosBundlePlan.env.SDKWORK_DESKTOP_TARGET, 'x86_64-apple-darwin');
  assert.equal(macosBundlePlan.env.SDKWORK_DESKTOP_TARGET_PLATFORM, 'macos');
  assert.equal(macosBundlePlan.env.SDKWORK_DESKTOP_TARGET_ARCH, 'x64');
});

test('desktop release build runner avoids explicit tauri target flags on native architecture runners', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  const nativeLinuxArmPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    hostArch: 'arm64',
    env: {},
    phase: 'bundle',
    targetTriple: 'aarch64-unknown-linux-gnu',
  });

  assert.deepEqual(nativeLinuxArmPlan.args, [
    '--dir',
    desktopPackageDir,
    'exec',
    'tauri',
    'build',
    '--config',
    desktopBundleOverlayConfig,
    '--bundles',
    'deb,rpm',
  ]);
  assert.equal(nativeLinuxArmPlan.env.SDKWORK_DESKTOP_TARGET, 'aarch64-unknown-linux-gnu');
  assert.equal(nativeLinuxArmPlan.env.SDKWORK_DESKTOP_TARGET_PLATFORM, 'linux');
  assert.equal(nativeLinuxArmPlan.env.SDKWORK_DESKTOP_TARGET_ARCH, 'arm64');
});

test('desktop release build runner can recover a macOS dmg bundle failure when the app and dmg outputs already exist', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  assert.equal(typeof runner.canRecoverMacosBundleFailure, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-macos-bundle-recovery-'));

  try {
    const targetDir = path.join(tempRoot, 'target');
    const bundleRoot = path.join(targetDir, 'release', 'bundle');
    const appBundleDir = path.join(bundleRoot, 'macos', 'Claw Studio.app');
    const dmgPath = path.join(bundleRoot, 'dmg', 'Claw Studio_0.1.0_x64.dmg');

    mkdirSync(path.join(appBundleDir, 'Contents'), { recursive: true });
    mkdirSync(path.dirname(dmgPath), { recursive: true });
    writeFileSync(dmgPath, 'synthetic dmg');

    assert.equal(
      runner.canRecoverMacosBundleFailure({
        platform: 'darwin',
        targetTriple: 'x86_64-apple-darwin',
        bundleTargets: ['app', 'dmg'],
        targetDir,
      }),
      true,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop release build runner can recover a macOS dmg bundle failure when Tauri leaves the dmg under the macos bundle directory', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  assert.equal(typeof runner.canRecoverMacosBundleFailure, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-macos-bundle-recovery-macos-dir-'));

  try {
    const targetDir = path.join(tempRoot, 'target');
    const bundleRoot = path.join(targetDir, 'release', 'bundle');
    const appBundleDir = path.join(bundleRoot, 'macos', 'Claw Studio.app');
    const dmgPath = path.join(bundleRoot, 'macos', 'Claw Studio_0.1.0_x64.dmg');

    mkdirSync(path.join(appBundleDir, 'Contents'), { recursive: true });
    writeFileSync(dmgPath, 'synthetic dmg');

    assert.equal(
      runner.canRecoverMacosBundleFailure({
        platform: 'darwin',
        targetTriple: 'x86_64-apple-darwin',
        bundleTargets: ['app', 'dmg'],
        targetDir,
      }),
      true,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop release build runner does not treat a Tauri rw temporary dmg as a completed dmg output', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  assert.equal(typeof runner.canRecoverMacosBundleFailure, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-macos-bundle-temp-dmg-'));

  try {
    const targetDir = path.join(tempRoot, 'target');
    const bundleRoot = path.join(targetDir, 'release', 'bundle');
    const appBundleDir = path.join(bundleRoot, 'macos', 'Claw Studio.app');
    const temporaryDmgPath = path.join(bundleRoot, 'macos', 'rw.86444.Claw.Studio_0.1.0_x64.dmg');

    mkdirSync(path.join(appBundleDir, 'Contents'), { recursive: true });
    writeFileSync(temporaryDmgPath, 'synthetic temporary dmg');

    assert.equal(
      runner.canRecoverMacosBundleFailure({
        platform: 'darwin',
        targetTriple: 'x86_64-apple-darwin',
        bundleTargets: ['app', 'dmg'],
        targetDir,
      }),
      false,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop release build runner can repair a macOS dmg bundle failure by converting a Tauri rw temporary dmg into the final dmg artifact', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  assert.equal(typeof runner.repairMacosDmgBundleOutput, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-macos-bundle-repair-'));

  try {
    const targetDir = path.join(tempRoot, 'target');
    const bundleRoot = path.join(targetDir, 'release', 'bundle');
    const appBundleDir = path.join(bundleRoot, 'macos', 'Claw Studio.app');
    const temporaryDmgPath = path.join(bundleRoot, 'macos', 'rw.86444.Claw.Studio_0.1.0_x64.dmg');
    const finalDmgPath = path.join(bundleRoot, 'dmg', 'Claw.Studio_0.1.0_x64.dmg');

    mkdirSync(path.join(appBundleDir, 'Contents'), { recursive: true });
    mkdirSync(path.dirname(temporaryDmgPath), { recursive: true });
    writeFileSync(temporaryDmgPath, 'synthetic temporary dmg');

    const spawnCalls = [];
    const repaired = runner.repairMacosDmgBundleOutput({
      platform: 'darwin',
      targetTriple: 'x86_64-apple-darwin',
      bundleTargets: ['app', 'dmg'],
      targetDir,
      spawnSyncImpl(command, args) {
        spawnCalls.push({ command, args });
        mkdirSync(path.dirname(finalDmgPath), { recursive: true });
        writeFileSync(finalDmgPath, 'synthetic finalized dmg');
        return { status: 0 };
      },
    });

    assert.equal(repaired, true);
    assert.equal(existsSync(finalDmgPath), true);
    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].command, 'hdiutil');
    assert.deepEqual(spawnCalls[0].args, [
      'convert',
      temporaryDmgPath,
      '-format',
      'UDZO',
      '-o',
      finalDmgPath,
    ]);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop release build runner does not recover a macOS dmg bundle failure when the dmg output is missing', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  assert.equal(typeof runner.canRecoverMacosBundleFailure, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-macos-bundle-failure-'));

  try {
    const targetDir = path.join(tempRoot, 'target');
    const bundleRoot = path.join(targetDir, 'release', 'bundle');
    const appBundleDir = path.join(bundleRoot, 'macos', 'Claw Studio.app');

    mkdirSync(path.join(appBundleDir, 'Contents'), { recursive: true });

    assert.equal(
      runner.canRecoverMacosBundleFailure({
        platform: 'darwin',
        targetTriple: 'x86_64-apple-darwin',
        bundleTargets: ['app', 'dmg'],
        targetDir,
      }),
      false,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release plan resolver expands the claw-studio profile into the full desktop matrix', async () => {
  const resolverPath = path.join(rootDir, 'scripts', 'release', 'resolve-release-plan.mjs');
  assert.equal(existsSync(resolverPath), true, 'missing scripts/release/resolve-release-plan.mjs');

  const resolver = await import(pathToFileURL(resolverPath).href);
  assert.equal(typeof resolver.createReleasePlan, 'function');

  const plan = resolver.createReleasePlan({
    profileId: 'claw-studio',
    releaseTag: 'release-2026-03-31-03',
    gitRef: 'refs/tags/release-2026-03-31-03',
  });

  assert.equal(plan.profileId, 'claw-studio');
  assert.equal(plan.desktopMatrix.length, 6);
  assert.deepEqual(
    plan.desktopMatrix.find((entry) => entry.platform === 'linux' && entry.arch === 'x64'),
    {
      runner: 'ubuntu-24.04',
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      bundles: ['deb', 'rpm'],
    },
  );
  assert.deepEqual(
    plan.desktopMatrix.find((entry) => entry.platform === 'macos' && entry.arch === 'arm64'),
    {
      runner: 'macos-15',
      platform: 'macos',
      arch: 'arm64',
      target: 'aarch64-apple-darwin',
      bundles: ['app', 'dmg'],
    },
  );
});

test('release asset packager knows how to filter desktop bundle outputs, resolve target roots, and name web archives', async () => {
  const packagerPath = path.join(rootDir, 'scripts', 'release', 'package-release-assets.mjs');
  assert.equal(existsSync(packagerPath), true, 'missing scripts/release/package-release-assets.mjs');

  const packager = await import(pathToFileURL(packagerPath).href);
  assert.equal(typeof packager.normalizePlatformId, 'function');
  assert.equal(typeof packager.shouldIncludeDesktopBundleFile, 'function');
  assert.equal(typeof packager.buildDesktopBundleRootCandidates, 'function');
  assert.equal(typeof packager.resolveDesktopBundleRoot, 'function');
  assert.equal(typeof packager.resolveExistingDesktopBundleRoot, 'function');
  assert.equal(typeof packager.buildWebArchiveBaseName, 'function');

  assert.equal(packager.normalizePlatformId('win32'), 'windows');
  assert.equal(packager.normalizePlatformId('darwin'), 'macos');
  assert.equal(packager.normalizePlatformId('linux'), 'linux');

  assert.equal(
    packager.shouldIncludeDesktopBundleFile('windows', 'nsis/Claw Studio_0.1.0_x64-setup.exe'),
    true,
  );
  assert.equal(
    packager.shouldIncludeDesktopBundleFile('windows', 'deb/claw-studio_0.1.0_amd64.deb'),
    false,
  );
  assert.equal(
    packager.shouldIncludeDesktopBundleFile('linux', 'deb/claw-studio_0.1.0_amd64.deb'),
    true,
  );
  assert.equal(
    packager.shouldIncludeDesktopBundleFile('macos', 'dmg/Claw Studio_0.1.0_aarch64.dmg'),
    true,
  );
  assert.equal(
    packager.shouldIncludeDesktopBundleFile('macos', 'macos/rw.86444.Claw.Studio_0.1.0_x64.dmg'),
    false,
  );
  assert.equal(
    packager.resolveDesktopBundleRoot({ targetTriple: 'aarch64-pc-windows-msvc' }).replaceAll('\\', '/'),
    path.join(
      rootDir,
      'packages',
      'sdkwork-claw-desktop',
      'src-tauri',
      'target',
      'aarch64-pc-windows-msvc',
      'release',
      'bundle',
    ).replaceAll('\\', '/'),
  );

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-bundle-root-'));

  try {
    const tempTargetDir = path.join(tempRoot, 'target');
    const fallbackBundleRoot = path.join(tempTargetDir, 'release', 'bundle');

    mkdirSync(fallbackBundleRoot, { recursive: true });

    assert.deepEqual(
      packager.buildDesktopBundleRootCandidates({
        targetTriple: 'x86_64-pc-windows-msvc',
        targetDir: tempTargetDir,
      }).map((candidate) => candidate.replaceAll('\\', '/')),
      [
        path.join(tempTargetDir, 'x86_64-pc-windows-msvc', 'release', 'bundle').replaceAll('\\', '/'),
        fallbackBundleRoot.replaceAll('\\', '/'),
      ],
    );

    assert.equal(
      packager.resolveExistingDesktopBundleRoot({
        targetTriple: 'x86_64-pc-windows-msvc',
        targetDir: tempTargetDir,
      }).replaceAll('\\', '/'),
      fallbackBundleRoot.replaceAll('\\', '/'),
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }

  assert.equal(
    packager.buildWebArchiveBaseName('release-2026-03-26'),
    'claw-studio-web-assets-release-2026-03-26',
  );
});

test('bundled component sync resolves the npm global node_modules root for Unix and Windows layouts', async () => {
  const syncPath = path.join(rootDir, 'scripts', 'sync-bundled-components.mjs');
  const syncModule = await import(pathToFileURL(syncPath).href);
  const syncSource = read('scripts/sync-bundled-components.mjs');

  assert.equal(typeof syncModule.resolveGlobalNodeModulesDir, 'function');
  assert.match(syncSource, /buildAttempts:\s*3/);
  assert.match(syncSource, /retrying after cleaning dist/);

  assert.equal(
    syncModule.resolveGlobalNodeModulesDir('/tmp/openclaw-prefix', 'linux'),
    '/tmp/openclaw-prefix/lib/node_modules',
  );
  assert.equal(
    syncModule.resolveGlobalNodeModulesDir('/tmp/openclaw-prefix', 'darwin'),
    '/tmp/openclaw-prefix/lib/node_modules',
  );
  assert.equal(
    syncModule.resolveGlobalNodeModulesDir('C:/openclaw-prefix', 'win32'),
    'C:\\openclaw-prefix\\node_modules',
  );
  assert.doesNotMatch(syncSource, /'router-web-service',/);
  assert.doesNotMatch(syncSource, /"router-web-service",/);
  assert.doesNotMatch(syncSource, /-p'\s*,\s*'router-web-service'/);
});

test('release sync defers heavyweight openclaw and api-router builds to later dedicated phases', async () => {
  const syncPath = path.join(rootDir, 'scripts', 'sync-bundled-components.mjs');
  const syncModule = await import(pathToFileURL(syncPath).href);

  assert.equal(typeof syncModule.createComponentExecutionPlan, 'function');

  assert.deepEqual(
    syncModule.createComponentExecutionPlan({
      componentId: 'openclaw',
      devMode: false,
      releaseMode: true,
    }),
    {
      shouldBuild: false,
      shouldStage: false,
    },
  );
  assert.deepEqual(
    syncModule.createComponentExecutionPlan({
      componentId: 'sdkwork-api-router',
      devMode: false,
      releaseMode: true,
    }),
    {
      shouldBuild: false,
      shouldStage: false,
    },
  );
  assert.deepEqual(
    syncModule.createComponentExecutionPlan({
      componentId: 'hub-installer',
      devMode: false,
      releaseMode: true,
    }),
    {
      shouldBuild: true,
      shouldStage: true,
    },
  );
  assert.deepEqual(
    syncModule.createComponentExecutionPlan({
      componentId: 'sdkwork-api-router',
      devMode: false,
      releaseMode: false,
    }),
    {
      shouldBuild: true,
      shouldStage: true,
    },
  );
});
