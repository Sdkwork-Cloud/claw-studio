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
runTest('claw registry center keeps a search-first workbench and adaptive maximum page width', () => {
  const centerPageSource = read('packages/sdkwork-claw-center/src/pages/ClawCenter.tsx');
  const detailPageSource = read('packages/sdkwork-claw-center/src/pages/ClawDetail.tsx');
  const uploadPageSource = read('packages/sdkwork-claw-center/src/pages/ClawUpload.tsx');

  assert.match(centerPageSource, /max-w-none/);
  assert.match(detailPageSource, /max-w-\[min\(1760px,_calc\(100vw-2rem\)\)\]/);
  assert.match(centerPageSource, /selectLatestRegistryEntries/);
  assert.match(centerPageSource, /selectPopularRegistryEntries/);
  assert.match(centerPageSource, /selectRecommendedRegistryEntries/);
  assert.match(centerPageSource, /clawCenter\.sections\.latestClaw/);
  assert.match(centerPageSource, /clawCenter\.sections\.popularClaw/);
  assert.match(centerPageSource, /clawCenter\.sections\.recommendedClaw/);
  assert.match(centerPageSource, /xl:grid-cols-\[240px_minmax\(0,1fr\)_320px\]/);
  assert.match(centerPageSource, /xl:grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(centerPageSource, /clawCenter\.actions\.quickRegister/);
  assert.match(centerPageSource, /navigate\('\/claw-upload'\)/);
  assert.match(centerPageSource, /matchReasons/);
  assert.match(centerPageSource, /categoryName\(entry\.category, t, entry\.category\)/);
  assert.match(centerPageSource, /const currentCommand = primaryEntry \? buildRegistryConnectCommand\(primaryEntry\) : '';/);
  assert.match(centerPageSource, /clawCenter\.labels\.currentCommand/);
  assert.match(centerPageSource, /aria-label=\{t\('clawCenter\.actions\.copyContent'\)\}/);
  assert.match(centerPageSource, /font-mono/);
  assert.doesNotMatch(centerPageSource, /TopMatchCard/);
  assert.doesNotMatch(centerPageSource, /searchSuggestions/);
  assert.doesNotMatch(centerPageSource, /clawCenter\.sections\.spotlightEyebrow/);
  assert.doesNotMatch(centerPageSource, /clawCenter\.sections\.statusEyebrow/);
  assert.match(centerPageSource, /bg-zinc-50 dark:bg-zinc-950/);
  assert.match(detailPageSource, /bg-zinc-50 dark:bg-zinc-950/);
  assert.match(uploadPageSource, /bg-zinc-50 dark:bg-zinc-950/);
  assert.doesNotMatch(centerPageSource, /radial-gradient|linear-gradient/);
  assert.doesNotMatch(detailPageSource, /radial-gradient|linear-gradient/);
  assert.doesNotMatch(uploadPageSource, /radial-gradient|linear-gradient/);
});

runTest('claw center locales stay valid json and include search workbench copy in both languages', () => {
  const enLocale = readJson<{ clawCenter: Record<string, any> }>('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocale = readJson<{ clawCenter: Record<string, any> }>('packages/sdkwork-claw-i18n/src/locales/zh.json');

  assert.equal(enLocale.clawCenter.actions.copyContent, 'Copy Content');
  assert.equal(enLocale.clawCenter.actions.quickRegister, 'One-Click Register');
  assert.equal(enLocale.clawCenter.labels.matchReasons, 'Matched On');
  assert.equal(enLocale.clawCenter.sections.latestClaw, 'Latest Claw');
  assert.equal(enLocale.clawCenter.sections.popularClaw, 'Popular Claw');
  assert.equal(enLocale.clawCenter.sections.recommendedClaw, 'Recommended Claw');

  assert.equal(zhLocale.clawCenter.actions.copyContent, '复制内容');
  assert.equal(zhLocale.clawCenter.actions.quickRegister, '一键注册');
  assert.equal(zhLocale.clawCenter.labels.matchReasons, '命中原因');
  assert.equal(zhLocale.clawCenter.sections.latestClaw, '最新 Claw');
  assert.equal(zhLocale.clawCenter.sections.popularClaw, '热门 Claw');
  assert.equal(zhLocale.clawCenter.sections.recommendedClaw, '推荐 Claw');
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
