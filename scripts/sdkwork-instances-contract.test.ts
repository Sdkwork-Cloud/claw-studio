import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const instanceDetailBadgeDescriptorsModuleUrl = pathToFileURL(
  path.join(root, 'packages/sdkwork-claw-instances/src/pages/instanceDetailBadgeDescriptors.ts'),
).href;
const { buildInstanceDetailBadgeDescriptors } =
  (await import(instanceDetailBadgeDescriptorsModuleUrl)) as typeof import('../packages/sdkwork-claw-instances/src/pages/instanceDetailBadgeDescriptors');

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function readSources(relPaths: string[]) {
  return relPaths.map((relPath) => read(relPath)).join('\n');
}

function getLocaleValue(locale: Record<string, unknown>, key: string) {
  return key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, locale);
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function extractBetween(source: string, startMarker: string, endMarker: string) {
  const startIndex = source.indexOf(startMarker);
  assert.notEqual(startIndex, -1, `Expected to find start marker: ${startMarker}`);

  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);
  assert.notEqual(endIndex, -1, `Expected to find end marker: ${endMarker}`);

  return source.slice(startIndex, endIndex);
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

runTest('sdkwork-claw-instances is implemented locally instead of re-exporting claw-studio-instances', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-instances/package.json',
  );
  const indexSource = read('packages/sdkwork-claw-instances/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-instances/src/pages/Instances.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/components/AgentWorkbenchPanel.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/components/InstanceFileExplorer.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/components/InstanceFilesWorkspace.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/components/InstanceLLMConfigPanel.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/services/agentWorkbenchService.ts'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/services/instanceService.ts'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/store/useInstanceStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/types/index.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-instances']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-instances/);
  assert.match(indexSource, /Instances/);
  assert.match(indexSource, /InstanceDetail/);
  assert.match(indexSource, /Nodes/);
  assert.match(indexSource, /agentSkillManagementService/);
  assert.match(indexSource, /agentWorkbenchService/);
  assert.match(indexSource, /instanceService/);
  assert.match(indexSource, /instanceWorkbenchService/);
  assert.match(indexSource, /useInstanceStore/);
  assert.doesNotMatch(indexSource, /export \* from '\.\/services';/);
  assert.doesNotMatch(indexSource, /export \* from '\.\/types';/);
});

runTest('sdkwork-claw-instances exports the Nodes surface through package and service barrels with localized page copy', () => {
  const indexSource = read('packages/sdkwork-claw-instances/src/index.ts');
  const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
  const nodesSource = read('packages/sdkwork-claw-instances/src/pages/Nodes.tsx');
  const enLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/zh.json');
  const directKeys = [...nodesSource.matchAll(/\bt\('([^']+)'\)/g)].map((match) => match[1]);
  const uniqueKeys = [...new Set(directKeys)].sort();

  const missingKeys = uniqueKeys.filter(
    (key) => getLocaleValue(enLocale, key) === undefined || getLocaleValue(zhLocale, key) === undefined,
  );

  assert.ok(exists('packages/sdkwork-claw-instances/src/pages/Nodes.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/services/nodeInventoryService.ts'));
  assert.match(indexSource, /Nodes/);
  assert.match(servicesIndexSource, /nodeInventoryService/);
  assert.match(nodesSource, /nodeInventoryService/);
  assert.doesNotMatch(nodesSource, /Cluster governance starts here\./);
  assert.doesNotMatch(nodesSource, /Failed to load node inventory\./);
  assert.match(nodesSource, /instances\.nodes\.description/);
  assert.match(nodesSource, /instances\.nodes\.actions\.refresh/);
  assert.match(nodesSource, /instances\.nodes\.actions\.ensureLocalNode/);
  assert.match(nodesSource, /instances\.nodes\.actions\.restartLocalNode/);
  assert.match(nodesSource, /instances\.nodes\.metrics\.totalNodes/);
  assert.match(nodesSource, /instances\.nodes\.fields\.topology/);
  assert.match(nodesSource, /instances\.nodes\.kinds\.localPrimary/);
  assert.match(nodesSource, /instances\.nodes\.health\.ok/);
  assert.deepEqual(missingKeys, []);
});

runTest('sdkwork-claw-instances removes the legacy token chrome from instance detail', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');

  assert.doesNotMatch(detailSource, /instances\.detail\.fields\.apiToken/);
  assert.doesNotMatch(detailSource, /sk-local-123456789/);
});

runTest('sdkwork-claw-instances upgrades the detail page into a sidebar workbench for OpenClaw runtime capabilities', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');

  assert.match(detailSource, /instanceWorkbench\.sidebar\.overview/);
  assert.match(detailSource, /instanceWorkbench\.sidebar\.channels/);
  assert.match(detailSource, /instanceWorkbench\.sidebar\.cronTasks/);
  assert.match(detailSource, /instanceWorkbench\.sidebar\.llmProviders/);
  assert.match(detailSource, /instanceWorkbench\.sidebar\.agents/);
  assert.match(detailSource, /instanceWorkbench\.sidebar\.skills/);
  assert.match(detailSource, /instanceWorkbench\.sidebar\.files/);
  assert.match(detailSource, /instanceWorkbench\.sidebar\.memory/);
  assert.match(detailSource, /instanceWorkbench\.sidebar\.tools/);
  assert.match(detailSource, /instanceWorkbench\.sections\.overview/);
  assert.match(detailSource, /instanceWorkbench\.sections\.channels/);
  assert.match(detailSource, /instanceWorkbench\.sections\.cronTasks/);
  assert.match(detailSource, /instanceWorkbench\.sections\.llmProviders/);
  assert.match(detailSource, /instanceWorkbench\.sections\.agents/);
  assert.match(detailSource, /instanceWorkbench\.sections\.skills/);
  assert.match(detailSource, /instanceWorkbench\.sections\.files/);
  assert.match(detailSource, /instanceWorkbench\.sections\.memory/);
  assert.match(detailSource, /instanceWorkbench\.sections\.tools/);
});

