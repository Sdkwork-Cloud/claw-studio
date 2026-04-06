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
  assert.ok(exists('packages/sdkwork-claw-install/src/pages/install/Install.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/pages/install/InstallDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/components/GuidedInstallWizard.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/services/installBootstrapService.ts'));
  assert.ok(exists('packages/sdkwork-claw-install/src/services/installGuidedWizardService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-install']);
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-apirouter']);
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-channels']);
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-market']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-install/);
  assert.match(indexSource, /GuidedInstallWizard|MobileAppDownloadDialog/);
});

runTest('sdkwork-claw-install renders a simplified product-first page and launches install through a modal wizard', () => {
  const installSource = read('packages/sdkwork-claw-install/src/pages/install/Install.tsx');
  const pageModelSource = read(
    'packages/sdkwork-claw-install/src/pages/install/installPageModel.ts',
  );
  const wizardSource = read(
    'packages/sdkwork-claw-install/src/components/GuidedInstallWizard.tsx',
  );
  const enLocale = read('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocale = read('packages/sdkwork-claw-i18n/src/locales/zh.json');

  assert.match(installSource, /productSidebar/);
  assert.match(installSource, /workspaceModeTabs/);
  assert.match(installSource, /currentInstallChoices/);
  assert.match(installSource, /currentUninstallChoices/);
  assert.match(installSource, /currentMigrationCandidates/);
  assert.match(installSource, /GuidedInstallWizard/);
  assert.match(installSource, /install\.page\.method\.actions\.install/);
  assert.match(installSource, /inspectHubInstall/);
  assert.doesNotMatch(installSource, /runHubInstall/);
  assert.doesNotMatch(installSource, /runHubDependencyInstall/);
  assert.doesNotMatch(installSource, /guidedInstallOverview/);
  assert.doesNotMatch(installSource, /guidedInstallPrepare/);
  assert.doesNotMatch(installSource, /guidedInstallComplete/);

  assert.match(pageModelSource, /openclaw/);
  assert.doesNotMatch(pageModelSource, /zeroclaw/);
  assert.doesNotMatch(pageModelSource, /ironclaw/);
  assert.match(pageModelSource, /GUIDED_INSTALL_STEPS/);
  assert.match(pageModelSource, /dependencies/);
  assert.match(pageModelSource, /configure/);
  assert.match(pageModelSource, /initialize/);
  assert.match(pageModelSource, /success/);
  assert.match(pageModelSource, /getInstallGridClassName/);

  assert.match(wizardSource, /guided-install-modal/);
  assert.match(wizardSource, /installGuidedWizardService/);
  assert.match(wizardSource, /installBootstrapService/);
  assert.match(wizardSource, /runHubDependencyInstall/);
  assert.match(wizardSource, /runHubInstall/);
  assert.match(wizardSource, /subscribeHubInstallProgress/);
  assert.match(wizardSource, /useNavigate/);
  assert.match(wizardSource, /useInstanceStore/);

  assert.match(enLocale, /Choose a product/);
  assert.match(enLocale, /Install {{product}} with {{method}}/);
  assert.match(enLocale, /Dependencies/);
  assert.match(enLocale, /Configure/);
  assert.match(enLocale, /Initialize/);
  assert.match(enLocale, /Success/);
  assert.match(enLocale, /Install now/);
  assert.match(zhLocale, /选择产品/);
  assert.match(zhLocale, /通过 {{method}} 安装 {{product}}/);
  assert.match(zhLocale, /安装依赖/);
  assert.match(zhLocale, /进行配置/);
  assert.match(zhLocale, /初始化/);
  assert.match(zhLocale, /安装成功/);
  assert.match(zhLocale, /立即安装/);
  assert.doesNotMatch(zhLocale, /绔嬪嵆瀹夎/);
  assert.doesNotMatch(zhLocale, /閫夋嫨瀹夎鏂瑰紡/);
  assert.doesNotMatch(zhLocale, /鍑嗗瀹夎鐜/);
  assert.doesNotMatch(zhLocale, /瀹屾垚瀹夎/);
});

runTest('sdkwork-claw-install keeps guided install configuration and initialization behind install-local aggregation services', () => {
  const bootstrapSource = read(
    'packages/sdkwork-claw-install/src/services/installBootstrapService.ts',
  );
  const wizardSource = read('packages/sdkwork-claw-install/src/components/GuidedInstallWizard.tsx');
  const wizardServiceSource = read(
    'packages/sdkwork-claw-install/src/services/installGuidedWizardService.ts',
  );
  const serviceIndexSource = read('packages/sdkwork-claw-install/src/services/index.ts');

  assert.doesNotMatch(bootstrapSource, /studioMockService/);
  assert.match(bootstrapSource, /openClawBootstrapService/);
  assert.match(bootstrapSource, /openClawConfigService/);
  assert.match(bootstrapSource, /providerRoutingApi/);
  assert.match(bootstrapSource, /saveProviderRoutingRecord/);
  assert.match(bootstrapSource, /readConfigSnapshot/);
  assert.match(bootstrapSource, /inferLocalAiProxyUpstreamProtocol/);
  assert.match(bootstrapSource, /createDefaultProviderRuntimeConfig/);
  assert.match(bootstrapSource, /providerChannels:/);
  assert.match(bootstrapSource, /channelSnapshots|communicationChannels/);
  assert.match(bootstrapSource, /loadBootstrapData/);
  assert.match(bootstrapSource, /applyConfiguration/);
  assert.match(bootstrapSource, /initializeOpenClawInstance/);
  assert.match(bootstrapSource, /createInstallBootstrapService/);
  assert.doesNotMatch(bootstrapSource, /import\('\.\/openClawBootstrapService\.ts'\)/);
  assert.doesNotMatch(bootstrapSource, /saveProviderSelection/);
  assert.doesNotMatch(bootstrapSource, /@sdkwork\/claw-apirouter/);
  assert.doesNotMatch(bootstrapSource, /@sdkwork\/claw-channels/);
  assert.doesNotMatch(bootstrapSource, /@sdkwork\/claw-market/);
  assert.doesNotMatch(bootstrapSource, /apiRouterChannels/);
  assert.doesNotMatch(bootstrapSource, /provider-api-router-/);
  assert.doesNotMatch(bootstrapSource, /provider:\s*'api-router'/);
  assert.doesNotMatch(bootstrapSource, /capabilities:\s*\[[^\]]*'API Router'/);
  assert.doesNotMatch(wizardSource, /apiRouterChannels/);
  assert.match(wizardSource, /providerChannels/);

  assert.match(wizardServiceSource, /GUIDED_WIZARD_STEPS/);
  assert.match(wizardServiceSource, /dependencies/);
  assert.match(wizardServiceSource, /install/);
  assert.match(wizardServiceSource, /configure/);
  assert.match(wizardServiceSource, /initialize/);
  assert.match(wizardServiceSource, /success/);

  assert.match(serviceIndexSource, /installBootstrapService/);
  assert.match(serviceIndexSource, /installGuidedWizardService/);
});

runTest('sdkwork-claw-install gives OpenClaw a dedicated file-backed guided wizard instead of reusing the generic inline configuration flow', () => {
  const installSource = read('packages/sdkwork-claw-install/src/pages/install/Install.tsx');
  const openClawWizardSource = read(
    'packages/sdkwork-claw-install/src/components/OpenClawGuidedInstallWizard.tsx',
  );
  const bootstrapSource = read(
    'packages/sdkwork-claw-install/src/services/openClawBootstrapService.ts',
  );

  assert.match(installSource, /OpenClawGuidedInstallWizard/);
  assert.match(installSource, /shouldShowProductSidebar/);
  assert.match(installSource, /navigate\(`\/install\/\$\{choice\.id\}`\)/);
  assert.match(openClawWizardSource, /ChannelCatalog/);
  assert.match(openClawWizardSource, /Dialog(Content|Header|Footer|Title|Description)?/);
  assert.match(openClawWizardSource, /configurationStatus === 'skipped'|setConfigurationStatus\('skipped'\)/);
  assert.match(openClawWizardSource, /configPath/);
  assert.doesNotMatch(openClawWizardSource, /selectedInstanceId/);
  assert.doesNotMatch(openClawWizardSource, /common\.back/);
  assert.doesNotMatch(openClawWizardSource, /install\.page\.modal\.actions\.close/);

  assert.match(bootstrapSource, /openClawConfigService/);
  assert.match(bootstrapSource, /providerRoutingCatalogService/);
  assert.match(bootstrapSource, /kernelPlatformService/);
  assert.match(bootstrapSource, /createOpenClawLocalProxyProjection/);
  assert.match(bootstrapSource, /OPENCLAW_LOCAL_PROXY_DEFAULT_API_KEY/);
  assert.match(bootstrapSource, /saveManagedLocalProxyProjection/);
  assert.match(bootstrapSource, /saveManagedChannelConfiguration/);
  assert.match(bootstrapSource, /resolveSyncedOpenClawAuthToken/);
  assert.match(bootstrapSource, /studio\.(createInstance|updateInstance)/);
  assert.match(bootstrapSource, /configPath/);
  assert.match(bootstrapSource, /const websocketUrl = `ws:\/\/\$\{host\}:\$\{port\}`;/);
  assert.doesNotMatch(bootstrapSource, /ws:\/\/\$\{host\}:\$\{port\}\/ws/);
  assert.doesNotMatch(bootstrapSource, /authToken:\s*null/);
  assert.doesNotMatch(bootstrapSource, /upsertInstanceLlmProvider/);
  assert.doesNotMatch(bootstrapSource, /\bsaveChannelConfig\b/);
  assert.doesNotMatch(bootstrapSource, /saveProviderSelection/);
  assert.doesNotMatch(bootstrapSource, /PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE/);
  assert.doesNotMatch(bootstrapSource, /storage\.getStorageInfo/);
});

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
  const tauriCommandSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/commands/run_hub_install.rs',
  );
  const webInstallerSource = read('packages/sdkwork-claw-infrastructure/src/platform/webInstaller.ts');

  assert.match(featureServiceSource, /@sdkwork\/claw-infrastructure/);
  assert.doesNotMatch(featureServiceSource, /@tauri-apps\/api\/core/);

  assert.match(infraContractSource, /HubInstallRequest/);
  assert.match(infraContractSource, /HubInstallResult/);
  assert.match(infraContractSource, /HubInstallAssessmentResult/);
  assert.match(infraContractSource, /HubInstallAssessmentDependency/);
  assert.match(infraContractSource, /HubInstallDependencyRequest/);
  assert.match(infraContractSource, /HubInstallDependencyResult/);
  assert.match(infraContractSource, /HubInstallProgressEvent/);
  assert.match(infraContractSource, /HubUninstallRequest/);
  assert.match(infraContractSource, /HubUninstallResult/);
  assert.match(infraContractSource, /runHubInstall/);
  assert.match(infraContractSource, /inspectHubInstall/);
  assert.match(infraContractSource, /runHubDependencyInstall/);
  assert.match(infraContractSource, /runHubUninstall/);
  assert.match(infraContractSource, /subscribeHubInstallProgress/);
  assert.doesNotMatch(infraContractSource, /executeInstallScript/);

  assert.match(infraServiceSource, /runHubInstall/);
  assert.match(infraServiceSource, /inspectHubInstall/);
  assert.match(infraServiceSource, /runHubDependencyInstall/);
  assert.match(infraServiceSource, /runHubUninstall/);
  assert.match(infraServiceSource, /subscribeHubInstallProgress/);
  assert.doesNotMatch(infraServiceSource, /executeInstallScript/);

  assert.match(catalogSource, /inspectHubInstall:\s*'inspect_hub_install'/);
  assert.match(catalogSource, /runHubDependencyInstall:\s*'run_hub_dependency_install'/);
  assert.match(bridgeSource, /runHubInstall/);
  assert.match(bridgeSource, /inspectHubInstall/);
  assert.match(bridgeSource, /runHubDependencyInstall/);
  assert.match(bridgeSource, /runHubUninstall/);
  assert.match(bridgeSource, /subscribeHubInstallProgress/);
  assert.match(tauriCommandSource, /HubInstallAssessmentInstallation/);
  assert.match(webInstallerSource, /inspectHubInstall/);
  assert.doesNotMatch(bridgeSource, /executeInstallScript/);
});

