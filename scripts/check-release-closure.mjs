#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function main() {
  const scriptPath = path.join(rootDir, 'scripts', 'check-release-closure.mjs');
  const packageJson = JSON.parse(read('package.json'));
  const workflow = read('.github/workflows/release-reusable.yml');
  const kubernetesValues = read('deploy/kubernetes/values.yaml');
  const kubernetesDeployment = read('deploy/kubernetes/templates/deployment.yaml');
  const kubernetesReadme = read('deploy/kubernetes/README.md');
  const releaseDoc = read('docs/core/release-and-deployment.md');
  const packagerSource = read('scripts/release/package-release-assets.mjs');

  assert.equal(existsSync(scriptPath), true, 'missing scripts/check-release-closure.mjs');
  assert.match(
    packageJson.scripts['check:release-flow'],
    /node scripts\/check-release-closure\.mjs/,
    'check:release-flow must execute the release closure guard',
  );

  assert.doesNotMatch(
    kubernetesValues,
    /tag:\s+latest/,
    'kubernetes values.yaml must not ship a mutable latest image tag',
  );
  assert.match(
    kubernetesDeployment,
    /image:\s+"?\{\{[^}]*\.Values\.image\.repository[^}]*\}\}@\{\{[^}]*\.Values\.image\.digest[^}]*\}\}"?/,
    'kubernetes deployment template must support digest-pinned images',
  );
  assert.match(
    kubernetesDeployment,
    /image:\s+"?\{\{[^}]*\.Values\.image\.repository[^}]*\}\}:\{\{[^}]*\.Values\.image\.tag[^}]*\}\}"?/,
    'kubernetes deployment template must support explicit tag fallback',
  );
  assert.match(
    workflow,
    /docker\/build-push-action@/,
    'release workflow must publish OCI images before kubernetes bundles are finalized',
  );
  assert.match(
    workflow,
    /container-image-metadata-\$\{\{ matrix\.arch \}\}/,
    'release workflow must persist published image metadata by architecture',
  );
  assert.match(
    workflow,
    /package-release-assets\.mjs kubernetes[\s\S]*--image-repository \$\{\{ steps\.[^.]+\.outputs\.image_repository \}\}[\s\S]*--image-tag \$\{\{ steps\.[^.]+\.outputs\.image_tag \}\}[\s\S]*--image-digest \$\{\{ steps\.[^.]+\.outputs\.image_digest \}\}/,
    'release workflow must stamp kubernetes bundles with the published image repository, tag, and digest',
  );
  assert.match(
    packagerSource,
    /image:\s*',?\s*`  repository: \$\{normalizedImageRepository\}`[\s\S]*`  tag: \$\{normalizedImageTag\}`/s,
    'kubernetes packager must write image repository and tag into values.release.yaml',
  );
  assert.match(
    packagerSource,
    /imageTag:\s*normalizedImageTag/,
    'kubernetes packager must record image tag metadata in release-metadata.json',
  );
  assert.match(
    kubernetesReadme,
    /image tag/i,
    'kubernetes README must explain the immutable image tag contract',
  );
  assert.match(
    releaseDoc,
    /release tag/i,
    'release and deployment docs must describe the kubernetes image release tag contract',
  );

  console.log('Release closure checks passed.');
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
