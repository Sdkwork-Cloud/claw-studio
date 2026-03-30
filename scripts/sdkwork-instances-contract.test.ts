import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const instanceDetailBadgeDescriptorsModuleUrl = pathToFileURL(
  path.join(root, 'packages/sdkwork-claw-instances/src/pages/instanceDetailBadgeDescriptors.ts'),
).href;
const instanceAssistSupportModuleUrl = pathToFileURL(
  path.join(root, 'packages/sdkwork-claw-instances/src/services/instanceAssistSupport.ts'),
).href;
const { buildInstanceDetailBadgeDescriptors } =
  (await import(instanceDetailBadgeDescriptorsModuleUrl)) as typeof import('../packages/sdkwork-claw-instances/src/pages/instanceDetailBadgeDescriptors');
const { supportsInstanceAssist } =
  (await import(instanceAssistSupportModuleUrl)) as typeof import('../packages/sdkwork-claw-instances/src/services/instanceAssistSupport');

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
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
  assert.match(indexSource, /instanceService/);
  assert.match(indexSource, /instanceWorkbenchService/);
  assert.match(indexSource, /useInstanceStore/);
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

runTest('sdkwork-claw-instances blocks built-in OpenClaw assist activation from instance list and detail', () => {
  const listSource = read('packages/sdkwork-claw-instances/src/pages/Instances.tsx');
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const typesSource = read('packages/sdkwork-claw-instances/src/types/index.ts');
  const serviceSource = read('packages/sdkwork-claw-instances/src/services/instanceAssistSupport.ts');

  assert.equal(supportsInstanceAssist({ runtimeKind: 'openclaw', isBuiltIn: true }), false);
  assert.equal(supportsInstanceAssist({ runtimeKind: 'openclaw', isBuiltIn: false }), true);
  assert.equal(supportsInstanceAssist({ runtimeKind: 'custom', isBuiltIn: true }), true);
  assert.match(typesSource, /supportsAssist:\s*boolean/);
  assert.match(serviceSource, /runtimeKind === 'openclaw'/);
  assert.match(serviceSource, /instance\.isBuiltIn/);
  assert.match(listSource, /instance\.supportsAssist/);
  assert.match(listSource, /activeInstanceId === instance\.id && !instance\.supportsAssist/);
  assert.match(detailSource, /instance\.supportsAssist/);
  assert.match(detailSource, /activeInstanceId === instance\.id && !instance\.supportsAssist/);
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
  const agentPanelSource = read(
    'packages/sdkwork-claw-instances/src/components/AgentWorkbenchPanel.tsx',
  );
  const detailSectionsSource = read(
    'packages/sdkwork-claw-instances/src/components/AgentWorkbenchDetailSections.tsx',
  );
  const explorerSource = read('packages/sdkwork-claw-instances/src/components/InstanceFileExplorer.tsx');
  const sharedWorkbenchSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceFileWorkbench.tsx',
  );
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-instances/package.json',
  );
  const filesSectionSource = extractBetween(
    detailSource,
    'const renderFilesSection = () => {',
    'const renderMemorySection = () => {',
  );

  assert.ok(pkg.dependencies?.['@monaco-editor/react']);
  assert.match(detailSource, /InstanceFileWorkbench/);
  assert.match(detailSectionsSource, /InstanceFileWorkbench/);
  assert.match(sharedWorkbenchSource, /data-slot="instance-files-explorer"/);
  assert.match(sharedWorkbenchSource, /data-slot="instance-files-editor"/);
  assert.match(sharedWorkbenchSource, /@monaco-editor\/react/);
  assert.match(filesSectionSource, /data-slot="instance-files-agent-select"/);
  assert.match(detailSource, /const fileWorkbench = activeSection === 'files' \? selectedAgentWorkbench : null;/);
  assert.match(detailSource, /const visibleFiles = fileWorkbench\?\.files \?\? EMPTY_WORKBENCH_FILES;/);
  assert.match(detailSource, /onSaveFile=\{handleSaveWorkbenchFile\}/);
  assert.match(agentPanelSource, /onSaveFile:/);
  assert.doesNotMatch(filesSectionSource, /gatewayProfile/);
  assert.doesNotMatch(filesSectionSource, /runtimeArtifactsDescription/);
  assert.match(explorerSource, /data-slot="instance-files-list"/);
  assert.match(explorerSource, /resolveRelativeFilePath/);
  assert.doesNotMatch(explorerSource, /data-node-kind="directory"/);
  assert.doesNotMatch(explorerSource, /ChevronDown|ChevronRight|FolderOpen|Folder/);
  assert.doesNotMatch(detailSource, /instanceWorkbench\.sidebar\.title/);
  assert.doesNotMatch(detailSource, /instanceWorkbench\.sidebar\.description/);
  assert.match(detailSource, /activeSection !== 'files' \? \(/);
});

