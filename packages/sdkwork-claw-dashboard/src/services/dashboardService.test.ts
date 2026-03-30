import assert from 'node:assert/strict';
import { studioMockService } from '@sdkwork/claw-infrastructure';
import { dashboardCommerceService } from '@sdkwork/claw-core';
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

const originalListUsageRecords = studioMockService.listApiRouterUsageRecords;
const originalGetCommerceSnapshot = dashboardCommerceService.getCommerceSnapshot;

function buildUsageRecord(
  projectId: string,
  model: string,
  provider: string,
  inputTokens: number,
  outputTokens: number,
  amount: number,
  createdAtMs: number,
) {
  return {
    project_id: projectId,
    model,
    provider,
    units: inputTokens + outputTokens,
    amount,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    created_at_ms: createdAtMs,
  };
}

await runTest('dashboardService builds token analytics for the dashboard snapshot from studio usage records', async () => {
  studioMockService.listApiRouterUsageRecords = async () => ({
    items: [
      buildUsageRecord('project-alpha', 'gpt-5.4', 'openai', 100, 40, 0.14, Date.UTC(2026, 2, 12, 10)),
      buildUsageRecord('project-alpha', 'gpt-5.4', 'openai', 60, 20, 0.08, Date.UTC(2026, 2, 12, 15)),
      buildUsageRecord('project-beta', 'claude-sonnet-4.5', 'anthropic', 90, 30, 0.12, Date.UTC(2026, 2, 14, 9)),
      buildUsageRecord('project-beta', 'claude-sonnet-4.5', 'anthropic', 110, 50, 0.16, Date.UTC(2026, 2, 18, 11)),
    ],
    total: 4,
    page: 1,
    pageSize: 50,
    hasMore: false,
  });

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

  assert.ok(daySnapshot.businessSummary);
  assert.ok(daySnapshot.revenueAnalytics);
  assert.ok(daySnapshot.activityFeed);
  assert.equal(daySnapshot.tokenAnalytics.granularity, 'day');
  assert.equal(daySnapshot.tokenAnalytics.rangeMode, 'seven_days');
  assert.equal(daySnapshot.tokenAnalytics.usageTrend.length, 7);
  assert.equal(daySnapshot.tokenAnalytics.totalTokens, 500);
  assert.equal(daySnapshot.tokenAnalytics.inputTokens, 360);
  assert.equal(daySnapshot.tokenAnalytics.outputTokens, 140);
  assert.equal(daySnapshot.tokenAnalytics.cacheCreationTokens, 0);
  assert.equal(daySnapshot.tokenAnalytics.cacheReadTokens, 0);
  assert.equal(daySnapshot.tokenAnalytics.actualAmount, 0.5);
  assert.equal(daySnapshot.tokenAnalytics.standardAmount, 0.5);
  assert.equal(daySnapshot.tokenAnalytics.totalRequestCount, 4);
  assert.equal(daySnapshot.tokenAnalytics.usageTrend.find((point) => point.bucketKey === '2026-03-12')?.totalTokens, 220);
  assert.equal(daySnapshot.tokenAnalytics.usageTrend.find((point) => point.bucketKey === '2026-03-14')?.totalTokens, 120);
  assert.equal(daySnapshot.tokenAnalytics.usageTrend.find((point) => point.bucketKey === '2026-03-18')?.totalTokens, 160);
  assert.equal(daySnapshot.tokenAnalytics.modelBreakdown.length, 2);
  assert.equal(daySnapshot.tokenAnalytics.modelBreakdown[0]?.id, 'claude-sonnet-4.5');
  assert.equal(daySnapshot.tokenAnalytics.modelBreakdown[0]?.tokens, 280);
  assert.equal(daySnapshot.tokenAnalytics.modelBreakdown[0]?.requestCount, 2);
  assert.equal(daySnapshot.tokenAnalytics.modelBreakdown[0]?.actualAmount, 0.28);
  assert.equal(daySnapshot.tokenAnalytics.modelBreakdown[0]?.standardAmount, 0.28);
  assert.equal(daySnapshot.tokenAnalytics.modelBreakdown[1]?.id, 'gpt-5.4');
  assert.equal(daySnapshot.tokenAnalytics.modelBreakdown[1]?.tokens, 220);
  assert.equal(daySnapshot.tokenSummary.dailyRequestCount, 1);
  assert.equal(daySnapshot.tokenSummary.dailyTokenCount, 160);
  assert.equal(daySnapshot.tokenSummary.dailySpend, 0.16);
  assert.equal(daySnapshot.tokenSummary.weeklyRequestCount, 4);
  assert.equal(daySnapshot.tokenSummary.weeklyTokenCount, 500);
  assert.equal(daySnapshot.tokenSummary.weeklySpend, 0.5);
  assert.equal(daySnapshot.tokenSummary.monthlyRequestCount, 4);
  assert.equal(daySnapshot.tokenSummary.monthlyTokenCount, 500);
  assert.equal(daySnapshot.tokenSummary.monthlySpend, 0.5);
  assert.equal(daySnapshot.tokenSummary.yearlyRequestCount, 4);
  assert.equal(daySnapshot.tokenSummary.yearlyTokenCount, 500);
  assert.equal(daySnapshot.tokenSummary.yearlySpend, 0.5);
  assert.equal(daySnapshot.activityFeed.recentApiCalls.length, 4);
  assert.equal(daySnapshot.activityFeed.recentApiCalls[0]?.modelName, 'claude-sonnet-4.5');
  assert.equal(daySnapshot.activityFeed.recentApiCalls[0]?.providerName, 'anthropic');
  assert.equal(daySnapshot.activityFeed.recentApiCalls[0]?.requestCount, 1);
  assert.equal(daySnapshot.activityFeed.recentApiCalls[0]?.tokenCount, 160);
  assert.equal(daySnapshot.activityFeed.recentApiCalls[0]?.costAmount, 0.16);
  assert.equal(daySnapshot.activityFeed.recentApiCalls[0]?.status, 'success');
  assert.equal(daySnapshot.activityFeed.recentApiCalls[0]?.timestamp, new Date(Date.UTC(2026, 2, 18, 11)).toISOString());
  assert.equal(hourSnapshot.tokenAnalytics.granularity, 'hour');
  assert.equal(hourSnapshot.tokenAnalytics.rangeMode, 'month');
  assert.equal(hourSnapshot.tokenAnalytics.selectedMonthKey, '2026-03');
  assert.equal(hourSnapshot.tokenAnalytics.usageTrend.find((point) => point.bucketKey === '2026-03-18T11:00')?.totalTokens, 160);
  assert.equal(customSnapshot.tokenAnalytics.rangeMode, 'custom');
  assert.equal(customSnapshot.tokenAnalytics.customRange?.start, '2026-03-01');
  assert.equal(customSnapshot.tokenAnalytics.customRange?.end, '2026-03-18');
  assert.equal(customSnapshot.tokenAnalytics.totalTokens, 500);
  assert.equal(customSnapshot.revenueAnalytics.totalRevenue, 0);
});

