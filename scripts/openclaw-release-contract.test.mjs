import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const releaseConfigPath = path.join(
  rootDir,
  'config',
  'kernel-releases',
  'openclaw.json',
);
const legacyReleaseConfigPath = path.join(rootDir, 'config', 'openclaw-release.json');
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
const clawTypesKernelReleaseCatalogSource = readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-claw-types', 'src', 'kernelReleaseCatalog.ts'),
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
const legacyReleaseConfig = JSON.parse(readFileSync(legacyReleaseConfigPath, 'utf8'));
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
  '2026.4.14',
  'openclaw shared release config must pin the current stable OpenClaw version',
);
assert.equal(
  releaseConfig.kernelId,
  'openclaw',
  'openclaw kernel release registry must pin kernelId=openclaw',
);
assert.deepEqual(
  releaseConfig.supportedChannels,
  ['stable'],
  'openclaw kernel release registry must expose the supported release channels',
);
assert.equal(
  releaseConfig.defaultChannel,
  'stable',
  'openclaw kernel release registry must expose the default release channel',
);
assert.equal(
  releaseConfig.packageName,
  'openclaw',
  'openclaw shared release config must pin the packaged OpenClaw npm package name',
);
assert.equal(
  releaseConfig.nodeVersion,
  '22.16.0',
  'openclaw shared release config must pin the external Node.js requirement version',
);
assert.deepEqual(
  releaseConfig.runtimeSupplementalPackages,
  [],
  'openclaw shared release config must pin the prepared supplemental runtime packages',
);
assert.deepEqual(
  releaseConfig.runtimeSupplementalPackageExceptions,
  [],
  'openclaw shared release config must keep prerelease exception metadata empty while no supplemental runtime packages are bundled',
);
assert.deepEqual(
  releaseConfig.runtimeRequirements?.requiredExternalRuntimes,
  ['nodejs'],
  'openclaw kernel release registry must declare Node.js as the only required external runtime',
);
assert.equal(
  releaseConfig.runtimeRequirements?.requiredExternalRuntimeVersions?.nodejs,
  '22.16.0',
  'openclaw kernel release registry must pin the required external Node.js version',
);
assert.deepEqual(
  legacyReleaseConfig,
  {
    stableVersion: releaseConfig.stableVersion,
    nodeVersion: releaseConfig.nodeVersion,
    packageName: releaseConfig.packageName,
    runtimeSupplementalPackages: releaseConfig.runtimeSupplementalPackages,
    runtimeSupplementalPackageExceptions: releaseConfig.runtimeSupplementalPackageExceptions,
  },
  'legacy config/openclaw-release.json must remain a projection of the kernel release registry during migration',
);
assert.deepEqual(
  sourceComponentRegistry.components,
  [],
  'desktop source component registry must remain a generic support-component catalog and must not carry kernel-specific OpenClaw version metadata',
);
assert.match(
  prepareRuntimeSource,
  /from '\.\/openclaw-release\.mjs'/,
  'prepare-openclaw-runtime must read OpenClaw release metadata from the shared release module',
);
assert.match(
  desktopBuildScriptSource,
  /OPENCLAW_RELEASE_CONFIG_RELATIVE_PATH:.*config\/kernel-releases\/openclaw\.json/s,
  'desktop build script must read the kernel release registry during clean-clone cargo builds',
);
assert.match(
  desktopBuildScriptSource,
  /SDKWORK_BUNDLED_OPENCLAW_VERSION/,
  'desktop build script must export the legacy-named built-in OpenClaw version from shared release metadata',
);
assert.match(
  syncBundledSource,
  /from '\.\/openclaw-release\.mjs'/,
  'sync-bundled-components must read OpenClaw release metadata from the shared release module',
);
assert.doesNotMatch(
  syncBundledSource,
  /normalized source component registry openclaw version/,
  'sync-bundled-components must not normalize OpenClaw version metadata inside the generic desktop component registry after the multi-kernel hard cut',
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
  clawTypesIndexSource,
  /export \* from '\.\/kernelReleaseCatalog\.ts';/,
  '@sdkwork/claw-types must export the shared kernel release registry catalog for frontend/runtime consumers',
);
assert.match(
  clawTypesKernelReleaseCatalogSource,
  /kernelId:\s*'openclaw'/,
  '@sdkwork/claw-types kernel release catalog must register OpenClaw metadata from the shared kernel release registry',
);
assert.match(
  clawTypesKernelReleaseCatalogSource,
  /kernelId:\s*'hermes'/,
  '@sdkwork/claw-types kernel release catalog must register Hermes metadata from the shared kernel release registry',
);
assert.match(
  clawTypesOpenClawReleaseSource,
  /runtimeSupplementalPackages:\s*string\[\];/,
  '@sdkwork/claw-types shared OpenClaw release metadata must expose prepared runtime supplemental packages',
);
assert.match(
  clawTypesOpenClawReleaseSource,
  /resolveKernelReleaseConfig\('openclaw'\)/,
  '@sdkwork/claw-types OpenClaw release metadata must resolve through the shared kernel release catalog',
);
assert.match(
  clawTypesOpenClawReleaseSource,
  /runtimeSupplementalPackages:\s*(normalizeRuntimeSupplementalPackages\(\s*metadata\.runtimeSupplementalPackages\s*,?\s*\)|metadata\.runtimeSupplementalPackages|normalizedSupplementalPackages)/,
  '@sdkwork/claw-types must project prepared runtime supplemental packages from the shared release config, with optional normalization',
);
assert.match(
  clawTypesOpenClawReleaseSource,
  /DEFAULT_BUNDLED_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES\s*=\s*OPENCLAW_RELEASE\.runtimeSupplementalPackages/,
  '@sdkwork/claw-types must export the legacy-named prepared runtime supplemental package list for frontend/runtime consumers',
);
assert.match(
  webStudioSource,
  /DEFAULT_BUNDLED_OPENCLAW_VERSION.*@sdkwork\/claw-types|from '@sdkwork\/claw-types'/,
  'webStudio must consume the shared OpenClaw release metadata instead of a private hard-coded version',
);
assert.doesNotMatch(
  webStudioSource,
  /const DEFAULT_BUNDLED_OPENCLAW_VERSION = '2026\.4\.1';/,
  'webStudio must not keep a private hard-coded legacy built-in OpenClaw version after release centralization',
);
assert.match(
  desktopStudioSource,
  /openclaw_release::bundled_openclaw_version|bundled_openclaw_version\(\)/,
  'desktop Rust services must resolve the legacy-named built-in OpenClaw version through the shared release metadata bridge',
);
if (desktopBundledManifest) {
  assert.equal(
    desktopBundledManifest.openclawVersion,
    releaseConfig.stableVersion,
    'desktop packaged runtime manifest must carry the shared stable OpenClaw version when prepared runtime resources exist',
  );
  assert.deepEqual(
    desktopBundledManifest.requiredExternalRuntimes,
    ['nodejs'],
    'desktop packaged runtime manifest must declare external Node.js as a required runtime when prepared runtime resources exist',
  );
  assert.equal(
    desktopBundledManifest.requiredExternalRuntimeVersions?.nodejs,
    releaseConfig.nodeVersion,
    'desktop packaged runtime manifest must carry the shared external Node.js requirement version in requiredExternalRuntimeVersions.nodejs when prepared runtime resources exist',
  );
  assert.equal(
    Object.hasOwn(desktopBundledManifest, 'nodeVersion'),
    false,
    'desktop packaged runtime manifest must not expose a legacy top-level nodeVersion field after the external Node hard cut',
  );
  assert.equal(
    Object.hasOwn(desktopBundledManifest, 'nodeRelativePath'),
    false,
    'desktop packaged runtime manifest must not expose a packaged Node entrypoint after the external Node hard cut',
  );
}
assert.equal(
  existsSync(
    path.join(
      rootDir,
      'packages',
      'sdkwork-claw-desktop',
      'src-tauri',
      'resources',
      'openclaw',
      'runtime',
      'node',
    ),
  ),
  false,
  'desktop source resources must not retain a packaged Node payload after the external Node hard cut',
);
assert.deepEqual(
  readdirSync(rootDir).filter(
    (entry) =>
      /^openclaw-.*\.tgz$/u.test(entry) && entry !== `openclaw-${releaseConfig.stableVersion}.tgz`,
  ),
  [],
  'repository root must not retain stale OpenClaw tarballs after upgrading the packaged runtime baseline',
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
    `${fixturePath} should consume the shared legacy-named built-in OpenClaw version constant instead of hard-coding a fixture version`,
  );
}

console.log('ok - openclaw release metadata stays centralized across scripts, frontend, and desktop runtime');
