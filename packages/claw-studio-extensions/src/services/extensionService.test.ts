import assert from 'node:assert/strict';
import { createExtensionService } from './extensionService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('getExtensions filters by keyword and reports pagination metadata', async () => {
  const service = createExtensionService();

  const page = await service.getExtensions({ keyword: 'docker', page: 1, pageSize: 10 });

  assert.equal(page.total, 1);
  assert.equal(page.items[0]?.name, 'Docker Manager');
  assert.equal(page.hasMore, false);
});

await runTest('installExtension marks the target extension as installed', async () => {
  const service = createExtensionService();

  await service.installExtension('ext-2');
  const page = await service.getExtensions({ keyword: 'docker' });

  assert.equal(page.items[0]?.installed, true);
});

await runTest('uninstallExtension rejects missing extensions', async () => {
  const service = createExtensionService();

  await assert.rejects(() => service.uninstallExtension('missing-extension'), /Extension not found/);
});
