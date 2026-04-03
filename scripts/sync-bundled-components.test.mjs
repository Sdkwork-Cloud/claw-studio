import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');
const syncModulePath = path.join(rootDir, 'scripts', 'sync-bundled-components.mjs');
const syncModuleSource = readFileSync(syncModulePath, 'utf8');
const syncModule = await import(pathToFileURL(syncModulePath).href);
const expectedOpenClawVersion = syncModule.resolvePinnedOpenClawVersion({ env: {} });
assert.equal(
  typeof syncModule.createTauriBundleOverlayConfig,
  'function',
  'sync-bundled-components must export createTauriBundleOverlayConfig',
);
assert.equal(
  typeof syncModule.resolveComponentRepositoryDir,
  'function',
  'sync-bundled-components must export resolveComponentRepositoryDir',
);
assert.equal(
  typeof syncModule.resolvePinnedOpenClawVersion,
  'function',
  'sync-bundled-components must export resolvePinnedOpenClawVersion',
);
assert.equal(
  typeof syncModule.shouldRefreshComponentRepository,
  'function',
  'sync-bundled-components must export shouldRefreshComponentRepository',
);
assert.equal(
  typeof syncModule.removeDirectoryWithRetriesSync,
  'function',
  'sync-bundled-components must export removeDirectoryWithRetriesSync',
);
assert.equal(
  typeof syncModule.inspectOpenClawPackageMetadata,
  'function',
  'sync-bundled-components must export inspectOpenClawPackageMetadata',
);
assert.equal(
  typeof syncModule.prepareBundledOutputRootSync,
  'function',
  'sync-bundled-components must export prepareBundledOutputRootSync',
);
assert.equal(
  typeof syncModule.copyBundledFileSync,
  'function',
  'sync-bundled-components must export copyBundledFileSync',
);
assert.equal(
  typeof syncModule.writeJsonWithWindowsLockFallback,
  'function',
  'sync-bundled-components must export writeJsonWithWindowsLockFallback',
);
assert.equal(
  typeof syncModule.syncSourceFoundationComponentRegistrySync,
  'function',
  'sync-bundled-components must export syncSourceFoundationComponentRegistrySync',
);
assert.match(
  syncModuleSource,
  /if \(process\.argv\[1\] && path\.resolve\(process\.argv\[1\]\) === __filename\) \{\s*try \{\s*main\(\);\s*\} catch \(error\) \{\s*console\.error\(error instanceof Error \? error\.message : String\(error\)\);\s*process\.exit\(1\);\s*\}\s*\}/s,
  'sync-bundled-components must wrap the CLI entrypoint with a top-level error handler',
);
const overlay = syncModule.createTauriBundleOverlayConfig({
  workspaceRootDir: 'D:\\workspace\\claw-studio',
  platform: 'win32',
});

assert.equal(typeof overlay, 'object');
assert.equal(typeof overlay.bundle, 'object');
assert.equal(typeof overlay.bundle.resources, 'object');

const resources = overlay.bundle.resources;

assert.ok(
  syncModuleSource.indexOf("const desktopSrcTauriPathSegments = ['packages', 'sdkwork-claw-desktop', 'src-tauri'];") <
    syncModuleSource.indexOf('const bundledRoot = resolveBundledBuildRoot(rootDir, process.platform);'),
  'desktopSrcTauriPathSegments must be initialized before bundledRoot for non-Windows module loading',
);

for (const [resourceId, expectedSource, expectedTarget] of [
  ['bundled', 'generated/br/b/', 'generated/bundled/'],
  ['openclaw-runtime', 'generated/br/o/', 'resources/openclaw/'],
]) {
  assert.equal(
    resources[expectedSource],
    expectedTarget,
    `missing overlay bridge mapping for ${resourceId}`,
  );
  assert.doesNotMatch(
    expectedSource,
    /^[a-zA-Z]:[\\/]/,
    `overlay bridge source must stay repo-relative for ${resourceId}`,
  );
  assert.equal(
    expectedSource.includes('.sdkwork-bc'),
    false,
    `overlay bridge source must not expose external mirror roots for ${resourceId}`,
  );
}

const vendoredHubInstallerRepoDir = syncModule.resolveComponentRepositoryDir({
  component: {
    checkoutDir: 'hub-installer',
    repositoryDir: 'D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\vendor\\hub-installer',
  },
  upstreamRootDir: 'D:\\workspace\\claw-studio\\.cache\\bundled-components\\upstreams',
});

assert.equal(
  vendoredHubInstallerRepoDir,
  'D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\vendor\\hub-installer',
  'sync-bundled-components must use the vendored hub-installer submodule as the source of truth',
);

