import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('repository exposes a cross-platform claw-studio release workflow', () => {
  const workflowPath = path.join(rootDir, '.github', 'workflows', 'release.yml');
  assert.equal(existsSync(workflowPath), true, 'missing .github/workflows/release.yml');

  const workflow = read('.github/workflows/release.yml');

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /push:\s*[\s\S]*tags:\s*[\s\S]*release-\*/);
  assert.match(workflow, /windows-2022/);
  assert.match(workflow, /windows-11-arm/);
  assert.match(workflow, /ubuntu-22\.04/);
  assert.match(workflow, /ubuntu-22\.04-arm/);
  assert.match(workflow, /macos-15-intel/);
  assert.match(workflow, /macos-15/);
  assert.match(workflow, /arch:\s*x64/);
  assert.match(workflow, /arch:\s*arm64/);
  assert.match(workflow, /target:\s*x86_64-pc-windows-msvc/);
  assert.match(workflow, /target:\s*aarch64-pc-windows-msvc/);
  assert.match(workflow, /target:\s*x86_64-unknown-linux-gnu/);
  assert.match(workflow, /target:\s*aarch64-unknown-linux-gnu/);
  assert.match(workflow, /target:\s*x86_64-apple-darwin/);
  assert.match(workflow, /target:\s*aarch64-apple-darwin/);
  assert.match(workflow, /SDKWORK_SHARED_SDK_MODE:\s*git/);
  assert.match(workflow, /SDKWORK_SHARED_SDK_GIT_REF:\s*main/);
  assert.match(workflow, /SDKWORK_SHARED_SDK_APP_REPO_URL:\s*https:\/\/github\.com\/Sdkwork-Cloud\/sdkwork-sdk-app\.git/);
  assert.match(workflow, /SDKWORK_SHARED_SDK_COMMON_REPO_URL:\s*https:\/\/github\.com\/Sdkwork-Cloud\/sdkwork-sdk-commons\.git/);
  assert.match(workflow, /node scripts\/prepare-shared-sdk-git-sources\.mjs/);
  assert.match(workflow, /pnpm install --frozen-lockfile/);
  assert.match(workflow, /pnpm build/);
  assert.match(workflow, /pnpm docs:build/);
  assert.match(workflow, /node scripts\/run-desktop-release-build\.mjs --target \$\{\{ matrix\.target \}\}/);
  assert.match(workflow, /node scripts\/release\/package-release-assets\.mjs desktop --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\}/);
  assert.match(workflow, /release-assets-desktop-\$\{\{ matrix\.platform \}\}-\$\{\{ matrix\.arch \}\}/);
  assert.match(workflow, /node scripts\/release\/package-release-assets\.mjs web/);
  assert.match(workflow, /softprops\/action-gh-release@/);
  assert.match(workflow, /CMAKE_GENERATOR:\s*Visual Studio 17 2022/);
});

test('root package exposes release helper scripts for desktop and asset packaging', () => {
  const rootPackage = JSON.parse(read('package.json'));

  assert.match(rootPackage.scripts['release:desktop'], /node scripts\/run-desktop-release-build\.mjs/);
  assert.match(rootPackage.scripts['release:package:desktop'], /node scripts\/release\/package-release-assets\.mjs desktop/);
  assert.match(rootPackage.scripts['release:package:web'], /node scripts\/release\/package-release-assets\.mjs web/);
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
});
