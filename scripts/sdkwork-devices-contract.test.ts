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

runTest('sdkwork-claw-devices is implemented locally with the service-first device service surface', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-devices/package.json');
  const indexSource = read('packages/sdkwork-claw-devices/src/index.ts');
  const serviceSource = read('packages/sdkwork-claw-devices/src/services/deviceService.ts');

  assert.ok(exists('packages/sdkwork-claw-devices/src/Devices.tsx'));
  assert.ok(exists('packages/sdkwork-claw-devices/src/services/deviceService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-devices']);
  assert.equal(pkg.dependencies?.['@sdkwork/claw-types'], 'workspace:*');
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-devices/);

  assert.match(serviceSource, /import\s+\{\s*studioMockService\s*\}\s+from\s+'@sdkwork\/claw-infrastructure'/);
  assert.match(serviceSource, /studioMockService\.listDevices\(\)/);
  assert.match(serviceSource, /studioMockService\.createDevice\(name\)/);
  assert.match(serviceSource, /studioMockService\.deleteDevice\(id\)/);
  assert.match(serviceSource, /studioMockService\.listDeviceInstalledSkills\(deviceId\)/);
  assert.match(serviceSource, /studioMockService\.uninstallSkill\(deviceId, skillId\)/);
  assert.doesNotMatch(serviceSource, /fetch\('/);
  assert.doesNotMatch(serviceSource, /const devicesData/);
  assert.doesNotMatch(serviceSource, /skillsByDevice/);
});
