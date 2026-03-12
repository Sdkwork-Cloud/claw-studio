import assert from 'node:assert/strict';
import { taskService } from './taskService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('getList returns the seeded v3 task list', async () => {
  const result = await taskService.getList({ page: 1, pageSize: 10 });

  assert.equal(result.total, 2);
  assert.equal(result.items[0]?.name, 'Daily System Check');
});

await runTest('create delegates to createTask and assigns the next run like the v3 backend', async () => {
  const task = await taskService.create({
    name: 'Hourly Summary',
    schedule: '0 * * * *',
    actionType: 'message',
    status: 'active',
  });

  assert.match(task.id, /^task-/);
  assert.equal(task.nextRun, 'In 5 minutes');
});

await runTest('updateTaskStatus and deleteTask persist state changes', async () => {
  await taskService.updateTaskStatus('task-2', 'active');
  assert.equal((await taskService.getById('task-2'))?.status, 'active');

  const created = await taskService.createTask({
    name: 'Cleanup',
    schedule: '0 12 * * *',
    actionType: 'skill',
    status: 'paused',
  });

  await taskService.deleteTask(created.id);

  const tasks = await taskService.getTasks();
  assert.equal(tasks.some((task) => task.id === created.id), false);
});
