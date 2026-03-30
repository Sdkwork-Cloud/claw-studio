import type {
  DashboardCommerceBusinessSummaryVO,
  DashboardCommerceCustomRangeVO,
  DashboardCommerceProductBreakdownVO,
  DashboardCommerceProductPerformanceVO,
  DashboardCommerceRevenueAnalyticsVO,
  DashboardCommerceRevenueRecordVO,
  DashboardCommerceRevenueTrendPointVO,
  DashboardCommerceStatisticsVO,
  OrderVO,
  PageOrderVO,
  PageProductVO,
  ProductVO,
  SdkworkAppClient,
} from '@sdkwork/app-sdk';
import { unwrapAppSdkResponse } from '../sdk/appSdkResult.ts';

export type DashboardCommerceGranularity = 'day' | 'hour';
export type DashboardCommerceRangeMode = 'seven_days' | 'month' | 'custom';
export type DashboardCommerceRecordStatus =
  | 'paid'
  | 'pending'
  | 'refunded'
  | 'completed'
  | 'delivered'
  | 'cancelled'
  | 'refunding';

export interface DashboardCommerceQuery {
  granularity?: DashboardCommerceGranularity;
  rangeMode?: DashboardCommerceRangeMode;
  monthKey?: string;
  customStart?: string;
  customEnd?: string;
}

export interface DashboardCommerceCustomRange {
  start: string;
  end: string;
}

export interface DashboardCommerceBusinessSummary {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  yearRevenue: number;
  todayOrders: number;
  weekOrders: number;
  monthOrders: number;
  yearOrders: number;
  averageOrderValue: number;
  conversionRate: number;
  revenueDelta: number;
}

export interface DashboardCommerceRevenueTrendPoint {
  label: string;
  bucketKey: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
}

export interface DashboardCommerceProductBreakdown {
  id: string;
  productName: string;
  orders: number;
  revenue: number;
  share: number;
  dailyRevenue: number;
}

export interface DashboardCommerceRevenueAnalytics {
  granularity: DashboardCommerceGranularity;
  rangeMode: DashboardCommerceRangeMode;
  selectedMonthKey?: string;
  customRange?: DashboardCommerceCustomRange;
  totalRevenue: number;
  dailyRevenue: number;
  projectedMonthlyRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  peakRevenueLabel: string;
  peakRevenueValue: number;
  deltaPercentage: number;
  revenueTrend: DashboardCommerceRevenueTrendPoint[];
  productBreakdown: DashboardCommerceProductBreakdown[];
}

export interface DashboardCommerceRevenueRecord {
  id: string;
  timestamp: string;
  productName: string;
  orderNo: string;
  revenueAmount: number;
  channel: string;
  status: DashboardCommerceRecordStatus;
}

export interface DashboardCommerceProductPerformance {
  id: string;
  productName: string;
  revenue: number;
  orders: number;
  share: number;
  trendDelta: number;
}

export interface DashboardCommerceSnapshot {
  businessSummary: DashboardCommerceBusinessSummary;
  revenueAnalytics: DashboardCommerceRevenueAnalytics;
  recentRevenueRecords: DashboardCommerceRevenueRecord[];
  productPerformance: DashboardCommerceProductPerformance[];
}

type DashboardCommerceClient = Pick<SdkworkAppClient, 'dashboard' | 'order' | 'product'>;
type DashboardCommerceSessionTokens = {
  authToken?: string | null;
};

export interface CreateDashboardCommerceServiceOptions {
  getClient?: () => DashboardCommerceClient;
  getSessionTokens?: () => DashboardCommerceSessionTokens;
}

export interface DashboardCommerceService {
  getCommerceSnapshot(query?: DashboardCommerceQuery): Promise<DashboardCommerceSnapshot>;
}

async function getDefaultClient(): Promise<DashboardCommerceClient> {
  const { getAppSdkClientWithSession } = await import('../sdk/useAppSdkClient.ts');
  return getAppSdkClientWithSession();
}

async function getDefaultSessionTokens(): Promise<DashboardCommerceSessionTokens> {
  const { readAppSdkSessionTokens } = await import('../sdk/useAppSdkClient.ts');
  return readAppSdkSessionTokens();
}

function toOptionalString(value: string | undefined | null): string | undefined {
  const normalized = (value || '').trim();
  return normalized || undefined;
}

