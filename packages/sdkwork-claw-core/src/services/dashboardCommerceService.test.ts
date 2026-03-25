import assert from 'node:assert/strict';
import { createClient } from '@sdkwork/app-sdk';
import { createDashboardCommerceService } from './dashboardCommerceService.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest(
  'dashboardCommerceService maps generated app sdk commerce payload into numeric dashboard data',
  async () => {
    let orderRequestCount = 0;
    let productRequestCount = 0;
    const service = createDashboardCommerceService({
      getSessionTokens: () => ({
        authToken: 'auth-token',
      }),
      getClient: () =>
        ({
          dashboard: {
            getCommerceStatistics: async (params?: Record<string, unknown>) => {
              assert.deepEqual(params, {
                granularity: 'day',
                rangeMode: 'seven_days',
              });

              return {
                code: '2000',
                data: {
                  businessSummary: {
                    todayRevenue: '120.00',
                    weekRevenue: '200.00',
                    monthRevenue: '240.00',
                    yearRevenue: '240.00',
                    todayOrders: 1,
                    weekOrders: 3,
                    monthOrders: 4,
                    yearOrders: 4,
                    averageOrderValue: '66.67',
                    conversionRate: 33.3,
                    revenueDelta: 400,
                  },
                  revenueAnalytics: {
                    granularity: 'day',
                    rangeMode: 'seven_days',
                    totalRevenue: '200.00',
                    dailyRevenue: '28.57',
                    projectedMonthlyRevenue: '857.10',
                    totalOrders: 3,
                    averageOrderValue: '66.67',
                    peakRevenueLabel: '03-24',
                    peakRevenueValue: '120.00',
                    deltaPercentage: 400,
                    revenueTrend: [
                      {
                        label: '03-24',
                        bucketKey: '2026-03-24',
                        revenue: '120.00',
                        orders: 1,
                        averageOrderValue: '120.00',
                      },
                    ],
                    productBreakdown: [
                      {
                        id: '11',
                        productName: 'VIP Membership',
                        orders: 1,
                        revenue: '120.00',
                        share: 60,
                        dailyRevenue: '17.14',
                      },
                    ],
                  },
                  recentRevenueRecords: [
                    {
                      id: '1',
                      timestamp: '2026-03-24T09:00:00Z',
                      productName: 'VIP Membership',
                      orderNo: 'SN-001',
                      revenueAmount: '120.00',
                      channel: 'app',
                      status: 'completed',
                    },
                  ],
                  productPerformance: [
                    {
                      id: '11',
                      productName: 'VIP Membership',
                      revenue: '120.00',
                      orders: 1,
                      share: 60,
                      trendDelta: 200,
                    },
                  ],
                },
              };
            },
          },
          order: {
            listOrders: async (params?: Record<string, unknown>) => {
              orderRequestCount += 1;
              assert.equal(params?.page, '1');
              assert.equal(params?.size, '10');

              return {
                code: '2000',
                data: {
                  content: [
                    {
                      orderId: '1',
                      orderSn: 'SN-001',
                      subject: 'VIP Membership',
                      totalAmount: '120.00',
                      status: 'COMPLETED',
                      createdAt: '2026-03-24T09:00:00Z',
                    },
                  ],
                },
              };
            },
          },
          product: {
            getProducts: async (params?: Record<string, unknown>) => {
              productRequestCount += 1;
              assert.equal(params?.page, '1');
              assert.equal(params?.size, '20');

              return {
                code: '2000',
                data: {
                  content: [
                    {
                      id: '11',
                      title: 'VIP Membership',
                      price: 120,
                      sales: 3,
                    },
                  ],
                },
              };
            },
          },
        }) as any,
    });

    const snapshot = await service.getCommerceSnapshot({
      granularity: 'day',
      rangeMode: 'seven_days',
    });

    assert.equal(snapshot.businessSummary.todayRevenue, 120);
    assert.equal(snapshot.businessSummary.conversionRate, 33.3);
    assert.equal(snapshot.revenueAnalytics.totalRevenue, 200);
    assert.equal(snapshot.revenueAnalytics.revenueTrend[0]?.averageOrderValue, 120);
    assert.equal(snapshot.revenueAnalytics.productBreakdown[0]?.productName, 'VIP Membership');
    assert.equal(snapshot.recentRevenueRecords[0]?.status, 'completed');
    assert.equal(snapshot.recentRevenueRecords[0]?.revenueAmount, 120);
    assert.equal(snapshot.productPerformance[0]?.trendDelta, 200);
    assert.equal(orderRequestCount, 1);
    assert.equal(productRequestCount, 1);
  },
);

