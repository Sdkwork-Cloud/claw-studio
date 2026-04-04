import type {
  HistoryVO,
  PointsAccountInfoVO,
  PointsRechargeForm,
  PointsRechargeVO,
  SdkworkAppClient,
  VipInfoVO,
  VipPackVO,
  VipPurchaseForm,
  VipPurchaseVO,
  VipStatusVO,
} from '@sdkwork/app-sdk';
import {
  getAppSdkClientWithSession,
  readAppSdkSessionTokens,
} from '../sdk/useAppSdkClient.ts';
import { type AppSdkEnvelope, unwrapAppSdkResponse } from '../sdk/appSdkResult.ts';

export interface PointsWalletAccount {
  availablePoints: number;
  frozenPoints: number;
  totalPoints: number;
  tokenBalance: number;
  totalEarned: number;
  totalSpent: number;
  status?: string;
  statusName?: string;
  level: number | null;
  levelName?: string;
  experience: number | null;
}

export interface PointsWalletHistoryItem {
  id: string;
  transactionId?: string;
  transactionType?: string;
  transactionTypeName?: string;
  remarks?: string;
  status?: string;
  statusName?: string;
  pointsDelta: number;
  cashAmount: number | null;
  pointsBefore: number | null;
  pointsAfter: number | null;
  createdAt: string;
  counterpartyUserName?: string;
}

export interface PointsWalletMembership {
  isVip: boolean;
  vipLevel: number | null;
  vipLevelName?: string;
  vipStatus?: string;
  expireTime?: string;
  remainingDays: number | null;
  totalSpent: number | null;
  vipPoints: number | null;
  growthValue: number | null;
  upgradeGrowthValue: number | null;
  pointBalance: number | null;
}

export interface PointsWalletVipPack {
  id: number;
  name: string;
  description?: string;
  price: number;
  originalPrice: number | null;
  pointAmount: number;
  vipDurationDays: number | null;
  levelName?: string;
  sortWeight: number | null;
  recommended: boolean;
  tags: string[];
}

export interface PointsWalletOverview {
  isAuthenticated: boolean;
  pointsAccount: PointsWalletAccount;
  history: PointsWalletHistoryItem[];
  pointsToCashRate: number | null;
  vip: PointsWalletMembership;
  vipPacks: PointsWalletVipPack[];
}

export interface GetPointsWalletOverviewOptions {
  pageSize?: number;
}

export interface RechargePointsInput {
  points: number;
  paymentMethod?: string;
  requestNo?: string;
  remarks?: string;
}

export interface RechargePointsResult {
  requestNo?: string;
  transactionId?: string;
  accountId?: string;
  points: number;
  cashAmount: number | null;
  paymentMethod?: string;
  status?: string;
  statusName?: string;
  remainingPoints: number | null;
  resultDesc?: string;
  processedAt?: string;
}

export interface PurchaseVipPackInput {
  packId: number;
  couponId?: string;
  paymentMethod?: string;
}

export interface PurchaseVipPackResult {
  orderId?: string;
  packId: number | null;
  packName?: string;
  amount: number | null;
  durationDays: number | null;
  targetLevelId: number | null;
  targetLevelName?: string;
  status?: string;
}

type PointsWalletClient = Pick<SdkworkAppClient, 'account' | 'vip'>;

export interface CreatePointsWalletServiceOptions {
  getClient?: () => PointsWalletClient;
  getSessionTokens?: typeof readAppSdkSessionTokens;
}

export interface PointsWalletService {
  getOverview(options?: GetPointsWalletOverviewOptions): Promise<PointsWalletOverview>;
  rechargePoints(input: RechargePointsInput): Promise<RechargePointsResult>;
  purchaseVipPack(input: PurchaseVipPackInput): Promise<PurchaseVipPackResult>;
}

const DEFAULT_HISTORY_PAGE_SIZE = 50;

function toOptionalString(value: string | undefined | null): string | undefined {
  const normalized = (value || '').trim();
  return normalized || undefined;
}

