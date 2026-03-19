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

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-tasks']);
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-instances']);
  assert.equal(pkg.dependencies?.['@sdkwork/claw-core'], 'workspace:*');
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-tasks/);
  assert.match(indexSource, /\.\/Tasks/);
  assert.match(indexSource, /\.\/components\/GlobalTaskManager/);
  assert.match(indexSource, /\.\/store\/useTaskStore/);
  assert.match(indexSource, /taskService/);
});

runTest('sdkwork-claw-tasks keeps the V5 instance-aware task service and page wiring', () => {
  const serviceSource = read('packages/sdkwork-claw-tasks/src/services/taskService.ts');
  const pageSource = read('packages/sdkwork-claw-tasks/src/pages/Tasks.tsx');

  assert.match(
    serviceSource,
    /import\s+\{\s*studioMockService\s*\}\s+from\s+'@sdkwork\/claw-infrastructure'/,
  );
  assert.match(serviceSource, /getTasks\(instanceId: string\): Promise<Task\[]>/);
  assert.match(serviceSource, /studioMockService\.listTasks\(instanceId\)/);
  assert.match(serviceSource, /createTask\(instanceId: string, task: Omit<Task, 'id'>\): Promise<Task>/);
  assert.match(serviceSource, /studioMockService\.createTask\(instanceId, task\)/);
  assert.match(serviceSource, /studioMockService\.updateTaskStatus\(id, status\)/);
  assert.match(serviceSource, /studioMockService\.deleteTask\(id\)/);
  assert.doesNotMatch(serviceSource, /fetch\('/);
  assert.doesNotMatch(serviceSource, /const tasksData/);

  assert.match(pageSource, /useInstanceStore/);
  assert.match(pageSource, /const \{ activeInstanceId \} = useInstanceStore\(\)/);
  assert.match(pageSource, /taskService\.getTasks\(activeInstanceId\)/);
  assert.match(pageSource, /taskService\.(createTask|create)\(activeInstanceId,/);
});

runTest('sdkwork-claw-tasks page composes the refined task workspace and card actions', () => {
  const pageSource = read('packages/sdkwork-claw-tasks/src/pages/Tasks.tsx');

  assert.match(pageSource, /buildTaskCreateWorkspaceState/);
  assert.match(pageSource, /buildTaskCardState/);
  assert.match(pageSource, /buildTaskFormValuesFromTask/);
  assert.match(pageSource, /buildCreateTaskInput/);
  assert.match(pageSource, /OverlaySurface/);
  assert.match(pageSource, /taskService\.cloneTask\(/);
  assert.match(pageSource, /taskService\.runTaskNow\(/);
  assert.match(pageSource, /taskService\.listTaskExecutions\(/);
  assert.match(pageSource, /taskService\.updateTask\(/);
  assert.match(pageSource, /taskService\.updateTaskStatus\(/);
  assert.match(pageSource, /taskService\.deleteTask\(/);
});

runTest('sdkwork-claw-tasks page uses the shared task catalog surface', () => {
  const pageSource = read('packages/sdkwork-claw-tasks/src/pages/Tasks.tsx');

  assert.match(pageSource, /TaskCatalog/);
  assert.match(pageSource, /TaskExecutionHistoryDrawer/);
  assert.match(pageSource, /getTaskToggleStatusTarget/);
  assert.doesNotMatch(pageSource, /<TaskRow/);
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
