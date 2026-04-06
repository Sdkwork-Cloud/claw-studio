import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

test('server bundle smoke validates packaged server bundles and writes runtime-backed evidence', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-server-release-assets.mjs');
  assert.equal(existsSync(smokePath), true, 'missing scripts/release/smoke-server-release-assets.mjs');

  const smoke = await import(pathToFileURL(smokePath).href);
  assert.equal(typeof smoke.parseArgs, 'function');
  assert.equal(typeof smoke.smokeServerReleaseAssets, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-server-smoke-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const serverDir = path.join(releaseAssetsDir, 'server', 'linux', 'x64');
  const archiveRelativePath = 'server/linux/x64/claw-studio-server-release-2026-04-06-01-linux-x64.tar.gz';
  const archivePath = path.join(releaseAssetsDir, archiveRelativePath);
  const manifestPath = path.join(serverDir, 'release-asset-manifest.json');
  const extractedBundleRoot = path.join(tempRoot, 'extracted', 'claw-studio-server-release-2026-04-06-01-linux-x64');
  let stopped = false;

  try {
    mkdirSync(serverDir, { recursive: true });
    writeFileSync(archivePath, 'synthetic server archive', 'utf8');
    writeFileSync(
      manifestPath,
      `${JSON.stringify({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-04-06-01',
        platform: 'linux',
        arch: 'x64',
        artifacts: [
          {
            name: 'claw-studio-server-release-2026-04-06-01-linux-x64.tar.gz',
            relativePath: archiveRelativePath,
            family: 'server',
            platform: 'linux',
            arch: 'x64',
            kind: 'archive',
            sha256: 'placeholder',
            size: 24,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );

    const result = await smoke.smokeServerReleaseAssets({
      releaseAssetsDir,
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      extractServerArchiveFn: async ({ archivePath: inputArchivePath, extractDir }) => {
        assert.equal(inputArchivePath.replaceAll('\\', '/'), archivePath.replaceAll('\\', '/'));
        assert.match(extractDir.replaceAll('\\', '/'), /claw-server-smoke-/);
        mkdirSync(path.join(extractedBundleRoot, 'bin'), { recursive: true });
        writeFileSync(path.join(extractedBundleRoot, 'start-claw-server.sh'), '#!/usr/bin/env sh\n', 'utf8');
        writeFileSync(path.join(extractedBundleRoot, 'bin', 'sdkwork-claw-server'), 'binary\n', 'utf8');
        return extractedBundleRoot;
      },
      launchServerBundleFn: async ({ bundleRoot, platform, port }) => {
        assert.equal(bundleRoot.replaceAll('\\', '/'), extractedBundleRoot.replaceAll('\\', '/'));
        assert.equal(platform, 'linux');
        assert.equal(typeof port, 'number');
        return {
          baseUrl: `http://127.0.0.1:${port}`,
          launcherRelativePath: 'start-claw-server.sh',
          async stop() {
            stopped = true;
          },
        };
      },
      probeEndpointFn: async (request) => {
        if (request.path === '/claw/health/ready') {
          return {
            statusCode: 200,
            body: '{"status":"ready"}',
          };
        }
        if (request.path === '/') {
          return {
            statusCode: 200,
            body: '<html><body>Claw Studio</body></html>',
          };
        }

        return {
          statusCode: 404,
          body: 'not-found',
        };
      },
      fetchJsonFn: async (request) => {
        assert.equal(request.path, '/claw/manage/v1/host-endpoints');
        return {
          statusCode: 200,
          json: [
            {
              id: 'manage-http',
              kind: 'manage',
              baseUrl: 'http://127.0.0.1:19797',
            },
          ],
        };
      },
      resolveAvailablePortFn: async () => 19797,
    });

    assert.equal(stopped, true);
    assert.equal(result.platform, 'linux');
    assert.equal(result.arch, 'x64');
    assert.equal(result.target, 'x86_64-unknown-linux-gnu');
    assert.equal(result.report.report.status, 'passed');
    assert.equal(result.report.report.smokeKind, 'bundle-runtime');
    assert.equal(result.report.report.runtimeBaseUrl, 'http://127.0.0.1:19797');
    assert.equal(result.report.report.launcherRelativePath, 'start-claw-server.sh');
    assert.deepEqual(result.report.report.artifactRelativePaths, [archiveRelativePath]);
    assert.deepEqual(
      result.report.report.checks.map((check) => check.id),
      ['health-ready', 'host-endpoints', 'browser-shell'],
    );
    assert.equal(existsSync(result.report.reportPath), true);
    assert.equal(
      JSON.parse(readFileSync(result.report.reportPath, 'utf8')).status,
      'passed',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