runTest('sdkwork-claw-instances uses viewport-adaptive height and tabbed editing for the files workspace', () => {
  const sharedWorkbenchSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceFileWorkbench.tsx',
  );

  assert.match(sharedWorkbenchSource, /const \[openFileIds, setOpenFileIds\] = useState<string\[\]>\(\[\]\);/);
  assert.match(sharedWorkbenchSource, /data-slot="instance-files-tabs"/);
  assert.match(sharedWorkbenchSource, /data-slot="instance-files-tab"/);
  assert.match(sharedWorkbenchSource, /h-\[max\(42rem,calc\(100vh-18rem\)\)\]/);
  assert.match(sharedWorkbenchSource, /overflow-x-auto/);
  assert.doesNotMatch(sharedWorkbenchSource, /selectedFileRelativePath \|\| selectedFile\.name/);
  assert.match(sharedWorkbenchSource, /path=\{selectedFile\.path\}/);
  assert.match(sharedWorkbenchSource, /saveViewState/);
});

runTest('sdkwork-claw-instances reuses a shared OpenClaw skill workspace in both instance and agent views', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const agentDetailSectionsSource = read(
    'packages/sdkwork-claw-instances/src/components/AgentWorkbenchDetailSections.tsx',
  );
  const sharedSkillWorkspaceSource = read(
    'packages/sdkwork-claw-instances/src/components/OpenClawSkillWorkspace.tsx',
  );
  const skillModelSource = read(
    'packages/sdkwork-claw-instances/src/components/openClawSkillWorkspaceModel.ts',
  );

  assert.ok(exists('packages/sdkwork-claw-instances/src/components/OpenClawSkillWorkspace.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/components/openClawSkillWorkspaceModel.ts'));
  assert.match(detailSource, /OpenClawSkillWorkspace/);
  assert.match(agentDetailSectionsSource, /OpenClawSkillWorkspace/);
  assert.match(detailSource, /!\['agents', 'files', 'skills'\]\.includes\(activeSection\)/);
  assert.match(sharedSkillWorkspaceSource, /data-slot="openclaw-skill-workspace"/);
  assert.match(sharedSkillWorkspaceSource, /skillConfigDialog/);
  assert.match(sharedSkillWorkspaceSource, /sharedConfigScopeNotice/);
  assert.match(skillModelSource, /buildOpenClawSkillConfigDraft/);
  assert.match(skillModelSource, /normalizeOpenClawSkillEnvEntries/);
});

runTest('sdkwork-claw-instances keeps explorer clicks and tab clicks on the same file activation state machine', () => {
  const sharedWorkbenchSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceFileWorkbench.tsx',
  );
  const workspaceStateSource = read(
    'packages/sdkwork-claw-instances/src/pages/instanceFileWorkspaceState.ts',
  );

  assert.match(sharedWorkbenchSource, /activateWorkbenchFile/);
  assert.match(sharedWorkbenchSource, /syncWorkbenchFileSelection/);
  assert.match(sharedWorkbenchSource, /onSelectFile=\{handleOpenFileTab\}/);
  assert.match(sharedWorkbenchSource, /onClick=\{\(\) => handleOpenFileTab\(file\.id\)\}/);
  assert.match(workspaceStateSource, /export function activateWorkbenchFile/);
  assert.match(workspaceStateSource, /export function syncWorkbenchFileSelection/);
  assert.match(workspaceStateSource, /nextSelectedFileId && !nextOpenFileIds\.includes\(nextSelectedFileId\)/);
});

