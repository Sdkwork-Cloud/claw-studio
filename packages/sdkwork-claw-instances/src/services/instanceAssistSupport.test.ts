import assert from 'node:assert/strict';
import { supportsInstanceAssist } from './instanceAssistSupport.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('supportsInstanceAssist returns false for built-in OpenClaw instances', () => {
  assert.equal(
    supportsInstanceAssist({
      runtimeKind: 'openclaw',
      isBuiltIn: true,
    }),
    false,
  );
});

runTest('supportsInstanceAssist returns true for external OpenClaw instances', () => {
  assert.equal(
    supportsInstanceAssist({
      runtimeKind: 'openclaw',
      isBuiltIn: false,
    }),
    true,
  );
});

runTest('supportsInstanceAssist returns true for non-OpenClaw instances', () => {
  assert.equal(
    supportsInstanceAssist({
      runtimeKind: 'custom',
      isBuiltIn: true,
    }),
    true,
  );
});
