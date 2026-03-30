import type {
  HistoryVO,
  OrderCreateForm,
  OrderPaymentSuccessVO,
  OrderPayForm,
  OrderVO,
  PaymentParamsVO,
  PaymentStatusVO,
  PointsAccountInfoVO,
  PointsRechargePackVO,
  SdkworkAppClient,
  VipBenefitVO,
  VipInfoVO,
  VipPackDetailVO,
  VipPackGroupVO,
  VipPackVO,
  VipStatusVO,
} from '@sdkwork/app-sdk';
import {
  getAppSdkClientWithSession,
} from '../sdk/useAppSdkClient.ts';
import { readAppSdkSessionTokens } from '../sdk/appSdkSession.ts';
import { unwrapAppSdkResponse } from '../sdk/appSdkResult.ts';

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

export interface PointsWalletVipBenefit {
  id: number;
  name: string;
  benefitKey?: string;
  type?: string;
  description?: string;
  icon?: string;
  claimed: boolean;
  usageLimit: number | null;
  usedCount: number | null;
}

export interface PointsWalletVipPack {
  id: number;
  groupId: number | null;
  groupName?: string;
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
  benefits: PointsWalletVipBenefit[];
}

export interface PointsWalletVipPackGroup {
  id: number;
  name: string;
  description?: string;
  sortWeight: number | null;
  packs: PointsWalletVipPack[];
}

export interface PointsWalletOrderPayment {
  paymentId?: string;
  paymentOrderId?: string;
  merchantOrderId?: string;
  orderId?: string;
  status?: string;
  statusName?: string;
  amount: number | null;
  paymentMethod?: string;
  paymentProvider?: string;
  transactionId?: string;
  outTradeNo?: string;
  successTime?: string;
}

export interface PointsWalletRechargePack {
  id: number;
  name: string;
  description?: string;
  price: number;
  pointAmount: number;
  sortWeight: number | null;
  validFrom?: string;
  validTo?: string;
  remark?: string;
}

export interface PointsWalletOverview {
  isAuthenticated: boolean;
  pointsAccount: PointsWalletAccount;
  history: PointsWalletHistoryItem[];
  pointsToCashRate: number | null;
  vip: PointsWalletMembership;
  vipPackGroups: PointsWalletVipPackGroup[];
  vipPacks: PointsWalletVipPack[];
  rechargePacks: PointsWalletRechargePack[];
}

export interface GetPointsWalletOverviewOptions {
  pageSize?: number;
}

export interface RechargePointsInput {
  packId: number;
  paymentMethod?: string;
  remark?: string;
  sourceChannel?: string;
}

export interface RechargePointsResult {
  orderId?: string;
  orderSn?: string;
  packId: number | null;
  packName?: string;
  points: number | null;
  amount: number | null;
  paymentMethod?: string;
  status?: string;
  statusName?: string;
  expireTime?: string;
  paymentId?: string;
  outTradeNo?: string;
  paymentParams?: Record<string, unknown>;
  payments: PointsWalletOrderPayment[];
}

export interface PurchaseVipPackInput {
  packId: number;
  couponId?: string;
  paymentMethod?: string;
  remark?: string;
  sourceChannel?: string;
}

export interface PurchaseVipPackResult {
  orderId?: string;
  orderSn?: string;
  packId: number | null;
  packName?: string;
  amount: number | null;
  durationDays: number | null;
  targetLevelId: number | null;
  targetLevelName?: string;
  status?: string;
  expireTime?: string;
  paymentId?: string;
  outTradeNo?: string;
  paymentMethod?: string;
  paymentParams?: Record<string, unknown>;
  payments: PointsWalletOrderPayment[];
}

export interface PointsWalletPurchaseStatus {
  orderId?: string;
  outTradeNo?: string;
  paid: boolean;
  status?: string;
  statusName?: string;
}

type PointsWalletClient = Pick<SdkworkAppClient, 'account' | 'vip' | 'order' | 'payment'>;

export interface CreatePointsWalletServiceOptions {
  getClient?: () => PointsWalletClient;
  getSessionTokens?: typeof readAppSdkSessionTokens;
}

export interface PointsWalletService {
  getOverview(options?: GetPointsWalletOverviewOptions): Promise<PointsWalletOverview>;
  rechargePoints(input: RechargePointsInput): Promise<RechargePointsResult>;
  getPointsRechargeStatus(orderId: string): Promise<PointsWalletPurchaseStatus>;
  listPointsOrderPayments(orderId: string): Promise<PointsWalletOrderPayment[]>;
  purchaseVipPack(input: PurchaseVipPackInput): Promise<PurchaseVipPackResult>;
  getVipPurchaseStatus(orderId: string): Promise<PointsWalletPurchaseStatus>;
  listVipOrderPayments(orderId: string): Promise<PointsWalletOrderPayment[]>;
}