runTest('sdkwork-claw-instances uses path-aware OpenClaw file ids so same-name files do not alias each other in the editor', () => {
  const supportSource = read('packages/sdkwork-claw-instances/src/services/openClawSupport.ts');
  const agentWorkbenchSource = read('packages/sdkwork-claw-instances/src/services/agentWorkbenchService.ts');
  const instanceWorkbenchSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts',
  );

  assert.match(supportSource, /export function buildOpenClawAgentFileId\(agentId: string, name: string, path\?: string \| null\)/);
  assert.match(supportSource, /return `\$\{OPENCLAW_AGENT_FILE_ID_PREFIX\}\$\{encodedAgentId\}:\$\{encodedName\}:\$\{encodeURIComponent\(normalizedPath\)\}`;/);
  assert.match(supportSource, /path: encodedPath \? decodeURIComponent\(encodedPath\) : null/);
  assert.match(agentWorkbenchSource, /buildOpenClawAgentFileId\(agent\.agent\.id, name, normalizedPath\)/);
  assert.match(instanceWorkbenchSource, /buildOpenClawAgentFileId\(agent\.agent\.id, name, path\)/);
});

runTest('sdkwork-claw-instances styles the file tabs like an editor strip and exposes a tab context menu', () => {
  const sharedWorkbenchSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceFileWorkbench.tsx',
  );

  assert.match(sharedWorkbenchSource, /const \[tabContextMenu, setTabContextMenu\] = useState/);
  assert.match(
    sharedWorkbenchSource,
    /scrollIntoView\(\{\s*block: 'nearest',\s*inline: 'nearest',\s*behavior: 'smooth',?\s*\}\)/,
  );
  assert.match(sharedWorkbenchSource, /data-slot="instance-files-tab-context-menu"/);
  assert.match(sharedWorkbenchSource, /onContextMenu=\{\(event\) =>/);
  assert.match(sharedWorkbenchSource, /\[scrollbar-width:none\]/);
  assert.match(sharedWorkbenchSource, /\[&::\-webkit-scrollbar\]:hidden/);
  assert.match(sharedWorkbenchSource, /Close Others|Close Right|Close All/);
  assert.match(sharedWorkbenchSource, /Copy Relative Path|Copy Workspace Path/);
  assert.match(sharedWorkbenchSource, /navigator\.clipboard\.writeText/);
});

runTest('sdkwork-claw-instances exposes left and right tab overflow navigation controls', () => {
  const sharedWorkbenchSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceFileWorkbench.tsx',
  );

  assert.match(sharedWorkbenchSource, /const handleTabStripStepScroll = \(direction: 'left' \| 'right'\)/);
  assert.match(sharedWorkbenchSource, /data-slot="instance-files-tab-scroll-left"/);
  assert.match(sharedWorkbenchSource, /data-slot="instance-files-tab-scroll-right"/);
  assert.match(sharedWorkbenchSource, /ChevronLeft/);
  assert.match(sharedWorkbenchSource, /ChevronRight/);
  assert.match(sharedWorkbenchSource, /disabled=\{!tabStripOverflow\.canScrollLeft\}/);
  assert.match(sharedWorkbenchSource, /disabled=\{!tabStripOverflow\.canScrollRight\}/);
});

runTest('sdkwork-claw-instances loads agent workbench data for agent, skill, and file surfaces', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');

  assert.match(detailSource, /!\['agents', 'files', 'skills'\]\.includes\(activeSection\)/);
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

runTest('sdkwork-claw-instances exposes the OpenClaw console browser action in the instance detail header row', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const headerActionsSource = extractBetween(
    detailSource,
    '<div className="flex flex-wrap gap-3">',
    '<div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">',
  );
  const managementSummarySource = extractBetween(
    detailSource,
    'data-slot="instance-detail-management-summary"',
    'data-slot="instance-detail-connectivity"',
  );

  assert.match(detailSource, /const handleOpenOpenClawConsole = async \(\) => \{/);
  assert.match(detailSource, /await openExternalUrl\(targetUrl\);/);
  assert.match(detailSource, /data-slot="instance-detail-management-summary"[\s\S]*handleOpenOpenClawConsole/);
  assert.match(
    detailSource,
    /data-slot="instance-detail-openclaw-console-action"[\s\S]*instances\.detail\.actions\.openOpenClawConsole/,
  );
  assert.match(
    headerActionsSource,
    /instances\.detail\.actions\.openOpenClawConsole/,
  );
  assert.equal(
    [...detailSource.matchAll(/instances\.detail\.actions\.openOpenClawConsole/g)].length,
    1,
  );
  assert.doesNotMatch(managementSummarySource, /instance-detail-openclaw-console-action/);
});

runTest('sdkwork-claw-instances adds an instance-native LLM provider workspace with editable config chrome', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const panelSource = read('packages/sdkwork-claw-instances/src/components/InstanceLLMConfigPanel.tsx');

  assert.match(detailSource, /data-slot="instance-llm-provider-list"/);
  assert.match(panelSource, /data-slot="instance-llm-config-panel"/);
  assert.match(panelSource, /defaultModelId/);
  assert.match(panelSource, /temperature/);
  assert.match(panelSource, /maxTokens/);
});

