import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-claw-core exposes local stores and hooks instead of re-exporting claw-studio-business', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-core/package.json');
  const indexSource = read('packages/sdkwork-claw-core/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-core/src/components/CommandPalette.tsx'));
  assert.ok(exists('packages/sdkwork-claw-core/src/components/Sidebar.tsx'));
  assert.ok(exists('packages/sdkwork-claw-core/src/stores/useAppStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/stores/useInstanceStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/stores/useTaskStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/stores/useUpdateStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/store/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/store/useAppStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/hooks/useKeyboardShortcuts.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/lib/llmService.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/platform/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/platform-impl/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/platform-impl/web.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/services/updateService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-business']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-business/);
  assert.match(indexSource, /\.\/platform/);
  assert.match(indexSource, /\.\/platform-impl/);
  assert.match(indexSource, /\.\/store/);
  assert.match(indexSource, /\.\/components\/CommandPalette/);
  assert.match(indexSource, /\.\/components\/Sidebar/);
  assert.match(indexSource, /\.\/lib\/llmService/);
  assert.match(indexSource, /useAppStore/);
  assert.match(indexSource, /useKeyboardShortcuts/);
});
