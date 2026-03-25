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

runTest('sdkwork-claw-tasks is implemented locally instead of re-exporting claw-studio-tasks', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-tasks/package.json',
  );
  const indexSource = read('packages/sdkwork-claw-tasks/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-tasks/src/Tasks.tsx'));
  assert.ok(exists('packages/sdkwork-claw-tasks/src/components/GlobalTaskManager.tsx'));
  assert.ok(exists('packages/sdkwork-claw-tasks/src/store/useTaskStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-tasks/src/pages/Tasks.tsx'));
  assert.ok(exists('packages/sdkwork-claw-tasks/src/services/taskService.ts'));
  assert.ok(exists('packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-tasks']);
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-instances']);
  assert.equal(pkg.dependencies?.['@sdkwork/claw-core'], 'workspace:*');
  assert.equal(pkg.dependencies?.['@sdkwork/claw-commons'], 'workspace:*');
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-tasks/);
  assert.match(indexSource, /\.\/Tasks/);
  assert.match(indexSource, /\.\/components\/GlobalTaskManager/);
  assert.match(indexSource, /\.\/store\/useTaskStore/);
  assert.match(indexSource, /taskService/);
});

runTest('sdkwork-claw-tasks routes cron CRUD through the shared manager and the real studio bridge', () => {
  const serviceSource = read('packages/sdkwork-claw-core/src/services/taskService.ts');
  const pageSource = read('packages/sdkwork-claw-tasks/src/pages/Tasks.tsx');

  assert.match(serviceSource, /studio\.getInstanceDetail\(instanceId\)/);
  assert.match(serviceSource, /detail\?\.instance\.runtimeKind === 'openclaw'/);
  assert.match(serviceSource, /studio\.createInstanceTask\(/);
  assert.match(serviceSource, /studio\.updateInstanceTask\(/);
  assert.match(serviceSource, /studio\.cloneInstanceTask\(/);
  assert.match(serviceSource, /studio\.runInstanceTaskNow\(/);
  assert.match(serviceSource, /studio\.listInstanceTaskExecutions\(/);
  assert.match(serviceSource, /studio\.updateInstanceTaskStatus\(/);
  assert.match(serviceSource, /studio\.deleteInstanceTask\(/);
  assert.doesNotMatch(serviceSource, /fetch\('/);
  assert.doesNotMatch(serviceSource, /const tasksData/);

  assert.match(pageSource, /CronTasksManager/);
  assert.match(pageSource, /useInstanceStore/);
  assert.match(pageSource, /instanceId=\{activeInstanceId \?\? undefined\}/);
  assert.doesNotMatch(pageSource, /taskService\.getTasks\(activeInstanceId\)/);
  assert.doesNotMatch(pageSource, /taskService\.(createTask|create)\(activeInstanceId,/);
});

runTest('sdkwork-claw-tasks shared manager keeps the refined task workspace and card actions', () => {
  const managerSource = read('packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx');

  assert.match(managerSource, /buildTaskCreateWorkspaceState/);
  assert.match(managerSource, /buildTaskCardState/);
  assert.match(managerSource, /buildTaskFormValuesFromTask/);
  assert.match(managerSource, /buildCreateTaskInput/);
  assert.match(managerSource, /OverlaySurface/);
  assert.match(managerSource, /taskService\.cloneTask\(/);
  assert.match(managerSource, /taskService\.runTaskNow\(/);
  assert.match(managerSource, /taskService\.listTaskExecutions\(/);
  assert.match(managerSource, /taskService\.updateTask\(/);
  assert.match(managerSource, /taskService\.updateTaskStatus\(/);
  assert.match(managerSource, /taskService\.deleteTask\(/);
});

runTest('sdkwork-claw-tasks shared manager uses the shared task catalog surface', () => {
  const managerSource = read('packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx');

  assert.match(managerSource, /TaskCatalog/);
  assert.match(managerSource, /TaskExecutionHistoryDrawer/);
  assert.match(managerSource, /getTaskToggleStatusTarget/);
  assert.doesNotMatch(managerSource, /<TaskRow/);
});

runTest('sdkwork-claw-tasks shared manager binds cron agent selection to the connected instance catalog', () => {
  const managerSource = read('packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx');
  const coreServiceSource = read('packages/sdkwork-claw-core/src/services/openClawAgentCatalogService.ts');

  assert.match(managerSource, /openClawAgentCatalogService\.getCatalog\(activeInstanceId\)/);
  assert.match(managerSource, /buildTaskAgentSelectState/);
  assert.match(managerSource, /DEFAULT_TASK_AGENT_SELECT_VALUE/);
  assert.match(
    managerSource,
    /value === DEFAULT_TASK_AGENT_SELECT_VALUE \? '' : value/,
  );
  assert.match(managerSource, /agentIdDefaultOption/);
  assert.match(managerSource, /agentIdCatalogHelp/);
  assert.match(coreServiceSource, /readOpenClawConfigSnapshot\(configPath\)\.catch\(\(\) => null\)/);
  assert.match(coreServiceSource, /buildTaskAgentSelectState/);
});

runTest('sdkwork-claw-tasks shared manager uses compact label-control rows in the task editor', () => {
  const managerSource = read('packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx');

  assert.match(managerSource, /function renderCompactField\(/);
  assert.match(managerSource, /md:grid-cols-\[10rem,minmax\(0,1fr\)\]/);
  assert.match(
    managerSource,
    /renderCompactField\(\{\s*label:\s*t\('tasks\.page\.fields\.taskName'\)/,
  );
  assert.match(
    managerSource,
    /renderCompactField\(\{\s*label:\s*t\('tasks\.page\.fields\.timeoutSeconds'\)/,
  );
  assert.doesNotMatch(
    managerSource,
    /<Label className="mb-2 block">\{t\('tasks\.page\.fields\.taskName'\)\}<\/Label>/,
  );
});

runTest('sdkwork-claw-tasks ships readable zh task copy without mojibake placeholders', () => {
  const zh = readJson<{ tasks: { page: Record<string, unknown> } }>(
    'packages/sdkwork-claw-i18n/src/locales/zh.json',
  );
  const taskPage = zh.tasks.page as {
    title: string;
    subtitle: string;
    sections: { basicInfo: string; execution: string };
    fields: { prompt: string; executionContent: string };
    workspace: { scheduleTitle: string; deliveryTitle: string };
    toasts: { created: string };
    confirmDelete: string;
  };
  const serialized = JSON.stringify(taskPage);

  assert.equal(taskPage.title, '定时任务');
  assert.equal(taskPage.sections.basicInfo, '基本信息');
  assert.equal(taskPage.sections.execution, '执行设置');
  assert.equal(taskPage.fields.prompt, '提示词');
  assert.equal(taskPage.fields.executionContent, '执行内容');
  assert.equal(taskPage.workspace.scheduleTitle, '调度设置');
  assert.equal(taskPage.workspace.deliveryTitle, '结果交付');
  assert.equal(taskPage.toasts.created, '任务创建成功');
  assert.equal(taskPage.confirmDelete, '确认删除“{{name}}”吗？此操作不可恢复。');
  assert.doesNotMatch(serialized, /\uFFFD/);
  assert.doesNotMatch(serialized, /\?/);
  assert.doesNotMatch(serialized, /"Execution"/);
  assert.doesNotMatch(serialized, /"Prompt"/);
});