runTest('sdkwork-claw-instances aggregates instance-native runtime surfaces through a dedicated workbench service', () => {
  const serviceSource = read('packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts');

  assert.match(serviceSource, /getInstanceDetail/);
  assert.match(serviceSource, /getInstance/);
  assert.match(serviceSource, /getInstanceConfig/);
  assert.match(serviceSource, /getInstanceToken/);
  assert.match(serviceSource, /getInstanceLogs/);
  assert.match(serviceSource, /listChannels/);
  assert.match(serviceSource, /listTasks/);
  assert.match(serviceSource, /listInstalledSkills/);
  assert.match(serviceSource, /listAgents/);
  assert.match(serviceSource, /listInstanceFiles/);
  assert.match(serviceSource, /listInstanceLlmProviders/);
  assert.match(serviceSource, /listInstanceMemories/);
  assert.match(serviceSource, /listInstanceTools/);
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
  const serviceSource = read('packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts');

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
  const serviceSource = read('packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts');

  assert.match(serviceSource, /detail\.workbench/);
  assert.match(serviceSource, /detail\.instance\.runtimeKind === 'openclaw'/);
  assert.match(serviceSource, /detail\.workbench\.[a-zA-Z]+/);
});

runTest('sdkwork-claw-instances reuses the shared cron manager and keeps OpenClaw cron CRUD fully editable', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const serviceSource = read('packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts');
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

runTest('sdkwork-claw-instances keeps local-external OpenClaw editable through the discovered config file instead of locking the workbench', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const instanceServiceSource = read('packages/sdkwork-claw-instances/src/services/instanceService.ts');
  const workbenchSource = read('packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts');

  assert.match(detailSource, /Dialog(Content|Header|Footer|Title|Description)?/);
  assert.match(detailSource, /ChannelCatalog/);
  assert.match(detailSource, /managedFile/);
  assert.doesNotMatch(detailSource, /isReadonly=\{isOpenClawWorkbench\}/);
  assert.doesNotMatch(detailSource, /if \(isOpenClawWorkbench \|\| !selectedProvider/);

  assert.match(instanceServiceSource, /openClawConfigService/);
  assert.doesNotMatch(instanceServiceSource, /studioMockService\.updateInstanceLlmProviderConfig/);
  assert.match(instanceServiceSource, /detail\.lifecycle\.configWritable/);

  assert.match(workbenchSource, /openClawConfigService/);
  assert.match(workbenchSource, /resolveInstanceConfigPath/);
  assert.match(workbenchSource, /detail\.dataAccess/);
});

runTest('sdkwork-claw-instances exposes real OpenClaw provider and agent CRUD controls inside instance detail', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const instanceServiceSource = read('packages/sdkwork-claw-instances/src/services/instanceService.ts');
  const workbenchSource = read('packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts');

  assert.match(detailSource, /openCreateProviderDialog/);
  assert.match(detailSource, /openCreateProviderModelDialog/);
  assert.match(detailSource, /handleSubmitProviderDialog/);
  assert.match(detailSource, /handleSubmitProviderModelDialog/);
  assert.match(detailSource, /handleDeleteProviderModel/);
  assert.match(detailSource, /handleDeleteProvider/);
  assert.match(detailSource, /instances\.detail\.instanceWorkbench\.llmProviders\.panel\.newProvider/);
  assert.match(detailSource, /instances\.detail\.instanceWorkbench\.llmProviders\.panel\.providerModelsTitle/);
  assert.match(detailSource, /instances\.detail\.instanceWorkbench\.llmProviders\.deleteProviderDialog\.title/);
  assert.match(detailSource, /instances\.detail\.instanceWorkbench\.llmProviders\.deleteModelDialog\.title/);
  assert.match(detailSource, /instances\.detail\.instanceWorkbench\.agents\.deleteDialog\.title/);
  assert.match(detailSource, /onEditAgent=\{openEditAgentDialog\}/);
  assert.match(instanceServiceSource, /createInstanceLlmProvider/);
  assert.match(instanceServiceSource, /updateInstanceLlmProviderModel/);
  assert.match(instanceServiceSource, /deleteInstanceLlmProviderModel/);
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
  assert.match(detailSource, /disabled=\{!isOpenClawConfigWritable\}/);
  assert.match(panelSource, /instances\.detail\.instanceWorkbench\.agents\.marketReadonlyNotice/);
});