function toNullableNumber(value: number | string | undefined | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toNumber(value: number | string | undefined | null, fallback = 0): number {
  return toNullableNumber(value) ?? fallback;
}

function isAuthenticated(getSessionTokens: typeof readAppSdkSessionTokens): boolean {
  return Boolean(toOptionalString(getSessionTokens().authToken));
}

function createGuestOverview(): PointsWalletOverview {
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
}

function mapPointsAccount(account: PointsAccountInfoVO | null | undefined): PointsWalletAccount {
  return {
    availablePoints: toNumber(account?.availablePoints),
    frozenPoints: toNumber(account?.frozenPoints),
    totalPoints: toNumber(
      account?.totalPoints,
      toNumber(account?.availablePoints) + toNumber(account?.frozenPoints),
    ),
    tokenBalance: toNumber(account?.tokenBalance),
    totalEarned: toNumber(account?.totalEarned),
    totalSpent: toNumber(account?.totalSpent),
    status: toOptionalString(account?.status),
    statusName: toOptionalString(account?.statusName),
    level: toNullableNumber(account?.level),
    levelName: toOptionalString(account?.levelName),
    experience: toNullableNumber(account?.experience),
  };
}

function resolvePointsDelta(item: HistoryVO): number {
  const points = toNullableNumber(item.points);
  if (points !== null) {
    return points;
  }

  const before = toNullableNumber(item.pointsBefore);
  const after = toNullableNumber(item.pointsAfter);
  if (before !== null && after !== null) {
    return after - before;
  }

  return 0;
}

function mapHistoryItem(item: HistoryVO): PointsWalletHistoryItem {
  return {
    id: toOptionalString(item.historyId)
      || toOptionalString(item.transactionId)
      || `points-history-${Date.now()}`,
    transactionId: toOptionalString(item.transactionId),
    transactionType: toOptionalString(item.transactionType),
    transactionTypeName: toOptionalString(item.transactionTypeName),
    remarks: toOptionalString(item.remarks),
    status: toOptionalString(item.status),
    statusName: toOptionalString(item.statusName),
    pointsDelta: resolvePointsDelta(item),
    cashAmount: toNullableNumber(item.amount),
    pointsBefore: toNullableNumber(item.pointsBefore),
    pointsAfter: toNullableNumber(item.pointsAfter),
    createdAt: toOptionalString(item.createdAt) || new Date(0).toISOString(),
    counterpartyUserName: toOptionalString(item.counterpartyUserName),
  };
}

function mapVipMembership(vipInfo: VipInfoVO | null | undefined, vipStatus: VipStatusVO | null | undefined): PointsWalletMembership {
  return {
    isVip: Boolean(vipStatus?.isVip ?? vipInfo?.vipStatus?.toUpperCase() === 'ACTIVE'),
    vipLevel: toNullableNumber(vipStatus?.vipLevel ?? vipInfo?.vipLevel),
    vipLevelName: toOptionalString(vipInfo?.vipLevelName),
    vipStatus: toOptionalString(vipInfo?.vipStatus),
    expireTime: toOptionalString(vipStatus?.expireTime ?? vipInfo?.expireTime),
    remainingDays: toNullableNumber(vipInfo?.remainingDays),
    totalSpent: toNullableNumber(vipInfo?.totalSpent),
    vipPoints: toNullableNumber(vipInfo?.vipPoints),
    growthValue: toNullableNumber(vipInfo?.growthValue),
    upgradeGrowthValue: toNullableNumber(vipInfo?.upgradeGrowthValue),
    pointBalance: toNullableNumber(vipStatus?.pointBalance),
  };
}

function mapVipPack(pack: VipPackVO): PointsWalletVipPack {
  return {
    id: toNumber(pack.id),
    name: toOptionalString(pack.name) || 'VIP Pack',
    description: toOptionalString(pack.description),
    price: toNumber(pack.price),
    originalPrice: toNullableNumber(pack.originalPrice),
    pointAmount: toNumber(pack.pointAmount),
    vipDurationDays: toNullableNumber(pack.vipDurationDays),
    levelName: toOptionalString(pack.levelName),
    sortWeight: toNullableNumber(pack.sortWeight),
    recommended: Boolean(pack.recommended),
    tags: Array.isArray(pack.tags)
      ? pack.tags
          .map((tag) => toOptionalString(tag))
          .filter((tag): tag is string => Boolean(tag))
      : [],
  };
}

function sortVipPacks(packs: PointsWalletVipPack[]): PointsWalletVipPack[] {
  return [...packs].sort((left, right) => (
    Number(right.recommended) - Number(left.recommended)
    || toNumber(right.sortWeight) - toNumber(left.sortWeight)
    || left.price - right.price
    || left.id - right.id
  ));
}

function mapRechargeResult(result: PointsRechargeVO | null | undefined): RechargePointsResult {
  return {
    requestNo: toOptionalString(result?.requestNo),
    transactionId: toOptionalString(result?.transactionId),
    accountId: toOptionalString(result?.accountId),
    points: toNumber(result?.points),
    cashAmount: toNullableNumber(result?.cashAmount),
    paymentMethod: toOptionalString(result?.paymentMethod),
    status: toOptionalString(result?.status),
    statusName: toOptionalString(result?.statusName),
    remainingPoints: toNullableNumber(result?.remainingPoints),
    resultDesc: toOptionalString(result?.resultDesc),
    processedAt: toOptionalString(result?.processedAt),
  };
}

function mapPurchaseVipPackResult(result: VipPurchaseVO | null | undefined): PurchaseVipPackResult {
  return {
    orderId: toOptionalString(result?.orderId),
    packId: toNullableNumber(result?.packId),
    packName: toOptionalString(result?.packName),
    amount: toNullableNumber(result?.amount),
    durationDays: toNullableNumber(result?.durationDays),
    targetLevelId: toNullableNumber(result?.targetLevelId),
    targetLevelName: toOptionalString(result?.targetLevelName),
    status: toOptionalString(result?.status),
  };
}

async function readOptional<T>(
  callback: () => Promise<T | AppSdkEnvelope<T> | null | undefined>,
  fallback: T,
): Promise<T> {
  try {
    return unwrapAppSdkResponse<T>(await callback());
  } catch {
    return fallback;
  }
}

function requireAuthenticated(getSessionTokens: typeof readAppSdkSessionTokens): void {
  if (!isAuthenticated(getSessionTokens)) {
    throw new Error('Please sign in to manage points and memberships.');
  }
}

export function createPointsWalletService(
  options: CreatePointsWalletServiceOptions = {},
): PointsWalletService {
  const getClient = options.getClient ?? getAppSdkClientWithSession;
  const getSessionTokens = options.getSessionTokens ?? readAppSdkSessionTokens;

  return {
    async getOverview(options = {}) {
      if (!isAuthenticated(getSessionTokens)) {
        return createGuestOverview();
      }

      const client = getClient();
      const pageSize = options.pageSize ?? DEFAULT_HISTORY_PAGE_SIZE;

      const [
        pointsAccount,
        historyPage,
        pointsToCashRate,
        vipInfo,
        vipStatus,
        vipPacks,
      ] = await Promise.all([
        unwrapAppSdkResponse<PointsAccountInfoVO>(
          await client.account.getPoints(),
          'Failed to load points account.',
        ),
        readOptional<{ content?: HistoryVO[] }>(
          () =>
            client.account.getHistory({
              pageNum: 1,
              pageSize,
              sortField: 'createdAt',
              sortDirection: 'desc',
            }),
          { content: [] },
        ),
        readOptional<number | null>(
          () => client.account.getPointsToCashRate(),
          null,
        ),
        readOptional<VipInfoVO | null>(
          () => client.vip.getVipInfo(),
          null,
        ),
        readOptional<VipStatusVO | null>(
          () => client.vip.getVipStatus(),
          null,
        ),
        readOptional<VipPackVO[]>(
          () => client.vip.listAllPacks(),
          [],
        ),
      ]);

      return {
        isAuthenticated: true,
        pointsAccount: mapPointsAccount(pointsAccount),
        history: (historyPage.content ?? []).map(mapHistoryItem),
        pointsToCashRate: toNullableNumber(pointsToCashRate),
        vip: mapVipMembership(vipInfo, vipStatus),
        vipPacks: sortVipPacks(vipPacks.map(mapVipPack)),
      };
    },

    async rechargePoints(input) {
      requireAuthenticated(getSessionTokens);
      const client = getClient();
      const request: PointsRechargeForm = {
        points: input.points,
        paymentMethod: toOptionalString(input.paymentMethod),
        requestNo: toOptionalString(input.requestNo),
        remarks: toOptionalString(input.remarks),
      };

      return mapRechargeResult(
        unwrapAppSdkResponse<PointsRechargeVO>(
          await client.account.rechargePoints(request),
          'Failed to recharge points.',
        ),
      );
    },

    async purchaseVipPack(input) {
      requireAuthenticated(getSessionTokens);
      const client = getClient();
      const request: VipPurchaseForm = {
        packId: input.packId,
        couponId: toOptionalString(input.couponId),
        paymentMethod: toOptionalString(input.paymentMethod),
      };

      return mapPurchaseVipPackResult(
        unwrapAppSdkResponse<VipPurchaseVO>(
          await client.vip.purchase(request),
          'Failed to purchase VIP pack.',
        ),
      );
    },
  };
}

export const pointsWalletService = createPointsWalletService();
