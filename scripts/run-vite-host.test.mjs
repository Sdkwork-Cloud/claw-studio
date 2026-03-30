import assert from 'node:assert/strict';

import { createViteHostPlan } from './run-vite-host.mjs';

const servePlan = createViteHostPlan({
  argv: ['serve', '--host', '0.0.0.0', '--port', '3001'],
  env: {},
  platform: 'linux',
});

assert.equal(servePlan.command, 'vite');
assert.deepEqual(servePlan.args, ['serve', '--mode', 'development', '--host', '0.0.0.0', '--port', '3001']);
assert.equal(servePlan.env.SDKWORK_VITE_MODE, 'development');

const buildPlan = createViteHostPlan({
  argv: ['build'],
  env: {},
  platform: 'linux',
});

assert.equal(buildPlan.command, 'vite');
assert.deepEqual(buildPlan.args, ['build', '--mode', 'production']);
assert.equal(buildPlan.env.SDKWORK_VITE_MODE, 'production');

const explicitModePlan = createViteHostPlan({
  argv: ['build', '--mode', 'test'],
  env: { SDKWORK_VITE_MODE: 'production' },
  platform: 'win32',
});

assert.equal(explicitModePlan.command, 'vite.cmd');
assert.deepEqual(explicitModePlan.args, ['build', '--mode', 'test']);
assert.equal(explicitModePlan.env.SDKWORK_VITE_MODE, 'test');

console.log('ok - vite host runner resolves explicit and default modes for serve and build commands');
