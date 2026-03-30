import {
  pointsWalletService,
  type PointsWalletHistoryItem,
  type PointsWalletOrderPayment,
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

export interface PointsPlanBenefit {
  id: string;
  name: string;
  benefitKey?: string;
  type?: string;
  description?: string;
  icon?: string;
  claimed: boolean;
  usageLimit: number | null;
  usedCount: number | null;
}

export interface PointsPlan {
  id: string;
  packId: number;
  groupId: number | null;
  groupName?: string;
  groupDescription?: string;
  name: string;
  description?: string;
  priceCny: number;
  originalPriceCny: number | null;
  includedPoints: number;
  durationDays: number | null;
  levelName?: string;
  recommended: boolean;
  tags: string[];
  benefits: PointsPlanBenefit[];
}

export interface PointsPlanGroup {
  id: string;
  groupId: number;
  groupName: string;
  description?: string;
  plans: PointsPlan[];
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

export interface PointsRechargePack {
  id: string;
  packId: number;
  name: string;
  description?: string;
  priceCny: number;
  includedPoints: number;
  sortWeight: number | null;
  validFrom?: string;
  validTo?: string;
  remark?: string;
}

export interface PointsDashboardData {
  summary: PointsSummary;
  transactions: PointsTransaction[];
  plans: PointsPlan[];
  planGroups: PointsPlanGroup[];
  rechargePacks: PointsRechargePack[];
}

export interface RechargePointsInput {
  packId: number;
  paymentMethod?: string;
  remark?: string;
}

export interface UpgradePlanInput {
  packId: number;
  paymentMethod?: string;
  couponId?: string;
  remark?: string;
}

export interface PointsRechargeResult {
  orderId?: string;
  orderSn?: string;
  packId: number | null;
  packName?: string;
  points: number | null;
  amountCny: number | null;
  paymentMethod?: string;
  status: 'completed' | 'pending' | 'failed';
  expireTime?: string;
  paymentSession?: PointsPaymentSession;
  payments: PointsPaymentRecord[];
}

export interface PointsPaymentRecord {
  paymentId?: string;
  paymentOrderId?: string;
  merchantOrderId?: string;
  orderId?: string;
  status: 'completed' | 'pending' | 'failed';
  statusName?: string;
  amountCny: number | null;
  paymentMethod?: string;
  paymentProvider?: string;
  transactionId?: string;
  outTradeNo?: string;
  successTime?: string;
}

export interface PointsPaymentSession {
  paymentId?: string;
  outTradeNo?: string;
  paymentMethod?: string;
  paymentUrl?: string;
  paymentParams: Record<string, unknown>;
}

export interface PointsUpgradeResult {
  orderId?: string;
  orderSn?: string;
  packId: number | null;
  packName?: string;
  amountCny: number | null;
  durationDays: number | null;
  targetLevelName?: string;
  status: 'completed' | 'pending' | 'failed';
  expireTime?: string;
  paymentSession?: PointsPaymentSession;
  payments: PointsPaymentRecord[];
}

export interface PointsUpgradeStatus {
  orderId?: string;
  outTradeNo?: string;
  paid: boolean;
  status: 'completed' | 'pending' | 'failed';
  statusName?: string;
}

export interface CreatePointsServiceOptions {
  walletService?: Pick<
    PointsWalletService,
    | 'getOverview'
    | 'rechargePoints'
    | 'getPointsRechargeStatus'
    | 'listPointsOrderPayments'
    | 'purchaseVipPack'
    | 'getVipPurchaseStatus'
    | 'listVipOrderPayments'
  >;
  now?: () => string;
}

export const pointsQueryKeys = {
  dashboard: ['points', 'dashboard'] as const,
};

const PAYMENT_URL_KEYS = [
  'codeUrl',
  'code_url',
  'payUrl',
  'pay_url',
  'paymentUrl',
  'payment_url',
  'mwebUrl',
  'mweb_url',
  'h5Url',
  'h5_url',
  'url',
  'link',
  'deepLink',
  'deep_link',
];

function resolveMutationStatus(status?: string): PointsRechargeResult['status'] {
  const normalized = (status || '').trim().toUpperCase();
  if (
    normalized === 'SUCCESS'
    || normalized === 'COMPLETED'
    || normalized === 'PAID'
    || normalized === 'DELIVERED'
  ) {
    return 'completed';
  }
  if (
    normalized === 'FAILED'
    || normalized === 'CANCELLED'
    || normalized === 'CLOSED'
    || normalized === 'REFUNDED'
  ) {
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

function mapPlanGroups(
  dashboardGroups: Awaited<ReturnType<PointsWalletService['getOverview']>>['vipPackGroups'],
): PointsPlanGroup[] {
  return dashboardGroups.map((group) => ({
    id: `group-${group.id}`,
    groupId: group.id,
    groupName: group.name,
    description: group.description,
    plans: group.packs.map((pack) => ({
      id: `pack-${pack.id}`,
      packId: pack.id,
      groupId: pack.groupId,
      groupName: pack.groupName,
      groupDescription: group.description,
      name: pack.name,
      description: pack.description,
      priceCny: pack.price,
      originalPriceCny: pack.originalPrice,
      includedPoints: pack.pointAmount,
      durationDays: pack.vipDurationDays,
      levelName: pack.levelName,
      recommended: pack.recommended,
      tags: pack.tags,
      benefits: pack.benefits.map((benefit) => ({
        id: `benefit-${benefit.id}`,
        name: benefit.name,
        benefitKey: benefit.benefitKey,
        type: benefit.type,
        description: benefit.description,
        icon: benefit.icon,
        claimed: benefit.claimed,
        usageLimit: benefit.usageLimit,
        usedCount: benefit.usedCount,
      })),
    })),
  }));
}

function flattenPlanGroups(planGroups: PointsPlanGroup[]): PointsPlan[] {
  return planGroups.flatMap((group) => group.plans);
}

function mapRechargePacks(
  rechargePacks: Awaited<ReturnType<PointsWalletService['getOverview']>>['rechargePacks'],
): PointsRechargePack[] {
  return [...rechargePacks]
    .map((pack) => ({
      id: `recharge-pack-${pack.id}`,
      packId: pack.id,
      name: pack.name,
      description: pack.description,
      priceCny: pack.price,
      includedPoints: pack.pointAmount,
      sortWeight: pack.sortWeight,
      validFrom: pack.validFrom,
      validTo: pack.validTo,
      remark: pack.remark,
    }))
    .sort((left, right) => (
      (right.sortWeight ?? 0) - (left.sortWeight ?? 0)
      || left.priceCny - right.priceCny
      || left.packId - right.packId
    ));
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

function extractPaymentUrl(paymentParams?: Record<string, unknown>): string | undefined {
  if (!paymentParams) {
    return undefined;
  }

  for (const key of PAYMENT_URL_KEYS) {
    const value = paymentParams[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  for (const value of Object.values(paymentParams)) {
    if (typeof value === 'string' && value.trim()) {
      const normalized = value.trim();
      if (
        normalized.startsWith('http://')
        || normalized.startsWith('https://')
        || normalized.startsWith('weixin://')
        || normalized.startsWith('alipays://')
      ) {
        return normalized;
      }
    }
  }

  return undefined;
}

function mapPaymentRecord(payment: PointsWalletOrderPayment): PointsPaymentRecord {
  return {
    paymentId: payment.paymentId,
    paymentOrderId: payment.paymentOrderId,
    merchantOrderId: payment.merchantOrderId,
    orderId: payment.orderId,
    status: resolveMutationStatus(payment.status),
    statusName: payment.statusName,
    amountCny: payment.amount,
    paymentMethod: payment.paymentMethod,
    paymentProvider: payment.paymentProvider,
    transactionId: payment.transactionId,
    outTradeNo: payment.outTradeNo,
    successTime: payment.successTime,
  };
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
    planGroups: [],
    rechargePacks: [],
  };
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

  return {
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
      const planGroups = mapPlanGroups(overview.vipPackGroups);
      const rechargePacks = mapRechargePacks(overview.rechargePacks);

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
        plans: flattenPlanGroups(planGroups),
        planGroups,
        rechargePacks,
      };
    },

    async rechargePoints(input: RechargePointsInput): Promise<PointsRechargeResult> {
      const result = await walletService.rechargePoints({
        packId: input.packId,
        paymentMethod: input.paymentMethod,
        remark: input.remark,
      });
      const paymentParams = result.paymentParams ?? {};

      return {
        orderId: result.orderId,
        orderSn: result.orderSn,
        packId: result.packId,
        packName: result.packName,
        points: result.points,
        amountCny: result.amount,
        paymentMethod: result.paymentMethod,
        status: resolveMutationStatus(result.status),
        expireTime: result.expireTime,
        paymentSession:
          result.paymentId || result.outTradeNo || Object.keys(paymentParams).length > 0
            ? {
              paymentId: result.paymentId,
              outTradeNo: result.outTradeNo,
              paymentMethod: result.paymentMethod,
              paymentUrl: extractPaymentUrl(paymentParams),
              paymentParams,
            }
            : undefined,
        payments: result.payments.map(mapPaymentRecord),
      };
    },

    async confirmRechargePayment(orderId: string): Promise<PointsUpgradeStatus> {
      const result = await walletService.getPointsRechargeStatus(orderId);
      return {
        orderId: result.orderId,
        outTradeNo: result.outTradeNo,
        paid: result.paid,
        status: resolveMutationStatus(result.status),
        statusName: result.statusName,
      };
    },

    async getRechargePaymentRecords(orderId: string): Promise<PointsPaymentRecord[]> {
      const payments = await walletService.listPointsOrderPayments(orderId);
      return payments.map(mapPaymentRecord);
    },

    async upgradePlan(input: UpgradePlanInput): Promise<PointsUpgradeResult> {
      const result = await walletService.purchaseVipPack({
        packId: input.packId,
        paymentMethod: input.paymentMethod,
        couponId: input.couponId,
        remark: input.remark,
      });
      const paymentParams = result.paymentParams ?? {};

      return {
        orderId: result.orderId,
        orderSn: result.orderSn,
        packId: result.packId,
        packName: result.packName,
        amountCny: result.amount,
        durationDays: result.durationDays,
        targetLevelName: result.targetLevelName,
        status: resolveMutationStatus(result.status),
        expireTime: result.expireTime,
        paymentSession:
          result.paymentId || result.outTradeNo || Object.keys(paymentParams).length > 0
            ? {
              paymentId: result.paymentId,
              outTradeNo: result.outTradeNo,
              paymentMethod: result.paymentMethod,
              paymentUrl: extractPaymentUrl(paymentParams),
              paymentParams,
            }
            : undefined,
        payments: result.payments.map(mapPaymentRecord),
      };
    },

    async confirmUpgradePayment(orderId: string): Promise<PointsUpgradeStatus> {
      const result = await walletService.getVipPurchaseStatus(orderId);
      return {
        orderId: result.orderId,
        outTradeNo: result.outTradeNo,
        paid: result.paid,
        status: resolveMutationStatus(result.status),
        statusName: result.statusName,
      };
    },

    async getUpgradePaymentRecords(orderId: string): Promise<PointsPaymentRecord[]> {
      const payments = await walletService.listVipOrderPayments(orderId);
      return payments.map(mapPaymentRecord);
    },
  };
}

export const pointsService = createPointsService();
