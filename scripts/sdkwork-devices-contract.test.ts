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

runTest('sdkwork-claw-devices is implemented locally with the V5 device API service surface', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-devices/package.json');
  const indexSource = read('packages/sdkwork-claw-devices/src/index.ts');
  const serviceSource = read('packages/sdkwork-claw-devices/src/services/deviceService.ts');

  assert.ok(exists('packages/sdkwork-claw-devices/src/Devices.tsx'));
  assert.ok(exists('packages/sdkwork-claw-devices/src/services/deviceService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-devices']);
  assert.equal(pkg.dependencies?.['@sdkwork/claw-types'], 'workspace:*');
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-devices/);

  assert.match(serviceSource, /fetch\('\/api\/devices'\)/);
  assert.match(
    serviceSource,
    /fetch\('\/api\/devices',\s*\{\s*method:\s*'POST'/,
  );
  assert.match(serviceSource, /fetch\(`\/api\/devices\/\$\{id\}`,\s*\{\s*method:\s*'DELETE'/);
  assert.match(serviceSource, /fetch\(`\/api\/devices\/\$\{deviceId\}\/skills`\)/);
  assert.match(
    serviceSource,
    /fetch\('\/api\/installations',\s*\{\s*method:\s*'DELETE'/,
  );
  assert.doesNotMatch(serviceSource, /const devicesData/);
  assert.doesNotMatch(serviceSource, /skillsByDevice/);
});