function toNumber(value: number | string | undefined | null, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function normalizeGranularity(value: string | undefined): DashboardCommerceGranularity {
  return value === 'hour' ? 'hour' : 'day';
}

function normalizeRangeMode(value: string | undefined): DashboardCommerceRangeMode {
  if (value === 'month' || value === 'custom') {
    return value;
  }
  return 'seven_days';
}

function normalizeRecordStatus(value: string | undefined): DashboardCommerceRecordStatus {
  switch ((value || '').trim().toLowerCase()) {
    case 'paid':
      return 'paid';
    case 'completed':
      return 'completed';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    case 'refunding':
      return 'refunding';
    case 'refunded':
      return 'refunded';
    default:
      return 'pending';
  }
}

function resolveCustomRange(
  value: DashboardCommerceCustomRangeVO | null | undefined,
  query: DashboardCommerceQuery,
): DashboardCommerceCustomRange | undefined {
  const start = toOptionalString(value?.start) || toOptionalString(query.customStart);
  const end = toOptionalString(value?.end) || toOptionalString(query.customEnd);

  if (!start || !end) {
    return undefined;
  }

  return { start, end };
}

function buildQueryParams(query: DashboardCommerceQuery): Record<string, string> {
  const rangeMode = normalizeRangeMode(query.rangeMode);
  const params: Record<string, string> = {
    granularity: normalizeGranularity(query.granularity),
    rangeMode,
  };

  const monthKey = toOptionalString(query.monthKey);
  if (rangeMode === 'month' && monthKey) {
    params.monthKey = monthKey;
  }

  const customStart = toOptionalString(query.customStart);
  if (rangeMode === 'custom' && customStart) {
    params.customStart = customStart;
  }

  const customEnd = toOptionalString(query.customEnd);
  if (rangeMode === 'custom' && customEnd) {
    params.customEnd = customEnd;
  }

  return params;
}

function parseDayValue(value: string | undefined): Date | undefined {
  const normalized = toOptionalString(value);
  if (!normalized) {
    return undefined;
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function resolveOrderTimeRange(query: DashboardCommerceQuery): { startTime: string; endTime: string } | undefined {
  const rangeMode = normalizeRangeMode(query.rangeMode);

  if (rangeMode === 'custom') {
    const customStart = parseDayValue(query.customStart);
    const customEnd = parseDayValue(query.customEnd);
    if (customStart && customEnd) {
      const [start, end] = customStart <= customEnd ? [customStart, customEnd] : [customEnd, customStart];
      return {
        startTime: startOfUtcDay(start).toISOString(),
        endTime: endOfUtcDay(end).toISOString(),
      };
    }
    return undefined;
  }

  if (rangeMode === 'month') {
    const monthKey = toOptionalString(query.monthKey);
    if (!monthKey) {
      return undefined;
    }

    const [yearText, monthText] = monthKey.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return undefined;
    }

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
  }

  const today = startOfUtcDay(new Date());
  return {
    startTime: addUtcDays(today, -6).toISOString(),
    endTime: endOfUtcDay(today).toISOString(),
  };
}

function buildOrderQueryParams(query: DashboardCommerceQuery): Record<string, string> {
  const params: Record<string, string> = {
    page: '1',
    size: '10',
  };
  const timeRange = resolveOrderTimeRange(query);
  if (timeRange) {
    params.startTime = timeRange.startTime;
    params.endTime = timeRange.endTime;
  }
  return params;
}

function buildProductQueryParams(): Record<string, string> {
  return {
    page: '1',
    size: '20',
  };
}

export function createEmptyDashboardCommerceSnapshot(
  query: DashboardCommerceQuery = {},
): DashboardCommerceSnapshot {
  const granularity = normalizeGranularity(query.granularity);
  const rangeMode = normalizeRangeMode(query.rangeMode);
  const selectedMonthKey = rangeMode === 'month' ? toOptionalString(query.monthKey) : undefined;
  const customRange =
    rangeMode === 'custom'
      ? resolveCustomRange(undefined, query)
      : undefined;

  return {
    businessSummary: {
      todayRevenue: 0,
      weekRevenue: 0,
      monthRevenue: 0,
      yearRevenue: 0,
      todayOrders: 0,
      weekOrders: 0,
      monthOrders: 0,
      yearOrders: 0,
      averageOrderValue: 0,
      conversionRate: 0,
      revenueDelta: 0,
    },
    revenueAnalytics: {
      granularity,
      rangeMode,
      selectedMonthKey,
      customRange,
      totalRevenue: 0,
      dailyRevenue: 0,
      projectedMonthlyRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      peakRevenueLabel: '',
      peakRevenueValue: 0,
      deltaPercentage: 0,
      revenueTrend: [],
      productBreakdown: [],
    },
    recentRevenueRecords: [],
    productPerformance: [],
  };
}

function mapBusinessSummary(
  value: DashboardCommerceBusinessSummaryVO | null | undefined,
): DashboardCommerceBusinessSummary {
  return {
    todayRevenue: toNumber(value?.todayRevenue),
    weekRevenue: toNumber(value?.weekRevenue),
    monthRevenue: toNumber(value?.monthRevenue),
    yearRevenue: toNumber(value?.yearRevenue),
    todayOrders: toNumber(value?.todayOrders),
    weekOrders: toNumber(value?.weekOrders),
    monthOrders: toNumber(value?.monthOrders),
    yearOrders: toNumber(value?.yearOrders),
    averageOrderValue: toNumber(value?.averageOrderValue),
    conversionRate: toNumber(value?.conversionRate),
    revenueDelta: toNumber(value?.revenueDelta),
  };
}

function mapRevenueTrendPoint(
  value: DashboardCommerceRevenueTrendPointVO,
): DashboardCommerceRevenueTrendPoint {
  return {
    label: value.label || '',
    bucketKey: value.bucketKey || '',
    revenue: toNumber(value.revenue),
    orders: toNumber(value.orders),
    averageOrderValue: toNumber(value.averageOrderValue),
  };
}

function mapProductBreakdown(
  value: DashboardCommerceProductBreakdownVO,
): DashboardCommerceProductBreakdown {
  return {
    id: value.id || '',
    productName: value.productName || value.id || 'Unknown Product',
    orders: toNumber(value.orders),
    revenue: toNumber(value.revenue),
    share: toNumber(value.share),
    dailyRevenue: toNumber(value.dailyRevenue),
  };
}

function mapRevenueAnalytics(
  value: DashboardCommerceRevenueAnalyticsVO | null | undefined,
  query: DashboardCommerceQuery,
): DashboardCommerceRevenueAnalytics {
  return {
    granularity: normalizeGranularity(value?.granularity),
    rangeMode: normalizeRangeMode(value?.rangeMode),
    selectedMonthKey: toOptionalString(value?.selectedMonthKey) || toOptionalString(query.monthKey),
    customRange: resolveCustomRange(value?.customRange, query),
    totalRevenue: toNumber(value?.totalRevenue),
    dailyRevenue: toNumber(value?.dailyRevenue),
    projectedMonthlyRevenue: toNumber(value?.projectedMonthlyRevenue),
    totalOrders: toNumber(value?.totalOrders),
    averageOrderValue: toNumber(value?.averageOrderValue),
    peakRevenueLabel: value?.peakRevenueLabel || '',
    peakRevenueValue: toNumber(value?.peakRevenueValue),
    deltaPercentage: toNumber(value?.deltaPercentage),
    revenueTrend: (value?.revenueTrend || []).map(mapRevenueTrendPoint),
    productBreakdown: (value?.productBreakdown || []).map(mapProductBreakdown),
  };
}

function mapRevenueRecord(
  value: DashboardCommerceRevenueRecordVO,
): DashboardCommerceRevenueRecord {
  return {
    id: value.id || '',
    timestamp: value.timestamp || new Date(0).toISOString(),
    productName: value.productName || value.id || 'Unknown Product',
    orderNo: value.orderNo || '',
    revenueAmount: toNumber(value.revenueAmount),
    channel: (value.channel || 'app').trim().toLowerCase(),
    status: normalizeRecordStatus(value.status),
  };
}

function mapProductPerformance(
  value: DashboardCommerceProductPerformanceVO,
): DashboardCommerceProductPerformance {
  return {
    id: value.id || '',
    productName: value.productName || value.id || 'Unknown Product',
    revenue: toNumber(value.revenue),
    orders: toNumber(value.orders),
    share: toNumber(value.share),
    trendDelta: toNumber(value.trendDelta),
  };
}

function mapCommerceSnapshot(
  value: DashboardCommerceStatisticsVO | null | undefined,
  query: DashboardCommerceQuery,
): DashboardCommerceSnapshot {
  return {
    businessSummary: mapBusinessSummary(value?.businessSummary),
    revenueAnalytics: mapRevenueAnalytics(value?.revenueAnalytics, query),
    recentRevenueRecords: (value?.recentRevenueRecords || []).map(mapRevenueRecord),
    productPerformance: (value?.productPerformance || []).map(mapProductPerformance),
  };
}

function normalizeLookupKey(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function mapRecentRevenueRecordFromOrder(
  value: OrderVO,
  index: number,
): DashboardCommerceRevenueRecord {
  return {
    id: value.orderId || value.orderSn || `order-${index}`,
    timestamp: value.payTime || value.createdAt || new Date(0).toISOString(),
    productName: value.subject || value.orderSn || `Order ${index + 1}`,
    orderNo: value.orderSn || value.orderId || '',
    revenueAmount: toNumber(value.paidAmount ?? value.totalAmount),
    channel: (value.paymentProvider || value.paymentMethod || 'app').trim().toLowerCase(),
    status: normalizeRecordStatus(value.status || value.statusName),
  };
}

function mapRecentRevenueRecords(
  value: PageOrderVO | null | undefined,
): DashboardCommerceRevenueRecord[] {
  return (value?.content || [])
    .map(mapRecentRevenueRecordFromOrder)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

function mergeProductPerformance(
  products: PageProductVO | null | undefined,
  fallback: DashboardCommerceProductPerformance[],
): DashboardCommerceProductPerformance[] {
  const productRows = products?.content || [];
  if (productRows.length === 0) {
    return fallback;
  }

  const fallbackByKey = new Map<string, DashboardCommerceProductPerformance>();
  fallback.forEach((row) => {
    fallbackByKey.set(row.id, row);
    fallbackByKey.set(normalizeLookupKey(row.productName), row);
  });

  const matchedKeys = new Set<string>();
  const mergedRows = productRows.map((product, index) => {
    const id = product.id || product.title || `product-${index}`;
    const productName = product.title || id;
    const fallbackRow =
      fallbackByKey.get(id) || fallbackByKey.get(normalizeLookupKey(productName));

    if (fallbackRow) {
      matchedKeys.add(fallbackRow.id);
    }

    const orders = fallbackRow?.orders ?? Math.max(0, Math.round(toNumber(product.sales)));
    const revenue =
      fallbackRow?.revenue ?? toNumber(product.price) * Math.max(orders, 0);

    return {
      id,
      productName,
      revenue: toNumber(revenue),
      orders,
      share: fallbackRow?.share ?? 0,
      trendDelta: fallbackRow?.trendDelta ?? 0,
    } satisfies DashboardCommerceProductPerformance;
  });

  const appendedFallbackRows = fallback.filter((row) => !matchedKeys.has(row.id));
  const combinedRows = [...mergedRows, ...appendedFallbackRows].sort((left, right) => {
    if (right.revenue !== left.revenue) {
      return right.revenue - left.revenue;
    }
    return right.orders - left.orders;
  });
  const totalRevenue = combinedRows.reduce((sum, row) => sum + row.revenue, 0);

  return combinedRows.map((row) => ({
    ...row,
    share: totalRevenue > 0 ? toNumber(((row.revenue / totalRevenue) * 100).toFixed(1)) : row.share,
  }));
}

async function loadOptional<T>(loader: () => Promise<T>): Promise<{ data?: T; error?: unknown }> {
  try {
    return { data: await loader() };
  } catch (error) {
    return { error };
  }
}

export function createDashboardCommerceService(
  options: CreateDashboardCommerceServiceOptions = {},
): DashboardCommerceService {
  const getClient = options.getClient;
  const getSessionTokens = options.getSessionTokens;

  return {
    async getCommerceSnapshot(query: DashboardCommerceQuery = {}) {
      const sessionTokens = getSessionTokens ? getSessionTokens() : await getDefaultSessionTokens();
      if (!toOptionalString(sessionTokens.authToken)) {
        return createEmptyDashboardCommerceSnapshot(query);
      }

      const client = getClient ? getClient() : await getDefaultClient();
      const [dashboardResult, orderResult, productResult] = await Promise.all([
        loadOptional(() =>
          client.dashboard.getCommerceStatistics(buildQueryParams(query)),
        ),
        loadOptional(() =>
          client.order.listOrders(buildOrderQueryParams(query)),
        ),
        loadOptional(() =>
          client.product.getProducts(buildProductQueryParams()),
        ),
      ]);

      const errors = [dashboardResult.error, orderResult.error, productResult.error].filter(Boolean);
      const snapshot = dashboardResult.data
        ? mapCommerceSnapshot(
            unwrapAppSdkResponse<DashboardCommerceStatisticsVO>(
              dashboardResult.data,
              'Failed to load dashboard commerce statistics.',
            ),
            query,
          )
        : createEmptyDashboardCommerceSnapshot(query);

      const recentRevenueRecords = orderResult.data
        ? mapRecentRevenueRecords(
            unwrapAppSdkResponse<PageOrderVO>(
              orderResult.data,
              'Failed to load order list.',
            ),
          )
        : snapshot.recentRevenueRecords;
      const productPerformance = productResult.data
        ? mergeProductPerformance(
            unwrapAppSdkResponse<PageProductVO>(
              productResult.data,
              'Failed to load product list.',
            ),
            snapshot.productPerformance,
          )
        : snapshot.productPerformance;

      if (!dashboardResult.data && !orderResult.data && !productResult.data && errors[0]) {
        throw errors[0];
      }

      return {
        ...snapshot,
        recentRevenueRecords,
        productPerformance,
      };
    },
  };
}

export const dashboardCommerceService = createDashboardCommerceService();
