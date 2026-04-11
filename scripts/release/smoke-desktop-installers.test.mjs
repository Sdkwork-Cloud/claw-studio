import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

function writeJsonFile(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeArtifactFile(releaseAssetsDir, relativePath) {
  const absolutePath = path.join(releaseAssetsDir, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, 'synthetic desktop artifact\n', 'utf8');
  return absolutePath;
}

function buildInstallerContract(platform) {
  if (platform === 'windows') {
    return {
      version: 1,
      platform: 'windows',
      delivery: 'archive-only-resources',
      installMode: 'postinstall-prewarm',
      bundledResourceRoot: 'resources/openclaw/',
      runtimeArchive: 'resources/openclaw/runtime.zip',
      sourceConfigPath: 'packages/sdkwork-claw-desktop/src-tauri/tauri.windows.conf.json',
      installerHookPath: 'packages/sdkwork-claw-desktop/src-tauri/installer-hooks.nsh',
      prepareCommand: '--prepare-bundled-openclaw-runtime',
      prepareFailureMode: 'abort-install',
      cliRegistrationCommand: '--register-openclaw-cli',
      cliRegistrationFailureMode: 'best-effort',
    };
  }

  if (platform === 'linux') {
    return {
      version: 1,
      platform: 'linux',
      delivery: 'archive-only-resources',
      installMode: 'postinstall-prewarm',
      bundledResourceRoot: 'resources/openclaw/',
      runtimeArchive: 'resources/openclaw/runtime.zip',
      sourceConfigPath: 'packages/sdkwork-claw-desktop/src-tauri/tauri.linux.conf.json',
      postInstallScriptPath: 'packages/sdkwork-claw-desktop/src-tauri/linux-postinstall-openclaw.sh',
      packageFormats: ['deb', 'rpm'],
      prepareCommand: '--prepare-bundled-openclaw-runtime',
      prepareFailureMode: 'abort-install',
      installRootOverrides: ['SDKWORK_CLAW_INSTALL_ROOT', 'RPM_INSTALL_PREFIX', '--install-root'],
    };
  }

  if (platform === 'macos') {
    return {
      version: 1,
      platform: 'macos',
      delivery: 'archive-only-resources',
      installMode: 'preexpanded-managed-layout',
      bundledResourceRoot: 'resources/openclaw/',
      runtimeArchive: 'resources/openclaw/runtime.zip',
      sourceConfigPath: 'packages/sdkwork-claw-desktop/src-tauri/tauri.macos.conf.json',
      stagedInstallRootSource: 'generated/release/macos-install-root/',
      stagedInstallRootTarget: 'MacOS/',
    };
  }

  throw new Error(`Unsupported installer contract platform: ${platform}`);
}

function writeDesktopManifest({
  releaseAssetsDir,
  platform,
  arch,
  artifacts,
  openClawInstallerContract = buildInstallerContract(platform),
}) {
  const manifestPath = path.join(
    releaseAssetsDir,
    'desktop',
    platform,
    arch,
    'release-asset-manifest.json',
  );

  writeJsonFile(manifestPath, {
    profileId: 'claw-studio',
    productName: 'Claw Studio',
    releaseTag: 'release-2026-04-05-01',
    platform,
    arch,
    openClawInstallerContract,
    artifacts,
  });

  return manifestPath;
}

function buildInstallReadyLayout({
  mode,
  installKey,
  nodeEntryRelativePath = 'runtime/package/node_modules/node/bin/node',
  cliEntryRelativePath = 'runtime/package/node_modules/openclaw/openclaw.mjs',
} = {}) {
  return {
    mode,
    installKey,
    reuseOnFirstLaunch: true,
    requiresArchiveExtractionOnFirstLaunch: false,
    manifestRelativePath: 'manifest.json',
    runtimeSidecarRelativePath: 'runtime/.sdkwork-openclaw-runtime.json',
    nodeEntryRelativePath,
    cliEntryRelativePath,
  };
}

test('desktop installer smoke module can be imported without vendored hub-installer dist when installer functions are injected', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-installers.mjs');
  const originalSource = readFileSync(smokePath, 'utf8');
  const tempModulePath = path.join(
    rootDir,
    'scripts',
    'release',
    `smoke-desktop-installers.injected-${process.pid}-${Date.now()}.mjs`,
  );
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-smoke-desktop-injected-import-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const installerRelativePath = 'desktop/windows/x64/nsis/Claw Studio_0.1.0_x64-setup.exe';

  try {
    writeFileSync(
      tempModulePath,
      originalSource.replaceAll(
        'vendor/hub-installer/dist/index.mjs',
        'vendor/hub-installer/dist/__missing__/index.mjs',
      ),
      'utf8',
    );

    const smoke = await import(`${pathToFileURL(tempModulePath).href}?cacheBust=${Date.now()}`);

    writeArtifactFile(releaseAssetsDir, installerRelativePath);
    writeDesktopManifest({
      releaseAssetsDir,
      platform: 'windows',
      arch: 'x64',
      artifacts: [
        {
          name: 'Claw Studio_0.1.0_x64-setup.exe',
          relativePath: installerRelativePath,
          family: 'desktop',
          platform: 'windows',
          arch: 'x64',
          kind: 'installer',
          sha256: 'synthetic',
          size: readFileSync(path.join(releaseAssetsDir, installerRelativePath)).length,
        },
      ],
    });

    const result = await smoke.smokeDesktopInstallers({
      releaseAssetsDir,
      platform: 'windows',
      arch: 'x64',
      verifyDesktopOpenClawReleaseAssetsFn: async () => ({
        installReadyLayout: buildInstallReadyLayout({
          mode: 'simulated-prewarm',
          installKey: '2026.4.7-windows-x64',
        }),
      }),
      detectFormatFn(source) {
        return path.extname(source).slice(1).toLowerCase();
      },
      createInstallPlanFn: async (request) => ({
        request,
        steps: [
          {
            id: 'install-exe',
            description: 'synthetic windows install',
            command: 'installer.exe',
          },
        ],
        notes: [],
      }),
    });

    assert.equal(result.installPlans.length, 1);
    assert.equal(result.installPlans[0].artifact.relativePath, installerRelativePath);
  } finally {
    rmSync(tempModulePath, { force: true });
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop installer smoke resolves hub-installer bindings on demand when default vendor dist is required', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-installers.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  assert.equal(typeof smoke.resolveHubInstallerBindings, 'function');

  const fakeEntryPath = path.join(rootDir, 'tmp', 'hub-installer', 'dist', 'index.mjs');
  const callOrder = [];
  const bindings = await smoke.resolveHubInstallerBindings({
    ensureHubInstallerDistReadyFn: async () => {
      callOrder.push('prepare');
      return fakeEntryPath;
    },
    loadHubInstallerModuleFn: async ({ entryPath }) => {
      callOrder.push('load');
      assert.equal(entryPath, fakeEntryPath);
      return {
        createInstallPlan: async () => ({
          request: { dryRun: true },
          steps: [],
          notes: [],
        }),
        detectFormat: () => 'exe',
      };
    },
  });

  assert.deepEqual(callOrder, ['prepare', 'load']);
  assert.equal(typeof bindings.createInstallPlanFn, 'function');
  assert.equal(typeof bindings.detectFormatFn, 'function');
});

test('desktop installer smoke loads the default hub-installer module entry through a file URL', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-installers.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  assert.equal(typeof smoke.loadHubInstallerModule, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-smoke-desktop-module-load-'));
  const fakeEntryPath = path.join(tempRoot, 'hub-installer-entry.mjs');

  try {
    writeFileSync(
      fakeEntryPath,
      [
        'export function createInstallPlan() {',
        '  return { request: { dryRun: true }, steps: [], notes: [] };',
        '}',
        'export function detectFormat() {',
        "  return 'exe';",
        '}',
        '',
      ].join('\n'),
      'utf8',
    );

    const module = await smoke.loadHubInstallerModule({
      entryPath: fakeEntryPath,
    });

    assert.equal(typeof module.createInstallPlan, 'function');
    assert.equal(typeof module.detectFormat, 'function');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop installer smoke creates dry-run install plans for Windows installers after OpenClaw verification', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-installers.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  assert.equal(typeof smoke.smokeDesktopInstallers, 'function');
  assert.equal(typeof smoke.resolveDesktopInstallerSmokeReportPath, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-smoke-desktop-windows-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const installerRelativePath = 'desktop/windows/x64/nsis/Claw Studio_0.1.0_x64-setup.exe';

  try {
    writeArtifactFile(releaseAssetsDir, installerRelativePath);
    writeDesktopManifest({
      releaseAssetsDir,
      platform: 'windows',
      arch: 'x64',
      artifacts: [
        {
          name: 'Claw Studio_0.1.0_x64-setup.exe',
          relativePath: installerRelativePath,
          family: 'desktop',
          platform: 'windows',
          arch: 'x64',
          kind: 'installer',
          sha256: 'synthetic',
          size: readFileSync(path.join(releaseAssetsDir, installerRelativePath)).length,
        },
      ],
    });

    const callOrder = [];
    const planRequests = [];
    const result = await smoke.smokeDesktopInstallers({
      releaseAssetsDir,
      platform: 'windows',
      arch: 'x64',
      verifyDesktopOpenClawReleaseAssetsFn: async () => {
        callOrder.push('verify');
        return {
          installReadyLayout: buildInstallReadyLayout({
            mode: 'simulated-prewarm',
            installKey: '2026.4.2-windows-x64',
          }),
        };
      },
      detectFormatFn(source) {
        callOrder.push('detect');
        return path.extname(source).slice(1).toLowerCase();
      },
      createInstallPlanFn: async (request) => {
        callOrder.push('plan');
        planRequests.push(request);
        return {
          request,
          steps: [
            {
              id: 'install-exe',
              description: 'synthetic windows install',
              command: 'installer.exe',
            },
          ],
          notes: [],
        };
      },
    });

    assert.deepEqual(callOrder, ['verify', 'detect', 'plan']);
    assert.equal(planRequests.length, 1);
    assert.equal(planRequests[0].platform, 'windows');
    assert.equal(planRequests[0].format, 'exe');
    assert.equal(planRequests[0].dryRun, true);
    assert.equal(
      planRequests[0].source.replaceAll('\\', '/'),
      path.join(releaseAssetsDir, installerRelativePath).replaceAll('\\', '/'),
    );
    assert.equal(result.installPlans.length, 1);
    assert.equal(result.installPlans[0].artifact.relativePath, installerRelativePath);
    const smokeReportPath = smoke.resolveDesktopInstallerSmokeReportPath({
      releaseAssetsDir,
      platform: 'windows',
      arch: 'x64',
    });
    const smokeReport = JSON.parse(readFileSync(smokeReportPath, 'utf8'));
    assert.equal(smokeReport.platform, 'windows');
    assert.equal(smokeReport.arch, 'x64');
    assert.equal(
      smokeReport.manifestPath.replaceAll('\\', '/'),
      path.join(releaseAssetsDir, 'desktop', 'windows', 'x64', 'release-asset-manifest.json').replaceAll('\\', '/'),
    );
    assert.deepEqual(smokeReport.installableArtifactRelativePaths, [installerRelativePath]);
    assert.deepEqual(
      smokeReport.installReadyLayout,
      buildInstallReadyLayout({
        mode: 'simulated-prewarm',
        installKey: '2026.4.2-windows-x64',
      }),
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop installer smoke plans every Linux installable artifact through hub-installer dry-run mode', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-installers.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-smoke-desktop-linux-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const debRelativePath = 'desktop/linux/x64/deb/claw-studio_0.1.0_amd64.deb';
  const rpmRelativePath = 'desktop/linux/x64/rpm/claw-studio-0.1.0-1.x86_64.rpm';

  try {
    writeArtifactFile(releaseAssetsDir, debRelativePath);
    writeArtifactFile(releaseAssetsDir, rpmRelativePath);
    writeDesktopManifest({
      releaseAssetsDir,
      platform: 'linux',
      arch: 'x64',
      artifacts: [
        {
          name: 'claw-studio_0.1.0_amd64.deb',
          relativePath: debRelativePath,
          family: 'desktop',
          platform: 'linux',
          arch: 'x64',
          kind: 'package',
          sha256: 'deb',
          size: 10,
        },
        {
          name: 'claw-studio-0.1.0-1.x86_64.rpm',
          relativePath: rpmRelativePath,
          family: 'desktop',
          platform: 'linux',
          arch: 'x64',
          kind: 'package',
          sha256: 'rpm',
          size: 11,
        },
      ],
    });

    const planRequests = [];
    const result = await smoke.smokeDesktopInstallers({
      releaseAssetsDir,
      platform: 'linux',
      arch: 'x64',
      verifyDesktopOpenClawReleaseAssetsFn: async () => ({
        installReadyLayout: buildInstallReadyLayout({
          mode: 'simulated-prewarm',
          installKey: '2026.4.2-linux-x64',
        }),
      }),
      detectFormatFn(source) {
        return path.extname(source).slice(1).toLowerCase();
      },
      createInstallPlanFn: async (request) => {
        planRequests.push(request);
        return {
          request,
          steps: [
            {
              id: `install-${request.format}`,
              description: 'synthetic linux install',
              command: 'installer',
            },
          ],
          notes: [],
        };
      },
    });

    assert.deepEqual(
      planRequests.map((request) => ({
        platform: request.platform,
        format: request.format,
        dryRun: request.dryRun,
      })),
      [
        {
          platform: 'ubuntu',
          format: 'deb',
          dryRun: true,
        },
        {
          platform: 'ubuntu',
          format: 'rpm',
          dryRun: true,
        },
      ],
    );
    assert.equal(result.installPlans.length, 2);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop installer smoke rejects verification results that do not prove an install-ready OpenClaw layout', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-installers.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-smoke-desktop-install-ready-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const installerRelativePath = 'desktop/windows/x64/nsis/Claw Studio_0.1.0_x64-setup.exe';

  try {
    writeArtifactFile(releaseAssetsDir, installerRelativePath);
    writeDesktopManifest({
      releaseAssetsDir,
      platform: 'windows',
      arch: 'x64',
      artifacts: [
        {
          name: 'Claw Studio_0.1.0_x64-setup.exe',
          relativePath: installerRelativePath,
          family: 'desktop',
          platform: 'windows',
          arch: 'x64',
          kind: 'installer',
          sha256: 'synthetic',
          size: readFileSync(path.join(releaseAssetsDir, installerRelativePath)).length,
        },
      ],
    });

    await assert.rejects(
      () => smoke.smokeDesktopInstallers({
        releaseAssetsDir,
        platform: 'windows',
        arch: 'x64',
        verifyDesktopOpenClawReleaseAssetsFn: async () => ({}),
        detectFormatFn(source) {
          return path.extname(source).slice(1).toLowerCase();
        },
        createInstallPlanFn: async (request) => ({
          request,
          steps: [],
          notes: [],
        }),
      }),
      /install-ready|installReadyLayout/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop installer smoke rejects install-ready layout evidence whose mode does not match the target platform contract', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-installers.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-smoke-desktop-install-ready-mode-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const installerRelativePath = 'desktop/windows/x64/nsis/Claw Studio_0.1.0_x64-setup.exe';

  try {
    writeArtifactFile(releaseAssetsDir, installerRelativePath);
    writeDesktopManifest({
      releaseAssetsDir,
      platform: 'windows',
      arch: 'x64',
      artifacts: [
        {
          name: 'Claw Studio_0.1.0_x64-setup.exe',
          relativePath: installerRelativePath,
          family: 'desktop',
          platform: 'windows',
          arch: 'x64',
          kind: 'installer',
          sha256: 'synthetic',
          size: readFileSync(path.join(releaseAssetsDir, installerRelativePath)).length,
        },
      ],
    });

    await assert.rejects(
      () => smoke.smokeDesktopInstallers({
        releaseAssetsDir,
        platform: 'windows',
        arch: 'x64',
        verifyDesktopOpenClawReleaseAssetsFn: async () => ({
          installReadyLayout: buildInstallReadyLayout({
            mode: 'staged-layout',
            installKey: '2026.4.2-windows-x64',
          }),
        }),
        detectFormatFn(source) {
          return path.extname(source).slice(1).toLowerCase();
        },
        createInstallPlanFn: async (request) => ({
          request,
          steps: [],
          notes: [],
        }),
      }),
      /install-ready|installReadyLayout|simulated-prewarm/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop installer smoke requires a macOS dmg plan target and a bundled app archive companion', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-installers.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-smoke-desktop-macos-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const dmgRelativePath = 'desktop/macos/arm64/dmg/Claw Studio_0.1.0_aarch64.dmg';
  const archiveRelativePath = 'desktop/macos/arm64/macos/Claw Studio_0.1.0_arm64.app.zip';

  try {
    writeArtifactFile(releaseAssetsDir, dmgRelativePath);
    writeArtifactFile(releaseAssetsDir, archiveRelativePath);
    writeDesktopManifest({
      releaseAssetsDir,
      platform: 'macos',
      arch: 'arm64',
      artifacts: [
        {
          name: 'Claw Studio_0.1.0_aarch64.dmg',
          relativePath: dmgRelativePath,
          family: 'desktop',
          platform: 'macos',
          arch: 'arm64',
          kind: 'installer',
          sha256: 'dmg',
          size: 20,
        },
        {
          name: 'Claw Studio_0.1.0_arm64.app.zip',
          relativePath: archiveRelativePath,
          family: 'desktop',
          platform: 'macos',
          arch: 'arm64',
          kind: 'archive',
          sha256: 'zip',
          size: 21,
        },
      ],
    });

    const planRequests = [];
    const result = await smoke.smokeDesktopInstallers({
      releaseAssetsDir,
      platform: 'macos',
      arch: 'arm64',
      verifyDesktopOpenClawReleaseAssetsFn: async () => ({
        installReadyLayout: buildInstallReadyLayout({
          mode: 'staged-layout',
          installKey: '2026.4.2-macos-arm64',
        }),
      }),
      detectFormatFn(source) {
        const lowerCaseSource = source.toLowerCase();
        if (lowerCaseSource.endsWith('.app.zip')) {
          return 'zip';
        }
        return path.extname(source).slice(1).toLowerCase();
      },
      createInstallPlanFn: async (request) => {
        planRequests.push(request);
        return {
          request,
          steps: [
            {
              id: `install-${request.format}`,
              description: 'synthetic macos install',
              command: 'installer',
            },
          ],
          notes: [],
        };
      },
    });

    assert.equal(planRequests.length, 1);
    assert.equal(planRequests[0].platform, 'macos');
    assert.equal(planRequests[0].format, 'dmg');
    assert.equal(result.installPlans.length, 1);
    assert.equal(result.requiredCompanionArtifacts.length, 1);
    assert.equal(result.requiredCompanionArtifacts[0].relativePath, archiveRelativePath);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop installer smoke rejects a macOS release manifest that is missing the bundled app archive companion', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-installers.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-smoke-desktop-macos-missing-app-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const dmgRelativePath = 'desktop/macos/x64/dmg/Claw Studio_0.1.0_x64.dmg';

  try {
    writeArtifactFile(releaseAssetsDir, dmgRelativePath);
    writeDesktopManifest({
      releaseAssetsDir,
      platform: 'macos',
      arch: 'x64',
      artifacts: [
        {
          name: 'Claw Studio_0.1.0_x64.dmg',
          relativePath: dmgRelativePath,
          family: 'desktop',
          platform: 'macos',
          arch: 'x64',
          kind: 'installer',
          sha256: 'dmg',
          size: 22,
        },
      ],
    });

    await assert.rejects(
      () => smoke.smokeDesktopInstallers({
        releaseAssetsDir,
        platform: 'macos',
        arch: 'x64',
        verifyDesktopOpenClawReleaseAssetsFn: async () => ({
          installReadyLayout: buildInstallReadyLayout({
            mode: 'staged-layout',
            installKey: '2026.4.2-macos-x64',
          }),
        }),
        detectFormatFn(source) {
          return path.extname(source).slice(1).toLowerCase();
        },
        createInstallPlanFn: async (request) => ({
          request,
          steps: [],
          notes: [],
        }),
      }),
      /Missing macOS desktop app archive/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop installer smoke rejects manifests whose persisted OpenClaw installer contract is missing or stale', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-installers.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-smoke-desktop-contract-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const installerRelativePath = 'desktop/windows/x64/nsis/Claw Studio_0.1.0_x64-setup.exe';
  const expectedInstallerContract = {
    version: 1,
    platform: 'windows',
    delivery: 'archive-only-resources',
    installMode: 'postinstall-prewarm',
    bundledResourceRoot: 'resources/openclaw/',
    runtimeArchive: 'resources/openclaw/runtime.zip',
    sourceConfigPath: 'packages/sdkwork-claw-desktop/src-tauri/tauri.windows.conf.json',
    installerHookPath: 'packages/sdkwork-claw-desktop/src-tauri/installer-hooks.nsh',
    prepareCommand: '--prepare-bundled-openclaw-runtime',
    prepareFailureMode: 'abort-install',
    cliRegistrationCommand: '--register-openclaw-cli',
    cliRegistrationFailureMode: 'best-effort',
  };

  try {
    writeArtifactFile(releaseAssetsDir, installerRelativePath);
    const manifestPath = writeDesktopManifest({
      releaseAssetsDir,
      platform: 'windows',
      arch: 'x64',
      openClawInstallerContract: null,
      artifacts: [
        {
          name: 'Claw Studio_0.1.0_x64-setup.exe',
          relativePath: installerRelativePath,
          family: 'desktop',
          platform: 'windows',
          arch: 'x64',
          kind: 'installer',
          sha256: 'synthetic',
          size: readFileSync(path.join(releaseAssetsDir, installerRelativePath)).length,
        },
      ],
    });

    await assert.rejects(
      () => smoke.smokeDesktopInstallers({
        releaseAssetsDir,
        platform: 'windows',
        arch: 'x64',
        verifyDesktopOpenClawReleaseAssetsFn: async () => ({
          installReadyLayout: buildInstallReadyLayout({
            mode: 'simulated-prewarm',
            installKey: '2026.4.2-windows-x64',
          }),
        }),
        detectFormatFn(source) {
          return path.extname(source).slice(1).toLowerCase();
        },
        createInstallPlanFn: async (request) => ({
          request,
          steps: [],
          notes: [],
        }),
        readDesktopOpenClawInstallerContractFn: async () => expectedInstallerContract,
      }),
      /OpenClaw installer contract/i,
    );

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.openClawInstallerContract = {
      ...expectedInstallerContract,
      prepareFailureMode: 'defer-install',
    };
    writeJsonFile(manifestPath, manifest);

    await assert.rejects(
      () => smoke.smokeDesktopInstallers({
        releaseAssetsDir,
        platform: 'windows',
        arch: 'x64',
        verifyDesktopOpenClawReleaseAssetsFn: async () => ({
          installReadyLayout: buildInstallReadyLayout({
            mode: 'simulated-prewarm',
            installKey: '2026.4.2-windows-x64',
          }),
        }),
        detectFormatFn(source) {
          return path.extname(source).slice(1).toLowerCase();
        },
        createInstallPlanFn: async (request) => ({
          request,
          steps: [],
          notes: [],
        }),
        readDesktopOpenClawInstallerContractFn: async () => expectedInstallerContract,
      }),
      /OpenClaw installer contract/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
