import assert from 'node:assert/strict';
import { studioMockService } from '../services/index.ts';
import { WebStudioPlatform } from './webStudio.ts';

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('web studio maps main-session OpenClaw jobs without fabricated delivery', async () => {
  const platform = new WebStudioPlatform();
  const taskName = 'Web studio main session cron test';

  await platform.createInstanceTask('local-built-in', {
    name: taskName,
    description: 'Runs on the main session heartbeat.',
    enabled: true,
    schedule: {
      kind: 'cron',
      expr: '0 9 * * *',
    },
    sessionTarget: 'main',
    wakeMode: 'next-heartbeat',
    payload: {
      kind: 'systemEvent',
      text: 'Post a main-session reminder.',
    },
  });

  const created = (await studioMockService.listTasks('local-built-in')).find((task) => task.name === taskName);

  assert.ok(created);
  assert.equal(created.sessionMode, 'main');
  assert.equal(created.executionContent, 'sendPromptMessage');
  assert.equal(created.deliveryMode, 'none');
  assert.equal(created.deliveryChannel, undefined);
  assert.equal(created.recipient, undefined);
});

await runTest('web studio preserves advanced OpenClaw cron fields when mapping to mock tasks', async () => {
  const platform = new WebStudioPlatform();
  const original = await studioMockService.createTask('local-built-in', {
    name: 'Web studio advanced cron source',
    description: 'Created as a baseline task before OpenClaw-style update.',
    prompt: 'Baseline prompt.',
    schedule: '0 8 * * *',
    scheduleMode: 'cron',
    scheduleConfig: {
      cronExpression: '0 8 * * *',
    },
    cronExpression: '0 8 * * *',
    actionType: 'skill',
    status: 'active',
    sessionMode: 'isolated',
    wakeUpMode: 'immediate',
    executionContent: 'runAssistantTask',
    timeoutSeconds: 120,
    deliveryMode: 'publishSummary',
    deliveryChannel: 'telegram',
    recipient: 'channel:baseline',
  });

  await platform.updateInstanceTask('local-built-in', original.id, {
    name: 'Web studio advanced cron mapped',
    description: 'Uses a persistent custom session and webhook delivery.',
    enabled: false,
    deleteAfterRun: true,
    agentId: 'ops',
    schedule: {
      kind: 'cron',
      expr: '0 7 * * *',
      tz: 'Asia/Shanghai',
      staggerMs: 30000,
    },
    sessionTarget: 'session:project-alpha-monitor',
    wakeMode: 'now',
    payload: {
      kind: 'agentTurn',
      message: 'Summarize overnight updates.',
      model: 'openai/gpt-5.4',
      thinking: 'high',
      timeoutSeconds: 600,
      lightContext: true,
    },
    delivery: {
      mode: 'webhook',
      to: 'https://hooks.example.com/openclaw/cron',
      bestEffort: true,
    },
  });

  const updated = (await studioMockService.listTasks('local-built-in')).find((task) => task.id === original.id);

  assert.ok(updated);
  assert.equal(updated.name, 'Web studio advanced cron mapped');
  assert.equal(updated.status, 'paused');
  assert.equal(updated.sessionMode, 'custom');
  assert.equal(updated.customSessionId, 'project-alpha-monitor');
  assert.equal(updated.executionContent, 'runAssistantTask');
  assert.equal(updated.deleteAfterRun, true);
  assert.equal(updated.agentId, 'ops');
  assert.equal(updated.model, 'openai/gpt-5.4');
  assert.equal(updated.thinking, 'high');
  assert.equal(updated.lightContext, true);
  assert.equal(updated.deliveryMode, 'webhook');
  assert.equal(updated.deliveryBestEffort, true);
  assert.equal(updated.deliveryChannel, undefined);
  assert.equal(updated.recipient, 'https://hooks.example.com/openclaw/cron');
  assert.equal(updated.scheduleConfig.cronTimezone, 'Asia/Shanghai');
  assert.equal(updated.scheduleConfig.staggerMs, 30000);
});

await runTest('web studio maps current-session OpenClaw jobs without collapsing them to isolated', async () => {
  const platform = new WebStudioPlatform();
  const taskName = 'Web studio current session cron test';

  await platform.createInstanceTask('local-built-in', {
    name: taskName,
    description: 'Runs against the current session context.',
    enabled: true,
    schedule: {
      kind: 'cron',
      expr: '*/30 * * * *',
    },
    sessionTarget: 'current',
    wakeMode: 'now',
    payload: {
      kind: 'agentTurn',
      message: 'Check the current session context.',
      timeoutSeconds: 90,
    },
    delivery: {
      mode: 'announce',
      channel: 'telegram',
      to: 'channel:current-session',
      bestEffort: true,
    },
  });

  const created = (await studioMockService.listTasks('local-built-in')).find((task) => task.name === taskName);

  assert.ok(created);
  assert.equal(created.sessionMode, 'current');
  assert.equal(created.customSessionId, undefined);
  assert.equal(created.deliveryMode, 'publishSummary');
  assert.equal(created.deliveryBestEffort, true);
  assert.equal(created.deliveryChannel, 'telegram');
  assert.equal(created.recipient, 'channel:current-session');
});
