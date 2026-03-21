import assert from 'node:assert/strict';
import {
  buildCreateTaskInput,
  createDefaultTaskFormValues,
  isTaskThinkingLevel,
} from './taskSchedule.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('isTaskThinkingLevel only accepts supported thinking levels', () => {
  assert.equal(isTaskThinkingLevel('high'), true);
  assert.equal(isTaskThinkingLevel('minimal'), true);
  assert.equal(isTaskThinkingLevel('inherit'), false);
  assert.equal(isTaskThinkingLevel(''), false);
});

runTest('buildCreateTaskInput preserves custom session and thinking selections', () => {
  const values = createDefaultTaskFormValues();

  values.name = 'Project monitor';
  values.prompt = 'Summarize overnight updates.';
  values.scheduleMode = 'cron';
  values.cronExpression = '0 7 * * *';
  values.sessionMode = 'custom';
  values.customSessionId = 'project-alpha-monitor';
  values.thinking = 'high';
  values.deliveryMode = 'webhook';
  values.recipient = 'https://hooks.example.com/openclaw/cron';

  const payload = buildCreateTaskInput(values);

  assert.equal(payload.sessionMode, 'custom');
  assert.equal(payload.customSessionId, 'project-alpha-monitor');
  assert.equal(payload.thinking, 'high');
  assert.equal(payload.deliveryMode, 'webhook');
  assert.equal(payload.recipient, 'https://hooks.example.com/openclaw/cron');
});