const cachedOpenClawRepoDir = syncModule.resolveComponentRepositoryDir({
  component: {
    checkoutDir: 'openclaw',
  },
  upstreamRootDir: 'D:\\workspace\\claw-studio\\.cache\\bundled-components\\upstreams',
});

assert.equal(
  cachedOpenClawRepoDir,
  'D:\\workspace\\claw-studio\\.cache\\bundled-components\\upstreams\\openclaw',
  'sync-bundled-components must continue to use cached upstream checkouts for non-vendored components',
);

assert.equal(
  syncModule.resolvePinnedOpenClawVersion({ env: {} }),
  expectedOpenClawVersion,
  'sync-bundled-components must stay aligned with the bundled OpenClaw runtime version pin',
);

assert.equal(
  syncModule.shouldRefreshComponentRepository({
    componentId: 'openclaw',
    noFetch: true,
    desiredVersion: expectedOpenClawVersion,
    currentVersion: '2026.3.24',
    currentTags: ['v2026.3.24'],
  }),
  true,
  'sync-bundled-components must refresh stale OpenClaw checkouts even when --no-fetch is enabled',
);

assert.equal(
  syncModule.shouldRefreshComponentRepository({
    componentId: 'openclaw',
    noFetch: true,
    desiredVersion: expectedOpenClawVersion,
    currentVersion: expectedOpenClawVersion,
    currentTags: [`v${expectedOpenClawVersion}`],
  }),
  false,
  'sync-bundled-components must reuse OpenClaw checkouts already pinned to the bundled runtime release',
);

assert.equal(
  syncModule.shouldRefreshComponentRepository({
    componentId: 'openclaw',
    noFetch: true,
    desiredVersion: expectedOpenClawVersion,
    currentVersion: expectedOpenClawVersion,
    currentTags: [],
  }),
  false,
  'sync-bundled-components must not require git tag inspection during --no-fetch when the checkout version already matches',
);

assert.match(
  syncModuleSource,
  /refs\/tags\/v\$\{desiredVersion\}/,
  'sync-bundled-components must pin OpenClaw checkouts to the matching release tag',
);

{
  let attempts = 0;
  const sleepCalls = [];

  syncModule.removeDirectoryWithRetriesSync('D:\\tmp\\bundled', {
    retryCount: 3,
    retryDelayMs: 10,
    logger: () => {},
    sleepImpl: (delayMs) => {
      sleepCalls.push(delayMs);
    },
    removeImpl: () => {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error('busy directory');
        error.code = 'ENOTEMPTY';
        throw error;
      }
    },
  });

  assert.equal(
    attempts,
    2,
    'sync-bundled-components must retry bundled directory cleanup after transient ENOTEMPTY failures',
  );
  assert.deepEqual(
    sleepCalls,
    [10],
    'sync-bundled-components must back off before retrying transient bundled cleanup failures',
  );
}

{
  let cleanupCalls = 0;
  const logLines = [];

  syncModule.prepareBundledOutputRootSync('D:\\tmp\\bundled', {
    cleanupImpl: () => {
      cleanupCalls += 1;
      const error = new Error('bundle-manifest.json is locked');
      error.code = 'EPERM';
      throw error;
    },
    logger: (line) => {
      logLines.push(line);
    },
  });

  assert.equal(
    cleanupCalls,
    1,
    'sync-bundled-components must attempt bundled root cleanup before falling back to in-place sync',
  );
  assert.ok(
    logLines.some((line) => line.includes('continuing with in-place bundle sync after cleanup fallback')),
    'sync-bundled-components must log when it falls back to in-place bundle sync after a Windows cleanup lock',
  );
}

