import assert from 'node:assert/strict';
import { buildCommandPaletteCommands } from './commandPaletteCommands.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('buildCommandPaletteCommands includes the v3 command palette navigation entries', () => {
  const navigateCalls: string[] = [];
  const commands = buildCommandPaletteCommands({
    instances: [],
    navigate(path) {
      navigateCalls.push(path);
    },
    setActiveInstanceId() {},
  });

  const appsCommand = commands.find((command) => command.id === 'nav-apps');
  const settingsCommand = commands.find((command) => command.id === 'nav-settings');
  const accountCommand = commands.find((command) => command.id === 'nav-account');
  const extensionsCommand = commands.find((command) => command.id === 'nav-extensions');

  assert.ok(appsCommand);
  assert.equal(appsCommand.title, 'Go to App Store');
  assert.ok(settingsCommand);
  assert.equal(settingsCommand.title, 'Go to Settings');
  assert.equal(accountCommand, undefined);
  assert.equal(extensionsCommand, undefined);

  appsCommand.action();
  settingsCommand.action();

  assert.deepEqual(navigateCalls, ['/apps', '/settings']);
});

await runTest('buildCommandPaletteCommands exposes instance switch actions', () => {
  let activeInstanceId: string | null = null;
  const commands = buildCommandPaletteCommands({
    instances: [
      { id: 'inst-1', name: 'Alpha', ip: '192.168.0.10', status: 'online' },
      { id: 'inst-2', name: 'Beta', ip: '192.168.0.20', status: 'offline' },
    ],
    navigate() {},
    setActiveInstanceId(id) {
      activeInstanceId = id;
    },
  });

  const instanceCommands = commands.filter((command) => command.category === 'Instances');

  assert.equal(instanceCommands.length, 2);
  assert.equal(instanceCommands[0].title, 'Switch Instance: Alpha');
  assert.equal(instanceCommands[0].subtitle, '192.168.0.10 • online');
  assert.equal(instanceCommands[1].title, 'Switch Instance: Beta');

  instanceCommands[1].action();

  assert.equal(activeInstanceId, 'inst-2');
});
