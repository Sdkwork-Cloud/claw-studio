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
    assert.doesNotMatch(zhLocale, /hub-installer|registry|Hub 闁板秶鐤?/);
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
  const catalogSource = read('packages/sdkwork-claw-desktop/src/desktop/catalog.ts');
  const webInstallerSource = read('packages/sdkwork-claw-infrastructure/src/platform/webInstaller.ts');

  assert.match(featureServiceSource, /@sdkwork\/claw-infrastructure/);
  assert.doesNotMatch(featureServiceSource, /@tauri-apps\/api\/core/);

  assert.match(infraContractSource, /HubInstallRequest/);
  assert.match(infraContractSource, /HubInstallResult/);
  assert.match(infraContractSource, /HubInstallAssessmentResult/);
  assert.match(infraContractSource, /HubInstallAssessmentDependency/);
  assert.match(infraContractSource, /HubInstallProgressEvent/);
  assert.match(infraContractSource, /HubUninstallRequest/);
  assert.match(infraContractSource, /HubUninstallResult/);
  assert.match(infraContractSource, /runHubInstall/);
  assert.match(infraContractSource, /inspectHubInstall/);
  assert.match(infraContractSource, /runHubUninstall/);
  assert.match(infraContractSource, /subscribeHubInstallProgress/);
  assert.doesNotMatch(infraContractSource, /InstallScriptRequest/);
  assert.doesNotMatch(infraContractSource, /executeInstallScript/);

  assert.match(infraServiceSource, /runHubInstall/);
  assert.match(infraServiceSource, /inspectHubInstall/);
  assert.match(infraServiceSource, /runHubUninstall/);
  assert.match(infraServiceSource, /subscribeHubInstallProgress/);
  assert.doesNotMatch(infraServiceSource, /executeInstallScript/);

  assert.match(catalogSource, /inspectHubInstall:\s*'inspect_hub_install'/);
  assert.match(bridgeSource, /runHubInstall/);
  assert.match(bridgeSource, /inspectHubInstall/);
  assert.match(bridgeSource, /runHubUninstall/);
  assert.match(bridgeSource, /subscribeHubInstallProgress/);
  assert.match(webInstallerSource, /inspectHubInstall/);
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

runTest(
  'sdkwork-claw-install exposes install environment assessment and dependency guidance before execution',
  () => {
    const installSource = read('packages/sdkwork-claw-install/src/pages/install/Install.tsx');
    const zhLocale = read('packages/sdkwork-claw-i18n/src/locales/zh.json');
    const openclawDockerManifest = read(
      'packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-docker.hub.yaml',
    );
    const openclawNpmManifest = read(
      'packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-npm.hub.yaml',
    );
    const openclawPnpmManifest = read(
      'packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-pnpm.hub.yaml',
    );
    const openclawSourceManifest = read(
      'packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-source.hub.yaml',
    );
    const openclawWslManifest = read(
      'packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-wsl.hub.yaml',
    );

    assert.match(installSource, /inspectHubInstall/);
    assert.match(installSource, /assessment/);
    assert.match(installSource, /dependency/);
    assert.match(installSource, /recommendation/);
    assert.match(installSource, /resolvedInstallRoot/);
    assert.match(installSource, /resolvedDataRoot/);
    assert.match(installSource, /commandAvailability/);
    assert.match(installSource, /availableWslDistributions/);
    assert.match(installSource, /remediationCommands/);
    assert.match(zhLocale, /\u73af\u5883\u68c0\u67e5/);
    assert.match(zhLocale, /\u5b89\u88c5\u524d\u8bf7\u5148\u68c0\u67e5\u524d\u7f6e\u6761\u4ef6/);
    assert.match(zhLocale, /\u963b\u585e\u9879/);
    assert.match(zhLocale, /\u81ea\u52a8\u4fee\u590d/);

    assert.match(openclawDockerManifest, /dependencies:/);
    assert.match(openclawNpmManifest, /dependencies:/);
    assert.match(openclawPnpmManifest, /dependencies:/);
    assert.match(openclawSourceManifest, /dependencies:/);
    assert.match(openclawWslManifest, /dependencies:/);
  },
);

runTest(
  'sdkwork-claw-install uses a product-first lifecycle shell for install management',
  () => {
    const installSource = read('packages/sdkwork-claw-install/src/pages/install/Install.tsx');
    const enLocale = read('packages/sdkwork-claw-i18n/src/locales/en.json');
    const zhLocale = read('packages/sdkwork-claw-i18n/src/locales/zh.json');

    assert.match(installSource, /productSidebar/);
    assert.match(installSource, /workspaceHeader/);
    assert.match(installSource, /workspaceModeTabs/);
    assert.match(installSource, /currentInstallChoices/);
    assert.match(installSource, /currentUninstallChoices/);
    assert.match(installSource, /currentMigrationCandidates/);
    assert.match(installSource, /product-option/);
    assert.match(installSource, /active-product/);
    assert.match(installSource, /recommended-action/);
    assert.match(installSource, /product\.uninstallMethods/);
    assert.match(installSource, /product\.migrationDefinitions/);
    assert.doesNotMatch(installSource, /modeHeader/);
    assert.doesNotMatch(installSource, /modeSummaryBadges/);
    assert.doesNotMatch(installSource, /UNINSTALL_CHOICES/);
    assert.doesNotMatch(installSource, /openclaw\.json/);

    assert.match(enLocale, /Choose a product/);
    assert.match(enLocale, /Current product/);
    assert.match(enLocale, /Lifecycle mode/);
    assert.match(enLocale, /Available for this product/);
    assert.match(enLocale, /Review the current {{product}} runtime before removing it/);
    assert.match(
      enLocale,
      /Import settings, workspace data, and related files from {{product}} into Claw Studio/,
    );

    assert.match(zhLocale, /\u9009\u62e9\u4ea7\u54c1/);
    assert.match(zhLocale, /\u5f53\u524d\u4ea7\u54c1/);
    assert.match(zhLocale, /\u751f\u547d\u5468\u671f\u6a21\u5f0f/);
    assert.match(zhLocale, /\u5f53\u524d\u4ea7\u54c1\u53ef\u7528/);
    assert.match(
      zhLocale,
      /\u5148\u786e\u8ba4\u5f53\u524d {{product}} \u8fd0\u884c\u73af\u5883\uff0c\u518d\u6267\u884c\u79fb\u9664/,
    );
    assert.match(
      zhLocale,
      /\u5c06 {{product}} \u7684\u8bbe\u7f6e\u3001\u5de5\u4f5c\u533a\u6570\u636e\u548c\u76f8\u5173\u6587\u4ef6\u5bfc\u5165\u5230 Claw Studio/,
    );
  },
);
