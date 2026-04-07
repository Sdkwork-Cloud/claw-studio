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

function writeDesktopManifest({
  releaseAssetsDir,
  platform,
  arch,
  artifacts,
} = {}) {
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
    releaseTag: 'release-2026-04-06-08',
    platform,
    arch,
    artifacts,
  });

  return manifestPath;
}

function buildDesktopStartupEvidence({
  status = 'passed',
  phase = 'shell-mounted',
  ready = true,
  gatewayWebsocketDialable = true,
  builtInInstanceStatus = 'online',
} = {}) {
  return {
    version: 1,
    status,
    phase,
    runId: 2,
    durationMs: 1842,
    recordedAt: '2026-04-06T12:13:14.000Z',
    app: {
      name: 'Claw Studio',
      version: '0.1.0',
      tauriVersion: '2.0.0',
    },
    paths: {
      dataDir: 'C:/Users/test/AppData/Roaming/Claw Studio',
      logsDir: 'C:/Users/test/AppData/Roaming/Claw Studio/logs',
      machineLogsDir: 'C:/Users/test/AppData/Roaming/Claw Studio/logs/machine',
      mainLogFile: 'C:/Users/test/AppData/Roaming/Claw Studio/logs/main.log',
    },
    descriptor: {
      mode: 'desktopCombined',
      lifecycle: 'ready',
      apiBasePath: '/claw/api/v1',
      manageBasePath: '/claw/manage/v1',
      internalBasePath: '/claw/internal/v1',
      browserBaseUrl: 'http://127.0.0.1:19797',
      lastError: null,
      endpointId: 'desktop-managed-endpoint',
      requestedPort: 19797,
      activePort: 19797,
      loopbackOnly: true,
      dynamicPort: false,
      stateStoreDriver: 'sqlite',
      stateStoreProfileId: 'desktop-managed',
      runtimeDataDir: 'C:/runtime',
      webDistDir: 'C:/web',
    },
    hostPlatformStatus: {
      lifecycle: 'ready',
      mode: 'desktopCombined',
      supportedCapabilityKeys: ['manage.openclaw.gateway.invoke'],
      availableCapabilityKeys: ['manage.openclaw.gateway.invoke'],
    },
    hostEndpoints: [
      {
        endpointId: 'desktop-managed-endpoint',
        requestedPort: 19797,
        activePort: 19797,
        baseUrl: 'http://127.0.0.1:19797',
      },
    ],
    openClawRuntime: {
      lifecycle: 'ready',
      endpointId: 'desktop-managed-endpoint',
      activePort: 19797,
      baseUrl: 'http://127.0.0.1:19797',
      websocketUrl: 'ws://127.0.0.1:19797/openclaw/ws',
    },
    openClawGateway: {
      lifecycle: 'ready',
      endpointId: 'desktop-managed-endpoint',
      activePort: 19797,
      baseUrl: 'http://127.0.0.1:19797',
      websocketUrl: 'ws://127.0.0.1:19797/openclaw/ws',
    },
    builtInInstance: {
      id: 'local-built-in',
      name: 'OpenClaw',
      version: '2026.4.2',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-managed',
      transportKind: 'openclawGatewayWs',
      status: builtInInstanceStatus,
      baseUrl: 'http://127.0.0.1:19797',
      websocketUrl: 'ws://127.0.0.1:19797/openclaw/ws',
      isBuiltIn: true,
      isDefault: true,
    },
    readinessEvidence: {
      hostLifecycleReady: true,
      gatewayInvokeCapabilityAvailable: true,
      manageEndpointPublished: true,
      manageEndpointMatchesDescriptor: true,
      openClawRuntimeReady: true,
      openClawGatewayReady: true,
      runtimeAndGatewayBaseUrlMatch: true,
      runtimeAndGatewayWebsocketUrlMatch: true,
      builtInInstanceOnline: builtInInstanceStatus === 'online',
      builtInInstanceReady: builtInInstanceStatus === 'online',
      gatewayWebsocketProbeSupported: true,
      gatewayWebsocketDialable,
      ready,
    },
    error: null,
  };
}

