import {
  pointsWalletService,
  type PointsWalletHistoryItem,
  type PointsWalletService,
} from '@sdkwork/claw-core';

export type PointsTransactionFilter = 'all' | 'earned' | 'spent';
export type PointsTransactionDirection = Exclude<PointsTransactionFilter, 'all'>;

export interface PointsTransaction {
  id: string;
  title: string;
  description?: string;
  transactionType?: string;
  direction: PointsTransactionDirection;
  points: number;
  createdAt: string;
  status: 'completed' | 'pending' | 'failed';
  cashAmountCny?: number;
  paymentMethod?: string;
}

export interface PointsPlan {
  id: string;
  packId: number;
  name: string;
  description?: string;
  priceCny: number;
  originalPriceCny: number | null;
  includedPoints: number;
  durationDays: number | null;
  levelName?: string;
  recommended: boolean;
  tags: string[];
}

export interface PointsCurrentPlan {
  status: 'guest' | 'free' | 'vip';
  name: string;
  vipStatus?: string;
  expireTime?: string;
  remainingDays: number | null;
  vipPoints: number | null;
  level: number | null;
}

export interface PointsSummary {
  isAuthenticated: boolean;
  balancePoints: number;
  totalEarned: number;
  totalSpent: number;
  earnedThisMonth: number;
  spentThisMonth: number;
  pointsToCashRate: number | null;
  currentPlan: PointsCurrentPlan;
}

export interface PointsDashboardData {
  summary: PointsSummary;
  transactions: PointsTransaction[];
  plans: PointsPlan[];
}

export interface RechargePointsInput {
  points: number;
  paymentMethod: string;
  requestNo?: string;
  remarks?: string;
}

export interface UpgradePlanInput {
  packId: number;
  paymentMethod?: string;
  couponId?: string;
}

export interface PointsRechargeResult {
  requestNo?: string;
  transactionId?: string;
  points: number;
  cashAmountCny: number | null;
  paymentMethod?: string;
  status: 'completed' | 'pending' | 'failed';
  remainingPoints: number | null;
  resultDesc?: string;
  processedAt?: string;
}

