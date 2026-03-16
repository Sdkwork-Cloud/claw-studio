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

runTest('sdkwork-claw-settings is implemented locally with V5 settings tabs and sidebar controls', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-settings/package.json');
  const indexSource = read('packages/sdkwork-claw-settings/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-settings/src/Settings.tsx'));
  assert.ok(exists('packages/sdkwork-claw-settings/src/GeneralSettings.tsx'));
  assert.ok(exists('packages/sdkwork-claw-settings/src/services/settingsService.ts'));
  assert.ok(exists('packages/sdkwork-claw-settings/src/store/useLLMStore.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-settings']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-settings/);

  const settingsSource = read('packages/sdkwork-claw-settings/src/Settings.tsx');
  assert.match(settingsSource, /codebox/);
  assert.match(settingsSource, /api-router/);

  const generalSource = read('packages/sdkwork-claw-settings/src/GeneralSettings.tsx');
  assert.match(generalSource, /hiddenSidebarItems/);
  assert.match(generalSource, /toggleSidebarItem/);
});

runTest('sdkwork-claw-settings keeps the V5 API-backed settings service contract', () => {
  const settingsServiceSource = read('packages/sdkwork-claw-settings/src/services/settingsService.ts');

  assert.match(settingsServiceSource, /fetch\('\/api\/settings\/profile'\)/);
  assert.match(
    settingsServiceSource,
    /fetch\('\/api\/settings\/profile',\s*\{\s*method:\s*'PUT'/,
  );
  assert.match(settingsServiceSource, /fetch\('\/api\/settings\/preferences'\)/);
  assert.match(
    settingsServiceSource,
    /fetch\('\/api\/settings\/preferences',\s*\{\s*method:\s*'PUT'/,
  );
  assert.doesNotMatch(settingsServiceSource, /john\.doe@example\.com/);
  assert.doesNotMatch(settingsServiceSource, /currentPreferences/);
});

runTest('sdkwork-claw-settings keeps the V5 extended api key service surface', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-settings/package.json');
  const apiKeyServiceSource = read('packages/sdkwork-claw-settings/src/services/apiKeyService.ts');

  assert.equal(pkg.dependencies?.['@sdkwork/claw-types'], 'workspace:*');
  assert.match(apiKeyServiceSource, /import\s+\{\s*ListParams,\s*PaginatedResult,\s*delay\s*\}\s+from\s+'@sdkwork\/claw-types'/);
  assert.match(apiKeyServiceSource, /getList\(params\?: ListParams\)/);
  assert.match(apiKeyServiceSource, /getById\(id: string\)/);
  assert.match(apiKeyServiceSource, /create\(data: CreateApiKeyDTO\)/);
  assert.match(apiKeyServiceSource, /update\(id: string, data: UpdateApiKeyDTO\)/);
  assert.match(apiKeyServiceSource, /delete\(id: string\)/);
  assert.match(apiKeyServiceSource, /getApiKeys\(\): Promise<ApiKey\[]>/);
  assert.match(apiKeyServiceSource, /createApiKey\(name: string\): Promise<CreateApiKeyResponse>/);
  assert.match(apiKeyServiceSource, /revokeApiKey\(id: string\): Promise<void>/);
});