runTest('sdkwork-claw-instances uses a wider detail canvas and row-based operational list shells', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');

  assert.doesNotMatch(detailSource, /max-w-\[96rem\]/);
  assert.match(detailSource, /data-slot="instance-workbench-row-list"/);
});

runTest('sdkwork-claw-instances reuses the shared task catalog surface for cron tasks', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');

  assert.match(detailSource, /TaskCatalog/);
  assert.match(detailSource, /TaskExecutionHistoryDrawer/);
  assert.match(detailSource, /getTaskToggleStatusTarget/);
  assert.match(detailSource, /tasks\.page\.actions\.edit/);
  assert.match(detailSource, /tasks\.page\.actions\.runNow/);
  assert.match(detailSource, /tasks\.page\.actions\.history/);
  assert.doesNotMatch(detailSource, /<TaskRow/);
});

runTest('sdkwork-claw-instances opens channel official setup links through the host external browser bridge', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');

  assert.match(detailSource, /ChannelWorkspace/);
  assert.match(detailSource, /openExternalUrl/);
  assert.match(detailSource, /onOpenOfficialLink=\{\(_channel, link\) => void openOfficialLink\(link\.href\)\}/);
});

runTest('sdkwork-claw-instances keeps agents and skills visible in the top summary card deck', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');

  assert.match(detailSource, /instanceWorkbench\.summary\.agents/);
  assert.match(detailSource, /instanceWorkbench\.summary\.skills/);
});

runTest('sdkwork-claw-instances turns files into an IDE-style explorer and editor workspace', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const explorerSource = read('packages/sdkwork-claw-instances/src/components/InstanceFileExplorer.tsx');
  const workspaceSource = read('packages/sdkwork-claw-instances/src/components/InstanceFilesWorkspace.tsx');
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-instances/package.json',
  );

  assert.ok(pkg.dependencies?.['@monaco-editor/react']);
  assert.match(detailSource, /InstanceFilesWorkspace/);
  assert.match(detailSource, /mode="instance"/);
  assert.match(workspaceSource, /data-slot="instance-files-explorer"/);
  assert.match(workspaceSource, /data-slot="instance-files-editor"/);
  assert.match(workspaceSource, /InstanceFilesTabsBar/);
  assert.match(workspaceSource, /@monaco-editor\/react/);
  assert.match(explorerSource, /data-slot="instance-files-tree"/);
  assert.match(explorerSource, /directory/i);
  assert.doesNotMatch(detailSource, /instanceWorkbench\.sidebar\.title/);
  assert.doesNotMatch(detailSource, /instanceWorkbench\.sidebar\.description/);
});

runTest('sdkwork-claw-instances keeps instance-level destructive actions in the header and out of files/tools sections', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const filesSectionSource = extractBetween(
    detailSource,
    'const renderFilesSection = () => {',
    'const renderMemorySection = () => {',
  );
  const toolsSectionSource = extractBetween(
    detailSource,
    'const renderToolsSection = () => {',
    'const renderSectionContent = () => {',
  );

  assert.match(
    detailSource,
    /<div className="flex flex-wrap gap-3">[\s\S]*instances\.detail\.actions\.uninstallInstance/,
  );
  assert.doesNotMatch(filesSectionSource, /instances\.detail\.fields\.apiToken/);
  assert.doesNotMatch(filesSectionSource, /instances\.detail\.actions\.saveConfiguration/);
  assert.doesNotMatch(toolsSectionSource, /instances\.detail\.dangerZone/);
  assert.doesNotMatch(toolsSectionSource, /instances\.detail\.dangerDescription/);
  assert.doesNotMatch(toolsSectionSource, /instances\.detail\.actions\.uninstallInstance/);
});

runTest('sdkwork-claw-instances blocks unsupported lifecycle mutations before the studio bridge is called', () => {
  const serviceSource = read('packages/sdkwork-claw-instances/src/services/instanceService.ts');
  const serviceCoreSource = read('packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts');

  assert.match(serviceSource, /createInstanceService as createInstanceServiceCore/);
  assert.match(serviceSource, /export const instanceService = createInstanceService\(\);/);
  assert.match(serviceCoreSource, /assertLifecycleControlSupported/);
  assert.match(serviceCoreSource, /getInstanceDetail\(id\)\.catch\(\(\) => null\)/);
  assert.match(serviceCoreSource, /detail\.lifecycle\.startStopSupported === false/);
  assert.match(serviceCoreSource, /await this\.assertLifecycleControlSupported\(id\);\s*const updated = await this\.dependencies\.studioApi\.startInstance\(id\);/);
  assert.match(serviceCoreSource, /await this\.assertLifecycleControlSupported\(id\);\s*const updated = await this\.dependencies\.studioApi\.stopInstance\(id\);/);
  assert.match(serviceCoreSource, /await this\.assertLifecycleControlSupported\(id\);\s*const updated = await this\.dependencies\.studioApi\.restartInstance\(id\);/);
});

