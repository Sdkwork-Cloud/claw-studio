import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('Channels page uses the full available workspace width', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'Channels.tsx'), 'utf8');

  assert.doesNotMatch(source, /mx-auto max-w-5xl/);
  assert.match(source, /w-full space-y-6/);
  assert.doesNotMatch(source, /text-3xl font-bold tracking-tight text-zinc-900/);
  assert.doesNotMatch(source, /t\('channels\.page\.title'\)/);
});
