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

runTest('sdkwork-claw-center is implemented locally instead of re-exporting claw-studio-claw-center', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-center/package.json');
  const indexSource = read('packages/sdkwork-claw-center/src/index.ts');
  const uploadPageSource = read('packages/sdkwork-claw-center/src/pages/ClawUpload.tsx');

  assert.ok(exists('packages/sdkwork-claw-center/src/pages/ClawCenter.tsx'));
  assert.ok(exists('packages/sdkwork-claw-center/src/pages/ClawDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-center/src/services/clawService.ts'));
  assert.ok(exists('packages/sdkwork-claw-center/src/types/index.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-claw-center']);
  assert.ok(pkg.dependencies?.['@sdkwork/claw-infrastructure']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-claw-center/);
  assert.match(indexSource, /ClawCenter/);
  assert.match(indexSource, /ClawDetail/);
  assert.match(indexSource, /ClawUpload/);
  assert.match(uploadPageSource, /studio\.listInstances\(\)/);
  assert.match(uploadPageSource, /instance\.runtimeKind === 'openclaw'/);
  assert.match(uploadPageSource, /navigate\('\/api-router'\)/);
  assert.match(uploadPageSource, /navigate\(`\/instances\/\$\{instance\.id\}`\)/);
  assert.match(uploadPageSource, /clawUpload\.summary\.gatewayReady/);
});

runTest('claw networking surface uses registry-focused copy and clean capability formatting', () => {
  const uploadPageSource = read('packages/sdkwork-claw-center/src/pages/ClawUpload.tsx');
  const enLocale = read('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocale = read('packages/sdkwork-claw-i18n/src/locales/zh.json');

  assert.doesNotMatch(uploadPageSource, /join\(' 路 '\)/);
  assert.match(enLocale, /"clawUpload": "Claw Networking"/);
  assert.match(enLocale, /"title": "Go to Claw Networking"/);
  assert.match(enLocale, /"eyebrow": "Registry Linked"/);
  assert.match(zhLocale, /"clawUpload": "Claw联网"/);
  assert.match(zhLocale, /"title": "前往 Claw联网"/);
  assert.match(zhLocale, /"eyebrow": "注册中心已连接"/);
});
