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

runTest('sdkwork-claw-dashboard is implemented as a dedicated local feature package', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-dashboard/package.json',
  );
  const indexSource = read('packages/sdkwork-claw-dashboard/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-dashboard/src/Dashboard.tsx'));
  assert.ok(exists('packages/sdkwork-claw-dashboard/src/pages/Dashboard.tsx'));
  assert.ok(exists('packages/sdkwork-claw-dashboard/src/services/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-dashboard/src/services/dashboardService.ts'));
  assert.ok(exists('packages/sdkwork-claw-dashboard/src/types/index.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-dashboard']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-dashboard/);
  assert.match(indexSource, /\.\/Dashboard/);
  assert.match(indexSource, /\.\/services\/dashboardService/);
});

runTest('sdkwork-claw-dashboard aggregates shared runtime data into a control-plane snapshot', () => {
  const serviceSource = read('packages/sdkwork-claw-dashboard/src/services/dashboardService.ts');

  assert.match(serviceSource, /listInstances/);
  assert.match(serviceSource, /listTasks/);
  assert.match(serviceSource, /listChannels/);
  assert.match(serviceSource, /listInstalledSkills/);
  assert.match(serviceSource, /listAgents/);
  assert.match(serviceSource, /calculateWorkspaceHealthScore/);
  assert.match(serviceSource, /calculateCapabilityCoverageScore/);
  assert.match(serviceSource, /tokenAnalytics/);
  assert.match(serviceSource, /usageTrend/);
  assert.match(serviceSource, /granularity/);
  assert.match(serviceSource, /rangeMode/);
  assert.match(serviceSource, /modelBreakdown/);
  assert.match(serviceSource, /cacheCreationTokens/);
  assert.match(serviceSource, /cacheReadTokens/);
  assert.match(serviceSource, /revenueAnalytics/);
  assert.match(serviceSource, /revenueTrend/);
  assert.match(serviceSource, /productBreakdown/);
  assert.match(serviceSource, /dailyRevenue/);
  assert.match(serviceSource, /businessSummary/);
  assert.match(serviceSource, /tokenSummary/);
  assert.match(serviceSource, /recentApiCalls/);
  assert.match(serviceSource, /recentRevenueRecords/);
  assert.match(serviceSource, /productPerformance/);
});