runTest('sdkwork-claw-instances turns agents into a master-detail workbench backed by an agent-scoped service', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const panelSource = read('packages/sdkwork-claw-instances/src/components/AgentWorkbenchPanel.tsx');
  const detailSectionsSource = read(
    'packages/sdkwork-claw-instances/src/components/AgentWorkbenchDetailSections.tsx',
  );
  const serviceSource = read('packages/sdkwork-claw-instances/src/services/agentWorkbenchService.ts');

  assert.match(detailSource, /AgentWorkbenchPanel/);
  assert.match(detailSource, /selectedAgentId/);
  assert.match(detailSource, /agentWorkbenchService\.getAgentWorkbench/);
  assert.match(panelSource, /data-slot="agent-workbench-sidebar"/);
  assert.match(panelSource, /data-slot="agent-workbench-detail"/);
  assert.match(detailSectionsSource, /data-slot="agent-workbench-files"/);
  assert.match(serviceSource, /authProfilesPath/);
  assert.match(serviceSource, /modelsRegistryPath/);
  assert.match(serviceSource, /sessionsPath/);
  assert.match(serviceSource, /routeStatus/);
});

runTest('sdkwork-claw-instances keeps the agent detail area focused on tabs instead of a duplicated hero block', () => {
  const panelSource = read('packages/sdkwork-claw-instances/src/components/AgentWorkbenchPanel.tsx');
  const detailShellSource = extractBetween(
    panelSource,
    '<div data-slot="agent-workbench-detail" className="space-y-5">',
    '<AgentWorkbenchDetailSections',
  );

  assert.match(detailShellSource, /agentWorkbenchTabIds\.map/);
  assert.match(detailShellSource, /onClick=\{\(\) => onEditAgent\(selectedAgentRecord\)\}/);
  assert.match(detailShellSource, /onClick=\{\(\) => onDeleteAgent\(snapshot\.agent\.agent\.id\)\}/);
  assert.doesNotMatch(detailShellSource, /snapshot\.agent\.agent\.description/);
  assert.doesNotMatch(detailShellSource, /snapshot\.agent\.focusAreas\.map/);
  assert.doesNotMatch(detailShellSource, /text-2xl font-semibold tracking-tight/);
});

runTest('sdkwork-claw-instances reuses one shared file workbench component for instance and agent file views', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const detailSectionsSource = read(
    'packages/sdkwork-claw-instances/src/components/AgentWorkbenchDetailSections.tsx',
  );
  const sharedWorkbenchSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceFileWorkbench.tsx',
  );

  assert.match(detailSource, /InstanceFileWorkbench/);
  assert.match(detailSectionsSource, /InstanceFileWorkbench/);
  assert.match(sharedWorkbenchSource, /data-slot="instance-files-explorer"/);
  assert.match(sharedWorkbenchSource, /data-slot="instance-files-editor"/);
  assert.match(sharedWorkbenchSource, /data-slot="instance-files-tabs"/);
  assert.match(sharedWorkbenchSource, /MonacoEditor/);
  assert.match(sharedWorkbenchSource, /activateWorkbenchFile/);
  assert.match(sharedWorkbenchSource, /syncWorkbenchFileSelection/);
  assert.doesNotMatch(detailSectionsSource, /InstanceFileExplorer/);
});

runTest('sdkwork-claw-instances gives agent skills an official workspace-scoped install guide and richer status metadata', () => {
  const sharedSkillWorkspaceSource = read(
    'packages/sdkwork-claw-instances/src/components/OpenClawSkillWorkspace.tsx',
  );
  const serviceSource = read('packages/sdkwork-claw-instances/src/services/agentWorkbenchService.ts');

  assert.match(sharedSkillWorkspaceSource, /openclaw skills install/);
  assert.match(
    sharedSkillWorkspaceSource,
    /return `cd "\$\{target\}"\\nopenclaw skills install \$\{normalizedSlug\}`;/,
  );
  assert.match(sharedSkillWorkspaceSource, /navigator\.clipboard\.writeText/);
  assert.match(sharedSkillWorkspaceSource, /skill\.scope/);
  assert.match(sharedSkillWorkspaceSource, /skill\.eligible/);
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