runTest('sdkwork-claw-instances runtime service wrappers forward openClawConfigService methods explicitly instead of spreading a class instance', () => {
  const instanceServiceSource = read('packages/sdkwork-claw-instances/src/services/instanceService.ts');
  const workbenchServiceSource = read('packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts');
  const instanceServiceOverrides = extractBetween(
    instanceServiceSource,
    'function createRuntimeDependencyOverrides()',
    'export function createInstanceService(',
  );
  const workbenchServiceOverrides = extractBetween(
    workbenchServiceSource,
    'function createRuntimeDependencyOverrides()',
    'export function createInstanceWorkbenchService(',
  );

  assert.match(instanceServiceOverrides, /resolveInstanceConfigPath:\s*\(detail\)\s*=>\s*openClawConfigService\.resolveInstanceConfigPath\(detail\)/);
  assert.match(instanceServiceOverrides, /readConfigDocument:\s*\(configPath\)\s*=>\s*openClawConfigService\.readConfigDocument\(configPath\)/);
  assert.match(instanceServiceOverrides, /writeConfigDocument:\s*\(configPath,\s*raw\)\s*=>\s*openClawConfigService\.writeConfigDocument\(configPath,\s*raw\)/);
  assert.match(instanceServiceOverrides, /saveAgent:\s*\(input\)\s*=>\s*openClawConfigService\.saveAgent\(input\)/);
  assert.match(instanceServiceOverrides, /deleteAgent:\s*\(input\)\s*=>\s*openClawConfigService\.deleteAgent\(input\)/);
  assert.match(instanceServiceOverrides, /saveChannelConfiguration:\s*\(input\)\s*=>\s*openClawConfigService\.saveChannelConfiguration\(input\)/);
  assert.match(instanceServiceOverrides, /saveWebSearchConfiguration:\s*\(input\)\s*=>\s*openClawConfigService\.saveWebSearchConfiguration\(input\)/);
  assert.match(instanceServiceOverrides, /saveAuthCooldownsConfiguration:\s*\(input\)\s*=>\s*openClawConfigService\.saveAuthCooldownsConfiguration\(input\)/);
  assert.match(instanceServiceOverrides, /setChannelEnabled:\s*\(input\)\s*=>\s*openClawConfigService\.setChannelEnabled\(input\)/);
  assert.doesNotMatch(instanceServiceOverrides, /openClawConfigService,\s*\n/);

  assert.match(workbenchServiceOverrides, /resolveInstanceConfigPath:\s*\(detail\)\s*=>\s*openClawConfigService\.resolveInstanceConfigPath\(detail\)/);
  assert.match(workbenchServiceOverrides, /readConfigSnapshot:\s*\(configPath\)\s*=>\s*openClawConfigService\.readConfigSnapshot\(configPath\)/);
  assert.match(workbenchServiceOverrides, /getChannelDefinitions:\s*\(\)\s*=>\s*openClawConfigService\.getChannelDefinitions\(\)/);
  assert.doesNotMatch(workbenchServiceOverrides, /openClawConfigService,\s*\n/);
});

