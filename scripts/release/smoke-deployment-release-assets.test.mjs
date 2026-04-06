import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

function writeReleaseManifest({
  releaseAssetsDir,
  family,
  platform = 'linux',
  arch = 'x64',
  accelerator = 'cpu',
  releaseTag,
  archiveRelativePath,
} = {}) {
  const familyDir = path.join(releaseAssetsDir, family, platform, arch, accelerator);
  mkdirSync(familyDir, { recursive: true });
  writeFileSync(
    path.join(releaseAssetsDir, archiveRelativePath),
    `${family}-bundle`,
    'utf8',
  );
  writeFileSync(
    path.join(familyDir, 'release-asset-manifest.json'),
    `${JSON.stringify({
      profileId: 'claw-studio',
      releaseTag,
      platform,
      arch,
      artifacts: [
        {
          name: path.basename(archiveRelativePath),
          relativePath: archiveRelativePath,
          family,
          platform,
          arch,
          accelerator,
          kind: 'archive',
          sha256: 'placeholder',
          size: 16,
        },
      ],
    }, null, 2)}\n`,
    'utf8',
  );

  return familyDir;
}

test('container deployment smoke validates packaged bundles and writes runtime-backed evidence', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-deployment-release-assets.mjs');
  assert.equal(existsSync(smokePath), true, 'missing scripts/release/smoke-deployment-release-assets.mjs');

  const smoke = await import(pathToFileURL(smokePath).href);
  assert.equal(typeof smoke.parseArgs, 'function');
  assert.equal(typeof smoke.smokeDeploymentReleaseAssets, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-deployment-smoke-container-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const archiveRelativePath = 'container/linux/x64/cpu/claw-studio-container-bundle-release-2026-04-06-02-linux-x64-cpu.tar.gz';
  const extractedBundleRoot = path.join(tempRoot, 'extracted', 'claw-studio-container');

  try {
    writeReleaseManifest({
      releaseAssetsDir,
      family: 'container',
      releaseTag: 'release-2026-04-06-02',
      archiveRelativePath,
    });

    const result = await smoke.smokeDeploymentReleaseAssets({
      family: 'container',
      releaseAssetsDir,
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      accelerator: 'cpu',
      detectDeploymentSmokeCapabilitiesFn() {
        return {
          docker: true,
          dockerCompose: true,
        };
      },
      extractDeploymentBundleFn: async ({ archivePath, extractDir }) => {
        assert.equal(archivePath.replaceAll('\\', '/'), path.join(releaseAssetsDir, archiveRelativePath).replaceAll('\\', '/'));
        assert.match(extractDir.replaceAll('\\', '/'), /claw-deployment-smoke-container-/);
        mkdirSync(path.join(extractedBundleRoot, 'deploy'), { recursive: true });
        writeFileSync(path.join(extractedBundleRoot, 'deploy', 'docker-compose.yml'), 'services: {}\n', 'utf8');
        return extractedBundleRoot;
      },
      smokeContainerDeploymentBundleFn: async ({ bundleRoot, accelerator, capabilities }) => {
        assert.equal(bundleRoot.replaceAll('\\', '/'), extractedBundleRoot.replaceAll('\\', '/'));
        assert.equal(accelerator, 'cpu');
        assert.deepEqual(capabilities, {
          docker: true,
          dockerCompose: true,
        });
        return {
          launcherRelativePath: 'deploy/docker-compose.yml',
          runtimeBaseUrl: 'http://127.0.0.1:18797',
          checks: [
            {
              id: 'docker-compose-up',
              status: 'passed',
              detail: 'docker compose brought the packaged bundle online',
            },
            {
              id: 'health-ready',
              status: 'passed',
              detail: '/claw/health/ready returned 200',
            },
            {
              id: 'host-endpoints',
              status: 'passed',
              detail: '/claw/manage/v1/host-endpoints returned canonical endpoints',
            },
            {
              id: 'browser-shell',
              status: 'passed',
              detail: '/ returned bundled browser shell HTML',
            },
          ],
        };
      },
    });

    assert.equal(result.family, 'container');
    assert.equal(result.report.report.status, 'passed');
    assert.equal(result.report.report.smokeKind, 'live-deployment');
    assert.equal(result.report.report.launcherRelativePath, 'deploy/docker-compose.yml');
    assert.equal(result.report.report.runtimeBaseUrl, 'http://127.0.0.1:18797');
    assert.deepEqual(result.report.report.artifactRelativePaths, [archiveRelativePath]);
    assert.deepEqual(
      result.report.report.checks.map((check) => check.id),
      ['docker-compose-up', 'health-ready', 'host-endpoints', 'browser-shell'],
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('kubernetes deployment smoke validates packaged charts and writes render-backed evidence', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-deployment-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-deployment-smoke-kubernetes-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const archiveRelativePath = 'kubernetes/linux/x64/cpu/claw-studio-kubernetes-bundle-release-2026-04-06-03-linux-x64-cpu.tar.gz';
  const extractedBundleRoot = path.join(tempRoot, 'extracted', 'claw-studio-kubernetes');

  try {
    writeReleaseManifest({
      releaseAssetsDir,
      family: 'kubernetes',
      releaseTag: 'release-2026-04-06-03',
      archiveRelativePath,
    });

    const result = await smoke.smokeDeploymentReleaseAssets({
      family: 'kubernetes',
      releaseAssetsDir,
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      accelerator: 'cpu',
      detectDeploymentSmokeCapabilitiesFn() {
        return {
          helm: true,
          kubectl: true,
        };
      },
      extractDeploymentBundleFn: async ({ archivePath, extractDir }) => {
        assert.equal(archivePath.replaceAll('\\', '/'), path.join(releaseAssetsDir, archiveRelativePath).replaceAll('\\', '/'));
        assert.match(extractDir.replaceAll('\\', '/'), /claw-deployment-smoke-kubernetes-/);
        mkdirSync(path.join(extractedBundleRoot, 'chart', 'templates'), { recursive: true });
        writeFileSync(path.join(extractedBundleRoot, 'chart', 'Chart.yaml'), 'apiVersion: v2\nname: claw-studio\n', 'utf8');
        writeFileSync(path.join(extractedBundleRoot, 'values.release.yaml'), 'targetArchitecture: x64\n', 'utf8');
        return extractedBundleRoot;
      },
      smokeKubernetesDeploymentBundleFn: async ({ bundleRoot, accelerator, capabilities }) => {
        assert.equal(bundleRoot.replaceAll('\\', '/'), extractedBundleRoot.replaceAll('\\', '/'));
        assert.equal(accelerator, 'cpu');
        assert.deepEqual(capabilities, {
          helm: true,
          kubectl: true,
        });
        return {
          launcherRelativePath: 'chart/Chart.yaml',
          checks: [
            {
              id: 'helm-template',
              status: 'passed',
              detail: 'helm template rendered the packaged chart successfully',
            },
            {
              id: 'image-reference',
              status: 'passed',
              detail: 'rendered manifests reference the packaged OCI image coordinates',
            },
            {
              id: 'readiness-probe',
              status: 'passed',
              detail: 'rendered deployment probes /claw/health/ready',
            },
            {
              id: 'kubectl-client-dry-run',
              status: 'passed',
              detail: 'kubectl client-side dry-run accepted the rendered manifests',
            },
          ],
        };
      },
    });

    assert.equal(result.family, 'kubernetes');
    assert.equal(result.report.report.status, 'passed');
    assert.equal(result.report.report.smokeKind, 'chart-render');
    assert.equal(result.report.report.launcherRelativePath, 'chart/Chart.yaml');
    assert.deepEqual(result.report.report.artifactRelativePaths, [archiveRelativePath]);
    assert.deepEqual(
      result.report.report.checks.map((check) => check.id),
      ['helm-template', 'image-reference', 'readiness-probe', 'kubectl-client-dry-run'],
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('deployment smoke records structured skipped evidence when required capabilities are unavailable', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-deployment-release-assets.mjs');
  const smoke = await import(pathToFileURL(smokePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-deployment-smoke-skipped-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const archiveRelativePath = 'container/linux/x64/cpu/claw-studio-container-bundle-release-2026-04-06-04-linux-x64-cpu.tar.gz';

  try {
    writeReleaseManifest({
      releaseAssetsDir,
      family: 'container',
      releaseTag: 'release-2026-04-06-04',
      archiveRelativePath,
    });

    const result = await smoke.smokeDeploymentReleaseAssets({
      family: 'container',
      releaseAssetsDir,
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      accelerator: 'cpu',
      detectDeploymentSmokeCapabilitiesFn() {
        return {
          docker: false,
          dockerCompose: false,
        };
      },
    });

    assert.equal(result.report.report.status, 'skipped');
    assert.match(result.report.report.skippedReason, /docker/i);
    assert.deepEqual(result.report.report.capabilities, {
      docker: false,
      dockerCompose: false,
    });
    assert.equal(
      JSON.parse(readFileSync(result.report.reportPath, 'utf8')).status,
      'skipped',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
