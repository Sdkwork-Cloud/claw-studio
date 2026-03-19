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

runTest('sdkwork-claw-install keeps the install feature package local to the workspace', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-install/package.json');
  const indexSource = read('packages/sdkwork-claw-install/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-install/src/Install.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/InstallDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/components/MobileAppDownloadDialog.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/components/MobileAppDownloadSection.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/pages/install/Install.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/pages/install/InstallDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/services/installerService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-install']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-install/);
  assert.match(indexSource, /MobileAppDownloadDialog/);
});

runTest('sdkwork-claw-install turns the install page into a product-tabbed claw installer surface', () => {
  const installSource = read('packages/sdkwork-claw-install/src/pages/install/Install.tsx');

  assert.match(installSource, /useTranslation/);
  assert.match(installSource, /openclaw/);
  assert.match(installSource, /zeroclaw/);
  assert.match(installSource, /ironclaw/);
  assert.doesNotMatch(installSource, /MobileAppDownloadSection/);
  assert.doesNotMatch(installSource, /install\.mobileGuide\.section/);
  assert.doesNotMatch(installSource, /executeInstallScript/);
  assert.match(installSource, /runHubInstall/);
});

runTest('sdkwork-claw-install routes installation through the shared hub-installer contract', () => {
  const featureServiceSource = read('packages/sdkwork-claw-install/src/services/installerService.ts');
  const infraContractSource = read('packages/sdkwork-claw-infrastructure/src/platform/contracts/installer.ts');
  const infraServiceSource = read('packages/sdkwork-claw-infrastructure/src/services/installerService.ts');
  const bridgeSource = read('packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts');

  assert.match(featureServiceSource, /@sdkwork\/claw-infrastructure/);
  assert.doesNotMatch(featureServiceSource, /@tauri-apps\/api\/core/);

  assert.match(infraContractSource, /HubInstallRequest/);
  assert.match(infraContractSource, /HubInstallResult/);
  assert.match(infraContractSource, /HubInstallProgressEvent/);
  assert.match(infraContractSource, /runHubInstall/);
  assert.match(infraContractSource, /subscribeHubInstallProgress/);
  assert.doesNotMatch(infraContractSource, /InstallScriptRequest/);
  assert.doesNotMatch(infraContractSource, /executeInstallScript/);

  assert.match(infraServiceSource, /runHubInstall/);
  assert.match(infraServiceSource, /subscribeHubInstallProgress/);
  assert.doesNotMatch(infraServiceSource, /executeInstallScript/);

  assert.match(bridgeSource, /runHubInstall/);
  assert.match(bridgeSource, /subscribeHubInstallProgress/);
  assert.doesNotMatch(bridgeSource, /executeInstallScript/);
});

runTest('sdkwork-claw-install vendors hub-installer registry assets for the desktop runtime', () => {
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/rust/Cargo.toml'));
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/software-registry.yaml'));
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/src/commands/run_hub_install.rs'));
});
