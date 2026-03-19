import assert from 'node:assert/strict';
import { dashboardService } from './dashboardService.ts';

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('dashboardService builds token analytics for the dashboard snapshot', async () => {
  const daySnapshot = await dashboardService.getSnapshot({
    granularity: 'day',
    rangeMode: 'seven_days',
  });
  const hourSnapshot = await dashboardService.getSnapshot({
    granularity: 'hour',
    rangeMode: 'month',
    monthKey: '2026-03',
  });
  const customSnapshot = await dashboardService.getSnapshot({
    granularity: 'day',
    rangeMode: 'custom',
    customStart: '2026-03-01',
    customEnd: '2026-03-18',
  });

  assert.ok(daySnapshot.tokenAnalytics);
  assert.ok(daySnapshot.businessSummary);
  assert.ok(daySnapshot.tokenSummary);
  assert.ok(daySnapshot.activityFeed);
  assert.equal(daySnapshot.tokenAnalytics.granularity, 'day');
  assert.equal(daySnapshot.tokenAnalytics.rangeMode, 'seven_days');
  assert.equal(daySnapshot.tokenAnalytics.usageTrend.length, 7);
  assert.ok(daySnapshot.tokenAnalytics.totalTokens > 0);
  assert.equal(
    daySnapshot.tokenAnalytics.inputTokens +
      daySnapshot.tokenAnalytics.outputTokens +
      daySnapshot.tokenAnalytics.cacheCreationTokens +
      daySnapshot.tokenAnalytics.cacheReadTokens,
    daySnapshot.tokenAnalytics.totalTokens,
  );
  assert.ok(daySnapshot.tokenAnalytics.actualAmount > 0);
  assert.ok(daySnapshot.tokenAnalytics.standardAmount >= daySnapshot.tokenAnalytics.actualAmount);
  assert.ok(daySnapshot.tokenAnalytics.averageTokensPerRun > 0);
  assert.equal(
    daySnapshot.tokenAnalytics.instanceBreakdown.length,
    daySnapshot.instances.length,
  );
  assert.ok(daySnapshot.revenueAnalytics);
  assert.equal(daySnapshot.revenueAnalytics.granularity, 'day');
  assert.equal(daySnapshot.revenueAnalytics.rangeMode, 'seven_days');
  assert.equal(daySnapshot.revenueAnalytics.revenueTrend.length, 7);
  assert.ok(daySnapshot.revenueAnalytics.totalRevenue > 0);
  assert.ok(daySnapshot.revenueAnalytics.dailyRevenue > 0);
  assert.ok(daySnapshot.revenueAnalytics.projectedMonthlyRevenue >= daySnapshot.revenueAnalytics.totalRevenue);
  assert.ok(daySnapshot.revenueAnalytics.totalOrders > 0);
  assert.ok(daySnapshot.revenueAnalytics.averageOrderValue > 0);
  assert.ok(daySnapshot.revenueAnalytics.productBreakdown.length > 0);
  assert.equal(
    daySnapshot.revenueAnalytics.productBreakdown.reduce((sum, row) => sum + row.revenue, 0),
    daySnapshot.revenueAnalytics.totalRevenue,
  );
  assert.ok(daySnapshot.businessSummary.todayRevenue > 0);
  assert.ok(daySnapshot.businessSummary.weekRevenue >= daySnapshot.businessSummary.todayRevenue);
  assert.ok(daySnapshot.businessSummary.monthRevenue >= daySnapshot.businessSummary.weekRevenue);
  assert.ok(daySnapshot.businessSummary.yearRevenue >= daySnapshot.businessSummary.monthRevenue);
  assert.ok(daySnapshot.businessSummary.todayOrders > 0);
  assert.ok(daySnapshot.businessSummary.averageOrderValue > 0);
  assert.ok(daySnapshot.tokenSummary.dailyRequestCount > 0);
  assert.ok(daySnapshot.tokenSummary.dailyTokenCount > 0);
  assert.ok(daySnapshot.tokenSummary.dailySpend > 0);
  assert.ok(daySnapshot.tokenSummary.weeklyRequestCount >= daySnapshot.tokenSummary.dailyRequestCount);
  assert.ok(daySnapshot.tokenSummary.monthlyTokenCount >= daySnapshot.tokenSummary.weeklyTokenCount);
  assert.ok(daySnapshot.tokenSummary.yearlySpend >= daySnapshot.tokenSummary.monthlySpend);
  assert.ok(daySnapshot.activityFeed.recentApiCalls.length >= 8);
  assert.ok(daySnapshot.activityFeed.recentRevenueRecords.length >= 8);
  assert.ok(daySnapshot.activityFeed.productPerformance.length >= 4);
  assert.ok(daySnapshot.activityFeed.alerts.length > 0);
  assert.ok(
    daySnapshot.activityFeed.recentApiCalls[0]!.timestamp >=
      daySnapshot.activityFeed.recentApiCalls[1]!.timestamp,
  );
  assert.ok(
    daySnapshot.activityFeed.recentRevenueRecords[0]!.timestamp >=
      daySnapshot.activityFeed.recentRevenueRecords[1]!.timestamp,
  );
  assert.equal(hourSnapshot.tokenAnalytics.granularity, 'hour');
  assert.equal(hourSnapshot.tokenAnalytics.rangeMode, 'month');
  assert.equal(hourSnapshot.tokenAnalytics.selectedMonthKey, '2026-03');
  assert.ok(hourSnapshot.tokenAnalytics.usageTrend.length >= 24);
  assert.equal(hourSnapshot.revenueAnalytics.granularity, 'hour');
  assert.equal(hourSnapshot.revenueAnalytics.rangeMode, 'month');
  assert.equal(hourSnapshot.revenueAnalytics.selectedMonthKey, '2026-03');
  assert.ok(hourSnapshot.revenueAnalytics.revenueTrend.length >= 24);
  assert.ok(hourSnapshot.tokenSummary.dailyRequestCount > 0);
  assert.equal(customSnapshot.tokenAnalytics.rangeMode, 'custom');
  assert.equal(customSnapshot.tokenAnalytics.customRange?.start, '2026-03-01');
  assert.equal(customSnapshot.tokenAnalytics.customRange?.end, '2026-03-18');
  assert.ok(customSnapshot.tokenAnalytics.modelBreakdown.length > 0);
  assert.ok(customSnapshot.tokenAnalytics.modelBreakdown[0]?.requestCount > 0);
  assert.ok(customSnapshot.tokenAnalytics.modelBreakdown[0]?.actualAmount > 0);
  assert.ok(
    customSnapshot.tokenAnalytics.modelBreakdown[0]?.standardAmount >=
      customSnapshot.tokenAnalytics.modelBreakdown[0]?.actualAmount,
  );
  assert.equal(customSnapshot.revenueAnalytics.rangeMode, 'custom');
  assert.equal(customSnapshot.revenueAnalytics.customRange?.start, '2026-03-01');
  assert.equal(customSnapshot.revenueAnalytics.customRange?.end, '2026-03-18');
  assert.ok(customSnapshot.revenueAnalytics.revenueTrend.length > 0);
  assert.ok(customSnapshot.revenueAnalytics.productBreakdown[0]?.orders > 0);
  assert.ok(customSnapshot.revenueAnalytics.productBreakdown[0]?.dailyRevenue > 0);
  assert.ok(customSnapshot.activityFeed.recentApiCalls[0]?.modelName);
  assert.ok(customSnapshot.activityFeed.recentRevenueRecords[0]?.productName);
  assert.ok(customSnapshot.activityFeed.productPerformance[0]?.revenue > 0);
});
