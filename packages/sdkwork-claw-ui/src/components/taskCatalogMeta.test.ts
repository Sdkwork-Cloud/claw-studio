import assert from 'node:assert/strict';
import {
  getTaskToggleStatusTarget,
  getTaskCatalogTone,
  getTaskExecutionBadgeTone,
  getTaskHistoryBadgeTone,
  getTaskPreview,
  getTaskStatusBadgeTone,
} from './taskCatalogMeta.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('getTaskCatalogTone promotes failed executions to the danger row state', () => {
  assert.equal(getTaskCatalogTone('active', 'failed'), 'danger');
  assert.equal(getTaskCatalogTone('paused', 'success'), 'paused');
  assert.equal(getTaskCatalogTone('active', 'success'), 'healthy');
});

runTest('task catalog badge helpers map task semantics to shared tones', () => {
  assert.equal(getTaskStatusBadgeTone('active'), 'success');
  assert.equal(getTaskStatusBadgeTone('paused'), 'warning');
  assert.equal(getTaskExecutionBadgeTone('runAssistantTask'), 'info');
  assert.equal(getTaskExecutionBadgeTone('sendPromptMessage'), 'neutral');
  assert.equal(getTaskHistoryBadgeTone('running'), 'warning');
});

runTest('task catalog status helper keeps failed tasks disableable when the runtime still marks them enabled', () => {
  assert.equal(getTaskToggleStatusTarget('active'), 'paused');
  assert.equal(getTaskToggleStatusTarget('paused'), 'active');
  assert.equal(getTaskToggleStatusTarget('failed'), 'paused');
});

runTest('getTaskPreview normalizes whitespace and truncates long content', () => {
  assert.equal(getTaskPreview('   hello   world   '), 'hello world');
  assert.equal(getTaskPreview('a'.repeat(10), 8), 'aaaaa...');
});
