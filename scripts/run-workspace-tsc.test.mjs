import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = path.resolve(import.meta.dirname, 'run-workspace-tsc.mjs');
const moduleSource = readFileSync(modulePath, 'utf8');
const runner = await import(pathToFileURL(modulePath).href);

assert.equal(typeof runner.createWorkspaceTscPlan, 'function');
assert.equal(typeof runner.runWorkspaceTsc, 'function');

assert.match(
  moduleSource,
  /if \(result\.error\) \{\s*throw new Error\(`Failed to execute workspace TypeScript CLI: \$\{result\.error\.message\}`\);\s*\}/s,
  'run-workspace-tsc must surface spawn failures with a readable error message',
);

assert.match(
  moduleSource,
  /if \(result\.signal\) \{\s*throw new Error\(`Workspace TypeScript CLI exited with signal \$\{result\.signal\}`\);\s*\}/s,
  'run-workspace-tsc must surface signal exits with a readable error message',
);

assert.match(
  moduleSource,
  /if \(path\.resolve\(process\.argv\[1\] \?\? ''\) === __filename\) \{\s*try \{\s*main\(\);\s*\} catch \(error\) \{\s*console\.error\(error instanceof Error \? error\.message : String\(error\)\);\s*process\.exit\(1\);\s*\}\s*\}/s,
  'run-workspace-tsc must wrap the CLI entrypoint with a top-level error handler',
);

const plan = runner.createWorkspaceTscPlan({
  argv: ['--noEmit'],
  cwd: 'D:\\workspace\\claw-studio',
  execPath: 'node.exe',
});

assert.equal(plan.command, 'node.exe');
assert.equal(plan.cwd, 'D:\\workspace\\claw-studio');
assert.equal(plan.args.at(-1), '--noEmit');
assert.match(
  String(plan.args[0] ?? ''),
  /typescript[\\/]lib[\\/](?:_)?tsc\.js$/,
  'run-workspace-tsc must resolve the workspace TypeScript CLI before spawning it, including the TypeScript 6 _tsc.js entrypoint',
);

assert.equal(
  runner.runWorkspaceTsc({
    argv: ['--noEmit'],
    cwd: 'D:\\workspace\\claw-studio',
    execPath: 'node.exe',
    spawnSyncImpl(command, args, options) {
      assert.equal(command, 'node.exe');
      assert.equal(args.at(-1), '--noEmit');
      assert.equal(options.cwd, 'D:\\workspace\\claw-studio');
      assert.equal(options.stdio, 'inherit');
      return { status: 0 };
    },
  }),
  0,
  'run-workspace-tsc must return the child exit status on success',
);

assert.throws(
  () =>
    runner.runWorkspaceTsc({
      spawnSyncImpl() {
        return {
          error: new Error('spawn EPERM'),
        };
      },
    }),
  /Failed to execute workspace TypeScript CLI: spawn EPERM/,
  'run-workspace-tsc must surface child process spawn failures',
);

assert.throws(
  () =>
    runner.runWorkspaceTsc({
      spawnSyncImpl() {
        return {
          signal: 'SIGTERM',
        };
      },
    }),
  /Workspace TypeScript CLI exited with signal SIGTERM/,
  'run-workspace-tsc must surface child process signal exits',
);

console.log('ok - workspace tsc runner surfaces spawn failures and wraps the CLI entrypoint');