runTest('sdkwork-claw-instances gates instance detail lifecycle actions with backend lifecycle capability', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const actionCapabilitiesSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.ts',
  );

  assert.match(actionCapabilitiesSource, /buildInstanceActionCapabilities/);
  assert.match(
    actionCapabilitiesSource,
    /detail\?\.lifecycle\.lifecycleControllable \?\? detail\?\.lifecycle\.startStopSupported/,
  );
  assert.match(detailSource, /const actionCapabilities = buildInstanceActionCapabilities\(instance, detail\);/);
  assert.match(detailSource, /const canControlLifecycle = actionCapabilities\.canControlLifecycle;/);
  assert.match(detailSource, /const canStopLifecycle = actionCapabilities\.canStop;/);
  assert.match(detailSource, /const canStartLifecycle = actionCapabilities\.canStart;/);
  assert.match(detailSource, /\{canControlLifecycle \? \(/);
  assert.match(detailSource, /const canDelete = actionCapabilities\.canDelete;/);
  assert.match(detailSource, /\{canDelete \? \(/);
  assert.doesNotMatch(detailSource, /onClick=\{handleRestart\}[\s\S]*instances\.detail\.actions\.restart[\s\S]*\{instance\.status === 'online' \?/);
});

runTest('sdkwork-claw-instances preloads lifecycle support for instance list actions before exposing controls', () => {
  const listSource = read('packages/sdkwork-claw-instances/src/pages/Instances.tsx');
  const actionCapabilitiesSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.ts',
  );

  assert.match(
    listSource,
    /const \[actionCapabilitiesByInstanceId, setActionCapabilitiesByInstanceId\] = useState</,
  );
  assert.match(listSource, /buildInstanceActionCapabilities\(instance, null\)/);
  assert.match(listSource, /loadInstanceActionCapabilities\(/);
  assert.match(
    actionCapabilitiesSource,
    /const detail = await loadDetail\(instance\.id\)\.catch\(\(\) => null\);/,
  );
  assert.match(listSource, /actionCapabilitiesByInstanceId\[instance\.id\]/);
  assert.match(listSource, /const canRestartLifecycle = actionCapabilities\.canRestart;/);
  assert.match(listSource, /const canStartLifecycle = actionCapabilities\.canStart;/);
  assert.match(listSource, /const canDelete = actionCapabilities\.canDelete;/);
});

runTest('sdkwork-claw-instances adds an instance-native LLM provider workspace with editable config chrome', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const panelSource = read('packages/sdkwork-claw-instances/src/components/InstanceLLMConfigPanel.tsx');

  assert.match(detailSource, /data-slot="instance-llm-provider-list"/);
  assert.match(detailSource, /navigate\('\/settings\?tab=api'\)/);
  assert.match(detailSource, /isProviderConfigReadonly \? t\('instances\.detail\.instanceWorkbench\.llmProviders\.readonlyNotice'\)/);
  assert.match(detailSource, /isProviderConfigReadonly \? t\('providerCenter\.page\.title'\)/);
  assert.match(panelSource, /data-slot="instance-llm-config-panel"/);
  assert.match(panelSource, /onOpenProviderCenter\?: \(\) => void;/);
  assert.match(panelSource, /openProviderCenterLabel\?: string;/);
  assert.match(panelSource, /onOpenProviderCenter && openProviderCenterLabel/);
  assert.match(panelSource, /defaultModelId/);
  assert.match(panelSource, /temperature/);
  assert.match(panelSource, /maxTokens/);
});

runTest('sdkwork-claw-instances aggregates instance-native runtime surfaces through a dedicated workbench service', () => {
  const serviceSource = readSources([
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  ]);

  assert.match(serviceSource, /getInstanceDetail/);
  assert.match(serviceSource, /instanceService/);
  assert.match(serviceSource, /getInstanceById/);
  assert.match(serviceSource, /getInstanceConfig/);
  assert.match(serviceSource, /getInstanceToken/);
  assert.match(serviceSource, /getInstanceLogs/);
  assert.match(serviceSource, /openClawGatewayClient/);
  assert.match(serviceSource, /getChannelStatus/);
  assert.match(serviceSource, /listWorkbenchCronJobs/);
  assert.match(serviceSource, /listWorkbenchCronRuns/);
  assert.match(serviceSource, /listInstanceFiles/);
  assert.match(serviceSource, /listInstanceMemories/);
  assert.match(serviceSource, /buildRegistryWorkbenchSnapshot/);
  assert.doesNotMatch(serviceSource, /studioMockService/);
});

runTest('sdkwork-claw-instances renders a backend-authored runtime overview section', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');

  assert.match(detailSource, /data-slot="instance-detail-overview"/);
  assert.match(detailSource, /data-slot="instance-detail-management-summary"/);
  assert.match(detailSource, /data-slot="instance-detail-capability-matrix"/);
  assert.match(detailSource, /data-slot="instance-detail-connectivity"/);
});

runTest('sdkwork-claw-instances promotes instance management metadata into the overview workbench surface', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const presentationSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceManagementPresentation.ts',
  );

  assert.match(detailSource, /buildInstanceManagementSummary/);
  assert.match(detailSource, /instanceWorkbench\.overview\.management\.title/);
  assert.match(detailSource, /instanceWorkbench\.overview\.management\.description/);
  assert.match(presentationSource, /managementScope/);
  assert.match(presentationSource, /configAuthority/);
  assert.match(presentationSource, /defaultWorkspace/);
  assert.match(presentationSource, /instanceWorkbench\.overview\.management\.labels\.controlPlane/);
  assert.match(presentationSource, /instanceWorkbench\.overview\.management\.details\.scopeFull/);
});

runTest('sdkwork-claw-instances renders backend-authored data access and artifact overview surfaces', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const serviceSource = readSources([
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  ]);

  assert.match(detailSource, /data-slot="instance-detail-data-access"/);
  assert.match(detailSource, /data-slot="instance-detail-artifacts"/);
  assert.match(detailSource, /detail\.dataAccess/);
  assert.match(detailSource, /detail\.artifacts/);
  assert.match(serviceSource, /dataAccess/);
  assert.match(serviceSource, /artifacts/);
});

runTest('sdkwork-claw-instances keeps metadata badge keys unique when different fields share the same value', () => {
  const badges = buildInstanceDetailBadgeDescriptors('config', [
    { slot: 'scope', value: 'config' },
    { slot: 'mode', value: 'metadataOnly' },
    { slot: 'source', value: 'config' },
  ]);

  assert.deepEqual(
    badges.map((badge) => badge.value),
    ['config', 'metadataOnly', 'config'],
  );
  assert.deepEqual(
    badges.map((badge) => badge.key),
    ['config-scope-config', 'config-mode-metadataOnly', 'config-source-config'],
  );
  assert.equal(new Set(badges.map((badge) => badge.key)).size, badges.length);
});

