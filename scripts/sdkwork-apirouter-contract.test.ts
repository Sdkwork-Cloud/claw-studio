import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const legacyRouterRuntimeId = ['sdkwork', 'api', 'router'].join('-');
const legacyRouterRuntimePattern = new RegExp(legacyRouterRuntimeId, 'i');
const legacyRouterPrepareRuntimeScript = `scripts/prepare-${legacyRouterRuntimeId}-runtime.mjs`;
const legacyRouterPrepareRuntimeTestScript =
  `scripts/prepare-${legacyRouterRuntimeId}-runtime.test.mjs`;
const legacyRouterPrepareArtifactsScript =
  `scripts/prepare-${legacyRouterRuntimeId}-artifacts.mjs`;
const legacyRouterResourceDir =
  `packages/sdkwork-claw-desktop/src-tauri/resources/${legacyRouterRuntimeId}-runtime`;
const legacyRouterArtifactsDir =
  `packages/sdkwork-claw-desktop/src-tauri/vendor/${legacyRouterRuntimeId}-artifacts`;

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
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

runTest('sdkwork-claw-apirouter keeps the real feature package while removing the old router runtime/admin bridge', () => {
  assert.equal(exists('packages/sdkwork-claw-apirouter/package.json'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/index.ts'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/ApiRouter.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/pages/ApiRouter.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/pages/ApiRouterUsageRecordsPage.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/services/apiRouterService.ts'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/services/modelMappingService.ts'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/services/modelMappingFormService.ts'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyService.ts'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/services/providerAccessApplyService.ts'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.ts'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/services/providerAccessSetupService.ts'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyAccessService.ts'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/ModelMappingManager.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/ProxyProviderManager.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyManager.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/ApiRouterAccessMethodShared.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/services/apiRouterAdminService.ts'), false);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/services/apiRouterRuntimeService.ts'), false);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/ApiRouterAdminStatusCard.tsx'), false);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/ApiRouterRuntimeStatusCard.tsx'), false);
});

