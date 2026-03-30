import assert from 'node:assert/strict';
import { buildCommandPaletteCommands } from './commandPaletteCommands.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

const identityTranslate = (key: string) => key;

await runTest(
  'buildCommandPaletteCommands excludes navigation commands for hidden sidebar modules',
  () => {
    const commands = buildCommandPaletteCommands({
      instances: [],
      hiddenSidebarItems: ['apps', 'mall', 'api-router'],
      navigate: () => {},
      setActiveInstanceId: () => {},
      t: identityTranslate,
    });

    const commandIds = commands.map((command) => command.id);

    assert.equal(commandIds.includes('nav-apps'), false);
    assert.equal(commandIds.includes('nav-mall'), false);
    assert.equal(commandIds.includes('nav-api-router'), false);
    assert.equal(commandIds.includes('nav-chat'), true);
    assert.equal(commandIds.includes('nav-settings'), true);
  },
);