runTest('sdkwork-claw-instances prefers backend-authored openclaw workbench sections when available', () => {
  const serviceSource = readSources([
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  ]);

  assert.match(serviceSource, /detail\.workbench/);
  assert.match(serviceSource, /isOpenClawDetail\(detail\)/);
  assert.match(serviceSource, /if \(detail\?\.workbench\)/);
  assert.match(serviceSource, /mapBackendWorkbench\(detail,/);
});

runTest('sdkwork-claw-instances reuses the shared cron manager and keeps OpenClaw cron CRUD fully editable', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const serviceSource = readSources([
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  ]);
  const studioContract = read('packages/sdkwork-claw-infrastructure/src/platform/contracts/studio.ts');
  const instancesPkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-instances/package.json',
  );
  const panelSource = read('packages/sdkwork-claw-instances/src/components/InstanceLLMConfigPanel.tsx');

  assert.equal(instancesPkg.dependencies?.['@sdkwork/claw-commons'], 'workspace:*');
  assert.match(studioContract, /createInstanceTask/);
  assert.match(studioContract, /updateInstanceTask/);
  assert.match(studioContract, /cloneInstanceTask/);
  assert.match(studioContract, /runInstanceTaskNow/);
  assert.match(studioContract, /listInstanceTaskExecutions/);
  assert.match(studioContract, /updateInstanceTaskStatus/);
  assert.match(studioContract, /deleteInstanceTask/);
  assert.match(serviceSource, /studio\.createInstanceTask/);
  assert.match(serviceSource, /studio\.updateInstanceTask/);
  assert.match(serviceSource, /studio\.cloneInstanceTask/);
  assert.match(serviceSource, /studio\.runInstanceTaskNow/);
  assert.match(serviceSource, /studio\.listInstanceTaskExecutions/);
  assert.match(serviceSource, /studio\.updateInstanceTaskStatus/);
  assert.match(serviceSource, /studio\.deleteInstanceTask/);
  assert.doesNotMatch(serviceSource, /OpenClaw managed cron task mutations are not wired yet/);
  assert.match(detailSource, /detail\?\.instance\.runtimeKind === 'openclaw'/);
  assert.match(detailSource, /CronTasksManager/);
  assert.match(detailSource, /instanceId=\{id\}/);
  assert.doesNotMatch(detailSource, /data-slot="instance-openclaw-cron-editor-notice"/);
  assert.doesNotMatch(detailSource, /instanceWorkbench\.sections\.cronTasks\.editorNotice/);
  assert.doesNotMatch(detailSource, /isOpenClawTaskEditorPending/);
  assert.match(panelSource, /isReadonly: boolean;/);
  assert.match(panelSource, /readonlyMessage\?: string;/);
  assert.match(panelSource, /disabled=\{isReadonly\}/);
});

runTest('sdkwork-claw-instances keeps local-external OpenClaw config-backed while routing provider changes through Provider Center', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const instanceServiceSource = [
    read('packages/sdkwork-claw-instances/src/services/instanceService.ts'),
    read('packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts'),
  ].join('\n');
  const providerWorkspaceSource = read(
    'packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts',
  );
  const workbenchSource = readSources([
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  ]);

  assert.match(detailSource, /Dialog(Content|Header|Footer|Title|Description)?/);
  assert.match(detailSource, /ChannelCatalog/);
  assert.match(detailSource, /managedFile/);
  assert.match(detailSource, /buildOpenClawProviderWorkspaceState/);
  assert.match(detailSource, /detail\?\.lifecycle\.configWritable/);
  assert.match(detailSource, /isReadonly=\{isProviderConfigReadonly\}/);
  assert.match(detailSource, /readonlyMessage=\{t\('instances\.detail\.instanceWorkbench\.llmProviders\.readonlyNotice'\)\}/);
  assert.match(detailSource, /disabled=\{!canManageOpenClawProviders\}/);
  assert.match(detailSource, /canEditManagedChannels = Boolean\(id && isOpenClawConfigWritable && managedChannels\.length\)/);
  assert.match(
    detailSource,
    /canEditManagedAuthCooldowns = Boolean\(\s*id && isOpenClawConfigWritable && managedAuthCooldownsConfig,\s*\)/,
  );

  assert.match(instanceServiceSource, /openClawConfigService/);
  assert.match(instanceServiceSource, /createManagedOpenClawProviderControlPlaneError/);
  assert.match(instanceServiceSource, /Provider Center/);
  assert.match(instanceServiceSource, /resolveManagedOpenClawConfig/);
  assert.match(instanceServiceSource, /resolvedDetail\.lifecycle\.configWritable/);
  assert.match(instanceServiceSource, /openClawConfigService\.resolveInstanceConfigPath/);

  assert.match(providerWorkspaceSource, /isProviderCenterManagedOpenClawDetail/);
  assert.match(providerWorkspaceSource, /isProviderConfigReadonly:\s*providerCenterManaged/);
  assert.match(providerWorkspaceSource, /canManageProviderCatalog:\s*false/);

  assert.match(workbenchSource, /openClawConfigService/);
  assert.match(workbenchSource, /resolveInstanceConfigPath/);
  assert.match(workbenchSource, /detail\.dataAccess/);
  assert.match(workbenchSource, /isProviderCenterManagedOpenClawDetail/);
  assert.match(workbenchSource, /providerSnapshots\.map\(mapManagedProvider\)/);
});

