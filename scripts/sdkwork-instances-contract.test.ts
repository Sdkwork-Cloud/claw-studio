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
  assert.ok(exists('packages/sdkwork-claw-instances/src/components/InstanceFileExplorer.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/components/InstanceLLMConfigPanel.tsx'));
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
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-instances/package.json',
  );

  assert.ok(pkg.dependencies?.['@monaco-editor/react']);
  assert.match(detailSource, /data-slot="instance-files-explorer"/);
  assert.match(detailSource, /data-slot="instance-files-editor"/);
  assert.match(detailSource, /@monaco-editor\/react/);
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
  assert.match(detailSource, /data-slot="instance-detail-capability-matrix"/);
  assert.match(detailSource, /data-slot="instance-detail-connectivity"/);
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

runTest('sdkwork-claw-instances prefers backend-authored openclaw workbench sections when available', () => {
  const serviceSource = read('packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts');

  assert.match(serviceSource, /detail\.workbench/);
  assert.match(serviceSource, /detail\.instance\.runtimeKind === 'openclaw'/);
  assert.match(serviceSource, /detail\.workbench\.[a-zA-Z]+/);
});

runTest('sdkwork-claw-instances routes openclaw cron actions through the studio bridge while keeping the task editor honest', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');
  const serviceSource = read('packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts');
  const studioContract = read('packages/sdkwork-claw-infrastructure/src/platform/contracts/studio.ts');
  const panelSource = read('packages/sdkwork-claw-instances/src/components/InstanceLLMConfigPanel.tsx');

  assert.match(studioContract, /cloneInstanceTask/);
  assert.match(studioContract, /runInstanceTaskNow/);
  assert.match(studioContract, /listInstanceTaskExecutions/);
  assert.match(studioContract, /updateInstanceTaskStatus/);
  assert.match(studioContract, /deleteInstanceTask/);
  assert.match(serviceSource, /studio\.cloneInstanceTask/);
  assert.match(serviceSource, /studio\.runInstanceTaskNow/);
  assert.match(serviceSource, /studio\.listInstanceTaskExecutions/);
  assert.match(serviceSource, /studio\.updateInstanceTaskStatus/);
  assert.match(serviceSource, /studio\.deleteInstanceTask/);
  assert.doesNotMatch(serviceSource, /OpenClaw managed cron task mutations are not wired yet/);
  assert.match(detailSource, /detail\?\.instance\.runtimeKind === 'openclaw'/);
  assert.match(detailSource, /data-slot="instance-openclaw-cron-editor-notice"/);
  assert.match(detailSource, /instanceWorkbench\.cronTasks\.editorNotice/);
  assert.match(detailSource, /isOpenClawTaskEditorPending/);
  assert.match(panelSource, /isReadonly: boolean;/);
  assert.match(panelSource, /readonlyMessage\?: string;/);
  assert.match(panelSource, /disabled=\{isReadonly\}/);
});