test('desktop startup smoke validates captured startup evidence and writes a structured smoke report', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-startup-evidence.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  assert.equal(typeof smoke.smokeDesktopStartupEvidence, 'function');
  assert.equal(typeof smoke.resolveDesktopStartupSmokeReportPath, 'function');
  assert.equal(typeof smoke.resolveCapturedDesktopStartupEvidencePath, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-smoke-desktop-startup-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const artifactRelativePath = 'desktop/windows/x64/nsis/Claw Studio_0.1.0_x64-setup.exe';

  try {
    writeArtifactFile(releaseAssetsDir, artifactRelativePath);
    const manifestPath = writeDesktopManifest({
      releaseAssetsDir,
      platform: 'windows',
      arch: 'x64',
      artifacts: [
        {
          name: 'Claw Studio_0.1.0_x64-setup.exe',
          relativePath: artifactRelativePath,
          family: 'desktop',
          platform: 'windows',
          arch: 'x64',
          kind: 'installer',
          sha256: 'synthetic',
          size: 17,
        },
      ],
    });
    const evidencePath = smoke.resolveCapturedDesktopStartupEvidencePath({
      releaseAssetsDir,
      platform: 'windows',
      arch: 'x64',
    });
    writeJsonFile(evidencePath, buildDesktopStartupEvidence());

    const result = await smoke.smokeDesktopStartupEvidence({
      releaseAssetsDir,
      platform: 'windows',
      arch: 'x64',
    });

    assert.equal(result.manifestPath.replaceAll('\\', '/'), manifestPath.replaceAll('\\', '/'));
    assert.equal(result.evidencePath.replaceAll('\\', '/'), evidencePath.replaceAll('\\', '/'));
    const smokeReportPath = smoke.resolveDesktopStartupSmokeReportPath({
      releaseAssetsDir,
      platform: 'windows',
      arch: 'x64',
    });
    const smokeReport = JSON.parse(readFileSync(smokeReportPath, 'utf8'));
    assert.equal(smokeReport.platform, 'windows');
    assert.equal(smokeReport.arch, 'x64');
    assert.equal(smokeReport.status, 'passed');
    assert.equal(smokeReport.phase, 'shell-mounted');
    assert.equal(smokeReport.descriptorBrowserBaseUrl, 'http://127.0.0.1:19797');
    assert.equal(smokeReport.builtInInstanceId, 'local-built-in');
    assert.equal(smokeReport.builtInInstanceStatus, 'online');
    assert.equal(
      smokeReport.capturedEvidenceRelativePath,
      'desktop/windows/x64/diagnostics/desktop-startup-evidence.json',
    );
    assert.deepEqual(smokeReport.artifactRelativePaths, [artifactRelativePath]);
    assert.deepEqual(
      smokeReport.checks.map((check) => check.id),
      [
        'startup-status',
        'startup-phase',
        'runtime-readiness',
        'built-in-instance',
        'gateway-websocket',
      ],
    );
    assert.equal(smokeReport.checks.every((check) => check.status === 'passed'), true);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop startup smoke rejects a missing captured startup evidence file', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-startup-evidence.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-smoke-desktop-startup-missing-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const artifactRelativePath = 'desktop/windows/x64/nsis/Claw Studio_0.1.0_x64-setup.exe';

  try {
    writeArtifactFile(releaseAssetsDir, artifactRelativePath);
    writeDesktopManifest({
      releaseAssetsDir,
      platform: 'windows',
      arch: 'x64',
      artifacts: [
        {
          name: 'Claw Studio_0.1.0_x64-setup.exe',
          relativePath: artifactRelativePath,
          family: 'desktop',
          platform: 'windows',
          arch: 'x64',
          kind: 'installer',
          sha256: 'synthetic',
          size: 17,
        },
      ],
    });

    await assert.rejects(
      () => smoke.smokeDesktopStartupEvidence({
        releaseAssetsDir,
        platform: 'windows',
        arch: 'x64',
      }),
      /Missing desktop startup evidence/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop startup smoke rejects captured evidence that did not reach the shell-mounted ready phase', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-startup-evidence.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-smoke-desktop-startup-phase-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const artifactRelativePath = 'desktop/linux/x64/deb/claw-studio_0.1.0_amd64.deb';

  try {
    writeArtifactFile(releaseAssetsDir, artifactRelativePath);
    writeDesktopManifest({
      releaseAssetsDir,
      platform: 'linux',
      arch: 'x64',
      artifacts: [
        {
          name: 'claw-studio_0.1.0_amd64.deb',
          relativePath: artifactRelativePath,
          family: 'desktop',
          platform: 'linux',
          arch: 'x64',
          kind: 'package',
          sha256: 'synthetic',
          size: 18,
        },
      ],
    });
    writeJsonFile(
      smoke.resolveCapturedDesktopStartupEvidencePath({
        releaseAssetsDir,
        platform: 'linux',
        arch: 'x64',
      }),
      buildDesktopStartupEvidence({
        status: 'failed',
        phase: 'runtime-readiness-failed',
        ready: false,
        gatewayWebsocketDialable: false,
        builtInInstanceStatus: 'starting',
      }),
    );

    await assert.rejects(
      () => smoke.smokeDesktopStartupEvidence({
        releaseAssetsDir,
        platform: 'linux',
        arch: 'x64',
      }),
      /shell-mounted|passed|ready/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop startup smoke parses explicit evidence path overrides', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-desktop-startup-evidence.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const parsed = smoke.parseArgs([
    '--platform',
    'windows',
    '--arch',
    'x64',
    '--startup-evidence-path',
    'D:/synthetic/desktop-startup-evidence.json',
  ]);

  assert.equal(parsed.platform, 'windows');
  assert.equal(parsed.arch, 'x64');
  assert.equal(
    parsed.startupEvidencePath.replaceAll('\\', '/'),
    'D:/synthetic/desktop-startup-evidence.json',
  );
});