runTest('sdkwork-claw-instances keeps OpenClaw agent CRUD real while provider routes stay discoverable in instance detail', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const instanceServiceSource = [
    read('packages/sdkwork-claw-instances/src/services/instanceService.ts'),
    read('packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts'),
  ].join('\n');
  const workbenchSource = readSources([
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  ]);

  assert.match(detailSource, /instances\.detail\.instanceWorkbench\.llmProviders\.panel\.newProvider/);
  assert.match(detailSource, /instances\.detail\.instanceWorkbench\.llmProviders\.panel\.providerModelsTitle/);
  assert.match(detailSource, /isProviderConfigReadonly/);
  assert.match(detailSource, /canManageOpenClawProviders/);
  assert.match(detailSource, /instances\.detail\.instanceWorkbench\.agents\.deleteDialog\.title/);
  assert.match(detailSource, /onEditAgent=\{openEditAgentDialog\}/);
  assert.match(instanceServiceSource, /createOpenClawAgent/);
  assert.match(instanceServiceSource, /updateOpenClawAgent/);
  assert.match(instanceServiceSource, /deleteOpenClawAgent/);
  assert.match(workbenchSource, /configSource: 'managedConfig'/);
  assert.match(workbenchSource, /managedConfigSnapshot\?\.agentSnapshots/);
});

runTest('sdkwork-claw-instances keeps the OpenClaw workbench file explorer aligned with the standard bootstrap file set', () => {
  const rustWorkbenchSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio/openclaw_workbench.rs',
  );

  assert.match(rustWorkbenchSource, /"AGENTS\.md"/);
  assert.match(rustWorkbenchSource, /"HEARTBEAT\.md"/);
  assert.match(rustWorkbenchSource, /"BOOT\.md"/);
  assert.match(rustWorkbenchSource, /"BOOTSTRAP\.md"/);
  assert.match(rustWorkbenchSource, /"MEMORY\.md"/);
});

runTest('sdkwork-claw-instances links the agents workbench to the agent marketplace for the current instance', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const panelSource = read('packages/sdkwork-claw-instances/src/components/AgentWorkbenchPanel.tsx');

  assert.match(detailSource, /\/agents\?instanceId=/);
  assert.match(panelSource, /sidebar\.agentMarket/);
  assert.match(detailSource, /BriefcaseBusiness/);
  assert.doesNotMatch(detailSource, /<Bot className="h-4 w-4" \/>/);
  assert.match(detailSource, /isReadonly=\{!isOpenClawConfigWritable\}/);
  assert.match(panelSource, /disabled=\{isReadonly\}/);
  assert.match(panelSource, /instances\.detail\.instanceWorkbench\.agents\.marketReadonlyNotice/);
});

runTest('sdkwork-claw-instances turns agents into a master-detail workbench backed by an agent-scoped service', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const panelSource = read('packages/sdkwork-claw-instances/src/components/AgentWorkbenchPanel.tsx');
  const serviceSource = readSources([
    'packages/sdkwork-claw-instances/src/services/agentWorkbenchService.ts',
    'packages/sdkwork-claw-instances/src/services/agentWorkbenchServiceCore.ts',
  ]);

  assert.match(detailSource, /AgentWorkbenchPanel/);
  assert.match(detailSource, /selectedAgentId/);
  assert.match(detailSource, /agentWorkbenchService\.getAgentWorkbench/);
  assert.match(panelSource, /data-slot="agent-workbench-sidebar"/);
  assert.match(panelSource, /data-slot="agent-workbench-detail"/);
  assert.match(panelSource, /data-slot="agent-workbench-top-tabs"/);
  assert.match(panelSource, /data-slot="agent-workbench-files"/);
  assert.match(panelSource, /InstanceFilesWorkspace/);
  assert.match(panelSource, /mode="agent"/);
  assert.doesNotMatch(panelSource, /<InstanceFileExplorer/);
  assert.match(serviceSource, /authProfilesPath/);
  assert.match(serviceSource, /modelsRegistryPath/);
  assert.match(serviceSource, /sessionsPath/);
  assert.match(serviceSource, /routeStatus/);
});

runTest('sdkwork-claw-instances gives agent skills an official workspace-scoped install guide and richer status metadata', () => {
  const panelSource = read('packages/sdkwork-claw-instances/src/components/AgentWorkbenchPanel.tsx');
  const serviceSource = readSources([
    'packages/sdkwork-claw-instances/src/services/agentWorkbenchService.ts',
    'packages/sdkwork-claw-instances/src/services/agentWorkbenchServiceCore.ts',
  ]);

  assert.match(panelSource, /openclaw skills install/);
  assert.match(panelSource, /return `cd "\$\{target\}"\\nopenclaw skills install \$\{normalizedSlug\}`;/);
  assert.match(panelSource, /navigator\.clipboard\.writeText/);
  assert.match(panelSource, /skill\.scope/);
  assert.match(panelSource, /skill\.eligible/);
  assert.match(serviceSource, /scope:/);
  assert.match(serviceSource, /installOptions:/);
  assert.match(serviceSource, /skillKey:/);
});

runTest('sdkwork-claw-instances keeps direct InstanceDetail i18n keys mapped in both locale bundles', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const enLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/zh.json');
  const directKeys = [...detailSource.matchAll(/\bt\('([^']+)'\)/g)].map((match) => match[1]);
  const uniqueKeys = [...new Set(directKeys)].sort();

  const missingKeys = uniqueKeys.filter(
    (key) => getLocaleValue(enLocale, key) === undefined || getLocaleValue(zhLocale, key) === undefined,
  );

  assert.deepEqual(missingKeys, []);
});

