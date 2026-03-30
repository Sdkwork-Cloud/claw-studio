import assert from 'node:assert/strict';
import {
  createPointsWalletService,
  type PointsWalletOverview,
} from './pointsWalletService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createAuthenticatedStubService() {
  const calls: string[] = [];

  const service = createPointsWalletService({
    getSessionTokens: () => ({
      authToken: 'test-auth-token',
    }),
    getClient: () => ({
      account: {
        getPoints: async () => ({
          code: '2000',
          data: {
            availablePoints: 1200,
            frozenPoints: 30,
            totalPoints: 1230,
            totalEarned: 5600,
            totalSpent: 4400,
            tokenBalance: 5,
            status: 'ACTIVE',
            statusName: 'Active',
            level: 2,
            levelName: 'Silver',
            experience: 88,
          },
        }),
        getHistory: async () => ({
          code: '2000',
          data: {
            content: [
              {
                historyId: 'history-2',
                transactionType: 'POINTS_USAGE',
                transactionTypeName: 'Points usage',
                points: -150,
                pointsBefore: 1350,
                pointsAfter: 1200,
                remarks: 'Generate poster',
                status: 'SUCCESS',
                statusName: 'Success',
                createdAt: '2026-03-22T10:00:00.000Z',
              },
              {
                historyId: 'history-1',
                transactionType: 'POINTS_RECHARGE',
                transactionTypeName: 'Points recharge',
                points: 800,
                amount: 4,
                pointsBefore: 400,
                pointsAfter: 1200,
                remarks: 'Manual top-up',
                status: 'SUCCESS',
                statusName: 'Success',
                createdAt: '2026-03-21T08:00:00.000Z',
              },
            ],
          },
        }),
        getPointsToCashRate: async () => ({
          code: '2000',
          data: 200,
        }),
        rechargePoints: async (body: { points: number; paymentMethod?: string }) => {
          calls.push(`recharge:${body.points}:${body.paymentMethod ?? ''}`);
          return {
            code: '2000',
            data: {
              requestNo: 'REQ-100',
              transactionId: 'PTR-100',
              accountId: 'account-1',
              points: body.points,
              cashAmount: 6,
              paymentMethod: body.paymentMethod,
              status: 'SUCCESS',
              statusName: 'Success',
              remainingPoints: 2400,
              resultDesc: 'Points recharge completed successfully.',
              processedAt: '2026-03-22T12:00:00.000Z',
            },
          };
        },
      },
      vip: {
        getVipInfo: async () => ({
          code: '2000',
          data: {
            vipLevel: 3,
            vipLevelName: 'Pro',
            vipStatus: 'ACTIVE',
            expireTime: '2026-06-30T00:00:00.000Z',
            remainingDays: 100,
            totalSpent: 399,
            vipPoints: 3200,
            growthValue: 200,
            upgradeGrowthValue: 500,
          },
        }),
        getVipStatus: async () => ({
          code: '2000',
          data: {
            isVip: true,
            vipLevel: 3,
            expireTime: '2026-06-30T00:00:00.000Z',
            pointBalance: 1200,
          },
        }),
        listAllPacks: async () => ({
          code: '2000',
          data: [
            {
              id: 2,
              name: 'Pro Monthly',
              description: 'For growing teams',
              price: 199,
              originalPrice: 249,
              pointAmount: 5000,
              vipDurationDays: 30,
              levelName: 'Pro',
              recommended: true,
              tags: ['popular'],
            },
            {
              id: 1,
              name: 'Plus Monthly',
              description: 'For individuals',
              price: 99,
              originalPrice: 99,
              pointAmount: 2000,
              vipDurationDays: 30,
              levelName: 'Plus',
              recommended: false,
              tags: ['starter'],
            },
          ],
        }),
        purchase: async (body: { packId: number; paymentMethod?: string }) => {
          calls.push(`purchase:${body.packId}:${body.paymentMethod ?? ''}`);
          return {
            code: '2000',
            data: {
              orderId: 'ORDER-1',
              packId: body.packId,
              packName: 'Pro Monthly',
              amount: 199,
              durationDays: 30,
              targetLevelId: 3,
              targetLevelName: 'Pro',
              status: 'SUCCESS',
            },
          };
        },
      },
    }),
  });

  return {
    calls,
    service,
  };
}

function assertGuestOverview(overview: PointsWalletOverview) {
  assert.equal(overview.isAuthenticated, false);
  assert.equal(overview.pointsAccount.availablePoints, 0);
  assert.equal(overview.history.length, 0);
  assert.equal(overview.vipPacks.length, 0);
  assert.equal(overview.vip.isVip, false);
  assert.equal(overview.pointsToCashRate, null);
}

await runTest('pointsWalletService combines points account, history, rate, vip info, and vip packs into one overview', async () => {
  const { service } = createAuthenticatedStubService();

  const overview = await service.getOverview({
    pageSize: 20,
  });

  assert.equal(overview.isAuthenticated, true);
  assert.equal(overview.pointsAccount.availablePoints, 1200);
  assert.equal(overview.pointsAccount.totalEarned, 5600);
  assert.equal(overview.pointsToCashRate, 200);
  assert.equal(overview.vip.isVip, true);
  assert.equal(overview.vip.vipLevelName, 'Pro');
  assert.equal(overview.vip.remainingDays, 100);
  assert.equal(overview.history.length, 2);
  assert.equal(overview.history[0]?.id, 'history-2');
  assert.equal(overview.history[0]?.pointsDelta, -150);
  assert.equal(overview.history[1]?.cashAmount, 4);
  assert.equal(overview.vipPacks.length, 2);
  assert.equal(overview.vipPacks[0]?.name, 'Pro Monthly');
  assert.equal(overview.vipPacks[0]?.recommended, true);
});

await runTest('pointsWalletService returns a guest-safe empty overview when no auth token is available', async () => {
  const service = createPointsWalletService({
    getSessionTokens: () => ({}),
    getClient: () => {
      throw new Error('client should not be requested for guest state');
    },
  });

  const overview = await service.getOverview();

  assertGuestOverview(overview);
});

await runTest('pointsWalletService recharges points through the generated account SDK surface', async () => {
  const { calls, service } = createAuthenticatedStubService();

  const result = await service.rechargePoints({
    points: 1200,
    paymentMethod: 'WECHAT',
    remarks: 'Top up points',
  });

  assert.equal(calls[0], 'recharge:1200:WECHAT');
  assert.equal(result.requestNo, 'REQ-100');
  assert.equal(result.points, 1200);
  assert.equal(result.cashAmount, 6);
  assert.equal(result.remainingPoints, 2400);
});

await runTest('pointsWalletService purchases vip packs through the generated vip SDK surface', async () => {
  const { calls, service } = createAuthenticatedStubService();

  const result = await service.purchaseVipPack({
    packId: 2,
    paymentMethod: 'ALIPAY',
  });

  assert.equal(calls[0], 'purchase:2:ALIPAY');
  assert.equal(result.orderId, 'ORDER-1');
  assert.equal(result.packId, 2);
  assert.equal(result.amount, 199);
  assert.equal(result.status, 'SUCCESS');
});
