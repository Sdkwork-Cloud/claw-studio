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

runTest('sdkwork-claw-web stays a Vite-only host without a business runtime server', () => {
  const pkg = readJson<{
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>(
    'packages/sdkwork-claw-web/package.json',
  );

  assert.equal(pkg.scripts?.dev, 'vite --host 0.0.0.0 --port 3001');
  assert.equal(pkg.dependencies?.express, undefined);
  assert.equal(pkg.dependencies?.['sql.js'], undefined);
  assert.equal(pkg.devDependencies?.tsx, undefined);
  assert.equal(exists('packages/sdkwork-claw-web/server.ts'), false);
});

runTest('sdkwork-claw-web bootstraps shell runtime before mounting the React tree', () => {
  const mainSource = read('packages/sdkwork-claw-web/src/main.tsx');

  assert.match(mainSource, /bootstrapShellRuntime/);
  assert.doesNotMatch(mainSource, /@sdkwork\/claw-i18n/);
  assert.match(
    mainSource,
    /await bootstrapShellRuntime\([\s\S]*?\);[\s\S]*createRoot\(document\.getElementById\('root'\)!\)\.render/,
  );
});

runTest('sdkwork-claw-desktop contains the Tauri runtime package surface', () => {
  const pkg = readJson<{ scripts?: Record<string, string> }>(
    'packages/sdkwork-claw-desktop/package.json',
  );

  assert.ok(exists('packages/sdkwork-claw-desktop/.env.example'));
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/Cargo.toml'));
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json'));
  assert.equal(pkg.scripts?.['dev:tauri'], 'vite --host 127.0.0.1 --port 1420 --strictPort');
});

runTest('sdkwork-claw-desktop bootstraps shell runtime before mounting the React tree', () => {
  const createDesktopAppSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/createDesktopApp.tsx',
  );
  const desktopBootstrapAppSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  );
  const connectDesktopRuntimeBody = desktopBootstrapAppSource.match(
    /const connectDesktopRuntime = useEffectEvent\(async \(\) => \{([\s\S]*?)\n  }\);/,
  )?.[1];

  assert.match(createDesktopAppSource, /<DesktopBootstrapApp/);
  assert.match(desktopBootstrapAppSource, /bootstrapShellRuntime/);
  assert.match(desktopBootstrapAppSource, /getAppInfo/);
  assert.doesNotMatch(desktopBootstrapAppSource, /@sdkwork\/claw-i18n/);
  assert.ok(connectDesktopRuntimeBody);
  assert.match(connectDesktopRuntimeBody, /getAppInfo\(/);
  assert.doesNotMatch(
    connectDesktopRuntimeBody,
    /getDesktopKernelInfo\(/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /await revealStartupWindow\(\);[\s\S]*await connectDesktopRuntime\(\);[\s\S]*await bootstrapShellRuntime\(\);[\s\S]*setShouldRenderShell\(true\)/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /shouldRenderShell \? \([\s\S]*<AppRoot \/>/,
  );
});

runTest('sdkwork-claw-desktop wires hub-installer execution through a real Tauri command and progress event', () => {
  const bridgeSource = read('packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts');
  const catalogSource = read('packages/sdkwork-claw-desktop/src/desktop/catalog.ts');
  const commandsMod = read('packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs');
  const bootstrap = read('packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs');
  const tauriConfig = read('packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json');

  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/src/commands/run_hub_install.rs'));
  assert.ok(
    exists(
      'packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/software-registry.yaml',
    ),
  );
  assert.doesNotMatch(
    bridgeSource,
    /Desktop installer runtime is not enabled in the base Tauri foundation\./,
  );
  assert.match(catalogSource, /runHubInstall:\s*'run_hub_install'/);
  assert.match(catalogSource, /hubInstallProgress:\s*'hub-installer:progress'/);
  assert.match(
    bridgeSource,
    /invokeDesktopCommand<HubInstallResult>\(\s*DESKTOP_COMMANDS\.runHubInstall,\s*\{\s*request\s*\}/,
  );
  assert.match(bridgeSource, /subscribeHubInstallProgress/);
  assert.match(commandsMod, /pub mod run_hub_install;/);
  assert.match(
    bootstrap,
    /commands::run_hub_install::run_hub_install/,
  );
  assert.match(tauriConfig, /vendor\/hub-installer\/registry/);
});