runTest('sdkwork-claw-instances config workbench editor source avoids mojibake fallback copy', () => {
  const editorSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigSchemaSectionEditor.tsx',
  );
  const zhLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/zh.json');
  const fallbackEntries = new Map(
    [
      ...editorSource.matchAll(
        /(?:params|props)\.t\('([^']*schemaEditor[^']*)', '([^']+)', '([^']+)'/g,
      ),
    ].map((match) => [
      match[1],
      {
        en: match[2],
        zhFallback: match[3],
      },
    ]),
  );

  const expectedLocaleKeys = [
    'instances.detail.instanceWorkbench.config.schemaEditor.hideValue',
    'instances.detail.instanceWorkbench.config.schemaEditor.revealValue',
    'instances.detail.instanceWorkbench.config.schemaEditor.notSet',
    'instances.detail.instanceWorkbench.config.schemaEditor.unsupportedArraySchema',
    'instances.detail.instanceWorkbench.config.schemaEditor.itemCount',
    'instances.detail.instanceWorkbench.config.schemaEditor.addItem',
    'instances.detail.instanceWorkbench.config.schemaEditor.noItemsYet',
    'instances.detail.instanceWorkbench.config.schemaEditor.noArrayItemsMatchSearch',
    'instances.detail.instanceWorkbench.config.schemaEditor.itemLabel',
    'instances.detail.instanceWorkbench.config.schemaEditor.removeItem',
    'instances.detail.instanceWorkbench.config.schemaEditor.customEntries',
    'instances.detail.instanceWorkbench.config.schemaEditor.customEntriesDescription',
    'instances.detail.instanceWorkbench.config.schemaEditor.addEntry',
    'instances.detail.instanceWorkbench.config.schemaEditor.noCustomEntriesYet',
    'instances.detail.instanceWorkbench.config.schemaEditor.noCustomEntriesMatchSearch',
    'instances.detail.instanceWorkbench.config.schemaEditor.removeEntry',
    'instances.detail.instanceWorkbench.config.schemaEditor.noConfiguredFieldsYet',
    'instances.detail.instanceWorkbench.config.schemaEditor.saferInRawMode',
    'instances.detail.instanceWorkbench.config.schemaEditor.schemaUnavailable',
    'instances.detail.instanceWorkbench.config.schemaEditor.invalidDraftForConfigMode',
    'instances.detail.instanceWorkbench.config.schemaEditor.dynamicPathsUseRawMode',
    'instances.detail.instanceWorkbench.config.schemaEditor.hiddenSensitiveValues',
    'instances.detail.instanceWorkbench.config.schemaEditor.noSettingsMatchSearch',
    'instances.detail.instanceWorkbench.config.schemaEditor.noSettingsAvailable',
  ];

  assert.doesNotMatch(editorSource, /(?:params|props)\.t\('',/);
  assert.doesNotMatch(editorSource, /[\p{Script=Han}]/u);
  for (const key of expectedLocaleKeys) {
    const entry = fallbackEntries.get(key);
    assert.ok(entry, `missing schemaEditor keyed fallback for ${key}`);
    assert.equal(entry.en, entry.zhFallback);

    const localeValue = getLocaleValue(zhLocale, key);
    assert.equal(typeof localeValue, 'string');
    assert.match(String(localeValue), /[\p{Script=Han}]/u);
    assert.doesNotMatch(String(localeValue), /\?{2,}|^\?/);
  }
});

runTest('sdkwork-claw-instances config workbench panel keeps clean fallback copy without runtime mojibake guards', () => {
  const panelSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchPanel.tsx',
  );
  const fallbackEntries = [...panelSource.matchAll(/\btr\('', '([^']+)', '([^']+)'/g)].map((match) => ({
    en: match[1],
    zh: match[2],
  }));

  assert.doesNotMatch(panelSource, /GARBLED_ZH_FALLBACK_PATTERN/);
  assert.doesNotMatch(panelSource, /resolveDefaultValue/);

  fallbackEntries.forEach(({ en, zh }) => {
    const isExplicitEnglishCarryover = zh === en || zh === 'Raw';
    const hasChineseCopy = /[\u4e00-\u9fff]/.test(zh);

    assert.ok(
      isExplicitEnglishCarryover || hasChineseCopy,
      `Expected clean zh fallback copy for "${en}", received "${zh}"`,
    );
  });
});

runTest('sdkwork-claw-instances raw config editor avoids strict JSON validation and calls out JSON5 support', () => {
  const rawPanelSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchRawPanel.tsx',
  );

  assert.match(rawPanelSource, /jsonDefaults\.setDiagnosticsOptions\(\{\s*validate:\s*false\s*\}\)/);
  assert.match(rawPanelSource, /Raw config \(JSON\/JSON5\)/);
});

runTest('sdkwork-claw-instances raw config editor protects sensitive values until explicitly revealed', () => {
  const rawPanelSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchRawPanel.tsx',
  );

  assert.match(rawPanelSource, /rawSensitiveVisible/);
  assert.match(rawPanelSource, /Hidden until you reveal sensitive values\./);
  assert.match(rawPanelSource, /Use reveal to inspect and edit the raw config\./);
});

