import assert from 'node:assert/strict';
import { huggingfaceService } from './huggingfaceService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('huggingfaceService exposes the v3 model catalog', async () => {
  const models = await huggingfaceService.getModels();

  assert.equal(models.length, 6);
  assert.equal(models[0].name, 'Llama-2-7b-chat-hf');
  assert.equal(models[0].author, 'meta-llama');
});

await runTest('huggingfaceService getById returns a model by id', async () => {
  const model = await huggingfaceService.getById('3');

  assert.ok(model);
  assert.equal(model?.name, 'whisper-large-v3');
});

await runTest('huggingfaceService getList filters by keyword', async () => {
  const result = await huggingfaceService.getList({ keyword: 'stable diffusion' });

  assert.equal(result.total, 1);
  assert.equal(result.items[0].name, 'stable-diffusion-v1-5');
});
