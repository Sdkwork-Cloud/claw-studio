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

runTest('sdkwork-claw-points stays a dedicated feature package wired to claw-core and react-query', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-points/package.json',
  );
  const corePkg = readJson<{ exports?: Record<string, string> }>(
    'packages/sdkwork-claw-core/package.json',
  );
  const indexSource = read('packages/sdkwork-claw-points/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-points/src/Points.tsx'));
  assert.ok(exists('packages/sdkwork-claw-points/src/pages/Points.tsx'));
  assert.ok(exists('packages/sdkwork-claw-points/src/components/PointsHeaderEntry.tsx'));
  assert.ok(exists('packages/sdkwork-claw-points/src/components/PointsRechargeDialog.tsx'));
  assert.ok(exists('packages/sdkwork-claw-points/src/components/PointsUpgradeDialog.tsx'));
  assert.ok(exists('packages/sdkwork-claw-points/src/components/PointsQuickPanel.tsx'));
  assert.ok(exists('packages/sdkwork-claw-points/src/components/PointsTransactionList.tsx'));
  assert.ok(exists('packages/sdkwork-claw-points/src/services/pointsService.ts'));
  assert.equal(pkg.dependencies?.['@sdkwork/claw-core'], 'workspace:*');
  assert.equal(corePkg.exports?.['.'], './src/index.ts');
  assert.equal(corePkg.exports?.['./sdk'], './src/sdk/index.ts');
  assert.equal(corePkg.exports?.['./points-wallet'], undefined);
  assert.equal(pkg.dependencies?.['@tanstack/react-query'], '^5.90.21');
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-points']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-points/);
  assert.match(indexSource, /\.\/Points/);
  assert.match(indexSource, /\.\/components/);
  assert.match(indexSource, /\.\/services/);
});

runTest('sdkwork-claw-points reads live dashboard data through the shared app-sdk wrapper instead of local mock state', () => {
  const pageSource = read('packages/sdkwork-claw-points/src/pages/Points.tsx');
  const headerSource = read('packages/sdkwork-claw-points/src/components/PointsHeaderEntry.tsx');
  const rechargeSource = read('packages/sdkwork-claw-points/src/components/PointsRechargeDialog.tsx');
  const upgradeSource = read('packages/sdkwork-claw-points/src/components/PointsUpgradeDialog.tsx');
  const quickPanelSource = read('packages/sdkwork-claw-points/src/components/PointsQuickPanel.tsx');
  const transactionListSource = read('packages/sdkwork-claw-points/src/components/PointsTransactionList.tsx');
  const copySource = read('packages/sdkwork-claw-points/src/components/pointsCopy.ts');
  const serviceSource = read('packages/sdkwork-claw-points/src/services/pointsService.ts');
  const enLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/zh.json');
  const enPoints = JSON.stringify(enLocale.points ?? {});
  const zhPoints = JSON.stringify(zhLocale.points ?? {});

  assert.match(serviceSource, /from ['"]@sdkwork\/claw-core['"]/);
  assert.doesNotMatch(serviceSource, /@sdkwork\/claw-core\/points-wallet/);
  assert.match(serviceSource, /pointsQueryKeys/);
  assert.match(serviceSource, /getDashboard/);
  assert.match(serviceSource, /walletService\.getOverview/);
  assert.match(serviceSource, /walletService\.rechargePoints/);
  assert.match(serviceSource, /walletService\.purchaseVipPack/);
  assert.doesNotMatch(serviceSource, /localStorage/);
  assert.doesNotMatch(serviceSource, /claw-studio-points-state/);
  assert.doesNotMatch(serviceSource, /POINTS_STATE_CHANGED_EVENT/);

  assert.match(pageSource, /data-slot="points-page"/);
  assert.match(pageSource, /data-slot="points-hero"/);
  assert.match(pageSource, /useQuery/);
  assert.match(pageSource, /pointsQueryKeys\.dashboard/);
  assert.match(pageSource, /filterPointsTransactions/);
  assert.match(pageSource, /PointsRechargeDialog/);
  assert.match(pageSource, /PointsUpgradeDialog/);
  assert.doesNotMatch(pageSource, /subscribeToPointsState/);

  assert.match(headerSource, /useQuery/);
  assert.match(headerSource, /PointsQuickPanel/);
  assert.match(headerSource, /navigate\('\/points'\)/);
  assert.doesNotMatch(headerSource, /subscribeToPointsState/);

  assert.match(rechargeSource, /useMutation/);
  assert.match(rechargeSource, /useQuery/);
  assert.match(rechargeSource, /queryClient\.invalidateQueries/);
  assert.match(rechargeSource, /pointsService\.rechargePoints/);
  assert.match(rechargeSource, /pointsService\.getRechargePresets/);
  assert.match(rechargeSource, /points\.rechargeDialog\.exchangeRateLabel/);
  assert.match(rechargeSource, /data-slot="points-recharge-payment"/);
  assert.match(rechargeSource, /data-slot="points-recharge-summary"/);
  assert.match(rechargeSource, /data-slot="points-recharge-preset-grid"/);
  assert.match(rechargeSource, /data-slot="points-recharge-custom-panel"/);
  assert.doesNotMatch(rechargeSource, /resolvedPoints \/ 10/);
  assert.doesNotMatch(rechargeSource, /line-through/);
  assert.doesNotMatch(rechargeSource, /buildPseudoQrDataUrl/);
  assert.doesNotMatch(rechargeSource, /points-recharge-qr/);
  assert.doesNotMatch(rechargeSource, /setStep\('payment'\)/);
  assert.doesNotMatch(rechargeSource, /setStep\('form'\)/);

  assert.match(upgradeSource, /useMutation/);
  assert.match(upgradeSource, /useQuery/);
  assert.match(upgradeSource, /pointsService\.upgradePlan/);
  assert.match(upgradeSource, /data-slot="points-upgrade-payment"/);
  assert.match(upgradeSource, /data-slot="points-upgrade-plan-card"/);
  assert.match(upgradeSource, /data-slot="points-upgrade-summary"/);
  assert.match(upgradeSource, /data-slot="points-upgrade-summary-rows"/);
  assert.match(upgradeSource, /points\.upgradeDialog\.durationLabel/);
  assert.doesNotMatch(upgradeSource, /save20/);
  assert.doesNotMatch(upgradeSource, /buildPseudoQrDataUrl/);
  assert.doesNotMatch(upgradeSource, /points-upgrade-qr/);
  assert.doesNotMatch(upgradeSource, /setStep\('payment'\)/);
  assert.doesNotMatch(upgradeSource, /setStep\('plans'\)/);

  assert.match(quickPanelSource, /points\.quickPanel\.authRequired/);
  assert.match(quickPanelSource, /points\.quickPanel\.noRecords/);
  assert.match(transactionListSource, /points\.status\./);
  assert.match(copySource, /getCurrentPlanTitle/);
  assert.doesNotMatch(copySource, /resolveOriginalPrice/);
  assert.doesNotMatch(copySource, /getPointsPlanBenefits/);

  assert.match(enPoints, /exchangeRateLabel/);
  assert.match(enPoints, /auth/);
  assert.match(enPoints, /membership/);
  assert.match(enPoints, /durationLabel/);
  assert.match(enPoints, /selectPlan/);
  assert.match(zhPoints, /exchangeRateLabel/);
  assert.match(zhPoints, /auth/);
  assert.match(zhPoints, /membership/);
  assert.match(zhPoints, /durationLabel/);
  assert.match(zhPoints, /selectPlan/);
});