runTest('sdkwork-claw-instances config workbench exposes a root settings overview before section detail', () => {
  const panelSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchPanel.tsx',
  );
  const overviewSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchOverview.tsx',
  );
  const presentationSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceConfigWorkbenchPresentation.ts',
  );

  assert.match(panelSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.navigation\.settingsTab/);
  assert.match(panelSource, /setActiveSectionKey\(null\)/);
  assert.match(panelSource, /InstanceConfigWorkbenchOverview/);
  assert.match(panelSource, /buildInstanceConfigOverviewMetrics/);
  assert.match(panelSource, /groupInstanceConfigSectionsByCategory/);
  assert.match(panelSource, /model\.sections\.filter\(\(section\) => !schemaSectionByKey\.has\(section\.key\)\)/);
  assert.match(overviewSource, /OpenClaw config overview/);
  assert.match(overviewSource, /Review section groups and jump into a specific area before editing\./);
  assert.match(overviewSource, /category\.sectionLabels\.map\(\(label\) => \(/);
  assert.match(presentationSource, /groupInstanceConfigSectionsByCategory/);
  assert.match(presentationSource, /buildInstanceConfigOverviewMetrics/);
  assert.match(panelSource, /computeInstanceConfigWorkbenchDiff\(/);
  assert.match(panelSource, /Custom sections/);
  assert.match(panelSource, /Raw lines/);
});

runTest('sdkwork-claw-instances config workbench keeps control-ui style config actions and status coverage', () => {
  const panelSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchPanel.tsx',
  );
  const navigationSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchConfigNavigation.tsx',
  );
  const toolbarSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchToolbar.tsx',
  );
  const diffSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchDiffPanel.tsx',
  );
  const serviceSource = [
    read('packages/sdkwork-claw-instances/src/services/instanceService.ts'),
    read('packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts'),
  ].join('\n');
  const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');

  assert.match(panelSource, /InstanceConfigWorkbenchToolbar/);
  assert.match(panelSource, /InstanceConfigWorkbenchDiffPanel/);
  assert.match(toolbarSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.toolbar\.open/);
  assert.match(toolbarSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.toolbar\.apply/);
  assert.match(toolbarSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.toolbar\.update/);
  assert.match(toolbarSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.toolbar\.noChanges/);
  assert.match(navigationSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.navigation\.invalidDraft/);
  assert.match(panelSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.metrics\.formCoverage/);
  assert.match(panelSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.metrics\.schemaVersion/);
  assert.match(panelSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.metrics\.schemaGenerated/);
  assert.match(toolbarSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.toolbar\.rawOnlyPaths/);
  assert.match(diffSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.diff\.title/);
  assert.match(diffSource, /formatDiffValuePreviewWithHints\(/);
  assert.match(diffSource, /countSensitiveConfigValues\(value, pathSegments, uiHints\) > 0/);
  assert.match(diffSource, /setActiveSectionKey\(entry\.sectionKey\)/);
  assert.match(diffSource, /availableSectionKeys\.has\(entry\.sectionKey\)/);
  assert.match(diffSource, /setActiveMode\('raw'\)/);

  assert.match(serviceSource, /openManagedOpenClawConfigFile/);
  assert.match(serviceSource, /applyManagedOpenClawConfigDocument/);
  assert.match(serviceSource, /runManagedOpenClawUpdate/);
  assert.match(serviceSource, /openClawGatewayClient\.openConfigFile/);
  assert.match(serviceSource, /openClawGatewayClient\.applyConfig/);
  assert.match(serviceSource, /openClawGatewayClient\.runUpdate/);
  assert.match(servicesIndexSource, /instanceConfigWorkbenchPresentation/);
});

runTest('sdkwork-claw-instances config workbench keeps navigation, section hero, and raw editor in dedicated focused components', () => {
  const panelSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchPanel.tsx',
  );
  const navigationSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchConfigNavigation.tsx',
  );
  const heroSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchSectionHero.tsx',
  );
  const rawPanelSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchRawPanel.tsx',
  );

  assert.match(panelSource, /InstanceConfigWorkbenchConfigNavigation/);
  assert.match(panelSource, /InstanceConfigWorkbenchSectionHero/);
  assert.match(panelSource, /InstanceConfigWorkbenchRawPanel/);
  assert.doesNotMatch(panelSource, /Search settings\.\.\./);
  assert.doesNotMatch(panelSource, /The current draft is invalid JSON5\./);
  assert.doesNotMatch(panelSource, /Hidden until you reveal sensitive values\./);
  assert.match(navigationSource, /Search settings\.\.\./);
  assert.match(navigationSource, /The current draft is invalid JSON5\./);
  assert.match(navigationSource, /Open Raw/);
  assert.match(navigationSource, /Dismiss/);
  assert.match(heroSource, /Config section/);
  assert.match(heroSource, /Custom section/);
  assert.match(heroSource, /Hide sensitive values/);
  assert.match(heroSource, /Reveal sensitive values/);
  assert.match(rawPanelSource, /Raw config \(JSON\/JSON5\)/);
  assert.match(rawPanelSource, /Hidden until you reveal sensitive values\./);
  assert.match(rawPanelSource, /Use reveal to inspect and edit the raw config\./);
  assert.match(rawPanelSource, /MonacoEditor/);
});