runTest('sdkwork-claw-dashboard renders a professional operator cockpit instead of a placeholder page', () => {
  const pageSource = read('packages/sdkwork-claw-dashboard/src/pages/Dashboard.tsx');
  const chartSource = read('packages/sdkwork-claw-dashboard/src/components/TokenTrendChart.tsx');

  assert.doesNotMatch(pageSource, /dashboard\.page\.title/);
  assert.doesNotMatch(pageSource, /dashboard\.page\.eyebrow/);
  assert.doesNotMatch(pageSource, /dashboard\.page\.description/);
  assert.match(chartSource, /dashboard\.filters\.granularity/);
  assert.match(chartSource, /dashboard\.filters\.range/);
  assert.match(chartSource, /dashboard\.filters\.sevenDays/);
  assert.match(chartSource, /dashboard\.filters\.month/);
  assert.match(chartSource, /dashboard\.filters\.custom/);
  assert.doesNotMatch(pageSource, /dashboard\.filters\.granularity/);
  assert.doesNotMatch(pageSource, /dashboard\.filters\.range/);
  assert.match(pageSource, /dashboard\.sections\.tokenIntelligence/);
  assert.match(pageSource, /dashboard\.sections\.modelDistribution/);
  assert.match(pageSource, /dashboard\.sections\.activityWorkbench/);
  assert.match(pageSource, /dashboard\.series\.totalTokens/);
  assert.match(pageSource, /dashboard\.series\.inputTokens/);
  assert.match(pageSource, /dashboard\.series\.outputTokens/);
  assert.match(pageSource, /dashboard\.series\.cacheCreation/);
  assert.match(pageSource, /dashboard\.series\.cacheRead/);
  assert.match(pageSource, /dashboard\.table\.modelName/);
  assert.match(pageSource, /dashboard\.table\.requestCount/);
  assert.match(pageSource, /dashboard\.table\.token/);
  assert.match(pageSource, /dashboard\.table\.actualAmount/);
  assert.match(pageSource, /dashboard\.table\.standardAmount/);
  assert.match(pageSource, /dashboard\.metrics\.revenue/);
  assert.match(pageSource, /dashboard\.metrics\.tokenUsage/);
  assert.match(pageSource, /dashboard\.metrics\.businessConversion/);
  assert.match(pageSource, /dashboard\.labels\.today/);
  assert.match(pageSource, /dashboard\.labels\.week/);
  assert.match(pageSource, /dashboard\.labels\.month/);
  assert.match(pageSource, /dashboard\.labels\.year/);
  assert.match(pageSource, /dashboard\.labels\.dailyRequests/);
  assert.match(pageSource, /dashboard\.labels\.dailyTokens/);
  assert.match(pageSource, /dashboard\.labels\.dailySpend/);
  assert.match(pageSource, /dashboard\.sections\.revenueTrend/);
  assert.match(pageSource, /dashboard\.sections\.revenueDistribution/);
  assert.match(pageSource, /dashboard\.tabs\.recentApiCalls/);
  assert.match(pageSource, /dashboard\.tabs\.recentRevenueRecords/);
  assert.match(pageSource, /dashboard\.tabs\.productPerformance/);
  assert.match(pageSource, /dashboard\.tabs\.alerts/);
  assert.doesNotMatch(pageSource, /navigate\('\/instances'\)/);
  assert.doesNotMatch(pageSource, /navigate\('\/chat'\)/);
  assert.doesNotMatch(pageSource, /dashboard\.page\.openInstances/);
  assert.doesNotMatch(pageSource, /dashboard\.page\.openChat/);
  assert.doesNotMatch(pageSource, /dashboard\.page\.refresh/);
  assert.doesNotMatch(pageSource, /dashboard\.hero\.health/);
  assert.doesNotMatch(pageSource, /dashboard\.hero\.spend/);
  assert.doesNotMatch(pageSource, /dashboard\.hero\.tokens/);
  assert.doesNotMatch(pageSource, /dashboard\.metrics\.healthScore/);
  assert.doesNotMatch(pageSource, /dashboard\.metrics\.capabilityCoverage/);
  assert.doesNotMatch(pageSource, /dashboard\.metrics\.instanceAvailability/);
  assert.doesNotMatch(pageSource, /dashboard\.metrics\.automationCadence/);
});

runTest('sdkwork-claw-dashboard avoids garbled copy and redundant operator summary patterns', () => {
  const pageSource = read('packages/sdkwork-claw-dashboard/src/pages/Dashboard.tsx');

  assert.doesNotMatch(pageSource, /鈫\?/);
  assert.doesNotMatch(pageSource, /<SectionHeader[\s\S]*title=\{t\('dashboard\.page\.title'\)\}/);
  assert.match(pageSource, /ModelDistributionChart/);
  assert.doesNotMatch(pageSource, /formatTokens\(row\.requestCount\)/);
  assert.match(pageSource, /formatInteger\(row\.requestCount\)/);
});

