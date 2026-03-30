import assert from 'node:assert/strict';
import { resolveInstanceFileWorkbenchEditorTheme } from './instanceFileWorkbenchTheme.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest('instanceFileWorkbenchTheme resolves Monaco theme from app theme mode and system preference', () => {
  assert.equal(resolveInstanceFileWorkbenchEditorTheme('light', true), 'vs');
  assert.equal(resolveInstanceFileWorkbenchEditorTheme('dark', false), 'vs-dark');
  assert.equal(resolveInstanceFileWorkbenchEditorTheme('system', true), 'vs-dark');
  assert.equal(resolveInstanceFileWorkbenchEditorTheme('system', false), 'vs');
});