runTest('sdkwork-claw-install keeps hub-installer as an updateable git submodule for the desktop runtime', () => {
  const gitModules = read('.gitmodules');
  const submoduleGitPointer = read(
    'packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/.git',
  );
  const registrySource = read(
    'packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/software-registry.yaml',
  );
  const bundledSyncSource = read('scripts/sync-bundled-components.mjs');

  assert.ok(exists('.gitmodules'));
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer'));
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/.git'));
  assert.ok(exists('.git/modules/packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer'));
  assert.match(gitModules, /\[submodule "packages\/sdkwork-claw-desktop\/src-tauri\/vendor\/hub-installer"\]/);
  assert.match(gitModules, /path = packages\/sdkwork-claw-desktop\/src-tauri\/vendor\/hub-installer/);
  assert.match(gitModules, /url = https:\/\/github\.com\/Sdkwork-Cloud\/hub-installer/);
  assert.match(gitModules, /branch = main/);
  assert.match(
    submoduleGitPointer,
    /gitdir:\s+\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.git\/modules\/packages\/sdkwork-claw-desktop\/src-tauri\/vendor\/hub-installer/,
  );
  assert.match(
    bundledSyncSource,
    /repositoryDir:\s*path\.join\(\s*rootDir,\s*'packages',\s*'sdkwork-claw-desktop',\s*'src-tauri',\s*'vendor',\s*'hub-installer',/s,
  );
  assert.match(registrySource, /name: "openclaw-wsl"/);
  assert.match(
    read('packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-pnpm.hub.yaml'),
    /migration:/,
  );
  assert.match(
    read('packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-source.hub.yaml'),
    /pnpm link --global/,
  );
  assert.match(
    read('packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw.hub.yaml'),
    /documentationUrl: "https:\/\/docs\.openclaw\.ai\/install\/installer"/,
  );
});

runTest('sdkwork-claw-install keeps uninstall and migration flows simple and truthful for OpenClaw', () => {
  const installSource = read('packages/sdkwork-claw-install/src/pages/install/Install.tsx');
  const pageModelSource = read(
    'packages/sdkwork-claw-install/src/pages/install/installPageModel.ts',
  );
  const openclawSourceManifest = read(
    'packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw-source.hub.yaml',
  );
  const openclawInstallerManifest = read(
    'packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/openclaw.hub.yaml',
  );
  const enLocale = read('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocale = read('packages/sdkwork-claw-i18n/src/locales/zh.json');

  assert.match(installSource, /kind: 'uninstall'/);
  assert.match(installSource, /selectedMigrationIds/);
  assert.match(pageModelSource, /migrationDefinitions/);
  assert.match(pageModelSource, /uninstallMethods/);
  assert.match(openclawSourceManifest, /openclaw-source-unlink/);
  assert.match(openclawInstallerManifest, /uninstallByDefault: "preserve"/);
  assert.doesNotMatch(pageModelSource, /zeroclaw/);
  assert.doesNotMatch(pageModelSource, /ironclaw/);

  assert.match(enLocale, /Uninstall {{product}}/);
  assert.match(enLocale, /Migrate {{product}}/);
  assert.match(zhLocale, /卸载 {{product}}/);
  assert.match(zhLocale, /迁移 {{product}}/);
});
