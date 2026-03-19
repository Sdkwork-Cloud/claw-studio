import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
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

runTest('V5 contract includes auth and extended surface routes', () => {
  const source = read('upgrade/claw-studio-v5/src/App.tsx');
  assert.match(source, /path="\/auth"/);
  assert.match(source, /path="\/login"/);
  assert.match(source, /path="\/register"/);
  assert.match(source, /path="\/forgot-password"/);
  assert.match(source, /path="\/claw-upload"/);
  assert.match(source, /path="\/codebox"/);
  assert.match(source, /path="\/api-router"/);
});