runTest('sdkwork-claw-apirouter page stays focused on the management workspace without runtime/admin status panels', () => {
  const pageSource = read('packages/sdkwork-claw-apirouter/src/pages/ApiRouter.tsx');
  const routeConfigSource = read(
    'packages/sdkwork-claw-apirouter/src/components/ApiRouterRouteConfigView.tsx',
  );
  const managerSource = read('packages/sdkwork-claw-apirouter/src/components/ProxyProviderManager.tsx');
  const unifiedManagerSource = read(
    'packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyManager.tsx',
  );
  const accessSharedSource = read(
    'packages/sdkwork-claw-apirouter/src/components/ApiRouterAccessMethodShared.tsx',
  );

  assert.match(pageSource, /data-slot="api-router-page"/);
  assert.match(pageSource, /data-slot="api-router-page-tabs"/);
  assert.match(pageSource, /<UnifiedApiKeyManager/);
  assert.match(pageSource, /<ModelMappingManager/);
  assert.match(pageSource, /<ApiRouterUsageRecordsPage/);
  assert.match(pageSource, /resolveApiRouterPageViewState\(\{/);
  assert.match(routeConfigSource, /data-slot="api-router-route-config-view"/);
  assert.match(managerSource, /data-slot="api-router-key-manager"/);
  assert.match(unifiedManagerSource, /data-slot="api-router-unified-key-manager"/);
  assert.match(accessSharedSource, /export function ApiRouterUsageTabs/);
  assert.match(accessSharedSource, /export function ApiRouterAccessClientCard/);
  assert.match(accessSharedSource, /export function ApiRouterInstanceSelectorPanel/);
  assert.doesNotMatch(pageSource, /ApiRouterAdminStatusCard/);
  assert.doesNotMatch(pageSource, /ApiRouterRuntimeStatusCard/);
  assert.doesNotMatch(pageSource, /apiRouterAdminService/);
  assert.doesNotMatch(pageSource, /apiRouterRuntimeService/);
});

runTest('sdkwork-claw-apirouter quick setup routes through the new provider client setup contract', () => {
  const providerAccessApplySource = read(
    'packages/sdkwork-claw-apirouter/src/services/providerAccessApplyService.ts',
  );
  const providerAccessSetupSource = read(
    'packages/sdkwork-claw-apirouter/src/services/providerAccessSetupService.ts',
  );
  const unifiedAccessSource = read(
    'packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyAccessService.ts',
  );
  const proxyDialogsSource = read(
    'packages/sdkwork-claw-apirouter/src/components/ProxyProviderDialogs.tsx',
  );
  const unifiedDialogsSource = read(
    'packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyDialogs.tsx',
  );

  assert.match(providerAccessApplySource, /applyProviderClientSetup/);
  assert.match(providerAccessApplySource, /ProviderClientSetupOpenClawInstance/);
  assert.match(providerAccessApplySource, /ProviderClientSetupOpenClawApiKeyStrategy/);
  assert.match(providerAccessApplySource, /routeProviderId/);
  assert.doesNotMatch(providerAccessApplySource, /installApiRouterClientSetup/);
  assert.doesNotMatch(providerAccessApplySource, /ApiRouterInstalledOpenClawInstance/);
  assert.doesNotMatch(providerAccessApplySource, /ApiRouterInstallerCompatibility/);
  assert.doesNotMatch(providerAccessApplySource, /ApiRouterInstallerOpenClawApiKeyStrategy/);
  assert.match(providerAccessSetupSource, /ProviderClientSetupOpenClawInstance/);
  assert.match(unifiedAccessSource, /APP_ENV/);
  assert.doesNotMatch(unifiedAccessSource, /resolveApiRouterGatewayBaseUrl/);
  assert.match(proxyDialogsSource, /applyClientSetup/);
  assert.match(proxyDialogsSource, /applyOpenClawSetup/);
  assert.match(unifiedDialogsSource, /applyClientSetup/);
  assert.match(unifiedDialogsSource, /applyOpenClawSetup/);
});

runTest('shell routes /api-router directly to the independent provider config center without a workspace wrapper', () => {
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');

  assert.match(routesSource, /module\.ProviderConfigCenter/);
  assert.match(routesSource, /path="\/api-router"/);
  assert.match(routesSource, /<ProviderConfigCenter \/>/);
  assert.doesNotMatch(routesSource, /apiRouterComingSoon/);
  assert.doesNotMatch(routesSource, /ApiRouterWorkspace/);
  assert.equal(
    exists('packages/sdkwork-claw-shell/src/application/router/ApiRouterWorkspace.tsx'),
    false,
  );
});

runTest('claw studio keeps the legacy router runtime fully removed from active desktop env, assets, and copy', () => {
  const rootEnvSource = read('.env.example');
  const webEnvSource = read('packages/sdkwork-claw-web/.env.example');
  const desktopEnvSource = read('packages/sdkwork-claw-desktop/.env.example');
  const i18nEnSource = read('packages/sdkwork-claw-i18n/src/locales/en.json');
  const i18nZhSource = read('packages/sdkwork-claw-i18n/src/locales/zh.json');

  assert.doesNotMatch(rootEnvSource, legacyRouterRuntimePattern);
  assert.doesNotMatch(webEnvSource, legacyRouterRuntimePattern);
  assert.doesNotMatch(desktopEnvSource, legacyRouterRuntimePattern);
  assert.doesNotMatch(i18nEnSource, legacyRouterRuntimePattern);
  assert.doesNotMatch(i18nZhSource, legacyRouterRuntimePattern);
  assert.equal(exists(legacyRouterPrepareRuntimeScript), false);
  assert.equal(exists(legacyRouterPrepareRuntimeTestScript), false);
  assert.equal(exists(legacyRouterPrepareArtifactsScript), false);
  assert.equal(exists(legacyRouterResourceDir), false);
  assert.equal(exists(legacyRouterArtifactsDir), false);
});