export interface PointsUpgradeResult {
  orderId?: string;
  packId: number | null;
  packName?: string;
  amountCny: number | null;
  durationDays: number | null;
  targetLevelName?: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface CreatePointsServiceOptions {
  walletService?: Pick<PointsWalletService, 'getOverview' | 'rechargePoints' | 'purchaseVipPack'>;
  now?: () => string;
  rechargePresets?: number[];
}

export const pointsQueryKeys = {
  dashboard: ['points', 'dashboard'] as const,
};

const DEFAULT_RECHARGE_PRESETS = [500, 1000, 2000, 5000, 10000] as const;

function resolveMutationStatus(status?: string): PointsRechargeResult['status'] {
  const normalized = (status || '').trim().toUpperCase();
  if (normalized === 'SUCCESS' || normalized === 'COMPLETED') {
    return 'completed';
  }
  if (normalized === 'FAILED') {
    return 'failed';
  }
  return 'pending';
}

function resolveTransactionDirection(transaction: PointsWalletHistoryItem): PointsTransactionDirection {
  return transaction.pointsDelta >= 0 ? 'earned' : 'spent';
}

function buildTransactionTitle(transaction: PointsWalletHistoryItem, direction: PointsTransactionDirection): string {
  return transaction.transactionTypeName
    || transaction.remarks
    || (direction === 'earned' ? 'Points earned' : 'Points spent');
}

function buildTransactionDescription(transaction: PointsWalletHistoryItem, title: string): string | undefined {
  const remarks = transaction.remarks?.trim();
  if (remarks && remarks !== title) {
    return remarks;
  }

  const transactionTypeName = transaction.transactionTypeName?.trim();
  if (transactionTypeName && transactionTypeName !== title) {
    return transactionTypeName;
  }

  return undefined;
}

function mapTransaction(transaction: PointsWalletHistoryItem): PointsTransaction {
  const direction = resolveTransactionDirection(transaction);
  const title = buildTransactionTitle(transaction, direction);
  return {
    id: transaction.id,
    title,
    description: buildTransactionDescription(transaction, title),
    transactionType: transaction.transactionType,
    direction,
    points: Math.abs(transaction.pointsDelta),
    createdAt: transaction.createdAt,
    status: resolveMutationStatus(transaction.status),
    cashAmountCny: transaction.cashAmount ?? undefined,
  };
}

function mapPlans(dashboardPlans: Awaited<ReturnType<PointsWalletService['getOverview']>>['vipPacks']): PointsPlan[] {
  return dashboardPlans.map((pack) => ({
    id: `pack-${pack.id}`,
    packId: pack.id,
    name: pack.name,
    description: pack.description,
    priceCny: pack.price,
    originalPriceCny: pack.originalPrice,
    includedPoints: pack.pointAmount,
    durationDays: pack.vipDurationDays,
    levelName: pack.levelName,
    recommended: pack.recommended,
    tags: pack.tags,
  }));
}

function computeCurrentPlan(
  overview: Awaited<ReturnType<PointsWalletService['getOverview']>>,
): PointsCurrentPlan {
  if (!overview.isAuthenticated) {
    return {
      status: 'guest',
      name: 'Guest',
      remainingDays: null,
      vipPoints: null,
      level: null,
    };
  }

  if (!overview.vip.isVip) {
    return {
      status: 'free',
      name: 'Free',
      vipStatus: overview.vip.vipStatus,
      expireTime: overview.vip.expireTime,
      remainingDays: overview.vip.remainingDays,
      vipPoints: overview.vip.vipPoints,
      level: overview.vip.vipLevel,
    };
  }

  return {
    status: 'vip',
    name: overview.vip.vipLevelName || 'VIP',
    vipStatus: overview.vip.vipStatus,
    expireTime: overview.vip.expireTime,
    remainingDays: overview.vip.remainingDays,
    vipPoints: overview.vip.vipPoints,
    level: overview.vip.vipLevel,
  };
}

function toMonthRange(nowIso: string) {
  const now = new Date(nowIso);
  return {
    start: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    end: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  };
}

function computeMonthlyTotals(transactions: PointsTransaction[], nowIso: string) {
  const { start, end } = toMonthRange(nowIso);
  return transactions.reduce(
    (totals, transaction) => {
      const timestamp = new Date(transaction.createdAt).getTime();
      if (timestamp < start || timestamp >= end) {
        return totals;
      }

      if (transaction.direction === 'earned') {
        return {
          ...totals,
          earnedThisMonth: totals.earnedThisMonth + transaction.points,
        };
      }

      return {
        ...totals,
        spentThisMonth: totals.spentThisMonth + transaction.points,
      };
    },
    {
      earnedThisMonth: 0,
      spentThisMonth: 0,
    },
  );
}

export function createEmptyPointsDashboard(): PointsDashboardData {
  return {
    summary: {
      isAuthenticated: false,
      balancePoints: 0,
      totalEarned: 0,
      totalSpent: 0,
      earnedThisMonth: 0,
      spentThisMonth: 0,
      pointsToCashRate: null,
      currentPlan: {
        status: 'guest',
        name: 'Guest',
        remainingDays: null,
        vipPoints: null,
        level: null,
      },
    },
    transactions: [],
    plans: [],
  };
}

export function getPointsRechargePresets() {
  return [...DEFAULT_RECHARGE_PRESETS];
}

export function filterPointsTransactions(
  transactions: PointsTransaction[],
  filter: PointsTransactionFilter,
): PointsTransaction[] {
  if (filter === 'all') {
    return transactions;
  }

  return transactions.filter((transaction) => transaction.direction === filter);
}

export function createPointsService(options: CreatePointsServiceOptions = {}) {
  const walletService = options.walletService ?? pointsWalletService;
  const now = options.now ?? (() => new Date().toISOString());
  const rechargePresets = options.rechargePresets ?? getPointsRechargePresets();

  return {
    getRechargePresets() {
      return [...rechargePresets];
    },

    getEmptyDashboard() {
      return createEmptyPointsDashboard();
    },

    async getDashboard(): Promise<PointsDashboardData> {
      const overview = await walletService.getOverview();
      if (!overview.isAuthenticated) {
        return createEmptyPointsDashboard();
      }

      const transactions = overview.history
        .map(mapTransaction)
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        );
      const monthlyTotals = computeMonthlyTotals(transactions, now());

      return {
        summary: {
          isAuthenticated: true,
          balancePoints: overview.pointsAccount.availablePoints,
          totalEarned: overview.pointsAccount.totalEarned,
          totalSpent: overview.pointsAccount.totalSpent,
          earnedThisMonth: monthlyTotals.earnedThisMonth,
          spentThisMonth: monthlyTotals.spentThisMonth,
          pointsToCashRate: overview.pointsToCashRate,
          currentPlan: computeCurrentPlan(overview),
        },
        transactions,
        plans: mapPlans(overview.vipPacks),
      };
    },

    async rechargePoints(input: RechargePointsInput): Promise<PointsRechargeResult> {
      const result = await walletService.rechargePoints({
        points: input.points,
        paymentMethod: input.paymentMethod,
        requestNo: input.requestNo,
        remarks: input.remarks,
      });

      return {
        requestNo: result.requestNo,
        transactionId: result.transactionId,
        points: result.points,
        cashAmountCny: result.cashAmount,
        paymentMethod: result.paymentMethod,
        status: resolveMutationStatus(result.status),
        remainingPoints: result.remainingPoints,
        resultDesc: result.resultDesc,
        processedAt: result.processedAt,
      };
    },

    async upgradePlan(input: UpgradePlanInput): Promise<PointsUpgradeResult> {
      const result = await walletService.purchaseVipPack({
        packId: input.packId,
        paymentMethod: input.paymentMethod,
        couponId: input.couponId,
      });

      return {
        orderId: result.orderId,
        packId: result.packId,
        packName: result.packName,
        amountCny: result.amount,
        durationDays: result.durationDays,
        targetLevelName: result.targetLevelName,
        status: resolveMutationStatus(result.status),
      };
    },
  };
}

export const pointsService = createPointsService();
