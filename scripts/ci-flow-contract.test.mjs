import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const rootDir = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('repository exposes a mainline CI workflow for push and pull request verification', () => {
  const workflowPath = path.join(rootDir, '.github', 'workflows', 'ci.yml');
  assert.equal(existsSync(workflowPath), true, 'missing .github/workflows/ci.yml');

  const workflow = read('.github/workflows/ci.yml');

  assert.match(workflow, /push:\s*[\s\S]*branches:\s*[\s\S]*-\s*main/);
  assert.match(workflow, /pull_request:\s*[\s\S]*branches:\s*[\s\S]*-\s*main/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /cancel-in-progress:\s*true/);
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /windows-2022/);
  assert.match(workflow, /pnpm install --frozen-lockfile/);
  assert.match(workflow, /pnpm lint/);
  assert.match(workflow, /pnpm check:desktop/);
  assert.match(workflow, /pnpm build/);
  assert.match(workflow, /pnpm docs:build/);
  assert.match(
    workflow,
    /cargo test --manifest-path packages\/sdkwork-claw-desktop\/src-tauri\/Cargo\.toml/,
  );
});
