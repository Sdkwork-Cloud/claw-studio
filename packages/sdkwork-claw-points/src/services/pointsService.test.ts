import assert from 'node:assert/strict';
import {
  createPointsService,
  type PointsDashboardData,
} from './pointsService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createRealPointsService() {
  const calls: string[] = [];

  const service = createPointsService({
    walletService: {
      async getOverview() {
        return {
          isAuthenticated: true,
          pointsAccount: {
            availablePoints: 2400,
            frozenPoints: 0,
            totalPoints: 2400,
            tokenBalance: 0,
            totalEarned: 4200,
            totalSpent: 1800,
            status: 'ACTIVE',
            statusName: 'Active',
            level: 1,
            levelName: 'Bronze',
            experience: 10,
          },
          history: [
            {
              id: 'history-1',
              transactionId: 'txn-1',
              transactionType: 'POINTS_RECHARGE',
              transactionTypeName: 'Points recharge',
              remarks: 'Manual top-up',
              status: 'SUCCESS',
              statusName: 'Success',
              pointsDelta: 600,
              cashAmount: 3,
              pointsBefore: 1800,
              pointsAfter: 2400,
              createdAt: '2026-03-21T09:00:00.000Z',
            },
            {
              id: 'history-2',
              transactionId: 'txn-2',
              transactionType: 'POINTS_USAGE',
              transactionTypeName: 'Points usage',
              remarks: 'Image generation',
              status: 'SUCCESS',
              statusName: 'Success',
              pointsDelta: -120,
              cashAmount: null,
              pointsBefore: 2520,
              pointsAfter: 2400,
              createdAt: '2026-03-22T08:00:00.000Z',
            },
          ],
          pointsToCashRate: 200,
          vip: {
            isVip: true,
            vipLevel: 2,
            vipLevelName: 'Plus',
            vipStatus: 'ACTIVE',
            expireTime: '2026-04-30T00:00:00.000Z',
            remainingDays: 39,
            totalSpent: 99,
            vipPoints: 600,
            growthValue: 20,
            upgradeGrowthValue: 100,
            pointBalance: 2400,
          },
          vipPackGroups: [
            {
              id: 501,
              name: 'Personal',
              description: 'For personal work',
              sortWeight: 20,
              packs: [
                {
                  id: 11,
                  groupId: 501,
                  groupName: 'Personal',
                  name: 'Plus Monthly',
                  description: 'Good for personal work',
                  price: 99,
                  originalPrice: 129,
                  pointAmount: 2000,
                  vipDurationDays: 30,
                  levelName: 'Plus',
                  sortWeight: 10,
                  recommended: true,
                  tags: ['recommended'],
                  benefits: [
                    {
                      id: 901,
                      name: 'Priority queue',
                      benefitKey: 'priority_queue',
                      type: 'FEATURE',
                      description: 'Faster execution lane',
                      claimed: false,
                      usageLimit: 100,
                      usedCount: 10,
                    },
                  ],
                },
              ],
            },
            {
              id: 502,
              name: 'Team',
              description: 'For heavy workflows',
              sortWeight: 10,
              packs: [
                {
                  id: 22,
                  groupId: 502,
                  groupName: 'Team',
                  name: 'Pro Quarterly',
                  description: 'For heavy workflow teams',
                  price: 249,
                  originalPrice: null,
                  pointAmount: 8000,
                  vipDurationDays: 90,
                  levelName: 'Pro',
                  sortWeight: 5,
                  recommended: false,
                  tags: ['team'],
                  benefits: [
                    {
                      id: 902,
                      name: 'Daily reward',
                      benefitKey: 'daily_reward',
                      type: 'REWARD',
                      description: 'Claim daily points',
                      claimed: false,
                      usageLimit: 90,
                      usedCount: 0,
                    },
                  ],
                },
              ],
            },
          ],
          vipPacks: [],
          rechargePacks: [
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
        };
      },
      async rechargePoints(input) {
        calls.push(`recharge:${input.packId}:${input.paymentMethod ?? ''}`);
        return {
          orderId: 'ORDER-PTS-1',
          orderSn: 'PTS-ORDER-1',
          packId: input.packId,
          packName: 'Recharge 1000',
          points: 1000,
          amount: 9.9,
          paymentMethod: input.paymentMethod,
          status: 'SUCCESS',
          statusName: 'Success',
          expireTime: '2026-03-30T00:00:00.000Z',
          paymentId: 'PAY-PTS-1',
          outTradeNo: 'OUT-PTS-1',
          paymentParams: {
            codeUrl: 'https://pay.sdkwork.com/wechat/ORDER-PTS-1',
          },
          payments: [
            {
              paymentId: 'PAY-PTS-1',
              status: 'PENDING',
              statusName: 'Pending',
              amount: 9.9,
              paymentMethod: input.paymentMethod,
              outTradeNo: 'OUT-PTS-1',
            },
          ],
        };
      },
      async getPointsRechargeStatus(orderId) {
        calls.push(`recharge-status:${orderId}`);
        return {
          orderId,
          outTradeNo: 'OUT-PTS-1',
          paid: true,
          status: 'PAID',
          statusName: 'Paid',
        };
      },
      async listPointsOrderPayments(orderId) {
        calls.push(`recharge-payments:${orderId}`);
        return [
          {
            paymentId: 'PAY-PTS-1',
            status: 'PAID',
            statusName: 'Paid',
            amount: 9.9,
            paymentMethod: 'WECHAT',
            outTradeNo: 'OUT-PTS-1',
            orderId,
          },
        ];
      },
      async purchaseVipPack(input) {
        calls.push(`purchase:${input.packId}:${input.paymentMethod ?? ''}`);
        return {
          orderId: 'ORDER-1',
          orderSn: 'VIP-ORDER-1',
          packId: input.packId,
          packName: 'Plus Monthly',
          amount: 99,
          durationDays: 30,
          targetLevelId: 2,
          targetLevelName: 'Plus',
          status: 'PENDING',
          expireTime: '2026-03-30T00:00:00.000Z',
          paymentId: 'PAY-1',
          outTradeNo: 'OUT-TRADE-1',
          paymentMethod: input.paymentMethod,
          paymentParams: {
            codeUrl: 'https://pay.sdkwork.com/wechat/ORDER-1',
          },
          payments: [
            {
              paymentId: 'PAY-1',
              status: 'PENDING',
              statusName: 'Pending',
              amount: 99,
              paymentMethod: input.paymentMethod,
              outTradeNo: 'OUT-TRADE-1',
            },
          ],
        };
      },
      async getVipPurchaseStatus(orderId) {
        calls.push(`status:${orderId}`);
        return {
          orderId,
          outTradeNo: 'OUT-TRADE-1',
          paid: true,
          status: 'PAID',
          statusName: 'Paid',
        };
      },
      async listVipOrderPayments(orderId) {
        calls.push(`vip-payments:${orderId}`);
        return [
          {
            paymentId: 'PAY-1',
            status: 'PAID',
            statusName: 'Paid',
            amount: 99,
            paymentMethod: 'WECHAT',
            outTradeNo: 'OUT-TRADE-1',
            orderId,
          },
        ];
      },
    },
  });

  return {
    calls,
    service,
  };
}