{
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-sync-source-registry-'));
  const foundationDir = path.join(tempRoot, 'foundation', 'components');
  mkdirSync(foundationDir, { recursive: true });
  writeFileSync(
    path.join(foundationDir, 'component-registry.json'),
    `${JSON.stringify(
      {
        version: 1,
        components: [
          {
            id: 'openclaw',
            bundledVersion: '2026.3.24',
          },
          {
            id: 'hub-installer',
            bundledVersion: 'bundled',
          },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const normalizedRegistry = syncModule.syncSourceFoundationComponentRegistrySync({
    foundationDir,
    bundledOpenClawVersion: expectedOpenClawVersion,
  });
  const normalizedFile = JSON.parse(
    readFileSync(path.join(foundationDir, 'component-registry.json'), 'utf8'),
  );

  assert.equal(
    normalizedRegistry.components.find((entry) => entry.id === 'openclaw')?.bundledVersion,
    expectedOpenClawVersion,
    'sync-bundled-components must normalize the source component registry to the shared OpenClaw stable version',
  );
  assert.deepEqual(
    normalizedFile,
    normalizedRegistry,
    'sync-bundled-components must write the normalized OpenClaw source registry back to disk to prevent version drift',
  );

  rmSync(tempRoot, { recursive: true, force: true });
}

{
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-sync-openclaw-'));
  const packageRoot = path.join(tempRoot, 'openclaw');
  mkdirSync(path.join(packageRoot, 'dist'), { recursive: true });
  writeFileSync(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify({ name: 'openclaw', version: expectedOpenClawVersion }, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    path.join(packageRoot, 'dist', 'build-info.json'),
    `${JSON.stringify(
      {
        version: '2026.3.24',
        commit: '685f17460d69966be32f5409055c51a82bc0ad7e',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  writeFileSync(
    path.join(packageRoot, 'dist', 'cli-startup-metadata.json'),
    `${JSON.stringify(
      {
        rootHelpText: '\n🦞 OpenClaw 2026.3.24 (685f174)\n',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const inspection = syncModule.inspectOpenClawPackageMetadata({
    packageRoot,
    expectedVersion: expectedOpenClawVersion,
    expectedCommit: '213a704b71f4996dc82a583288ee53785215f627',
  });

  assert.equal(
    inspection.fresh,
    false,
    'sync-bundled-components must detect stale OpenClaw dist metadata before dev staging',
  );
  assert.deepEqual(
    inspection.issues,
    [
      'build-info-version-mismatch',
      'build-info-commit-mismatch',
      'cli-startup-version-mismatch',
      'cli-startup-commit-mismatch',
    ],
    'sync-bundled-components must flag stale build-info and CLI startup metadata drift',
  );

  rmSync(tempRoot, { recursive: true, force: true });
}

{
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-sync-locked-copy-'));
  const sourcePath = path.join(tempRoot, 'source.txt');
  const targetPath = path.join(tempRoot, 'target.txt');
  writeFileSync(sourcePath, 'same-openclaw-payload\n', 'utf8');
  writeFileSync(targetPath, 'same-openclaw-payload\n', 'utf8');

  const logLines = [];
  const result = syncModule.copyBundledFileSync(sourcePath, targetPath, {
    logger: (line) => {
      logLines.push(line);
    },
    copyFileImpl: () => {
      const error = new Error('avatar-placeholder.svg is locked');
      error.code = 'EPERM';
      throw error;
    },
  });

  assert.deepEqual(
    result,
    { reusedLockedTarget: true },
    'sync-bundled-components must reuse an equivalent locked target file instead of aborting the staged bundle sync',
  );
  assert.ok(
    logLines.some((line) => line.includes('reusing existing locked bundled file')),
    'sync-bundled-components must log when it reuses an equivalent locked file during bundle staging',
  );

  rmSync(tempRoot, { recursive: true, force: true });
}

{
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-sync-locked-json-'));
  const targetPath = path.join(tempRoot, 'component-registry.json');
  writeFileSync(
    targetPath,
    `${JSON.stringify({ version: 1, components: [{ id: 'openclaw', bundledVersion: '2026.4.1+213a704b71f4' }] }, null, 2)}\n`,
    'utf8',
  );

  const logLines = [];
  const result = syncModule.writeJsonWithWindowsLockFallback(
    targetPath,
    { version: 1, components: [{ id: 'openclaw', bundledVersion: '2026.4.1+213a704b71f4' }] },
    {
      logger: (line) => {
        logLines.push(line);
      },
      writeFileImpl: () => {
        const error = new Error('component-registry.json is locked');
        error.code = 'EPERM';
        throw error;
      },
      allowEquivalentExistingOnLock: true,
    },
  );

  assert.deepEqual(
    result,
    { reusedLockedTarget: true },
    'sync-bundled-components must tolerate a locked JSON target when it already matches the desired bundled metadata',
  );
  assert.ok(
    logLines.some((line) => line.includes('reusing existing locked bundled json')),
    'sync-bundled-components must log when it reuses equivalent locked bundled metadata',
  );

  assert.throws(
    () =>
      syncModule.writeJsonWithWindowsLockFallback(
        targetPath,
        { version: 1, components: [{ id: 'openclaw', bundledVersion: '2026.4.2+newcommit' }] },
        {
          writeFileImpl: () => {
            const error = new Error('component-registry.json is locked');
            error.code = 'EPERM';
            throw error;
          },
          allowEquivalentExistingOnLock: true,
        },
      ),
    /component-registry\.json is locked/,
    'sync-bundled-components must still fail when a locked bundled metadata file is stale',
  );

  rmSync(tempRoot, { recursive: true, force: true });
}

assert.match(
  syncModuleSource,
  /refreshing openclaw dist for dev staging/,
  'sync-bundled-components must rebuild stale OpenClaw dist before dev staging',
);

console.log('ok - sync-bundled-components emits short Windows Tauri bundle bridge roots');
