import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

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

  throw new Error(`Unsupported installer contract platform: ${platform}`);
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

test('release asset finalizer writes a global checksum manifest and release manifest from partial package outputs', async () => {
  const finalizerPath = path.join(rootDir, 'scripts', 'release', 'finalize-release-assets.mjs');
  assert.equal(existsSync(finalizerPath), true, 'missing scripts/release/finalize-release-assets.mjs');

  const finalizer = await import(pathToFileURL(finalizerPath).href);
  assert.equal(typeof finalizer.parseArgs, 'function');
  assert.equal(typeof finalizer.finalizeReleaseAssets, 'function');
  assert.throws(
    () => finalizer.parseArgs(['--release-tag']),
    /Missing value for --release-tag/,
  );

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-finalize-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const windowsDir = path.join(releaseAssetsDir, 'desktop', 'windows', 'x64');
  const legacyWindowsDir = path.join(releaseAssetsDir, 'desktop', 'windows', 'nsis');
  const staleArm64WindowsDir = path.join(releaseAssetsDir, 'desktop', 'windows', 'arm64');
  const webDir = path.join(releaseAssetsDir, 'web');

  try {
    mkdirSync(windowsDir, { recursive: true });
    mkdirSync(legacyWindowsDir, { recursive: true });
    mkdirSync(staleArm64WindowsDir, { recursive: true });
    mkdirSync(webDir, { recursive: true });

    const windowsAssetPath = path.join(windowsDir, 'Claw.Studio_0.1.0_x64-setup.exe');
    const webAssetPath = path.join(webDir, 'claw-studio-web-assets-release-2026-03-31-03.tar.gz');
    const staleLegacyWindowsAssetPath = path.join(
      legacyWindowsDir,
      'Claw.Studio_0.1.0_x64-setup.exe',
    );
    const staleTopLevelWebAssetPath = path.join(
      releaseAssetsDir,
      'claw-studio-web-assets-release-2026-03-20-legacy.tar.gz',
    );
    const staleArm64WindowsAssetPath = path.join(
      staleArm64WindowsDir,
      'Claw.Studio_0.1.0_arm64-setup.exe',
    );

    writeFileSync(windowsAssetPath, 'windows-installer', 'utf8');
    writeFileSync(webAssetPath, 'web-assets', 'utf8');
    writeFileSync(staleLegacyWindowsAssetPath, 'stale-desktop-installer', 'utf8');
    writeFileSync(staleTopLevelWebAssetPath, 'stale-web-assets', 'utf8');
    writeFileSync(staleArm64WindowsAssetPath, 'stale-arm64-installer', 'utf8');
    writeFileSync(
      path.join(windowsDir, 'release-asset-manifest.json'),
      `${JSON.stringify({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-03-31-03',
        platform: 'windows',
        arch: 'x64',
        openClawInstallerContract: buildInstallerContract('windows'),
        artifacts: [
          {
            name: 'Claw.Studio_0.1.0_x64-setup.exe',
            relativePath: 'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
            platform: 'windows',
            arch: 'x64',
            kind: 'installer',
            sha256: 'placeholder',
            size: 17,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(webDir, 'release-asset-manifest.json'),
      `${JSON.stringify({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-03-31-03',
        artifacts: [
          {
            name: 'claw-studio-web-assets-release-2026-03-31-03.tar.gz',
            relativePath: 'web/claw-studio-web-assets-release-2026-03-31-03.tar.gz',
            platform: 'web',
            arch: 'any',
            kind: 'archive',
            sha256: 'placeholder',
            size: 10,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(staleArm64WindowsDir, 'release-asset-manifest.json'),
      `${JSON.stringify({
        profileId: 'claw-studio',
        platform: 'windows',
        arch: 'arm64',
        artifacts: [
          {
            name: 'Claw.Studio_0.1.0_arm64-setup.exe',
            relativePath: 'desktop/windows/arm64/Claw.Studio_0.1.0_arm64-setup.exe',
            platform: 'windows',
            arch: 'arm64',
            kind: 'installer',
            sha256: 'placeholder',
            size: 21,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(windowsDir, 'installer-smoke-report.json'),
      `${JSON.stringify({
        platform: 'windows',
        arch: 'x64',
        target: 'x86_64-pc-windows-msvc',
        manifestPath: path.join(windowsDir, 'release-asset-manifest.json'),
        verifiedAt: '2026-04-05T11:22:33.000Z',
        installableArtifactRelativePaths: [
          'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
        ],
        requiredCompanionArtifactRelativePaths: [],
        installReadyLayout: {
          ...buildInstallReadyLayout({
            mode: 'simulated-prewarm',
            installKey: '2026.4.2-windows-x64',
          }),
        },
        openClawInstallerContract: buildInstallerContract('windows'),
        installPlanSummaries: [
          {
            relativePath: 'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
            format: 'nsis',
            platform: 'windows',
            stepCount: 3,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );

    finalizer.finalizeReleaseAssets({
      profileId: 'claw-studio',
      releaseTag: 'release-2026-03-31-03',
      repository: 'Sdkwork-Cloud/claw-studio',
      releaseAssetsDir,
    });

    const manifestPath = path.join(releaseAssetsDir, 'release-manifest.json');
    const checksumPath = path.join(releaseAssetsDir, 'SHA256SUMS.txt');

    assert.equal(existsSync(manifestPath), true, 'missing release manifest');
    assert.equal(existsSync(checksumPath), true, 'missing global checksum manifest');

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const checksums = readFileSync(checksumPath, 'utf8');

    assert.equal(manifest.profileId, 'claw-studio');
    assert.equal(manifest.releaseTag, 'release-2026-03-31-03');
    assert.equal(manifest.repository, 'Sdkwork-Cloud/claw-studio');
    assert.equal(manifest.artifacts.length, 2);
    assert.doesNotMatch(
      checksums,
      /desktop\/windows\/nsis\/Claw\.Studio_0\.1\.0_x64-setup\.exe/,
    );
    assert.doesNotMatch(
      checksums,
      /claw-studio-web-assets-release-2026-03-20-legacy\.tar\.gz/,
    );
    assert.doesNotMatch(
      checksums,
      /desktop\/windows\/arm64\/Claw\.Studio_0\.1\.0_arm64-setup\.exe/,
    );
    assert.deepEqual(
      manifest.artifacts.map((artifact) => ({
        relativePath: artifact.relativePath,
        family: artifact.family,
        platform: artifact.platform,
        arch: artifact.arch,
        kind: artifact.kind,
      })),
      [
        {
          relativePath: 'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
          family: 'desktop',
          platform: 'windows',
          arch: 'x64',
          kind: 'installer',
        },
        {
          relativePath: 'web/claw-studio-web-assets-release-2026-03-31-03.tar.gz',
          family: 'web',
          platform: 'web',
          arch: 'any',
          kind: 'archive',
        },
      ],
    );
    const desktopArtifact = manifest.artifacts.find(
      (artifact) => artifact.relativePath === 'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
    );
    const webArtifact = manifest.artifacts.find(
      (artifact) => artifact.relativePath === 'web/claw-studio-web-assets-release-2026-03-31-03.tar.gz',
    );

    assert.deepEqual(
      desktopArtifact?.openClawInstallerContract,
      buildInstallerContract('windows'),
    );
    assert.deepEqual(
      desktopArtifact?.desktopInstallerSmoke,
      {
        reportRelativePath: 'desktop/windows/x64/installer-smoke-report.json',
        manifestRelativePath: 'desktop/windows/x64/release-asset-manifest.json',
        verifiedAt: '2026-04-05T11:22:33.000Z',
        target: 'x86_64-pc-windows-msvc',
        installableArtifactRelativePaths: [
          'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
        ],
        requiredCompanionArtifactRelativePaths: [],
        installReadyLayout: {
          ...buildInstallReadyLayout({
            mode: 'simulated-prewarm',
            installKey: '2026.4.2-windows-x64',
          }),
        },
        installPlanSummaries: [
          {
            relativePath: 'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
            format: 'nsis',
            platform: 'windows',
            stepCount: 3,
          },
        ],
      },
    );
    assert.equal('openClawInstallerContract' in webArtifact, false);
    assert.equal('desktopInstallerSmoke' in webArtifact, false);
    assert.match(checksums, /desktop\/windows\/x64\/Claw\.Studio_0\.1\.0_x64-setup\.exe/);
    assert.match(checksums, /web\/claw-studio-web-assets-release-2026-03-31-03\.tar\.gz/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release asset finalizer rejects desktop release assets when installer smoke evidence is missing or stale', async () => {
  const finalizerPath = path.join(rootDir, 'scripts', 'release', 'finalize-release-assets.mjs');
  const finalizer = await import(pathToFileURL(finalizerPath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-finalize-desktop-smoke-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const windowsDir = path.join(releaseAssetsDir, 'desktop', 'windows', 'x64');

  try {
    mkdirSync(windowsDir, { recursive: true });
    writeFileSync(
      path.join(windowsDir, 'Claw.Studio_0.1.0_x64-setup.exe'),
      'windows-installer',
      'utf8',
    );
    writeFileSync(
      path.join(windowsDir, 'release-asset-manifest.json'),
      `${JSON.stringify({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-04-05-02',
        platform: 'windows',
        arch: 'x64',
        openClawInstallerContract: buildInstallerContract('windows'),
        artifacts: [
          {
            name: 'Claw.Studio_0.1.0_x64-setup.exe',
            relativePath: 'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
            platform: 'windows',
            arch: 'x64',
            kind: 'installer',
            sha256: 'placeholder',
            size: 17,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );

    assert.throws(
      () => finalizer.finalizeReleaseAssets({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-04-05-02',
        repository: 'Sdkwork-Cloud/claw-studio',
        releaseAssetsDir,
      }),
      /Missing desktop installer smoke report/,
    );

    writeFileSync(
      path.join(windowsDir, 'installer-smoke-report.json'),
      `${JSON.stringify({
        platform: 'windows',
        arch: 'x64',
        manifestPath: path.join(windowsDir, 'release-asset-manifest.json'),
        installableArtifactRelativePaths: [
          'desktop/windows/x64/another-installer.exe',
        ],
        openClawInstallerContract: buildInstallerContract('windows'),
      }, null, 2)}\n`,
      'utf8',
    );

    assert.throws(
      () => finalizer.finalizeReleaseAssets({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-04-05-02',
        repository: 'Sdkwork-Cloud/claw-studio',
        releaseAssetsDir,
      }),
      /Desktop installer smoke report does not match the current installable artifact set/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release asset finalizer rejects desktop manifests whose OpenClaw installer contract metadata is missing or stale', async () => {
  const finalizerPath = path.join(rootDir, 'scripts', 'release', 'finalize-release-assets.mjs');
  const finalizer = await import(pathToFileURL(finalizerPath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-finalize-desktop-contract-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const windowsDir = path.join(releaseAssetsDir, 'desktop', 'windows', 'x64');
  const expectedInstallerContract = buildInstallerContract('windows');

  try {
    mkdirSync(windowsDir, { recursive: true });
    writeFileSync(
      path.join(windowsDir, 'Claw.Studio_0.1.0_x64-setup.exe'),
      'windows-installer',
      'utf8',
    );
    writeFileSync(
      path.join(windowsDir, 'release-asset-manifest.json'),
      `${JSON.stringify({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-04-05-03',
        platform: 'windows',
        arch: 'x64',
        artifacts: [
          {
            name: 'Claw.Studio_0.1.0_x64-setup.exe',
            relativePath: 'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
            platform: 'windows',
            arch: 'x64',
            kind: 'installer',
            sha256: 'placeholder',
            size: 17,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(windowsDir, 'installer-smoke-report.json'),
      `${JSON.stringify({
        platform: 'windows',
        arch: 'x64',
        manifestPath: path.join(windowsDir, 'release-asset-manifest.json'),
        installableArtifactRelativePaths: [
          'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
        ],
        openClawInstallerContract: expectedInstallerContract,
      }, null, 2)}\n`,
      'utf8',
    );

    assert.throws(
      () => finalizer.finalizeReleaseAssets({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-04-05-03',
        repository: 'Sdkwork-Cloud/claw-studio',
        releaseAssetsDir,
      }),
      /OpenClaw installer contract/i,
    );

    writeFileSync(
      path.join(windowsDir, 'release-asset-manifest.json'),
      `${JSON.stringify({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-04-05-03',
        platform: 'windows',
        arch: 'x64',
        openClawInstallerContract: {
          ...expectedInstallerContract,
          prepareFailureMode: 'defer-install',
        },
        artifacts: [
          {
            name: 'Claw.Studio_0.1.0_x64-setup.exe',
            relativePath: 'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
            platform: 'windows',
            arch: 'x64',
            kind: 'installer',
            sha256: 'placeholder',
            size: 17,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );

    assert.throws(
      () => finalizer.finalizeReleaseAssets({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-04-05-03',
        repository: 'Sdkwork-Cloud/claw-studio',
        releaseAssetsDir,
      }),
      /OpenClaw installer contract/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release asset finalizer rejects desktop smoke reports that are missing install-ready layout evidence', async () => {
  const finalizerPath = path.join(rootDir, 'scripts', 'release', 'finalize-release-assets.mjs');
  const finalizer = await import(pathToFileURL(finalizerPath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-finalize-install-ready-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const windowsDir = path.join(releaseAssetsDir, 'desktop', 'windows', 'x64');

  try {
    mkdirSync(windowsDir, { recursive: true });
    writeFileSync(
      path.join(windowsDir, 'Claw.Studio_0.1.0_x64-setup.exe'),
      'windows-installer',
      'utf8',
    );
    writeFileSync(
      path.join(windowsDir, 'release-asset-manifest.json'),
      `${JSON.stringify({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-04-05-04',
        platform: 'windows',
        arch: 'x64',
        openClawInstallerContract: buildInstallerContract('windows'),
        artifacts: [
          {
            name: 'Claw.Studio_0.1.0_x64-setup.exe',
            relativePath: 'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
            platform: 'windows',
            arch: 'x64',
            kind: 'installer',
            sha256: 'placeholder',
            size: 17,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(windowsDir, 'installer-smoke-report.json'),
      `${JSON.stringify({
        platform: 'windows',
        arch: 'x64',
        target: 'x86_64-pc-windows-msvc',
        manifestPath: path.join(windowsDir, 'release-asset-manifest.json'),
        verifiedAt: '2026-04-05T12:34:56.000Z',
        installableArtifactRelativePaths: [
          'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
        ],
        requiredCompanionArtifactRelativePaths: [],
        openClawInstallerContract: buildInstallerContract('windows'),
        installPlanSummaries: [
          {
            relativePath: 'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
            format: 'nsis',
            platform: 'windows',
            stepCount: 3,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );

    assert.throws(
      () => finalizer.finalizeReleaseAssets({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-04-05-04',
        repository: 'Sdkwork-Cloud/claw-studio',
        releaseAssetsDir,
      }),
      /install-ready|installReadyLayout/i,
    );

    writeFileSync(
      path.join(windowsDir, 'installer-smoke-report.json'),
      `${JSON.stringify({
        platform: 'windows',
        arch: 'x64',
        target: 'x86_64-pc-windows-msvc',
        manifestPath: path.join(windowsDir, 'release-asset-manifest.json'),
        verifiedAt: '2026-04-05T12:34:56.000Z',
        installableArtifactRelativePaths: [
          'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
        ],
        requiredCompanionArtifactRelativePaths: [],
        installReadyLayout: {
          ...buildInstallReadyLayout({
            mode: '',
            installKey: '2026.4.2-windows-x64',
          }),
        },
        openClawInstallerContract: buildInstallerContract('windows'),
        installPlanSummaries: [
          {
            relativePath: 'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
            format: 'nsis',
            platform: 'windows',
            stepCount: 3,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );

    assert.throws(
      () => finalizer.finalizeReleaseAssets({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-04-05-04',
        repository: 'Sdkwork-Cloud/claw-studio',
        releaseAssetsDir,
      }),
      /install-ready|installReadyLayout/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release asset finalizer rejects desktop smoke reports whose install-ready mode drifts from the installer contract', async () => {
  const finalizerPath = path.join(rootDir, 'scripts', 'release', 'finalize-release-assets.mjs');
  const finalizer = await import(pathToFileURL(finalizerPath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-finalize-install-ready-mode-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const windowsDir = path.join(releaseAssetsDir, 'desktop', 'windows', 'x64');

  try {
    mkdirSync(windowsDir, { recursive: true });
    writeFileSync(
      path.join(windowsDir, 'Claw.Studio_0.1.0_x64-setup.exe'),
      'windows-installer',
      'utf8',
    );
    writeFileSync(
      path.join(windowsDir, 'release-asset-manifest.json'),
      `${JSON.stringify({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-04-05-05',
        platform: 'windows',
        arch: 'x64',
        openClawInstallerContract: buildInstallerContract('windows'),
        artifacts: [
          {
            name: 'Claw.Studio_0.1.0_x64-setup.exe',
            relativePath: 'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
            platform: 'windows',
            arch: 'x64',
            kind: 'installer',
            sha256: 'placeholder',
            size: 17,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(windowsDir, 'installer-smoke-report.json'),
      `${JSON.stringify({
        platform: 'windows',
        arch: 'x64',
        target: 'x86_64-pc-windows-msvc',
        manifestPath: path.join(windowsDir, 'release-asset-manifest.json'),
        verifiedAt: '2026-04-05T12:45:56.000Z',
        installableArtifactRelativePaths: [
          'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
        ],
        requiredCompanionArtifactRelativePaths: [],
        installReadyLayout: {
          ...buildInstallReadyLayout({
            mode: 'staged-layout',
            installKey: '2026.4.2-windows-x64',
          }),
        },
        openClawInstallerContract: buildInstallerContract('windows'),
        installPlanSummaries: [
          {
            relativePath: 'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
            format: 'nsis',
            platform: 'windows',
            stepCount: 3,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );

    assert.throws(
      () => finalizer.finalizeReleaseAssets({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-04-05-05',
        repository: 'Sdkwork-Cloud/claw-studio',
        releaseAssetsDir,
      }),
      /install-ready|installReadyLayout|simulated-prewarm/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release asset finalizer infers multi-family metadata when fallback assets do not have partial manifests', async () => {
  const finalizerPath = path.join(rootDir, 'scripts', 'release', 'finalize-release-assets.mjs');
  const finalizer = await import(pathToFileURL(finalizerPath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-finalize-fallback-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const serverDir = path.join(releaseAssetsDir, 'server', 'linux', 'x64');
  const containerDir = path.join(releaseAssetsDir, 'container', 'linux', 'arm64', 'cpu');
  const kubernetesDir = path.join(releaseAssetsDir, 'kubernetes', 'linux', 'x64', 'nvidia-cuda');

  try {
    mkdirSync(serverDir, { recursive: true });
    mkdirSync(containerDir, { recursive: true });
    mkdirSync(kubernetesDir, { recursive: true });

    writeFileSync(
      path.join(serverDir, 'claw-studio-server-release-2026-04-03-05-linux-x64.tar.gz'),
      'server-asset',
      'utf8',
    );
    writeFileSync(
      path.join(containerDir, 'claw-studio-container-bundle-release-2026-04-03-05-linux-arm64-cpu.tar.gz'),
      'container-asset',
      'utf8',
    );
    writeFileSync(
      path.join(kubernetesDir, 'claw-studio-kubernetes-bundle-release-2026-04-03-05-linux-x64-nvidia-cuda.tar.gz'),
      'kubernetes-asset',
      'utf8',
    );

    finalizer.finalizeReleaseAssets({
      profileId: 'claw-studio',
      releaseTag: 'release-2026-04-03-05',
      repository: 'Sdkwork-Cloud/claw-studio',
      releaseAssetsDir,
    });

    const manifest = JSON.parse(
      readFileSync(path.join(releaseAssetsDir, 'release-manifest.json'), 'utf8'),
    );

    assert.deepEqual(
      manifest.artifacts.map((artifact) => ({
        relativePath: artifact.relativePath,
        family: artifact.family,
        platform: artifact.platform,
        arch: artifact.arch,
        accelerator: artifact.accelerator,
        kind: artifact.kind,
      })),
      [
        {
          relativePath: 'container/linux/arm64/cpu/claw-studio-container-bundle-release-2026-04-03-05-linux-arm64-cpu.tar.gz',
          family: 'container',
          platform: 'linux',
          arch: 'arm64',
          accelerator: 'cpu',
          kind: 'archive',
        },
        {
          relativePath: 'kubernetes/linux/x64/nvidia-cuda/claw-studio-kubernetes-bundle-release-2026-04-03-05-linux-x64-nvidia-cuda.tar.gz',
          family: 'kubernetes',
          platform: 'linux',
          arch: 'x64',
          accelerator: 'nvidia-cuda',
          kind: 'archive',
        },
        {
          relativePath: 'server/linux/x64/claw-studio-server-release-2026-04-03-05-linux-x64.tar.gz',
          family: 'server',
          platform: 'linux',
          arch: 'x64',
          accelerator: undefined,
          kind: 'archive',
        },
      ],
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
