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
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-install/package.json',
  );
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

runTest(
  'sdkwork-claw-install turns the install page into install, uninstall, and migrate claw workflows',
  () => {
    const installSource = read('packages/sdkwork-claw-install/src/pages/install/Install.tsx');
    const enLocale = read('packages/sdkwork-claw-i18n/src/locales/en.json');
    const zhLocale = read('packages/sdkwork-claw-i18n/src/locales/zh.json');

    assert.match(installSource, /useTranslation/);
    assert.match(installSource, /getRuntimePlatform/);
    assert.match(installSource, /fileDialogService/);
    assert.match(installSource, /copyPath/);
    assert.match(installSource, /pathExists/);
    assert.match(installSource, /openclaw/);
    assert.match(installSource, /zeroclaw/);
    assert.match(installSource, /ironclaw/);
    assert.match(installSource, /openclaw-wsl/);
    assert.match(installSource, /runHubUninstall/);
    assert.match(installSource, /install\.page\.tabs\.install/);
    assert.match(installSource, /install\.page\.tabs\.uninstall/);
    assert.match(installSource, /install\.page\.tabs\.migrate/);
    assert.match(installSource, /migration/i);
    assert.doesNotMatch(installSource, /MobileAppDownloadSection/);
    assert.doesNotMatch(installSource, /install\.mobileGuide\.section/);
    assert.doesNotMatch(installSource, /executeInstallScript/);
    assert.match(installSource, /runHubInstall/);
    assert.doesNotMatch(installSource, /id:\s*'recommended'/);
    assert.doesNotMatch(installSource, /selectedMethod\.request\.softwareName/);
    assert.doesNotMatch(installSource, /\[stage\]/);
    assert.doesNotMatch(installSource, /\[artifact\]/);
    assert.doesNotMatch(installSource, /event\.commandLine/);
    assert.doesNotMatch(installSource, /profileLabel/);
    assert.match(enLocale, /WSL install/);
    assert.match(enLocale, /Cloud install/);
    assert.match(enLocale, /Uninstall OpenClaw/);
    assert.match(enLocale, /Migrate OpenClaw/);
    assert.match(
      enLocale,
      /Import settings, workspace data, and related files into Claw Studio/,
    );
    assert.match(zhLocale, /\u8fc1\u79fb OpenClaw/);
    assert.match(zhLocale, /WSL \u5b89\u88c5/);
    assert.match(zhLocale, /\u4e91\u7aef\u5b89\u88c5/);
    assert.match(zhLocale, /\u5378\u8f7d OpenClaw/);
    assert.doesNotMatch(enLocale, /hub-installer|Hub installer|registry|Hub profile/);
    assert.doesNotMatch(zhLocale, /hub-installer|registry|Hub 閰嶇疆/);
  },
);

runTest('sdkwork-claw-install routes installation through the shared hub-installer contract', () => {
  const featureServiceSource = read('packages/sdkwork-claw-install/src/services/installerService.ts');
  const infraContractSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/contracts/installer.ts',
  );
  const infraServiceSource = read(
    'packages/sdkwork-claw-infrastructure/src/services/installerService.ts',
  );
  const bridgeSource = read('packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts');

  assert.match(featureServiceSource, /@sdkwork\/claw-infrastructure/);
  assert.doesNotMatch(featureServiceSource, /@tauri-apps\/api\/core/);

  assert.match(infraContractSource, /HubInstallRequest/);
  assert.match(infraContractSource, /HubInstallResult/);
  assert.match(infraContractSource, /HubInstallProgressEvent/);
  assert.match(infraContractSource, /HubUninstallRequest/);
  assert.match(infraContractSource, /HubUninstallResult/);
  assert.match(infraContractSource, /runHubInstall/);
  assert.match(infraContractSource, /runHubUninstall/);
  assert.match(infraContractSource, /subscribeHubInstallProgress/);
  assert.doesNotMatch(infraContractSource, /InstallScriptRequest/);
  assert.doesNotMatch(infraContractSource, /executeInstallScript/);

  assert.match(infraServiceSource, /runHubInstall/);
  assert.match(infraServiceSource, /runHubUninstall/);
  assert.match(infraServiceSource, /subscribeHubInstallProgress/);
  assert.doesNotMatch(infraServiceSource, /executeInstallScript/);

  assert.match(bridgeSource, /runHubInstall/);
  assert.match(bridgeSource, /runHubUninstall/);
  assert.match(bridgeSource, /subscribeHubInstallProgress/);
  assert.doesNotMatch(bridgeSource, /executeInstallScript/);
});

runTest('sdkwork-claw-install vendors hub-installer registry assets for the desktop runtime', () => {
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/rust/Cargo.toml'));
  assert.ok(
    exists('packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/software-registry.yaml'),
  );
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/src/commands/run_hub_install.rs'));
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/src/commands/run_hub_uninstall.rs'));
  assert.match(
    read('packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/software-registry.yaml'),
    /name: "openclaw-wsl"/,
  );
  assert.match(
    read('packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-pnpm.hub.yaml'),
    /uninstall:/,
  );
  assert.match(
    read('packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-npm.hub.yaml'),
    /uninstall:/,
  );
  assert.match(
    read('packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-source.hub.yaml'),
    /uninstall:/,
  );
});