function assertGuestDashboard(dashboard: PointsDashboardData) {
  assert.equal(dashboard.summary.isAuthenticated, false);
  assert.equal(dashboard.summary.balancePoints, 0);
  assert.equal(dashboard.summary.currentPlan.status, 'guest');
  assert.equal(dashboard.transactions.length, 0);
  assert.equal(dashboard.planGroups.length, 0);
  assert.equal(dashboard.rechargePacks.length, 0);
}

await runTest('pointsService loads an async real-data dashboard with mapped history, vip groups, plans, benefits, and recharge packs', async () => {
  const { service } = createRealPointsService();

  const dashboard = await service.getDashboard();

  assert.equal(dashboard.summary.isAuthenticated, true);
  assert.equal(dashboard.summary.balancePoints, 2400);
  assert.equal(dashboard.summary.pointsToCashRate, 200);
  assert.equal(dashboard.summary.earnedThisMonth, 600);
  assert.equal(dashboard.summary.spentThisMonth, 120);
  assert.equal(dashboard.summary.currentPlan.status, 'vip');
  assert.equal(dashboard.summary.currentPlan.name, 'Plus');
  assert.equal(dashboard.summary.currentPlan.remainingDays, 39);
  assert.equal(dashboard.transactions.length, 2);
  assert.equal(dashboard.transactions[0]?.direction, 'spent');
  assert.equal(dashboard.transactions[0]?.title, 'Points usage');
  assert.equal(dashboard.transactions[1]?.cashAmountCny, 3);
  assert.equal(dashboard.planGroups.length, 2);
  assert.equal(dashboard.planGroups[0]?.groupName, 'Personal');
  assert.equal(dashboard.planGroups[0]?.plans[0]?.benefits[0]?.benefitKey, 'priority_queue');
  assert.equal(dashboard.plans.length, 2);
  assert.equal(dashboard.plans[0]?.packId, 11);
  assert.equal(dashboard.plans[0]?.recommended, true);
  assert.equal(dashboard.plans[1]?.durationDays, 90);
  assert.equal(dashboard.rechargePacks.length, 2);
  assert.equal(dashboard.rechargePacks[0]?.packId, 3001);
});

