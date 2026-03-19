import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
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

runTest('sdkwork-claw-extensions keeps the V5 extension package surface locally', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-extensions/package.json');
  const indexSource = read('packages/sdkwork-claw-extensions/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-extensions/src/Extensions.tsx'));
  assert.ok(exists('packages/sdkwork-claw-extensions/src/pages/extensions/Extensions.tsx'));
  assert.ok(exists('packages/sdkwork-claw-extensions/src/services/extensionService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-extensions']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-extensions/);
});

runTest('sdkwork-claw-extensions preserves the V5 install flow with modal instance targeting', () => {
  const pageSource = read('packages/sdkwork-claw-extensions/src/pages/extensions/Extensions.tsx');

  assert.match(pageSource, /useTranslation/);
  assert.match(pageSource, /installModalExt/);
  assert.match(pageSource, /selectedInstanceIds/);
  assert.match(pageSource, /t\('extensions\.page\.modal\.title'\)/);
  assert.match(pageSource, /@sdkwork\/claw-core/);
  assert.doesNotMatch(pageSource, /@sdkwork\/claw-instances/);
});

runTest('sdkwork-claw-extensions keeps the V5 service install signature', () => {
  const serviceSource = read('packages/sdkwork-claw-extensions/src/services/extensionService.ts');

  assert.match(serviceSource, /installExtension\(id: string,\s*instanceId\?: string\)/);
});
