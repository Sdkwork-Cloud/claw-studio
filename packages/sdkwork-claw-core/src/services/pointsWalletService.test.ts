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
        listRechargePacks: async () => ({
          code: '2000',
          data: [
            {
              id: 3001,
              name: 'Recharge 1000',
              description: 'Starter points pack',
              price: 9.9,
              pointAmount: 1000,
              sortWeight: 90,
            },
            {
              id: 3002,
              name: 'Recharge 3000',
              description: 'Power points pack',
              price: 28.8,
              pointAmount: 3000,
              sortWeight: 80,
            },
          ],
        }),
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
        listPackGroups: async () => ({
          code: '2000',
          data: [
            {
              id: 101,
              name: 'Personal',
              description: 'For solo workflows',
              sortWeight: 20,
              packs: [
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
                  sortWeight: 99,
                  tags: ['popular'],
                },
              ],
            },
            {
              id: 102,
              name: 'Studio',
              description: 'For advanced collaboration',
              sortWeight: 10,
              packs: [
                {
                  id: 3,
                  name: 'Studio Annual',
                  description: 'For scaled teams',
                  price: 999,
                  originalPrice: 1299,
                  pointAmount: 30000,
                  vipDurationDays: 365,
                  levelName: 'Studio',
                  recommended: false,
                  sortWeight: 50,
                  tags: ['annual'],
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
                  sortWeight: 10,
                  tags: ['starter'],
                },
              ],
            },
          ],
        }),
        getPackDetail: async (packId: number) => ({
          code: '2000',
          data: {
            id: packId,
            groupId: packId === 2 ? 101 : 102,
            groupName: packId === 2 ? 'Personal' : 'Studio',
            name: packId === 2 ? 'Pro Monthly' : packId === 3 ? 'Studio Annual' : 'Plus Monthly',
            description: packId === 2
              ? 'For growing teams'
              : packId === 3
                ? 'For scaled teams'
                : 'For individuals',
            price: packId === 2 ? 199 : packId === 3 ? 999 : 99,
            originalPrice: packId === 2 ? 249 : packId === 3 ? 1299 : 99,
            pointAmount: packId === 2 ? 5000 : packId === 3 ? 30000 : 2000,
            vipDurationDays: packId === 2 ? 30 : packId === 3 ? 365 : 30,
            levelName: packId === 2 ? 'Pro' : packId === 3 ? 'Studio' : 'Plus',
            benefits: packId === 2
              ? [
                {
                  id: 801,
                  name: 'Priority queue',
                  benefitKey: 'priority_queue',
                  type: 'FEATURE',
                  description: 'Faster execution lane',
                  usageLimit: 100,
                  usedCount: 20,
                },
              ]
              : [
                {
                  id: 901,
                  name: 'Daily points',
                  benefitKey: 'daily_points',
                  type: 'REWARD',
                  description: 'Claim every day',
                  usageLimit: 365,
                  usedCount: 0,
                },
              ],
          },
        }),
      },
      order: {
        createOrder: async (body: { orderType: string; productId?: string; paymentMethod?: string }) => {
          calls.push(`createOrder:${body.orderType}:${body.productId ?? ''}:${body.paymentMethod ?? ''}`);
          const isPointsOrder = body.orderType === 'POINTS';
          return {
            code: '2000',
            data: {
              orderId: isPointsOrder ? 'ORDER-PTS-1' : 'ORDER-1',
              orderSn: isPointsOrder ? 'PTS-ORDER-1' : 'VIP-ORDER-1',
              status: 'PENDING',
              statusName: 'Pending payment',
              totalAmount: isPointsOrder ? '9.90' : '199.00',
              expireTime: '2026-03-29T09:00:00.000Z',
            },
          };
        },
        pay: async (orderId: string, body: { paymentMethod?: string }) => {
          calls.push(`pay:${orderId}:${body.paymentMethod ?? ''}`);
          return {
            code: '2000',
            data: {
              orderId,
              paymentId: 'PAY-1',
              outTradeNo: 'OUT-TRADE-1',
              amount: orderId === 'ORDER-PTS-1' ? '9.90' : '199.00',
              paymentMethod: body.paymentMethod,
              paymentParams: {
                codeUrl: `https://pay.sdkwork.com/wechat/${orderId}`,
                deepLink: 'weixin://wxpay/mock',
              },
            },
          };
        },
        getOrderPaymentSuccess: async (orderId: string) => {
          calls.push(`paymentSuccess:${orderId}`);
          return {
            code: '2000',
            data: {
              orderId,
              outTradeNo: 'OUT-TRADE-1',
              paid: true,
              status: 'PAID',
              statusName: 'Paid',
            },
          };
        },
      },
      payment: {
        listOrderPayments: async (orderId: string) => {
          calls.push(`listPayments:${orderId}`);
          return {
            code: '2000',
            data: [
              {
                paymentId: 1,
                paymentOrderId: 'PAY-1',
                merchantOrderId: orderId === 'ORDER-PTS-1' ? 'PTS-ORDER-1' : 'VIP-ORDER-1',
                orderId: 1,
                status: 'PENDING',
                statusName: 'Pending',
                amount: orderId === 'ORDER-PTS-1' ? '9.90' : '199.00',
                paymentMethod: 'WECHAT',
                paymentProvider: 'WECHAT_PAY',
                outTradeNo: 'OUT-TRADE-1',
              },
            ],
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
  assert.equal(overview.vipPackGroups.length, 0);
  assert.equal(overview.vipPacks.length, 0);
  assert.equal(overview.vip.isVip, false);
  assert.equal(overview.pointsToCashRate, null);
}

await runTest('pointsWalletService combines points account, history, rate, vip info, and grouped vip packs with benefits into one overview', async () => {
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
  assert.equal(overview.vipPackGroups.length, 2);
  assert.equal(overview.vipPackGroups[0]?.name, 'Personal');
  assert.equal(overview.vipPackGroups[0]?.packs[0]?.benefits[0]?.benefitKey, 'priority_queue');
  assert.equal(overview.vipPacks.length, 3);
  assert.equal(overview.vipPacks[0]?.name, 'Pro Monthly');
  assert.equal(overview.vipPacks[0]?.groupName, 'Personal');
  assert.equal(overview.vipPacks[0]?.benefits.length, 1);
  assert.equal(overview.rechargePacks.length, 2);
  assert.equal(overview.rechargePacks[0]?.pointAmount, 1000);
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

await runTest('pointsWalletService creates a points recharge order, requests payment params, and exposes latest payment records', async () => {
  const { calls, service } = createAuthenticatedStubService();

  const result = await service.rechargePoints({
    packId: 3001,
    paymentMethod: 'WECHAT',
  });

  assert.deepEqual(calls, [
    'createOrder:POINTS:3001:WECHAT',
    'pay:ORDER-PTS-1:WECHAT',
    'listPayments:ORDER-PTS-1',
  ]);
  assert.equal(result.orderId, 'ORDER-PTS-1');
  assert.equal(result.packId, 3001);
  assert.equal(result.packName, 'Recharge 1000');
  assert.equal(result.points, 1000);
  assert.equal(result.amount, 9.9);
  assert.equal(result.paymentParams?.codeUrl, 'https://pay.sdkwork.com/wechat/ORDER-PTS-1');
  assert.equal(result.payments[0]?.status, 'PENDING');
});

await runTest('pointsWalletService queries points recharge payment success through the generated order SDK surface', async () => {
  const { calls, service } = createAuthenticatedStubService();

  const result = await service.getPointsRechargeStatus('ORDER-1');

  assert.equal(calls[0], 'paymentSuccess:ORDER-1');
  assert.equal(result.orderId, 'ORDER-1');
  assert.equal(result.paid, true);
  assert.equal(result.status, 'PAID');
});

await runTest('pointsWalletService creates a vip member order, requests payment params, and exposes latest payment records', async () => {
  const { calls, service } = createAuthenticatedStubService();

  const result = await service.purchaseVipPack({
    packId: 2,
    paymentMethod: 'WECHAT',
  });

  assert.deepEqual(calls, [
    'createOrder:MEMBER:2:WECHAT',
    'pay:ORDER-1:WECHAT',
    'listPayments:ORDER-1',
  ]);
  assert.equal(result.orderId, 'ORDER-1');
  assert.equal(result.orderSn, 'VIP-ORDER-1');
  assert.equal(result.packId, 2);
  assert.equal(result.amount, 199);
  assert.equal(result.paymentId, 'PAY-1');
  assert.equal(result.outTradeNo, 'OUT-TRADE-1');
  assert.equal(result.paymentMethod, 'WECHAT');
  assert.equal(result.paymentParams?.codeUrl, 'https://pay.sdkwork.com/wechat/ORDER-1');
  assert.equal(result.payments[0]?.status, 'PENDING');
});

await runTest('pointsWalletService queries vip order payment success through the generated order SDK surface', async () => {
  const { calls, service } = createAuthenticatedStubService();

  const result = await service.getVipPurchaseStatus('ORDER-1');

  assert.equal(calls[0], 'paymentSuccess:ORDER-1');
  assert.equal(result.orderId, 'ORDER-1');
  assert.equal(result.paid, true);
  assert.equal(result.status, 'PAID');
});
