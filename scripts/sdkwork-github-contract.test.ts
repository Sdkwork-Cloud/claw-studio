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

runTest('sdkwork-claw-github keeps the V5 github package surface locally', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-github/package.json');
  const indexSource = read('packages/sdkwork-claw-github/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-github/src/GitHubRepos.tsx'));
  assert.ok(exists('packages/sdkwork-claw-github/src/GitHubRepoDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-github/src/pages/github/GitHubRepos.tsx'));
  assert.ok(exists('packages/sdkwork-claw-github/src/pages/github/GitHubRepoDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-github/src/services/githubService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-github']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-github/);
});

runTest('sdkwork-claw-github preserves the V5 repository discovery shell', () => {
  const pageSource = read('packages/sdkwork-claw-github/src/pages/github/GitHubRepos.tsx');

  assert.match(pageSource, /RepositoryCard/);
  assert.match(pageSource, /useVirtualizer/);
  assert.match(pageSource, /useTaskStore/);
  assert.match(pageSource, /GitHub Repositories/);
  assert.match(pageSource, /Install popular open-source projects locally/);
});

runTest('sdkwork-claw-github preserves the V5 repository detail tabs and download flow', () => {
  const detailSource = read('packages/sdkwork-claw-github/src/pages/github/GitHubRepoDetail.tsx');

  assert.match(detailSource, /'readme' \| 'files' \| 'activity'/);
  assert.match(detailSource, /downloadRepo/);
  assert.match(detailSource, /Download to Local/);
  assert.match(detailSource, /Repository Stats/);
});
