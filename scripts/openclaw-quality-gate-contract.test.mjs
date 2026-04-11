import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const packageJson = readJson('package.json');

runTest('workspace lint compiles both web and desktop hosts before parity and automation gates', () => {
  assert.match(packageJson.scripts.lint, /pnpm --filter @sdkwork\/claw-web lint/);
  assert.match(packageJson.scripts.lint, /pnpm --filter @sdkwork\/claw-desktop lint/);
  assert.match(packageJson.scripts.lint, /pnpm check:arch/);
  assert.match(packageJson.scripts.lint, /pnpm check:parity/);
  assert.match(packageJson.scripts.lint, /pnpm check:automation/);
});

runTest('OpenClaw quality gate keeps fact-source tests in parity runners', () => {
  const foundationRunner = read('scripts/run-sdkwork-foundation-check.mjs');
  const instancesRunner = read('scripts/run-sdkwork-instances-check.mjs');
  const agentRunner = read('scripts/run-sdkwork-agent-check.mjs');
  const channelsRunner = read('scripts/run-sdkwork-channels-check.mjs');
  const marketRunner = read('scripts/run-sdkwork-market-check.mjs');

  assert.match(packageJson.scripts['check:parity'], /pnpm check:sdkwork-foundation/);
  assert.match(packageJson.scripts['check:parity'], /pnpm check:sdkwork-agent/);
  assert.match(packageJson.scripts['check:parity'], /pnpm check:sdkwork-channels/);
  assert.match(packageJson.scripts['check:parity'], /pnpm check:sdkwork-instances/);
  assert.match(packageJson.scripts['check:parity'], /pnpm check:sdkwork-market/);
  assert.match(
    packageJson.scripts['check:sdkwork-hosts'],
    /node scripts\/desktop-window-chrome-contract\.test\.mjs/,
    'check:sdkwork-hosts must execute the desktop tray and window chrome contract',
  );

  assert.match(
    packageJson.scripts['check:sdkwork-foundation'],
    /node scripts\/run-sdkwork-foundation-check\.mjs/,
    'check:sdkwork-foundation must execute the shared foundation runner',
  );
  assert.match(
    packageJson.scripts['check:sdkwork-agent'],
    /node scripts\/run-sdkwork-agent-check\.mjs/,
    'check:sdkwork-agent must execute the shared agent runner',
  );
  assert.match(
    packageJson.scripts['check:sdkwork-channels'],
    /node scripts\/run-sdkwork-channels-check\.mjs/,
    'check:sdkwork-channels must execute the shared channels runner',
  );
  assert.match(
    packageJson.scripts['check:sdkwork-instances'],
    /node scripts\/run-sdkwork-instances-check\.mjs/,
    'check:sdkwork-instances must execute the shared instances runner',
  );
  assert.match(
    packageJson.scripts['check:sdkwork-market'],
    /node scripts\/run-sdkwork-market-check\.mjs/,
    'check:sdkwork-market must execute the shared market runner',
  );

  assert.match(
    foundationRunner,
    /packages\/sdkwork-claw-infrastructure\/src\/platform\/webStudio\.test\.ts/,
    'foundation runner must execute webStudio fact-source coverage',
  );
  assert.match(
    agentRunner,
    /packages\/sdkwork-claw-agent\/src\/services\/agentInstallService\.test\.ts/,
    'agent runner must execute agentInstallService fact-source coverage',
  );
  assert.match(
    channelsRunner,
    /packages\/sdkwork-claw-channels\/src\/services\/channelService\.test\.ts/,
    'channels runner must execute channelService fact-source coverage',
  );
  assert.match(
    instancesRunner,
    /packages\/sdkwork-claw-instances\/src\/services\/openClawConfigSchemaSupport\.test\.ts/,
    'instances runner must execute config schema fact-source coverage',
  );
  assert.match(
    instancesRunner,
    /packages\/sdkwork-claw-instances\/src\/services\/openClawManagementCapabilities\.test\.ts/,
    'instances runner must execute management capabilities fact-source coverage',
  );
  assert.match(
    instancesRunner,
    /packages\/sdkwork-claw-instances\/src\/services\/openClawProviderWorkspacePresentation\.test\.ts/,
    'instances runner must execute provider workspace fact-source coverage',
  );
  assert.match(
    instancesRunner,
    /packages\/sdkwork-claw-instances\/src\/services\/instanceOnboardingService\.test\.ts/,
    'instances runner must execute OpenClaw onboarding association coverage',
  );
  assert.match(
    marketRunner,
    /packages\/sdkwork-claw-market\/src\/services\/marketService\.test\.ts/,
    'market runner must execute marketService fact-source coverage',
  );
  assert.match(
    packageJson.scripts['check:sdkwork-instances'],
    /node --experimental-strip-types scripts\/sdkwork-instances-contract\.test\.ts/,
    'check:sdkwork-instances must keep Instance Detail contract coverage in the formal gate',
  );
});
