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
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-tasks/package.json');
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

  assert.match(serviceSource, /getTasks\(instanceId: string\): Promise<Task\[]>/);
  assert.match(serviceSource, /fetch\(`\/api\/instances\/\$\{instanceId\}\/tasks`\)/);
  assert.match(serviceSource, /createTask\(instanceId: string, task: Omit<Task, 'id'>\): Promise<Task>/);
  assert.match(serviceSource, /fetch\(`\/api\/instances\/\$\{instanceId\}\/tasks`,\s*\{\s*method:\s*'POST'/);
  assert.match(serviceSource, /fetch\(`\/api\/tasks\/\$\{id\}\/status`,\s*\{\s*method:\s*'PUT'/);
  assert.match(serviceSource, /fetch\(`\/api\/tasks\/\$\{id\}`,\s*\{\s*method:\s*'DELETE'/);
  assert.doesNotMatch(serviceSource, /const tasksData/);

  assert.match(pageSource, /useInstanceStore/);
  assert.match(pageSource, /const \{ activeInstanceId \} = useInstanceStore\(\)/);
  assert.match(pageSource, /taskService\.getTasks\(activeInstanceId\)/);
  assert.match(pageSource, /taskService\.createTask\(activeInstanceId,/);
});