await runTest('pointsService returns a guest-safe dashboard without local seeded balances', async () => {
  const service = createPointsService({
    walletService: {
      async getOverview() {
        return {
          isAuthenticated: false,
          pointsAccount: {
            availablePoints: 0,
            frozenPoints: 0,
            totalPoints: 0,
            tokenBalance: 0,
            totalEarned: 0,
            totalSpent: 0,
            level: null,
            experience: null,
          },
          history: [],
          pointsToCashRate: null,
          vip: {
            isVip: false,
            vipLevel: null,
            remainingDays: null,
            totalSpent: null,
            vipPoints: null,
            growthValue: null,
            upgradeGrowthValue: null,
            pointBalance: null,
          },
          vipPackGroups: [],
          vipPacks: [],
          rechargePacks: [],
        };
      },
      async rechargePoints() {
        throw new Error('not used');
      },
      async getPointsRechargeStatus() {
        throw new Error('not used');
      },
      async listPointsOrderPayments() {
        throw new Error('not used');
      },
      async purchaseVipPack() {
        throw new Error('not used');
      },
      async getVipPurchaseStatus() {
        throw new Error('not used');
      },
      async listVipOrderPayments() {
        throw new Error('not used');
      },
    },
  });

  const dashboard = await service.getDashboard();

  assertGuestDashboard(dashboard);
  assert.equal(dashboard.summary.currentPlan.name, 'Guest');
});

await runTest('pointsService starts a points recharge checkout session through the shared claw-core wrapper', async () => {
  const { calls, service } = createRealPointsService();

  const result = await service.rechargePoints({
    packId: 3001,
    paymentMethod: 'WECHAT',
  });

  assert.equal(calls[0], 'recharge:3001:WECHAT');
  assert.equal(result.orderId, 'ORDER-PTS-1');
  assert.equal(result.packId, 3001);
  assert.equal(result.points, 1000);
  assert.equal(result.amountCny, 9.9);
  assert.equal(result.paymentSession?.paymentId, 'PAY-PTS-1');
  assert.equal(result.paymentSession?.paymentUrl, 'https://pay.sdkwork.com/wechat/ORDER-PTS-1');
  assert.equal(result.payments[0]?.status, 'pending');
  assert.equal(result.status, 'completed');
});

await runTest('pointsService confirms recharge payment status through the shared claw-core wrapper', async () => {
  const { calls, service } = createRealPointsService();

  const result = await service.confirmRechargePayment('ORDER-PTS-1');

  assert.equal(calls[0], 'recharge-status:ORDER-PTS-1');
  assert.equal(result.orderId, 'ORDER-PTS-1');
  assert.equal(result.paid, true);
  assert.equal(result.status, 'completed');
});

await runTest('pointsService starts a real vip checkout session through the shared claw-core wrapper', async () => {
  const { calls, service } = createRealPointsService();

  const result = await service.upgradePlan({
    packId: 11,
    paymentMethod: 'WECHAT',
  });

  assert.equal(calls[0], 'purchase:11:WECHAT');
  assert.equal(result.orderId, 'ORDER-1');
  assert.equal(result.orderSn, 'VIP-ORDER-1');
  assert.equal(result.packId, 11);
  assert.equal(result.amountCny, 99);
  assert.equal(result.status, 'pending');
  assert.equal(result.paymentSession?.paymentId, 'PAY-1');
  assert.equal(result.paymentSession?.paymentUrl, 'https://pay.sdkwork.com/wechat/ORDER-1');
  assert.equal(result.payments[0]?.status, 'pending');
});

await runTest('pointsService confirms vip payment status through the shared claw-core wrapper', async () => {
  const { calls, service } = createRealPointsService();

  const result = await service.confirmUpgradePayment('ORDER-1');

  assert.equal(calls[0], 'status:ORDER-1');
  assert.equal(result.orderId, 'ORDER-1');
  assert.equal(result.paid, true);
  assert.equal(result.status, 'completed');
});
