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

runTest('sdkwork-claw-huggingface keeps the V5 huggingface package surface locally', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-huggingface/package.json');
  const indexSource = read('packages/sdkwork-claw-huggingface/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-huggingface/src/HuggingFaceModels.tsx'));
  assert.ok(exists('packages/sdkwork-claw-huggingface/src/HuggingFaceModelDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-huggingface/src/pages/huggingface/HuggingFaceModels.tsx'));
  assert.ok(exists('packages/sdkwork-claw-huggingface/src/pages/huggingface/HuggingFaceModelDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-huggingface/src/services/huggingfaceService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-huggingface']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-huggingface/);
});

runTest('sdkwork-claw-huggingface preserves the V5 discovery shell and visual badge', () => {
  const pageSource = read('packages/sdkwork-claw-huggingface/src/pages/huggingface/HuggingFaceModels.tsx');

  assert.match(pageSource, /RepositoryCard/);
  assert.match(pageSource, /useVirtualizer/);
  assert.match(pageSource, /useTaskStore/);
  assert.match(pageSource, /Hugging Face Models/);
  assert.match(pageSource, /🤗/);
});

runTest('sdkwork-claw-huggingface preserves the V5 model detail tabs and visual fallback', () => {
  const detailSource = read('packages/sdkwork-claw-huggingface/src/pages/huggingface/HuggingFaceModelDetail.tsx');

  assert.match(detailSource, /'model_card' \| 'files' \| 'community'/);
  assert.match(detailSource, /Download to Local/);
  assert.match(detailSource, /Model Stats/);
  assert.match(detailSource, /🤗/);
});
