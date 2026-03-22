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

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return [next, ...flattenKeys(nested, next)];
  });
}

function extractCommunityTranslationKeys() {
  const files = [
    'packages/sdkwork-claw-community/src/pages/community/Community.tsx',
    'packages/sdkwork-claw-community/src/pages/community/CommunityPostDetail.tsx',
    'packages/sdkwork-claw-community/src/pages/community/NewPost.tsx',
  ];
  const pattern = /community\.[A-Za-z0-9_.]+/g;
  const matches = new Set<string>();

  for (const file of files) {
    for (const match of read(file).match(pattern) ?? []) {
      if (!match.endsWith('.')) {
        matches.add(match);
      }
    }
  }

  for (const dynamicKey of [
    'community.newPost.publisherTypes.personal',
    'community.newPost.publisherTypes.company',
    'community.newPost.publisherTypes.official',
    'community.newPost.serviceLines.legal',
    'community.newPost.serviceLines.tax',
    'community.newPost.serviceLines.design',
    'community.newPost.serviceLines.development',
    'community.newPost.serviceLines.marketing',
    'community.newPost.serviceLines.translation',
    'community.newPost.serviceLines.operations',
    'community.newPost.serviceLines.training',
    'community.newPost.serviceLines.consulting',
    'community.newPost.serviceLines.content',
    'community.newPost.serviceLines.data',
    'community.newPost.serviceLines.hr',
    'community.newPost.deliveryModes.online',
    'community.newPost.deliveryModes.hybrid',
    'community.newPost.deliveryModes.onsite',
    'community.postDetail.listingMeta.publisherTypes.personal',
    'community.postDetail.listingMeta.publisherTypes.company',
    'community.postDetail.listingMeta.publisherTypes.official',
    'community.postDetail.listingMeta.serviceLines.legal',
    'community.postDetail.listingMeta.serviceLines.tax',
    'community.postDetail.listingMeta.serviceLines.design',
    'community.postDetail.listingMeta.serviceLines.development',
    'community.postDetail.listingMeta.serviceLines.marketing',
    'community.postDetail.listingMeta.serviceLines.translation',
    'community.postDetail.listingMeta.serviceLines.operations',
    'community.postDetail.listingMeta.serviceLines.training',
    'community.postDetail.listingMeta.serviceLines.consulting',
    'community.postDetail.listingMeta.serviceLines.content',
    'community.postDetail.listingMeta.serviceLines.data',
    'community.postDetail.listingMeta.serviceLines.hr',
    'community.postDetail.listingMeta.deliveryModes.online',
    'community.postDetail.listingMeta.deliveryModes.hybrid',
    'community.postDetail.listingMeta.deliveryModes.onsite',
  ]) {
    matches.add(dynamicKey);
  }

  return [...matches].sort();
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
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-community/package.json',
  );
  const indexSource = read('packages/sdkwork-claw-community/src/index.ts');
  const communityEntrySource = read('packages/sdkwork-claw-community/src/Community.tsx');
  const detailEntrySource = read('packages/sdkwork-claw-community/src/CommunityPostDetail.tsx');
  const newPostEntrySource = read('packages/sdkwork-claw-community/src/NewPost.tsx');

  assert.ok(exists('packages/sdkwork-claw-community/src/Community.tsx'));
  assert.ok(exists('packages/sdkwork-claw-community/src/CommunityPostDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-community/src/NewPost.tsx'));
  assert.ok(exists('packages/sdkwork-claw-community/src/pages/community/Community.tsx'));
  assert.ok(exists('packages/sdkwork-claw-community/src/services/communityService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-community']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-community/);
  assert.match(communityEntrySource, /lazy\(\(\) =>/);
  assert.match(communityEntrySource, /\.\/pages\/community\/Community/);
  assert.match(detailEntrySource, /lazy\(\(\) =>/);
  assert.match(detailEntrySource, /\.\/pages\/community\/CommunityPostDetail/);
  assert.match(newPostEntrySource, /lazy\(\(\) =>/);
  assert.match(newPostEntrySource, /\.\/pages\/community\/NewPost/);
});

runTest(
  'sdkwork-claw-community exposes a classified-information landing instead of the old article community',
  () => {
    const pageSource = read('packages/sdkwork-claw-community/src/pages/community/Community.tsx');

    assert.match(pageSource, /useTranslation/);
    assert.match(pageSource, /id: 'job-seeking'/);
    assert.match(pageSource, /id: 'recruitment'/);
    assert.match(pageSource, /id: 'services'/);
    assert.match(pageSource, /id: 'news'/);
    assert.match(pageSource, /t\('community\.page\.hero\.primaryCta'\)/);
    assert.match(pageSource, /t\('community\.page\.hero\.secondaryCta'\)/);
    assert.match(pageSource, /t\('community\.page\.assistantWorkbench\.title'\)/);
    assert.match(pageSource, /t\('community\.page\.revenueServices\.title'\)/);
    assert.match(pageSource, /community\.page\.feedEyebrow/);
    assert.match(pageSource, /community\.page\.serviceCatalog\.items\.legal\.title/);
    assert.match(pageSource, /community\.page\.serviceCatalog\.items\.consulting\.title/);
    assert.match(pageSource, /community\.page\.serviceCatalog\.items\.content\.title/);
    assert.match(pageSource, /community\.page\.serviceCatalog\.items\.data\.title/);
    assert.match(pageSource, /community\.page\.serviceCatalog\.items\.hr\.title/);
    assert.match(pageSource, /community\.page\.rails\.urgentRecruitment/);
    assert.match(pageSource, /community\.page\.rails\.onlineServices/);
    assert.match(pageSource, /community\.page\.rails\.platformNews/);
    assert.doesNotMatch(pageSource, /community\.page\.latestClaw/);
    assert.doesNotMatch(pageSource, /community\.page\.onlineClaw/);
    assert.doesNotMatch(pageSource, /community\.page\.hottestClaw/);
  },
);

runTest('sdkwork-claw-community keeps a recruitment-first classified mock content model with retained news', () => {
  const serviceSource = read('packages/sdkwork-claw-community/src/services/communityService.ts');
  const newPostSource = read('packages/sdkwork-claw-community/src/pages/community/NewPost.tsx');
  const detailSource = read('packages/sdkwork-claw-community/src/pages/community/CommunityPostDetail.tsx');

  assert.match(serviceSource, /category:\s*'job-seeking'/);
  assert.match(serviceSource, /category:\s*'recruitment'/);
  assert.match(serviceSource, /category:\s*'news'/);
  assert.match(serviceSource, /publisherType/);
  assert.match(serviceSource, /location/);
  assert.match(serviceSource, /compensation/);
  assert.match(serviceSource, /serviceLine/);
  assert.match(serviceSource, /deliveryMode/);
  assert.match(serviceSource, /turnaround/);
  assert.match(serviceSource, /serviceLine:\s*'legal'/);
  assert.match(serviceSource, /serviceLine:\s*'consulting'/);
  assert.match(serviceSource, /serviceLine:\s*'content'/);
  assert.match(serviceSource, /serviceLine:\s*'data'/);
  assert.match(serviceSource, /serviceLine:\s*'hr'/);
  assert.match(serviceSource, /createdAt:\s*new Date\(\)\.toISOString\(\)/);
  assert.match(serviceSource, /category === 'all'/);
  assert.match(serviceSource, /category === 'news'/);
  assert.match(newPostSource, /community\.newPost\.entryTypes\.jobSeeking/);
  assert.match(newPostSource, /community\.newPost\.entryTypes\.recruitment/);
  assert.match(newPostSource, /community\.newPost\.fields\.location/);
  assert.match(newPostSource, /community\.newPost\.fields\.compensation/);
  assert.match(newPostSource, /community\.newPost\.fields\.publisherType/);
  assert.match(newPostSource, /community\.newPost\.fields\.serviceLine/);
  assert.match(newPostSource, /community\.newPost\.fields\.deliveryMode/);
  assert.match(newPostSource, /community\.newPost\.fields\.turnaround/);
  assert.match(newPostSource, /community\.newPost\.assistantPanel\.title/);
  assert.match(newPostSource, /community\.newPost\.assistantCards\.recruitment/);
  assert.match(detailSource, /community\.postDetail\.assistantCta/);
  assert.match(detailSource, /community\.postDetail\.listingMeta/);
  assert.match(detailSource, /community\.postDetail\.listingMeta\.location/);
  assert.match(detailSource, /community\.postDetail\.listingMeta\.compensation/);
  assert.match(detailSource, /community\.postDetail\.listingMeta\.publisherType/);
  assert.match(detailSource, /community\.postDetail\.listingMeta\.serviceLine/);
  assert.match(detailSource, /community\.postDetail\.listingMeta\.deliveryMode/);
  assert.match(detailSource, /community\.postDetail\.listingMeta\.turnaround/);
});

runTest('sdkwork-claw-community keeps the route surface and locale coverage aligned with the final classifieds UI', () => {
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');
  const enLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/zh.json');
  const requiredKeys = extractCommunityTranslationKeys();
  const availableEn = new Set(flattenKeys(enLocale));
  const availableZh = new Set(flattenKeys(zhLocale));
  const missingEn = requiredKeys.filter((key) => !availableEn.has(key));
  const missingZh = requiredKeys.filter((key) => !availableZh.has(key));

  assert.match(routesSource, /path="\/community"/);
  assert.equal((enLocale.sidebar as Record<string, string>).community, 'Classifieds');
  assert.equal((zhLocale.sidebar as Record<string, string>).community, '分类信息');
  assert.deepEqual(missingEn, []);
  assert.deepEqual(missingZh, []);
});
