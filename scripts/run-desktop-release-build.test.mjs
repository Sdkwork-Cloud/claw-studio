import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');

test('desktop release build helper rejects missing CLI option values instead of silently falling back', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.parseArgs, 'function');
  assert.throws(
    () => helper.parseArgs(['--profile']),
    /Missing value for --profile/,
  );
  assert.throws(
    () => helper.parseArgs(['--target']),
    /Missing value for --target/,
  );
  assert.throws(
    () => helper.parseArgs(['--phase']),
    /Missing value for --phase/,
  );
  assert.throws(
    () => helper.parseArgs(['--vite-mode']),
    /Missing value for --vite-mode/,
  );
  assert.throws(
    () => helper.parseArgs(['--bundles']),
    /Missing value for --bundles/,
  );
});

test('desktop release build cli wraps the entrypoint with a top-level error handler', () => {
  const source = readFileSync(
    path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs'),
    'utf8',
  );

  assert.match(
    source,
    /if \(path\.resolve\(process\.argv\[1\] \?\? ''\) === __filename\) \{\s*try \{\s*runCli\(\);\s*\} catch \(error\) \{\s*console\.error\(error instanceof Error \? error\.message : String\(error\)\);\s*process\.exit\(1\);\s*\}\s*\}/s,
  );
});
