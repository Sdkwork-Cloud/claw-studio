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
          vipPacks: [
            {
              id: 11,
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
            },
            {
              id: 22,
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
            },
          ],
        };
      },
      async rechargePoints(input) {
        calls.push(`recharge:${input.points}:${input.paymentMethod ?? ''}`);
        return {
          requestNo: 'REQ-1',
          transactionId: 'PTR-1',
          accountId: 'account-1',
          points: input.points,
          cashAmount: 6,
          paymentMethod: input.paymentMethod,
          status: 'SUCCESS',
          statusName: 'Success',
          remainingPoints: 3600,
          resultDesc: 'done',
          processedAt: '2026-03-22T12:00:00.000Z',
        };
      },
      async purchaseVipPack(input) {
        calls.push(`purchase:${input.packId}:${input.paymentMethod ?? ''}`);
        return {
          orderId: 'ORDER-1',
          packId: input.packId,
          packName: 'Plus Monthly',
          amount: 99,
          durationDays: 30,
          targetLevelId: 2,
          targetLevelName: 'Plus',
          status: 'SUCCESS',
        };
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
  assert.equal(dashboard.plans.length, 0);
}

await runTest('pointsService loads an async real-data dashboard with mapped history and vip packs', async () => {
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
  assert.equal(dashboard.plans.length, 2);
  assert.equal(dashboard.plans[0]?.packId, 11);
  assert.equal(dashboard.plans[0]?.recommended, true);
  assert.equal(dashboard.plans[1]?.durationDays, 90);
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
          vipPacks: [],
        };
      },
      async rechargePoints() {
        throw new Error('not used');
      },
      async purchaseVipPack() {
        throw new Error('not used');
      },
    },
  });

  const dashboard = await service.getDashboard();

  assertGuestDashboard(dashboard);
  assert.equal(dashboard.summary.currentPlan.name, 'Guest');
});

await runTest('pointsService recharges points through the shared claw-core wrapper and maps the result', async () => {
  const { calls, service } = createRealPointsService();

  const result = await service.rechargePoints({
    points: 1200,
    paymentMethod: 'WECHAT',
  });

  assert.equal(calls[0], 'recharge:1200:WECHAT');
  assert.equal(result.points, 1200);
  assert.equal(result.cashAmountCny, 6);
  assert.equal(result.remainingPoints, 3600);
  assert.equal(result.status, 'completed');
});

await runTest('pointsService purchases a real vip pack through the shared claw-core wrapper', async () => {
  const { calls, service } = createRealPointsService();

  const result = await service.upgradePlan({
    packId: 11,
    paymentMethod: 'ALIPAY',
  });

  assert.equal(calls[0], 'purchase:11:ALIPAY');
  assert.equal(result.orderId, 'ORDER-1');
  assert.equal(result.packId, 11);
  assert.equal(result.amountCny, 99);
  assert.equal(result.status, 'completed');
});