runTest('sdkwork-claw-dashboard keeps Chinese analytics copy intact', () => {
  const zhLocale = readJson<any>('packages/sdkwork-claw-i18n/src/locales/zh.json');

  assert.match(zhLocale.dashboard.page.title, /[\p{Script=Han}]/u);
  assert.doesNotMatch(zhLocale.dashboard.page.title, /\?/);
  assert.match(zhLocale.dashboard.sections.tokenIntelligence, /[\p{Script=Han}]/u);
  assert.doesNotMatch(zhLocale.dashboard.sections.tokenIntelligence, /\?/);
  assert.match(zhLocale.dashboard.sections.modelDistribution, /[\p{Script=Han}]/u);
  assert.doesNotMatch(zhLocale.dashboard.sections.modelDistribution, /\?/);
  assert.match(zhLocale.dashboard.charts.tokenUsageTrend, /[\p{Script=Han}]/u);
  assert.doesNotMatch(zhLocale.dashboard.charts.tokenUsageTrend, /\?/);
  assert.match(zhLocale.dashboard.sections.revenueTrend, /[\p{Script=Han}]/u);
  assert.doesNotMatch(zhLocale.dashboard.sections.revenueTrend, /\?/);
  assert.match(zhLocale.dashboard.sections.revenueDistribution, /[\p{Script=Han}]/u);
  assert.doesNotMatch(zhLocale.dashboard.sections.revenueDistribution, /\?/);
  assert.match(zhLocale.dashboard.sections.activityWorkbench, /[\p{Script=Han}]/u);
  assert.match(zhLocale.dashboard.tabs.recentApiCalls, /[\p{Script=Han}]/u);
  assert.match(zhLocale.dashboard.tabs.recentRevenueRecords, /[\p{Script=Han}]/u);
});

runTest('sdkwork-claw-dashboard token trend chart tolerates missing series input', () => {
  const chartSource = read('packages/sdkwork-claw-dashboard/src/components/TokenTrendChart.tsx');

  assert.match(chartSource, /points\s*=\s*\[\]/);
  assert.match(chartSource, /series\s*=\s*\[\]/);
});

runTest('sdkwork-claw-dashboard token trend chart uses the available card width more aggressively', () => {
  const pageSource = read('packages/sdkwork-claw-dashboard/src/pages/Dashboard.tsx');
  const chartSource = read('packages/sdkwork-claw-dashboard/src/components/TokenTrendChart.tsx');

  assert.doesNotMatch(
    pageSource,
    /rounded-\[1\.6rem\] border border-zinc-200\/70 bg-white\/70 p-4[\s\S]*<TokenTrendChart/,
  );
  assert.match(chartSource, /new ResizeObserver/);
  assert.match(chartSource, /const chartPaddingX = 16;/);
  assert.match(chartSource, /const yAxisLabelWidth = 36;/);
  assert.match(chartSource, /const plotLeft = chartPaddingX \+ yAxisLabelWidth;/);
  assert.match(chartSource, /className="h-\[22rem\] w-full"/);
  assert.doesNotMatch(chartSource, /w-\[calc\(100%\+1rem\)\]/);
});

runTest('sdkwork-claw-dashboard keeps advanced time-range configuration inside a popup instead of inline chart controls', () => {
  const chartSource = read('packages/sdkwork-claw-dashboard/src/components/TokenTrendChart.tsx');

  assert.match(chartSource, /DialogContent/);
  assert.match(chartSource, /DialogTitle/);
  assert.match(chartSource, /isRangeDialogOpen/);
  assert.match(chartSource, /draftRangeMode/);
  assert.match(chartSource, /dashboard\.filters\.configureRange/);
  assert.doesNotMatch(chartSource, /\{controls\.rangeMode === 'month' \? \(/);
  assert.doesNotMatch(chartSource, /\{controls\.rangeMode === 'custom' \? \(/);
});

runTest('sdkwork-claw-dashboard keeps chart filter controls aligned in a single desktop row', () => {
  const chartSource = read('packages/sdkwork-claw-dashboard/src/components/TokenTrendChart.tsx');

  assert.match(chartSource, /sm:flex-row sm:flex-nowrap sm:items-end/);
  assert.match(chartSource, /SelectTrigger className="mt-2 h-11 w-full rounded-2xl/);
  assert.match(chartSource, /className="mt-2 h-11 w-full justify-between rounded-2xl/);
  assert.doesNotMatch(chartSource, /SelectTrigger className="mt-2 h-auto/);
  assert.doesNotMatch(chartSource, /className="mt-2 h-auto w-full items-center justify-between/);
});
