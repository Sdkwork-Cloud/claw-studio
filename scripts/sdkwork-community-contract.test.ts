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

runTest('sdkwork-claw-community keeps the V5 community package surface locally', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-community/package.json');
  const indexSource = read('packages/sdkwork-claw-community/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-community/src/Community.tsx'));
  assert.ok(exists('packages/sdkwork-claw-community/src/CommunityPostDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-community/src/NewPost.tsx'));
  assert.ok(exists('packages/sdkwork-claw-community/src/pages/community/Community.tsx'));
  assert.ok(exists('packages/sdkwork-claw-community/src/services/communityService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-community']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-community/);
});

runTest('sdkwork-claw-community preserves the V5 community landing affordances', () => {
  const pageSource = read('packages/sdkwork-claw-community/src/pages/community/Community.tsx');

  assert.match(pageSource, /useTranslation/);
  assert.match(pageSource, /id: 'posts'/);
  assert.match(pageSource, /id: 'news'/);
  assert.match(pageSource, /t\('community\.page\.latestClaw'\)/);
  assert.match(pageSource, /t\('community\.page\.onlineClaw'\)/);
  assert.match(pageSource, /t\('community\.page\.hottestClaw'\)/);
});

runTest('sdkwork-claw-community keeps the V5 community mock content model', () => {
  const serviceSource = read('packages/sdkwork-claw-community/src/services/communityService.ts');

  assert.match(serviceSource, /How to optimize your AI agent for faster response times/);
  assert.match(serviceSource, /New release: Claw Framework v2\.0 is here!/);
  assert.match(serviceSource, /createdAt:\s*new Date\(\)\.toISOString\(\)/);
  assert.match(serviceSource, /category === 'all'/);
  assert.match(serviceSource, /category === 'posts'/);
  assert.match(serviceSource, /category === 'news'/);
});
