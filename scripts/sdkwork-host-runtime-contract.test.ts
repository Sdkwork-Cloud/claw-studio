import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-claw-web keeps the API-backed runtime server', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-web/package.json',
  );
  const source = read('packages/sdkwork-claw-web/server.ts');

  assert.equal(pkg.dependencies?.['sql.js'], '^1.11.0');
  assert.match(source, /const SQL = await initSqlJs\(/);
  assert.match(source, /app\.get\("\/api\/skills"/);
  assert.match(source, /app\.get\("\/api\/packs"/);
  assert.match(source, /app\.post\("\/api\/installations"/);
  assert.match(source, /const PORT = 3001/);
});

runTest('sdkwork-claw-desktop contains the Tauri runtime package surface', () => {
  const pkg = readJson<{ scripts?: Record<string, string> }>(
    'packages/sdkwork-claw-desktop/package.json',
  );

  assert.ok(exists('packages/sdkwork-claw-desktop/.env.example'));
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/Cargo.toml'));
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json'));
  assert.equal(pkg.scripts?.['dev:tauri'], 'vite --host 127.0.0.1 --port 1420');
});

runTest('sdkwork-claw-desktop wires install execution through a real Tauri command', () => {
  const bridgeSource = read('packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts');
  const commandsMod = read('packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs');
  const bootstrap = read('packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs');

  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/src/commands/execute_install_script.rs'));
  assert.doesNotMatch(
    bridgeSource,
    /Desktop installer runtime is not enabled in the base Tauri foundation\./,
  );
  assert.match(
    bridgeSource,
    /invoke<string>\('execute_install_script',\s*\{\s*command\s*\}\)/,
  );
  assert.match(commandsMod, /pub mod execute_install_script;/);
  assert.match(
    bootstrap,
    /commands::execute_install_script::execute_install_script/,
  );
});
