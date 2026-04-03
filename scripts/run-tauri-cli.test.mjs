import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createTauriCliPlan } from './run-tauri-cli.mjs';

const modulePath = path.resolve(import.meta.dirname, 'run-tauri-cli.mjs');

const defaultPlan = createTauriCliPlan({
  argv: ['dev'],
  env: {},
  platform: 'linux',
});

assert.equal(defaultPlan.command, 'tauri');
assert.deepEqual(defaultPlan.args, ['dev']);
assert.equal(defaultPlan.env.SDKWORK_VITE_MODE, 'development');

const testPlan = createTauriCliPlan({
  argv: ['dev', '--vite-mode', 'test', '--', '--target', 'x86_64-pc-windows-msvc'],
  env: {},
  platform: 'win32',
});

assert.equal(testPlan.command, 'tauri.cmd');
assert.deepEqual(testPlan.args, ['dev', '--', '--target', 'x86_64-pc-windows-msvc']);
assert.equal(testPlan.env.SDKWORK_VITE_MODE, 'test');
assert.throws(
  () => createTauriCliPlan({
    argv: ['build', '--vite-mode'],
    env: {},
    platform: 'linux',
  }),
  /Missing value for --vite-mode/,
);
assert.match(
  readFileSync(modulePath, 'utf8'),
  /if \(path\.resolve\(process\.argv\[1\] \?\? ''\) === __filename\) \{\s*try \{\s*runCli\(\);\s*\} catch \(error\) \{\s*console\.error\(error instanceof Error \? error\.message : String\(error\)\);\s*process\.exit\(1\);\s*\}\s*\}/s,
);

console.log('ok - tauri cli runner forwards vite mode through the tauri process environment');
