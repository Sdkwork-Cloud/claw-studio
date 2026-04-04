import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const releaseConfigPath = path.join(rootDir, 'config', 'openclaw-release.json');
const prepareRuntimeSource = readFileSync(
  path.join(rootDir, 'scripts', 'prepare-openclaw-runtime.mjs'),
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

console.log('ok - openclaw release metadata stays centralized across scripts, frontend, and desktop runtime');