await runTest('dashboardService returns an empty token snapshot when studio usage records are unavailable', async () => {
  studioMockService.listApiRouterUsageRecords = async () => {
    throw new Error('router offline');
  };

  const snapshot = await dashboardService.getSnapshot({
    granularity: 'day',
    rangeMode: 'seven_days',
  });

  assert.equal(snapshot.tokenAnalytics.totalTokens, 0);
  assert.equal(snapshot.tokenAnalytics.totalRequestCount, 0);
  assert.equal(snapshot.tokenAnalytics.modelBreakdown.length, 0);
  assert.equal(snapshot.tokenAnalytics.instanceBreakdown.length, 0);
  assert.equal(snapshot.tokenSummary.dailyRequestCount, 0);
  assert.equal(snapshot.tokenSummary.dailyTokenCount, 0);
  assert.equal(snapshot.tokenSummary.dailySpend, 0);
  assert.equal(snapshot.activityFeed.recentApiCalls.length, 0);
});

await runTest('dashboardService surfaces commerce data from claw-core app sdk wrapper', async () => {
  studioMockService.listApiRouterUsageRecords = async () => ({
    items: [
      buildUsageRecord('project-alpha', 'gpt-5.4', 'openai', 100, 40, 0.14, Date.UTC(2026, 2, 24, 9)),
    ],
    total: 1,
    page: 1,
    pageSize: 50,
    hasMore: false,
  });
  dashboardCommerceService.getCommerceSnapshot = async () => ({
    businessSummary: {
      todayRevenue: 120,
      weekRevenue: 200,
      monthRevenue: 240,
      yearRevenue: 240,
      todayOrders: 1,
      weekOrders: 3,
      monthOrders: 4,
      yearOrders: 4,
      averageOrderValue: 66.67,
      conversionRate: 33.3,
      revenueDelta: 400,
    },
    revenueAnalytics: {
      granularity: 'day',
      rangeMode: 'seven_days',
      totalRevenue: 200,
      dailyRevenue: 28.57,
      projectedMonthlyRevenue: 857.1,
      totalOrders: 3,
      averageOrderValue: 66.67,
      peakRevenueLabel: '03-24',
      peakRevenueValue: 120,
      deltaPercentage: 400,
      revenueTrend: [
        {
          label: '03-24',
          bucketKey: '2026-03-24',
          revenue: 120,
          orders: 1,
          averageOrderValue: 120,
        },
      ],
      productBreakdown: [
        {
          id: '11',
          productName: 'VIP Membership',
          orders: 1,
          revenue: 120,
          share: 60,
          dailyRevenue: 17.14,
        },
      ],
    },
    recentRevenueRecords: [
      {
        id: 'record-1',
        timestamp: '2026-03-24T09:00:00Z',
        productName: 'VIP Membership',
        orderNo: 'SN-001',
        revenueAmount: 120,
        channel: 'app',
        status: 'completed',
      },
    ],
    productPerformance: [
      {
        id: '11',
        productName: 'VIP Membership',
        revenue: 120,
        orders: 1,
        share: 60,
        trendDelta: 200,
      },
    ],
  });

  const snapshot = await dashboardService.getSnapshot({
    granularity: 'day',
    rangeMode: 'seven_days',
  });

  assert.equal(snapshot.businessSummary.todayRevenue, 120);
  assert.equal(snapshot.revenueAnalytics.productBreakdown[0]?.productName, 'VIP Membership');
  assert.equal(snapshot.activityFeed.recentRevenueRecords[0]?.status, 'completed');
  assert.equal(snapshot.activityFeed.productPerformance[0]?.productName, 'VIP Membership');
});

await runTest('dashboardService keeps token analytics available when commerce sdk loading fails', async () => {
  studioMockService.listApiRouterUsageRecords = async () => ({
    items: [
      buildUsageRecord('project-alpha', 'gpt-5.4', 'openai', 100, 40, 0.14, Date.UTC(2026, 2, 24, 9)),
    ],
    total: 1,
    page: 1,
    pageSize: 50,
    hasMore: false,
  });
  dashboardCommerceService.getCommerceSnapshot = async () => {
    throw new Error('commerce unavailable');
  };

  const snapshot = await dashboardService.getSnapshot({
    granularity: 'day',
    rangeMode: 'seven_days',
  });

  assert.equal(snapshot.tokenAnalytics.totalTokens, 140);
  assert.equal(snapshot.revenueAnalytics.totalRevenue, 0);
  assert.deepEqual(snapshot.activityFeed.recentRevenueRecords, []);
  assert.deepEqual(snapshot.activityFeed.productPerformance, []);
});

studioMockService.listApiRouterUsageRecords = originalListUsageRecords;
dashboardCommerceService.getCommerceSnapshot = originalGetCommerceSnapshot;