const DEFAULT_HISTORY_PAGE_SIZE = 50;
const DEFAULT_POINTS_SOURCE_CHANNEL = 'CLAW_STUDIO_POINTS';
const DEFAULT_VIP_SOURCE_CHANNEL = 'CLAW_STUDIO_VIP';

function toOptionalString(value: string | number | undefined | null): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || undefined;
  }

  return undefined;
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
    vipPackGroups: [],
    vipPacks: [],
    rechargePacks: [],
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

function mapVipMembership(
  vipInfo: VipInfoVO | null | undefined,
  vipStatus: VipStatusVO | null | undefined,
): PointsWalletMembership {
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

function mapVipBenefit(benefit: VipBenefitVO): PointsWalletVipBenefit {
  return {
    id: toNumber(benefit.id),
    name: toOptionalString(benefit.name) || 'VIP Benefit',
    benefitKey: toOptionalString(benefit.benefitKey),
    type: toOptionalString(benefit.type),
    description: toOptionalString(benefit.description),
    icon: toOptionalString(benefit.icon),
    claimed: Boolean(benefit.claimed),
    usageLimit: toNullableNumber(benefit.usageLimit),
    usedCount: toNullableNumber(benefit.usedCount),
  };
}

function mapVipPack(
  pack: VipPackVO,
  group?: VipPackGroupVO | null,
  detail?: VipPackDetailVO | null,
): PointsWalletVipPack {
  const benefits = detail?.benefits ?? [];

  return {
    id: toNumber(detail?.id ?? pack.id),
    groupId: toNullableNumber(detail?.groupId ?? group?.id),
    groupName: toOptionalString(detail?.groupName ?? group?.name),
    name: toOptionalString(detail?.name ?? pack.name) || 'VIP Pack',
    description: toOptionalString(detail?.description ?? pack.description),
    price: toNumber(detail?.price ?? pack.price),
    originalPrice: toNullableNumber(detail?.originalPrice ?? pack.originalPrice),
    pointAmount: toNumber(detail?.pointAmount ?? pack.pointAmount),
    vipDurationDays: toNullableNumber(detail?.vipDurationDays ?? pack.vipDurationDays),
    levelName: toOptionalString(detail?.levelName ?? pack.levelName),
    sortWeight: toNullableNumber(detail?.sortWeight ?? pack.sortWeight),
    recommended: Boolean(pack.recommended),
    tags: Array.isArray(pack.tags)
      ? pack.tags
          .map((tag) => toOptionalString(tag))
          .filter((tag): tag is string => Boolean(tag))
      : [],
    benefits: Array.isArray(benefits)
      ? benefits.map(mapVipBenefit)
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

function sortVipPackGroups(groups: PointsWalletVipPackGroup[]): PointsWalletVipPackGroup[] {
  return [...groups].sort((left, right) => (
    toNumber(right.sortWeight) - toNumber(left.sortWeight)
    || left.id - right.id
  ));
}

function mapVipPackGroup(
  group: VipPackGroupVO,
  packs: PointsWalletVipPack[],
): PointsWalletVipPackGroup {
  return {
    id: toNumber(group.id),
    name: toOptionalString(group.name) || 'VIP Group',
    description: toOptionalString(group.description),
    sortWeight: toNullableNumber(group.sortWeight),
    packs: sortVipPacks(packs),
  };
}

function mapRechargePack(pack: PointsRechargePackVO): PointsWalletRechargePack {
  return {
    id: toNumber(pack.id),
    name: toOptionalString(pack.name) || 'Points Pack',
    description: toOptionalString(pack.description),
    price: toNumber(pack.price),
    pointAmount: toNumber(pack.pointAmount),
    sortWeight: toNullableNumber(pack.sortWeight),
    validFrom: toOptionalString(pack.validFrom),
    validTo: toOptionalString(pack.validTo),
    remark: toOptionalString(pack.remark),
  };
}

function mapOrderPayment(payment: PaymentStatusVO | null | undefined): PointsWalletOrderPayment {
  return {
    paymentId: toOptionalString(payment?.paymentId),
    paymentOrderId: toOptionalString(payment?.paymentOrderId),
    merchantOrderId: toOptionalString(payment?.merchantOrderId),
    orderId: toOptionalString(payment?.orderId),
    status: toOptionalString(payment?.status),
    statusName: toOptionalString(payment?.statusName),
    amount: toNullableNumber(payment?.amount),
    paymentMethod: toOptionalString(payment?.paymentMethod),
    paymentProvider: toOptionalString(payment?.paymentProvider),
    transactionId: toOptionalString(payment?.transactionId),
    outTradeNo: toOptionalString(payment?.outTradeNo),
    successTime: toOptionalString(payment?.successTime),
  };
}

function mapPurchaseStatus(result: OrderPaymentSuccessVO | null | undefined): PointsWalletPurchaseStatus {
  return {
    orderId: toOptionalString(result?.orderId),
    outTradeNo: toOptionalString(result?.outTradeNo),
    paid: Boolean(result?.paid),
    status: toOptionalString(result?.status),
    statusName: toOptionalString(result?.statusName),
  };
}

function normalizePaymentParams(
  params: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return undefined;
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

async function readOptional<T>(callback: () => Promise<unknown>, fallback: T): Promise<T> {
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

async function loadGroupPacks(
  client: PointsWalletClient,
  group: VipPackGroupVO,
): Promise<VipPackVO[]> {
  if (Array.isArray(group.packs) && group.packs.length > 0) {
    return group.packs;
  }

  const groupId = toNullableNumber(group.id);
  if (groupId === null) {
    return [];
  }

  return readOptional<VipPackVO[]>(
    () => client.vip.listPacksByGroup(groupId),
    [],
  );
}

async function loadVipCatalog(client: PointsWalletClient): Promise<{
  vipPackGroups: PointsWalletVipPackGroup[];
  vipPacks: PointsWalletVipPack[];
}> {
  const packGroups = await readOptional<VipPackGroupVO[]>(
    () => client.vip.listPackGroups(),
    [],
  );

  const groups = await Promise.all(
    packGroups.map(async (group) => {
      const packs = await loadGroupPacks(client, group);
      const hydratedPacks = await Promise.all(
        packs.map(async (pack) => {
          const packId = toNullableNumber(pack.id);
          const detail = packId === null
            ? null
            : await readOptional<VipPackDetailVO | null>(
              () => client.vip.getPackDetail(packId),
              null,
            );
          return mapVipPack(pack, group, detail);
        }),
      );

      return mapVipPackGroup(group, hydratedPacks);
    }),
  );

  const vipPackGroups = sortVipPackGroups(groups);
  const vipPacks = sortVipPacks(vipPackGroups.flatMap((group) => group.packs));
  return {
    vipPackGroups,
    vipPacks,
  };
}

async function loadRechargePacks(client: PointsWalletClient): Promise<PointsWalletRechargePack[]> {
  const packs = await readOptional<PointsRechargePackVO[]>(
    () => client.account.listRechargePacks(),
    [],
  );

  return [...packs]
    .map(mapRechargePack)
    .sort((left, right) => (
      toNumber(right.sortWeight) - toNumber(left.sortWeight)
      || left.price - right.price
      || left.id - right.id
    ));
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
        vipCatalog,
        rechargePacks,
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
        loadVipCatalog(client),
        loadRechargePacks(client),
      ]);

      return {
        isAuthenticated: true,
        pointsAccount: mapPointsAccount(pointsAccount),
        history: (historyPage.content ?? []).map(mapHistoryItem),
        pointsToCashRate: toNullableNumber(pointsToCashRate),
        vip: mapVipMembership(vipInfo, vipStatus),
        vipPackGroups: vipCatalog.vipPackGroups,
        vipPacks: vipCatalog.vipPacks,
        rechargePacks,
      };
    },

    async rechargePoints(input) {
      requireAuthenticated(getSessionTokens);
      const client = getClient();
      const rechargePacks = await readOptional<PointsRechargePackVO[]>(
        () => client.account.listRechargePacks(),
        [],
      );
      const selectedPack = rechargePacks.find((pack) => toNumber(pack.id) === input.packId);

      const createOrderRequest: OrderCreateForm = {
        orderType: 'POINTS',
        productId: String(input.packId),
        paymentMethod: toOptionalString(input.paymentMethod),
        remark: toOptionalString(input.remark),
        sourceChannel: toOptionalString(input.sourceChannel) || DEFAULT_POINTS_SOURCE_CHANNEL,
        orderPayloadValid: true,
      };
      const order = unwrapAppSdkResponse<OrderVO>(
        await client.order.createOrder(createOrderRequest),
        'Failed to create points recharge order.',
      );
      const orderId = toOptionalString(order.orderId);
      if (!orderId) {
        throw new Error('Points recharge order was created without an order id.');
      }

      const payOrderRequest: OrderPayForm = {
        orderId,
        paymentMethod: toOptionalString(input.paymentMethod),
        amount: toOptionalString(order.totalAmount),
      };
      const payment = unwrapAppSdkResponse<PaymentParamsVO>(
        await client.order.pay(orderId, payOrderRequest),
        'Failed to initialize points recharge payment.',
      );
      const payments = await readOptional<PaymentStatusVO[]>(
        () => client.payment.listOrderPayments(orderId),
        [],
      );

      return {
        orderId,
        orderSn: toOptionalString(order.orderSn),
        packId: selectedPack ? toNumber(selectedPack.id) : input.packId,
        packName: toOptionalString(selectedPack?.name),
        points: selectedPack ? toNullableNumber(selectedPack.pointAmount) : null,
        amount: toNullableNumber(order.totalAmount ?? payment.amount ?? selectedPack?.price),
        paymentMethod: toOptionalString(payment.paymentMethod),
        status: toOptionalString(order.status),
        statusName: toOptionalString(order.statusName),
        expireTime: toOptionalString(order.expireTime),
        paymentId: toOptionalString(payment.paymentId),
        outTradeNo: toOptionalString(payment.outTradeNo),
        paymentParams: normalizePaymentParams(payment.paymentParams),
        payments: payments.map(mapOrderPayment),
      };
    },

    async getPointsRechargeStatus(orderId) {
      requireAuthenticated(getSessionTokens);
      const client = getClient();
      return mapPurchaseStatus(
        unwrapAppSdkResponse<OrderPaymentSuccessVO>(
          await client.order.getOrderPaymentSuccess(orderId),
          'Failed to query points recharge payment status.',
        ),
      );
    },

    async listPointsOrderPayments(orderId) {
      requireAuthenticated(getSessionTokens);
      const client = getClient();
      const payments = await readOptional<PaymentStatusVO[]>(
        () => client.payment.listOrderPayments(orderId),
        [],
      );
      return payments.map(mapOrderPayment);
    },

    async purchaseVipPack(input) {
      requireAuthenticated(getSessionTokens);
      const client = getClient();
      const packDetail = await readOptional<VipPackDetailVO | null>(
        () => client.vip.getPackDetail(input.packId),
        null,
      );

      const createOrderRequest: OrderCreateForm = {
        orderType: 'MEMBER',
        productId: String(input.packId),
        paymentMethod: toOptionalString(input.paymentMethod),
        couponId: toOptionalString(input.couponId),
        remark: toOptionalString(input.remark),
        sourceChannel: toOptionalString(input.sourceChannel) || DEFAULT_VIP_SOURCE_CHANNEL,
        orderPayloadValid: true,
      };

      const order = unwrapAppSdkResponse<OrderVO>(
        await client.order.createOrder(createOrderRequest),
        'Failed to create VIP order.',
      );
      const orderId = toOptionalString(order.orderId);
      if (!orderId) {
        throw new Error('VIP order was created without an order id.');
      }

      const payOrderRequest: OrderPayForm = {
        orderId,
        paymentMethod: toOptionalString(input.paymentMethod),
        amount: toOptionalString(order.totalAmount),
      };
      const payment = unwrapAppSdkResponse<PaymentParamsVO>(
        await client.order.pay(orderId, payOrderRequest),
        'Failed to initialize VIP payment.',
      );
      const payments = await readOptional<PaymentStatusVO[]>(
        () => client.payment.listOrderPayments(orderId),
        [],
      );

      return {
        orderId,
        orderSn: toOptionalString(order.orderSn),
        packId: toNullableNumber(packDetail?.id) ?? input.packId,
        packName: toOptionalString(packDetail?.name),
        amount: toNullableNumber(order.totalAmount ?? payment.amount ?? packDetail?.price),
        durationDays: toNullableNumber(packDetail?.vipDurationDays),
        targetLevelId: toNullableNumber(packDetail?.levelId),
        targetLevelName: toOptionalString(packDetail?.levelName),
        status: toOptionalString(order.status),
        expireTime: toOptionalString(order.expireTime),
        paymentId: toOptionalString(payment.paymentId),
        outTradeNo: toOptionalString(payment.outTradeNo),
        paymentMethod: toOptionalString(payment.paymentMethod),
        paymentParams: normalizePaymentParams(payment.paymentParams),
        payments: payments.map(mapOrderPayment),
      };
    },

    async getVipPurchaseStatus(orderId) {
      requireAuthenticated(getSessionTokens);
      const client = getClient();
      return mapPurchaseStatus(
        unwrapAppSdkResponse<OrderPaymentSuccessVO>(
          await client.order.getOrderPaymentSuccess(orderId),
          'Failed to query VIP payment status.',
        ),
      );
    },

    async listVipOrderPayments(orderId) {
      requireAuthenticated(getSessionTokens);
      const client = getClient();
      const payments = await readOptional<PaymentStatusVO[]>(
        () => client.payment.listOrderPayments(orderId),
        [],
      );
      return payments.map(mapOrderPayment);
    },
  };
}

export const pointsWalletService = createPointsWalletService();
