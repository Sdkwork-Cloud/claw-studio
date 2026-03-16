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

runTest('sdkwork-claw-install keeps the V5 install package surface locally', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-install/package.json');
  const indexSource = read('packages/sdkwork-claw-install/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-install/src/Install.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/InstallDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/pages/install/Install.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/pages/install/InstallDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/services/installerService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-install']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-install/);
});

runTest('sdkwork-claw-install preserves the V5 installation methods and system requirements surface', () => {
  const installSource = read('packages/sdkwork-claw-install/src/pages/install/Install.tsx');

  assert.match(installSource, /Quick Install Script/);
  assert.match(installSource, /Docker Gateway/);
  assert.match(installSource, /NPM \/ PNPM/);
  assert.match(installSource, /Cloud Deploy/);
  assert.match(installSource, /From Source/);
  assert.match(installSource, /System Requirements/);
  assert.match(installSource, /installerService\.executeInstallScript/);
});

runTest('sdkwork-claw-install keeps install execution behind infrastructure abstraction', () => {
  const serviceSource = read('packages/sdkwork-claw-install/src/services/installerService.ts');
  const infraSource = read('packages/sdkwork-claw-infrastructure/src/services/installerService.ts');

  assert.match(serviceSource, /@sdkwork\/claw-infrastructure/);
  assert.doesNotMatch(serviceSource, /@tauri-apps\/api\/core/);
  assert.match(infraSource, /getInstallerPlatform/);
  assert.match(infraSource, /executeInstallScript/);
});
