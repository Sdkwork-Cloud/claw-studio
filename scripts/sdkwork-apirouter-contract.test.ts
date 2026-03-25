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

function extractSingleQuotedStrings(value: string) {
  return [...value.matchAll(/'([^']+)'/g)].map((match) => match[1]);
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

runTest('sdkwork-claw-apirouter is implemented as a real feature package', () => {
  assert.equal(exists('packages/sdkwork-claw-apirouter/package.json'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/index.ts'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/ApiRouter.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/pages/ApiRouter.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/pages/ApiRouterUsageRecordsPage.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/services/apiRouterService.ts'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/services/apiRouterRuntimeService.ts'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/services/modelMappingService.ts'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/services/modelMappingFormService.ts'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/services/unifiedApiKeyService.ts'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/services/providerAccessConfigService.ts'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/ModelMappingManager.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/ModelMappingTable.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/ModelMappingDialogs.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/ApiRouterUsageSummaryCards.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/ApiRouterUsageFilters.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/ApiRouterUsageTable.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/ApiRouterUsagePagination.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/ApiRouterRuntimeStatusCard.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/ProxyProviderManager.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/ApiRouterRouteConfigView.tsx'), true);
  assert.equal(
    exists('packages/sdkwork-claw-apirouter/src/components/ApiRouterAccessMethodShared.tsx'),
    true,
  );
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyManager.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyTable.tsx'), true);
  assert.equal(exists('packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyDialogs.tsx'), true);
});

runTest('sdkwork-claw-apirouter page keeps the management workspace without the top runtime and admin status panels', () => {
  const pageSource = read('packages/sdkwork-claw-apirouter/src/pages/ApiRouter.tsx');
  const usageRecordsPageSource = read(
    'packages/sdkwork-claw-apirouter/src/pages/ApiRouterUsageRecordsPage.tsx',
  );
  const routeConfigSource = read(
    'packages/sdkwork-claw-apirouter/src/components/ApiRouterRouteConfigView.tsx',
  );
  const accessSharedSource = read(
    'packages/sdkwork-claw-apirouter/src/components/ApiRouterAccessMethodShared.tsx',
  );
  const modelMappingManagerSource = read(
    'packages/sdkwork-claw-apirouter/src/components/ModelMappingManager.tsx',
  );
  const usageSummaryCardsSource = read(
    'packages/sdkwork-claw-apirouter/src/components/ApiRouterUsageSummaryCards.tsx',
  );
  const usageFiltersSource = read(
    'packages/sdkwork-claw-apirouter/src/components/ApiRouterUsageFilters.tsx',
  );
  const usageTableSource = read('packages/sdkwork-claw-apirouter/src/components/ApiRouterUsageTable.tsx');
  const usagePaginationSource = read(
    'packages/sdkwork-claw-apirouter/src/components/ApiRouterUsagePagination.tsx',
  );
  const adminStatusServiceSource = read(
    'packages/sdkwork-claw-apirouter/src/services/apiRouterAdminService.ts',
  );
  const enLocaleSource = read('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocaleSource = read('packages/sdkwork-claw-i18n/src/locales/zh.json');
  const modelMappingTableSource = read(
    'packages/sdkwork-claw-apirouter/src/components/ModelMappingTable.tsx',
  );
  const modelMappingDialogSource = read(
    'packages/sdkwork-claw-apirouter/src/components/ModelMappingDialogs.tsx',
  );
  const managerSource = read('packages/sdkwork-claw-apirouter/src/components/ProxyProviderManager.tsx');
  const unifiedManagerSource = read(
    'packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyManager.tsx',
  );
  const unifiedTableSource = read(
    'packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyTable.tsx',
  );
  const unifiedDialogSource = read(
    'packages/sdkwork-claw-apirouter/src/components/UnifiedApiKeyDialogs.tsx',
  );
  const sidebarSource = read('packages/sdkwork-claw-apirouter/src/components/ApiRouterChannelSidebar.tsx');
  const tableSource = read('packages/sdkwork-claw-apirouter/src/components/ProxyProviderTable.tsx');
  const dialogSource = read('packages/sdkwork-claw-apirouter/src/components/ProxyProviderDialogs.tsx');
  const usageTabMatch = accessSharedSource.match(
    /const API_ROUTER_USAGE_TAB_IDS:[^=]+=\s*\[([\s\S]*?)\];/,
  );

  assert.match(pageSource, /data-slot="api-router-page"/);
  assert.match(pageSource, /data-slot="api-router-page-tabs"/);
  assert.match(pageSource, /apiRouterPage\.pageTabs\.unifiedApiKey/);
  assert.match(pageSource, /apiRouterPage\.pageTabs\.routeConfig/);
  assert.match(pageSource, /apiRouterPage\.pageTabs\.modelMapping/);
  assert.match(pageSource, /apiRouterPage\.pageTabs\.usageRecords/);
  assert.match(pageSource, /<UnifiedApiKeyManager/);
  assert.match(pageSource, /<ModelMappingManager/);
  assert.match(pageSource, /<ApiRouterUsageRecordsPage/);
  assert.match(pageSource, /queryFn: \(\) => apiRouterService\.getChannels\(\)/);
  assert.match(pageSource, /queryFn: \(\) => apiRouterService\.getGroups\(\)/);
  assert.match(pageSource, /resolveApiRouterPageViewState\(\{/);
  assert.match(pageSource, /selectedChannelId: routeConfigChannelId/);
  assert.match(pageSource, /activePageTab === 'unified-api-key'/);
  assert.match(pageSource, /activePageTab === 'route-config'/);
  assert.match(pageSource, /activePageTab === 'model-mapping'/);
  assert.doesNotMatch(pageSource, /apiRouterAdminService\.getStatus/);
  assert.doesNotMatch(pageSource, /adminStatusQuery/);
  assert.doesNotMatch(pageSource, /showManagementPanels/);
  assert.doesNotMatch(pageSource, /data-slot="api-router-page-status"/);
  assert.doesNotMatch(pageSource, /apiRouterPage\.admin\.messages\./);
  assert.doesNotMatch(pageSource, /canLoadRouteConfigMetadata/);
  assert.doesNotMatch(pageSource, /routeConfigViewState\.showManagementPanels/);
  assert.doesNotMatch(pageSource, /routeConfigViewState\.showPageTabs \?/);
  assert.match(adminStatusServiceSource, /allowsManualLogin/);
  assert.match(adminStatusServiceSource, /allowsManualDisconnect/);
  assert.match(adminStatusServiceSource, /'needsConfiguration'/);
  assert.match(adminStatusServiceSource, /Manual sign-in is disabled while that token is configured/);
  assert.match(enLocaleSource, /"needsConfiguration": "Configuration required"/);
  assert.match(enLocaleSource, /"configuredTokenConfigurationRequired": "The configured sdkwork-api-router admin token was rejected\./);
  assert.match(zhLocaleSource, /"needsConfiguration": "需要修正配置"/);
  assert.match(zhLocaleSource, /"configuredTokenConfigurationRequired": "预配置的 sdkwork-api-router 管理员令牌已被服务端拒绝。/);
  assert.match(usageRecordsPageSource, /data-slot="api-router-usage-records-page"/);
  assert.match(usageRecordsPageSource, /getUsageRecordApiKeys/);
  assert.match(usageRecordsPageSource, /getUsageRecordSummary/);
  assert.match(usageRecordsPageSource, /getUsageRecords/);
  assert.match(usageRecordsPageSource, /startTransition/);
  assert.match(usageRecordsPageSource, /handleExportCsv|buildUsageRecordsCsv|exportCsv|CSV/);
  assert.match(usageSummaryCardsSource, /data-slot="api-router-usage-summary-cards"/);
  assert.match(usageSummaryCardsSource, /apiRouterPage\.usageRecords\.summary\.totalRequests/);
  assert.match(usageSummaryCardsSource, /apiRouterPage\.usageRecords\.summary\.totalTokens/);
  assert.match(usageSummaryCardsSource, /apiRouterPage\.usageRecords\.summary\.totalSpend/);
  assert.match(usageSummaryCardsSource, /apiRouterPage\.usageRecords\.summary\.averageDuration/);
  assert.match(usageFiltersSource, /data-slot="api-router-usage-filters"/);
  assert.match(usageFiltersSource, /apiRouterPage\.usageRecords\.filters\.apiKey/);
  assert.match(usageFiltersSource, /apiRouterPage\.usageRecords\.filters\.timeRange/);
  assert.match(usageFiltersSource, /apiRouterPage\.usageRecords\.actions\.refresh/);
  assert.match(usageFiltersSource, /apiRouterPage\.usageRecords\.actions\.reset/);
  assert.match(usageFiltersSource, /apiRouterPage\.usageRecords\.actions\.exportCsv/);
  assert.match(usageFiltersSource, /DateInput/);
  assert.match(usageTableSource, /data-slot="api-router-usage-table"/);
  assert.match(usageTableSource, /apiRouterPage\.usageRecords\.table\.apiKey/);
  assert.match(usageTableSource, /apiRouterPage\.usageRecords\.table\.model/);
  assert.match(usageTableSource, /apiRouterPage\.usageRecords\.table\.reasoningEffort/);
  assert.match(usageTableSource, /apiRouterPage\.usageRecords\.table\.endpoint/);
  assert.match(usageTableSource, /apiRouterPage\.usageRecords\.table\.tokenDetail/);
  assert.match(usageTableSource, /apiRouterPage\.usageRecords\.table\.cost/);
  assert.match(usageTableSource, /apiRouterPage\.usageRecords\.table\.ttft/);
  assert.match(usageTableSource, /apiRouterPage\.usageRecords\.table\.duration/);
  assert.match(usageTableSource, /apiRouterPage\.usageRecords\.table\.time/);
  assert.match(usageTableSource, /apiRouterPage\.usageRecords\.table\.userAgent/);
  assert.match(usagePaginationSource, /data-slot="api-router-usage-pagination"/);
  assert.match(usagePaginationSource, /apiRouterPage\.usageRecords\.pagination\.totalResults/);
  assert.match(usagePaginationSource, /apiRouterPage\.usageRecords\.pagination\.showingRange/);
  assert.match(usagePaginationSource, /apiRouterPage\.usageRecords\.pagination\.previous/);
  assert.match(usagePaginationSource, /apiRouterPage\.usageRecords\.pagination\.next/);
  assert.match(routeConfigSource, /data-slot="api-router-route-config-view"/);
  assert.match(modelMappingManagerSource, /data-slot="api-router-model-mapping-manager"/);
  assert.match(modelMappingTableSource, /data-slot="api-router-model-mapping-table"/);
  assert.match(modelMappingDialogSource, /data-slot="api-router-model-mapping-dialogs"/);
  assert.match(modelMappingManagerSource, /apiRouterPage\.modelMapping\.actions\.create/);
  assert.match(modelMappingManagerSource, /apiRouterPage\.modelMapping\.actions\.refresh/);
  assert.match(modelMappingManagerSource, /apiRouterPage\.modelMapping\.filters\.searchPlaceholder/);
  assert.match(modelMappingTableSource, /apiRouterPage\.modelMapping\.table\.name/);
  assert.match(modelMappingTableSource, /apiRouterPage\.modelMapping\.table\.description/);
  assert.match(modelMappingTableSource, /apiRouterPage\.modelMapping\.table\.effectiveTime/);
  assert.match(modelMappingTableSource, /apiRouterPage\.modelMapping\.actions\.viewDetail/);
  assert.match(modelMappingDialogSource, /apiRouterPage\.modelMapping\.dialogs\.modelSelectorTitle/);
  assert.match(modelMappingDialogSource, /apiRouterPage\.modelMapping\.fields\.rules/);
  assert.match(modelMappingDialogSource, /apiRouterPage\.modelMapping\.actions\.selectSourceModel/);
  assert.match(modelMappingDialogSource, /apiRouterPage\.modelMapping\.actions\.selectTargetModel/);
  assert.match(modelMappingDialogSource, /DateInput/);
  assert.match(managerSource, /data-slot="api-router-key-manager"/);
  assert.match(accessSharedSource, /export function ApiRouterUsageTabs/);
  assert.match(accessSharedSource, /export function ApiRouterUsageHeaderCard/);
  assert.match(accessSharedSource, /export function ApiRouterAccessClientCard/);
  assert.match(accessSharedSource, /export function ApiRouterInstanceSelectorPanel/);
  assert.match(unifiedManagerSource, /data-slot="api-router-unified-key-manager"/);
  assert.match(unifiedTableSource, /data-slot="api-router-unified-key-table"/);
  assert.match(unifiedDialogSource, /data-slot="api-router-unified-key-dialogs"/);
  assert.match(sidebarSource, /data-slot="api-router-channel-sidebar"/);
  assert.match(tableSource, /data-slot="api-router-provider-table"/);
  assert.match(managerSource, /apiRouterPage\.actions\.createKey/);
  assert.match(managerSource, /apiRouterPage\.actions\.refresh/);
  assert.match(managerSource, /apiRouterPage\.filters\.searchPlaceholder/);
  assert.match(managerSource, /apiRouterPage\.filters\.allGroups/);
  assert.match(managerSource, /apiRouterPage\.filters\.allChannels/);
  assert.match(managerSource, /apiRouterPage\.filters\.channelPlaceholder/);
  assert.match(pageSource, /px-4/);
  assert.doesNotMatch(pageSource, /px-0/);
  assert.doesNotMatch(pageSource, /mx-auto/);
  assert.doesNotMatch(pageSource, /max-w-\[/);
  assert.doesNotMatch(pageSource, /<ApiRouterAdminStatusCard/);
  assert.doesNotMatch(pageSource, /<ApiRouterRuntimeStatusCard/);
  assert.doesNotMatch(pageSource, /apiRouterRuntimeService\.getStatus/);
  assert.doesNotMatch(pageSource, /signInMutation/);
  assert.doesNotMatch(pageSource, /signOutMutation/);
  assert.doesNotMatch(pageSource, /runtimeStatusQuery/);
  assert.doesNotMatch(pageSource, /apiRouterPage\.actions\.createKey/);
  assert.doesNotMatch(pageSource, /apiRouterPage\.actions\.refresh/);
  assert.doesNotMatch(pageSource, /apiRouterPage\.filters\.searchPlaceholder/);
  assert.doesNotMatch(pageSource, /apiRouterPage\.filters\.allGroups/);
  assert.doesNotMatch(pageSource, /apiRouterPage\.page\.eyebrow/);
  assert.doesNotMatch(pageSource, /apiRouterPage\.page\.description/);
  assert.doesNotMatch(pageSource, /apiRouterPage\.page\.descriptionWithChannel/);
  assert.doesNotMatch(pageSource, /apiRouterPage\.summary\./);
  assert.doesNotMatch(sidebarSource, /apiRouterPage\.sidebar\.heading/);
  assert.doesNotMatch(sidebarSource, /apiRouterPage\.sidebar\.description/);
  assert.doesNotMatch(sidebarSource, /apiRouterPage\.sidebar\.providers/);
  assert.doesNotMatch(sidebarSource, /channel\.modelFamily/);
  assert.doesNotMatch(sidebarSource, /channel\.description/);
  assert.doesNotMatch(sidebarSource, /providerCount/);
  assert.doesNotMatch(sidebarSource, /activeProviderCount/);
  assert.doesNotMatch(sidebarSource, /warningProviderCount/);
  assert.doesNotMatch(sidebarSource, /disabledProviderCount/);
  assert.match(unifiedManagerSource, /apiRouterPage\.unifiedApiKey\.filters\.searchPlaceholder/);
  assert.match(unifiedManagerSource, /apiRouterPage\.unifiedApiKey\.actions\.createKey/);
  assert.match(unifiedManagerSource, /apiRouterPage\.unifiedApiKey\.actions\.refresh/);
  assert.match(unifiedManagerSource, /apiRouterPage\.unifiedApiKey\.filters\.allGroups/);
  assert.match(unifiedTableSource, /apiRouterPage\.unifiedApiKey\.table\.name/);
  assert.match(unifiedTableSource, /apiRouterPage\.unifiedApiKey\.table\.apiKey/);
  assert.match(unifiedTableSource, /apiRouterPage\.unifiedApiKey\.table\.group/);
  assert.match(unifiedTableSource, /apiRouterPage\.unifiedApiKey\.table\.usage/);
  assert.match(unifiedTableSource, /apiRouterPage\.unifiedApiKey\.table\.expiresAt/);
  assert.match(unifiedTableSource, /apiRouterPage\.unifiedApiKey\.table\.status/);
  assert.match(unifiedTableSource, /apiRouterPage\.unifiedApiKey\.table\.createdAt/);
  assert.match(unifiedTableSource, /apiRouterPage\.unifiedApiKey\.table\.source/);
  assert.match(unifiedTableSource, /apiRouterPage\.unifiedApiKey\.actions\.usageMethod/);
  assert.match(unifiedTableSource, /apiRouterPage\.unifiedApiKey\.actions\.routeConfig/);
  assert.match(unifiedDialogSource, /apiRouterPage\.unifiedApiKey\.fields\.keyMode/);
  assert.match(unifiedDialogSource, /apiRouterPage\.unifiedApiKey\.dialogs\.routeConfigTitle/);
  assert.match(unifiedDialogSource, /buildUnifiedApiKeyRouteConfigOptions/);
  assert.match(unifiedDialogSource, /resolveUnifiedApiKeyRouteConfigMeta/);
  assert.match(
    unifiedDialogSource,
    /apiRouterPage\.unifiedApiKey\.routeConfig\.sidebar\.sdkworkRemote\.title/,
  );
  assert.match(unifiedDialogSource, /apiRouterPage\.unifiedApiKey\.routeConfig\.custom\.title/);
  assert.match(unifiedDialogSource, /apiRouterPage\.unifiedApiKey\.fields\.generateKey/);
  assert.match(unifiedDialogSource, /apiRouterPage\.unifiedApiKey\.fields\.customKey/);
  assert.match(unifiedDialogSource, /buildUnifiedApiKeyAccessClientConfigs/);
  assert.match(unifiedDialogSource, /apiRouterPage\.quickSetup\.title/);
  assert.match(unifiedDialogSource, /applyClientSetup/);
  assert.match(unifiedDialogSource, /applyOpenClawSetup/);
  assert.match(unifiedDialogSource, /ApiRouterUsageTabs/);
  assert.match(unifiedDialogSource, /ApiRouterUsageHeaderCard/);
  assert.match(unifiedDialogSource, /ApiRouterAccessClientCard/);
  assert.match(unifiedDialogSource, /ApiRouterInstanceSelectorPanel/);
  assert.match(unifiedDialogSource, /DateInput/);
  assert.doesNotMatch(unifiedDialogSource, /apiRouterPage\.fields\.baseUrl/);
  assert.doesNotMatch(unifiedDialogSource, /apiRouterPage\.fields\.models/);
  assert.match(tableSource, /apiRouterPage\.table\.apiKey/);
  assert.match(tableSource, /apiRouterPage\.table\.group/);
  assert.match(tableSource, /apiRouterPage\.table\.usage/);
  assert.match(tableSource, /apiRouterPage\.table\.expiresAt/);
  assert.match(tableSource, /apiRouterPage\.table\.status/);
  assert.match(tableSource, /apiRouterPage\.table\.createdAt/);
  assert.match(tableSource, /apiRouterPage\.table\.channel/);
  assert.match(tableSource, /apiRouterPage\.actions\.usageMethod/);
  assert.match(tableSource, /apiRouterPage\.actions\.disable/);
  assert.match(tableSource, /apiRouterPage\.actions\.edit/);
  assert.match(tableSource, /apiRouterPage\.actions\.delete/);
  assert.match(dialogSource, /buildProviderAccessClientConfigs/);
  assert.match(dialogSource, /apiRouterPage\.quickSetup\.title/);
  assert.match(dialogSource, /getProviderAccessClientKey/);
  assert.match(dialogSource, /ApiRouterUsageTabs/);
  assert.match(dialogSource, /ApiRouterUsageHeaderCard/);
  assert.match(dialogSource, /ApiRouterAccessClientCard/);
  assert.match(dialogSource, /ApiRouterInstanceSelectorPanel/);
  assert.match(dialogSource, /apiRouterPage\.actions\.addModel/);
  assert.match(dialogSource, /apiRouterPage\.fields\.modelId/);
  assert.match(dialogSource, /apiRouterPage\.fields\.modelDisplayName/);
  assert.match(dialogSource, /DateInput/);
  assert.match(accessSharedSource, /const API_ROUTER_USAGE_TAB_IDS/);
  assert.ok(usageTabMatch);
  assert.deepEqual(extractSingleQuotedStrings(usageTabMatch[1] ?? ''), [
    'default',
    'codex',
    'claude-code',
    'opencode',
    'openclaw',
    'gemini',
  ]);
  assert.match(accessSharedSource, /'default'/);
  assert.match(accessSharedSource, /'codex'/);
  assert.match(accessSharedSource, /'claude-code'/);
  assert.match(accessSharedSource, /'opencode'/);
  assert.match(accessSharedSource, /'openclaw'/);
  assert.match(accessSharedSource, /'gemini'/);
  assert.match(accessSharedSource, /apiRouterPage\.quickSetup\.selectInstances/);
  assert.match(accessSharedSource, /case 'codex'/);
  assert.match(accessSharedSource, /case 'claude-code'/);
  assert.match(accessSharedSource, /case 'opencode'/);
  assert.match(accessSharedSource, /case 'openclaw'/);
  assert.match(accessSharedSource, /case 'gemini'/);
  assert.match(enLocaleSource, /"codex": "Codex"/);
  assert.match(enLocaleSource, /Install ~\/\.codex\/config\.toml and ~\/\.codex\/auth\.json/);
  assert.match(zhLocaleSource, /"codex": "Codex"/);
  assert.match(zhLocaleSource, /安装 ~\/\.codex\/config\.toml 和 ~\/\.codex\/auth\.json/);
});

runTest('shell routes /api-router directly to the feature module without a workspace wrapper', () => {
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');

  assert.match(routesSource, /@sdkwork\/claw-apirouter/);
  assert.match(routesSource, /path="\/api-router"/);
  assert.match(routesSource, /<ApiRouter \/>/);
  assert.doesNotMatch(routesSource, /apiRouterComingSoon/);
  assert.doesNotMatch(routesSource, /ApiRouterWorkspace/);
  assert.equal(
    exists('packages/sdkwork-claw-shell/src/application/router/ApiRouterWorkspace.tsx'),
    false,
  );
});
