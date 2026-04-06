import assert from 'node:assert/strict';
import { githubService } from './githubService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('githubService exposes the v3 repository catalog', async () => {
  const repos = await githubService.getRepos();

  assert.equal(repos.length, 6);
  assert.equal(repos[0].name, 'AutoGPT');
  assert.equal(repos[0].author, 'Significant-Gravitas');
});

await runTest('githubService getById returns a repository by id', async () => {
  const repo = await githubService.getById('2');

  assert.ok(repo);
  assert.equal(repo?.name, 'LangChain');
});

await runTest('githubService getList filters by keyword', async () => {
  const result = await githubService.getList({ keyword: 'private' });

  assert.equal(result.total, 1);
  assert.equal(result.items[0].name, 'PrivateGPT');
});