await runTest(
  'dashboardCommerceService returns an empty snapshot when no auth session is available',
  async () => {
    const service = createDashboardCommerceService({
      getSessionTokens: () => ({
        authToken: '',
      }),
      getClient: () => {
        throw new Error('should not request sdk client without auth');
      },
    });

    const snapshot = await service.getCommerceSnapshot({
      granularity: 'hour',
      rangeMode: 'custom',
      customStart: '2026-03-01',
      customEnd: '2026-03-24',
    });

    assert.equal(snapshot.businessSummary.todayRevenue, 0);
    assert.equal(snapshot.revenueAnalytics.granularity, 'hour');
    assert.equal(snapshot.revenueAnalytics.rangeMode, 'custom');
    assert.equal(snapshot.revenueAnalytics.customRange?.start, '2026-03-01');
    assert.equal(snapshot.revenueAnalytics.customRange?.end, '2026-03-24');
    assert.deepEqual(snapshot.recentRevenueRecords, []);
    assert.deepEqual(snapshot.productPerformance, []);
  },
);

await runTest(
  'dashboardCommerceService issues the generated app sdk HTTP request when an auth session is available',
  async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ input, init });

      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const url = new URL(rawUrl);

      if (url.pathname === '/app/v3/api/orders') {
        return new Response(
          JSON.stringify({
            code: '2000',
            data: {
              content: [],
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      if (url.pathname === '/app/v3/api/products') {
        return new Response(
          JSON.stringify({
            code: '2000',
            data: {
              content: [],
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(
        JSON.stringify({
          code: '2000',
          data: {
            businessSummary: {
              todayRevenue: '18.00',
              weekRevenue: '54.00',
              monthRevenue: '108.00',
              yearRevenue: '108.00',
              todayOrders: 1,
              weekOrders: 3,
              monthOrders: 6,
              yearOrders: 6,
              averageOrderValue: '18.00',
              conversionRate: 12.5,
              revenueDelta: 25,
            },
            revenueAnalytics: {
              granularity: 'day',
              rangeMode: 'month',
              selectedMonthKey: '2026-03',
              totalRevenue: '54.00',
              dailyRevenue: '1.74',
              projectedMonthlyRevenue: '54.00',
              totalOrders: 3,
              averageOrderValue: '18.00',
              peakRevenueLabel: '03-24',
              peakRevenueValue: '18.00',
              deltaPercentage: 25,
              revenueTrend: [],
              productBreakdown: [],
            },
            recentRevenueRecords: [],
            productPerformance: [],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    try {
      const service = createDashboardCommerceService({
        getSessionTokens: () => ({
          authToken: 'session-auth-token',
        }),
        getClient: () =>
          createClient({
            baseUrl: 'https://api.sdkwork.test',
            accessToken: 'access-token',
          }) as any,
      });

      await service.getCommerceSnapshot({
        granularity: 'day',
        rangeMode: 'month',
        monthKey: '2026-03',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(fetchCalls.length, 3);

    const urls = fetchCalls.map(({ input }) => {
      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      return new URL(rawUrl);
    });
    const dashboardUrl = urls.find((url) => url.pathname === '/app/v3/api/dashboard/statistics/commerce');
    const orderUrl = urls.find((url) => url.pathname === '/app/v3/api/orders');
    const productUrl = urls.find((url) => url.pathname === '/app/v3/api/products');

    assert.ok(dashboardUrl);
    assert.ok(orderUrl);
    assert.ok(productUrl);
    assert.equal(dashboardUrl?.searchParams.get('granularity'), 'day');
    assert.equal(dashboardUrl?.searchParams.get('rangeMode'), 'month');
    assert.equal(dashboardUrl?.searchParams.get('monthKey'), '2026-03');
    assert.equal(orderUrl?.searchParams.get('page'), '1');
    assert.equal(orderUrl?.searchParams.get('size'), '10');
    assert.equal(productUrl?.searchParams.get('page'), '1');
    assert.equal(productUrl?.searchParams.get('size'), '20');
  },
);
