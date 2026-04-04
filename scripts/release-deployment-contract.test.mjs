import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const rootDir = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('docker deployment templates keep compose commands and overlay profiles aligned with the packaged bundle layout', () => {
  const dockerReadme = read('deploy/docker/README.md');
  const dockerCompose = read('deploy/docker/docker-compose.yml');
  const nvidiaCompose = read('deploy/docker/docker-compose.nvidia-cuda.yml');
  const amdCompose = read('deploy/docker/docker-compose.amd-rocm.yml');
  const defaultEnv = read('deploy/docker/profiles/default.env');
  const nvidiaEnv = read('deploy/docker/profiles/nvidia-cuda.env');
  const amdEnv = read('deploy/docker/profiles/amd-rocm.env');
  const releaseDoc = read('docs/core/release-and-deployment.md');

  assert.match(dockerReadme, /docker compose -f deploy\/docker-compose\.yml up -d/);
  assert.match(dockerReadme, /docker compose -f deploy\/docker-compose\.yml -f deploy\/docker-compose\.nvidia-cuda\.yml up -d/);
  assert.match(dockerReadme, /docker compose -f deploy\/docker-compose\.yml -f deploy\/docker-compose\.amd-rocm\.yml up -d/);
  assert.match(dockerCompose, /context:\s+\.\./);
  assert.match(dockerCompose, /dockerfile:\s+deploy\/Dockerfile/);
  assert.match(dockerCompose, /profiles\/default\.env/);
  assert.match(dockerCompose, /18797:18797/);
  assert.match(dockerCompose, /\/var\/lib\/claw-server/);
  assert.match(
    dockerCompose,
    /CLAW_SERVER_MANAGE_USERNAME:\s+\$\{CLAW_SERVER_MANAGE_USERNAME:\?/,
    'docker compose must require an explicit manage username for public deployments',
  );
  assert.match(
    dockerCompose,
    /CLAW_SERVER_MANAGE_PASSWORD:\s+\$\{CLAW_SERVER_MANAGE_PASSWORD:\?/,
    'docker compose must require an explicit manage password for public deployments',
  );
  assert.match(nvidiaCompose, /profiles\/nvidia-cuda\.env/);
  assert.match(amdCompose, /profiles\/amd-rocm\.env/);
  assert.match(defaultEnv, /CLAW_ACCELERATOR_PROFILE=cpu/);
  assert.match(defaultEnv, /CLAW_SERVER_DATA_DIR=\/var\/lib\/claw-server/);
  assert.match(defaultEnv, /CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=false/);
  assert.match(nvidiaEnv, /CLAW_ACCELERATOR_PROFILE=nvidia-cuda/);
  assert.match(amdEnv, /CLAW_ACCELERATOR_PROFILE=amd-rocm/);
  assert.match(releaseDoc, /docker compose -f deploy\/docker-compose\.yml up -d/);
  assert.match(
    dockerReadme,
    /CLAW_SERVER_MANAGE_USERNAME/i,
    'docker deployment docs must explain the required control-plane credentials',
  );
});

test('kubernetes deployment templates keep accelerator overlays and chart wiring aligned', () => {
  const kubernetesReadme = read('deploy/kubernetes/README.md');
  const chart = read('deploy/kubernetes/Chart.yaml');
  const values = read('deploy/kubernetes/values.yaml');
  const cpuValues = read('deploy/kubernetes/values-cpu.yaml');
  const nvidiaValues = read('deploy/kubernetes/values-nvidia-cuda.yaml');
  const amdValues = read('deploy/kubernetes/values-amd-rocm.yaml');
  const configmap = read('deploy/kubernetes/templates/configmap.yaml');
  const deployment = read('deploy/kubernetes/templates/deployment.yaml');
  const secret = read('deploy/kubernetes/templates/secret.yaml');
  const pvc = read('deploy/kubernetes/templates/persistentvolumeclaim.yaml');
  const releaseDoc = read('docs/core/release-and-deployment.md');

  assert.match(
    kubernetesReadme,
    /helm upgrade --install claw-studio \.\/chart[\s\S]*-f values\.release\.yaml/,
  );
  assert.match(kubernetesReadme, /values-nvidia-cuda\.yaml/);
  assert.match(kubernetesReadme, /values-amd-rocm\.yaml/);
  assert.match(
    kubernetesReadme,
    /image tag/i,
    'kubernetes deployment docs must explain the versioned image tag contract',
  );
  assert.match(chart, /name:\s+claw-studio/);
  assert.match(values, /targetArchitecture:\s+x64/);
  assert.match(values, /repository:\s+claw-studio-server/);
  assert.match(values, /auth:\s*[\s\S]*existingSecret:/);
  assert.match(values, /persistence:\s*[\s\S]*enabled:\s+true/);
  assert.match(values, /persistence:\s*[\s\S]*mountPath:\s+\/var\/lib\/claw-server/);
  assert.doesNotMatch(
    values,
    /tag:\s+latest/,
    'kubernetes chart defaults must not rely on the mutable latest image tag',
  );
  assert.match(cpuValues, /acceleratorProfile:\s+cpu/);
  assert.match(nvidiaValues, /acceleratorProfile:\s+nvidia-cuda/);
  assert.match(amdValues, /acceleratorProfile:\s+amd-rocm/);
  assert.match(configmap, /CLAW_ACCELERATOR_PROFILE/);
  assert.match(configmap, /CLAW_SERVER_DATA_DIR/);
  assert.match(deployment, /secretRef:/);
  assert.match(deployment, /volumeMounts:/);
  assert.match(deployment, /mountPath:\s+\{\{\s*\.Values\.persistence\.mountPath\s*\}\}/);
  assert.match(deployment, /persistentVolumeClaim:/);
  assert.match(secret, /kind:\s+Secret/);
  assert.match(secret, /CLAW_SERVER_MANAGE_USERNAME/);
  assert.match(secret, /CLAW_SERVER_MANAGE_PASSWORD/);
  assert.match(secret, /CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND/);
  assert.match(pvc, /kind:\s+PersistentVolumeClaim/);
  assert.match(deployment, /kubernetes\.io\/arch:\s+arm64/);
  assert.match(deployment, /kubernetes\.io\/arch:\s+amd64/);
  assert.match(
    deployment,
    /image:\s+\{\{[^}]*\.Values\.image\.repository[^}]*\}\}@\{\{[^}]*\.Values\.image\.digest[^}]*\}\}/,
    'kubernetes deployment template must support digest-pinned images',
  );
  assert.match(
    deployment,
    /image:\s+\{\{[^}]*\.Values\.image\.repository[^}]*\}\}:\{\{[^}]*\.Values\.image\.tag[^}]*\}\}/,
    'kubernetes deployment template must retain explicit tag-based fallback',
  );
  assert.match(releaseDoc, /helm upgrade --install claw-studio \.\/chart -f values\.release\.yaml/);
  assert.match(
    releaseDoc,
    /release tag/i,
    'release docs must describe the immutable image tag contract for kubernetes bundles',
  );
  assert.match(
    kubernetesReadme,
    /Secret/i,
    'kubernetes deployment docs must explain the required control-plane secret',
  );
});
