import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const releaseConfigPath = path.join(rootDir, 'config', 'openclaw-release.json');
const prepareRuntimeSource = readFileSync(
  path.join(rootDir, 'scripts', 'prepare-openclaw-runtime.mjs'),
  'utf8',
);
const desktopBuildScriptSource = readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src-tauri',
    'build.rs',
  ),
  'utf8',
);
const syncBundledSource = readFileSync(
  path.join(rootDir, 'scripts', 'sync-bundled-components.mjs'),
  'utf8',
);
const webStudioSource = readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-claw-infrastructure', 'src', 'platform', 'webStudio.ts'),
  'utf8',
);
const clawTypesIndexSource = readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-claw-types', 'src', 'index.ts'),
  'utf8',
);
const clawTypesOpenClawReleaseSource = readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-claw-types', 'src', 'openclawRelease.ts'),
  'utf8',
);
const desktopStudioSource = readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src-tauri',
    'src',
    'framework',
    'services',
    'studio.rs',
  ),
  'utf8',
);
const versionFixtureSourcePaths = [
  'packages/sdkwork-claw-instances/src/services/instanceManagementPresentation.test.ts',
  'packages/sdkwork-claw-instances/src/services/agentWorkbenchService.test.ts',
  'packages/sdkwork-claw-instances/src/services/agentSkillManagementService.test.ts',
  'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts',
  'packages/sdkwork-claw-instances/src/services/instanceService.test.ts',
  'packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts',
];
const versionFixtureSources = versionFixtureSourcePaths.map((fixturePath) => ({
  fixturePath,
  source: readFileSync(path.join(rootDir, fixturePath), 'utf8'),
}));

const releaseConfig = JSON.parse(readFileSync(releaseConfigPath, 'utf8'));
const sourceComponentRegistry = JSON.parse(
  readFileSync(
    path.join(
      rootDir,
      'packages',
      'sdkwork-claw-desktop',
      'src-tauri',
      'foundation',
      'components',
      'component-registry.json',
    ),
    'utf8',
  ),
);
const desktopBundledManifestPath = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'resources',
  'openclaw',
  'manifest.json',
);
const desktopBundledManifest = existsSync(desktopBundledManifestPath)
  ? JSON.parse(readFileSync(desktopBundledManifestPath, 'utf8'))
  : null;

