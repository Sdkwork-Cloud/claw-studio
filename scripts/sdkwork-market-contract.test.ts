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

runTest('sdkwork-claw-market is implemented locally instead of re-exporting claw-studio-market', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-market/package.json');
  const indexSource = read('packages/sdkwork-claw-market/src/index.ts');
  const marketEntrySource = read('packages/sdkwork-claw-market/src/Market.tsx');
  const skillDetailEntrySource = read('packages/sdkwork-claw-market/src/SkillDetail.tsx');
  const skillPackDetailEntrySource = read('packages/sdkwork-claw-market/src/SkillPackDetail.tsx');

  assert.ok(exists('packages/sdkwork-claw-market/src/Market.tsx'));
  assert.ok(exists('packages/sdkwork-claw-market/src/SkillDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-market/src/SkillPackDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-market/src/pages/Market.tsx'));
  assert.ok(exists('packages/sdkwork-claw-market/src/pages/SkillDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-market/src/pages/SkillPackDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-market/src/pages/marketLayout.ts'));
  assert.ok(exists('packages/sdkwork-claw-market/src/pages/marketLayout.test.ts'));
  assert.ok(exists('packages/sdkwork-claw-market/src/pages/marketPresentation.ts'));
  assert.ok(exists('packages/sdkwork-claw-market/src/pages/marketPresentation.test.ts'));
  assert.ok(exists('packages/sdkwork-claw-market/src/pages/marketViewComponents.tsx'));
  assert.ok(exists('packages/sdkwork-claw-market/src/services/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-market/src/services/marketService.ts'));
  assert.ok(exists('packages/sdkwork-claw-market/src/services/mySkillService.ts'));
  assert.ok(exists('packages/sdkwork-claw-market/src/services/instanceService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-market']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-market/);
  assert.match(indexSource, /\.\/Market/);
  assert.match(indexSource, /\.\/SkillDetail/);
  assert.match(indexSource, /\.\/SkillPackDetail/);
  assert.match(indexSource, /\.\/services\/marketService/);
  assert.match(marketEntrySource, /lazy\(\(\) =>/);
  assert.match(marketEntrySource, /\.\/pages\/Market/);
  assert.match(skillDetailEntrySource, /lazy\(\(\) =>/);
  assert.match(skillDetailEntrySource, /\.\/pages\/SkillDetail/);
  assert.match(skillPackDetailEntrySource, /lazy\(\(\) =>/);
  assert.match(skillPackDetailEntrySource, /\.\/pages\/SkillPackDetail/);
});

runTest('sdkwork-claw-market uses the three-tab hub surface while preserving multi-instance installs', () => {
  const marketSource = read('packages/sdkwork-claw-market/src/pages/Market.tsx');
  const presentationSource = read('packages/sdkwork-claw-market/src/pages/marketPresentation.ts');
  const viewComponentsSource = read('packages/sdkwork-claw-market/src/pages/marketViewComponents.tsx');

  assert.match(marketSource, /type MarketTab = 'skills' \| 'packages' \| 'mySkills'/);
  assert.match(marketSource, /createSkillCatalog/);
  assert.match(marketSource, /createPackCatalog/);
  assert.match(marketSource, /createMySkillsCatalog/);
  assert.match(marketSource, /createSkillCatalogGridStyle/);
  assert.match(marketSource, /createPackCatalogGridStyle/);
  assert.match(marketSource, /createMySkillsCatalogGridStyle/);
  assert.match(marketSource, /setActiveTab/);
  assert.match(marketSource, /setActiveCategory/);
  assert.match(marketSource, /setIsCreateSkillMenuOpen/);
  assert.match(marketSource, /createPortal/);
  assert.match(marketSource, /createSkillMenuStyle/);
  assert.match(marketSource, /whitespace-nowrap/);
  assert.match(marketSource, /shrink-0/);
  assert.match(marketSource, /navigate\('\/chat'\)/);
  assert.match(marketSource, /navigate\('\/claw-upload'\)/);
  assert.match(marketSource, /market\.actions\.createSkillWithChat/);
  assert.match(marketSource, /market\.actions\.uploadLocalSkill/);
  assert.match(marketSource, /market\.categoryLabels\./);
  assert.match(marketSource, /selectedInstanceIds/);
  assert.match(marketSource, /selectedInstanceIds\.map/);
  assert.doesNotMatch(marketSource, /linear-gradient/);
  assert.doesNotMatch(marketSource, /backdrop-blur/);
  assert.doesNotMatch(marketSource, /transition-all/);
  assert.doesNotMatch(marketSource, /transition-colors/);
  assert.doesNotMatch(marketSource, /transition-transform/);
  assert.doesNotMatch(marketSource, /max-w-\[1480px\]/);
  assert.doesNotMatch(marketSource, /type MarketView = 'discover' \| 'installed'/);
  assert.doesNotMatch(marketSource, /createDiscoverCatalog/);
  assert.doesNotMatch(marketSource, /createInstalledCatalog/);
  assert.match(presentationSource, /createCategoryIds/);
  assert.match(presentationSource, /createSkillCatalog/);
  assert.match(presentationSource, /createPackCatalog/);
  assert.match(presentationSource, /createMySkillsCatalog/);
  assert.match(presentationSource, /activeCategory/);
  assert.doesNotMatch(viewComponentsSource, /motion\/react/);
  assert.doesNotMatch(viewComponentsSource, /<motion\./);
  assert.doesNotMatch(viewComponentsSource, /animate-pulse/);
  assert.doesNotMatch(viewComponentsSource, /animate-spin/);
  assert.doesNotMatch(viewComponentsSource, /transition-all/);
  assert.doesNotMatch(viewComponentsSource, /transition-colors/);
  assert.doesNotMatch(viewComponentsSource, /bg-gradient-to-br/);
  assert.doesNotMatch(viewComponentsSource, /linear-gradient/);
  assert.doesNotMatch(viewComponentsSource, /radial-gradient/);
  assert.doesNotMatch(viewComponentsSource, /hidden shrink-0 md:block/);
  assert.doesNotMatch(viewComponentsSource, /mt-4 md:hidden/);
});

runTest('sdkwork-claw-market routes ClawHub browsing through claw-core app sdk wrappers and keeps installed-skill management local', () => {
  const marketServiceSource = read('packages/sdkwork-claw-market/src/services/marketService.ts');
  const mySkillServiceSource = read('packages/sdkwork-claw-market/src/services/mySkillService.ts');
  const marketPageSource = read('packages/sdkwork-claw-market/src/pages/Market.tsx');
  const skillDetailSource = read('packages/sdkwork-claw-market/src/pages/SkillDetail.tsx');
  const skillPackDetailSource = read('packages/sdkwork-claw-market/src/pages/SkillPackDetail.tsx');

  assert.match(marketServiceSource, /from '@sdkwork\/claw-core'|import\('@sdkwork\/claw-core'\)/);
  assert.doesNotMatch(marketServiceSource, /@sdkwork\/claw-core\/services\//);
  assert.match(mySkillServiceSource, /from '@sdkwork\/claw-instances'|import\('@sdkwork\/claw-instances'\)/);
  assert.doesNotMatch(mySkillServiceSource, /@sdkwork\/claw-instances\/services\//);
  assert.match(marketServiceSource, /clawHubService/);
  assert.match(marketServiceSource, /listCategories\(/);
  assert.match(marketServiceSource, /listSkills\(/);
  assert.match(marketServiceSource, /listPackages\(/);
  assert.match(marketServiceSource, /getSkill\(/);
  assert.match(marketServiceSource, /listReviews\(/);
  assert.match(marketServiceSource, /getPackage\(/);
  assert.doesNotMatch(marketServiceSource, /studioMockService/);
  assert.doesNotMatch(marketServiceSource, /fetch\(/);
  assert.doesNotMatch(marketServiceSource, /axios\./);
  assert.doesNotMatch(marketServiceSource, /Authorization/);

  assert.match(mySkillServiceSource, /instanceWorkbenchService/);
  assert.match(mySkillServiceSource, /agentWorkbenchService/);
  assert.match(mySkillServiceSource, /agentSkillManagementService/);
  assert.doesNotMatch(mySkillServiceSource, /clawHubService/);
  assert.doesNotMatch(mySkillServiceSource, /fetch\(/);
  assert.doesNotMatch(mySkillServiceSource, /axios\./);

  assert.match(marketPageSource, /queryFn:\s*marketService\.getCategories/);
  assert.match(marketPageSource, /marketService\.getSkills\(/);
  assert.match(marketPageSource, /marketService\.getPacks\(/);
  assert.match(skillDetailSource, /queryFn:\s*\(\)\s*=>\s*marketService\.getSkill\(id!\)/);
  assert.match(skillDetailSource, /queryFn:\s*\(\)\s*=>\s*marketService\.getSkillReviews\(id!\)/);
  assert.match(skillPackDetailSource, /queryFn:\s*\(\)\s*=>\s*marketService\.getPack\(id!\)/);
});

runTest('sdkwork-claw-market preserves V5 skill detail repository selector and multi-instance installs', () => {
  const detailSource = read('packages/sdkwork-claw-market/src/pages/SkillDetail.tsx');

  assert.match(detailSource, /useTranslation/);
  assert.match(detailSource, /selectedRepo/);
  assert.match(detailSource, /t\('market\.skillDetail\.repository\.options\.official\.title'\)/);
  assert.match(detailSource, /t\('market\.skillDetail\.repository\.options\.tencent\.title'\)/);
  assert.match(detailSource, /selectedInstanceIds/);
  assert.match(detailSource, /selectedInstanceIds\.map/);
});

runTest('sdkwork-claw-market keeps dead fallback seed data out of the public surface', () => {
  const indexSource = read('packages/sdkwork-claw-market/src/index.ts');
  const servicesIndexSource = read('packages/sdkwork-claw-market/src/services/index.ts');

  assert.equal(exists('packages/sdkwork-claw-market/src/services/fallbackData.ts'), false);
  assert.doesNotMatch(indexSource, /\.\/services';/);
  assert.doesNotMatch(indexSource, /fallbackData/);
  assert.doesNotMatch(servicesIndexSource, /fallbackData/);
  assert.match(indexSource, /\.\/services\/instanceService/);
  assert.match(indexSource, /\.\/services\/marketService/);
  assert.match(indexSource, /\.\/services\/mySkillService/);
});