assert.equal(
  releaseConfig.stableVersion,
  '2026.4.2',
  'openclaw shared release config must pin the current stable OpenClaw version',
);
assert.equal(
  releaseConfig.packageName,
  'openclaw',
  'openclaw shared release config must pin the bundled npm package name',
);
assert.equal(
  releaseConfig.nodeVersion,
  '22.16.0',
  'openclaw shared release config must pin the bundled Node.js version',
);
assert.deepEqual(
  releaseConfig.runtimeSupplementalPackages,
  ['@buape/carbon@0.0.0-beta-20260327000044'],
  'openclaw shared release config must pin the bundled supplemental runtime packages',
);
assert.equal(
  sourceComponentRegistry.components.find((entry) => entry.id === 'openclaw')?.bundledVersion,
  releaseConfig.stableVersion,
  'desktop source component registry must carry the shared stable OpenClaw version for openclaw instead of a drifting placeholder',
);
assert.match(
  prepareRuntimeSource,
  /from '\.\/openclaw-release\.mjs'/,
  'prepare-openclaw-runtime must read OpenClaw release metadata from the shared release module',
);
assert.match(
  desktopBuildScriptSource,
  /OPENCLAW_RELEASE_CONFIG_RELATIVE_PATH:.*config\/openclaw-release\.json/s,
  'desktop build script must read the shared OpenClaw release config during clean-clone cargo builds',
);
assert.match(
  desktopBuildScriptSource,
  /SDKWORK_BUNDLED_OPENCLAW_VERSION/,
  'desktop build script must export the bundled OpenClaw version from shared release metadata',
);
assert.match(
  syncBundledSource,
  /from '\.\/openclaw-release\.mjs'/,
  'sync-bundled-components must read OpenClaw release metadata from the shared release module',
);
assert.doesNotMatch(
  prepareRuntimeSource,
  /DEFAULT_OPENCLAW_VERSION\s*=\s*process\.env\.OPENCLAW_VERSION\s*\?\?\s*'2026\.4\.1'/,
  'prepare-openclaw-runtime must not keep a private hard-coded fallback version after release centralization',
);
assert.match(
  clawTypesIndexSource,
  /export \* from '\.\/openclawRelease\.ts';/,
  '@sdkwork/claw-types must export the shared OpenClaw release metadata for frontend/runtime consumers',
);
assert.match(
  clawTypesOpenClawReleaseSource,
  /runtimeSupplementalPackages:\s*string\[\];/,
  '@sdkwork/claw-types shared OpenClaw release metadata must expose bundled runtime supplemental packages',
);
assert.match(
  clawTypesOpenClawReleaseSource,
  /runtimeSupplementalPackages:\s*(normalizeRuntimeSupplementalPackages\(\s*metadata\.runtimeSupplementalPackages\s*,?\s*\)|metadata\.runtimeSupplementalPackages)/,
  '@sdkwork/claw-types must project bundled runtime supplemental packages from the shared release config, with optional normalization',
);
assert.match(
  clawTypesOpenClawReleaseSource,
  /DEFAULT_BUNDLED_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES\s*=\s*OPENCLAW_RELEASE\.runtimeSupplementalPackages/,
  '@sdkwork/claw-types must export the bundled runtime supplemental package list for frontend/runtime consumers',
);
assert.match(
  webStudioSource,
  /DEFAULT_BUNDLED_OPENCLAW_VERSION.*@sdkwork\/claw-types|from '@sdkwork\/claw-types'/,
  'webStudio must consume the shared OpenClaw release metadata instead of a private hard-coded version',
);
assert.doesNotMatch(
  webStudioSource,
  /const DEFAULT_BUNDLED_OPENCLAW_VERSION = '2026\.4\.1';/,
  'webStudio must not keep a private hard-coded bundled OpenClaw version after release centralization',
);
assert.match(
  desktopStudioSource,
  /openclaw_release::bundled_openclaw_version|bundled_openclaw_version\(\)/,
  'desktop Rust services must resolve the bundled OpenClaw version through the shared release metadata bridge',
);
if (desktopBundledManifest) {
  assert.equal(
    desktopBundledManifest.openclawVersion,
    releaseConfig.stableVersion,
    'desktop bundled runtime manifest must carry the shared stable OpenClaw version when prepared runtime resources exist',
  );
  assert.equal(
    desktopBundledManifest.nodeVersion,
    releaseConfig.nodeVersion,
    'desktop bundled runtime manifest must carry the shared bundled Node.js version when prepared runtime resources exist',
  );
}
assert.deepEqual(
  readdirSync(rootDir).filter(
    (entry) =>
      /^openclaw-.*\.tgz$/u.test(entry) && entry !== `openclaw-${releaseConfig.stableVersion}.tgz`,
  ),
  [],
  'repository root must not retain stale OpenClaw tarballs after upgrading the bundled runtime baseline',
);

for (const { fixturePath, source } of versionFixtureSources) {
  assert.doesNotMatch(
    source,
    /2026\.3\.13/,
    `${fixturePath} must not keep the retired OpenClaw 2026.3.13 fixture baseline`,
  );
  assert.match(
    source,
    /DEFAULT_BUNDLED_OPENCLAW_VERSION/,
    `${fixturePath} should consume the shared bundled OpenClaw version constant instead of hard-coding a fixture version`,
  );
}

console.log('ok - openclaw release metadata stays centralized across scripts, frontend, and desktop runtime');
