import type {
  AppDetailVO,
  AppVO,
  PageAppVO,
  SdkworkAppClient,
} from '@sdkwork/app-sdk';
import { unwrapAppSdkResponse } from '../sdk/appSdkResult.ts';
import { getAppSdkClientWithSession } from '../sdk/useAppSdkClient.ts';

type AppStoreCatalogSdkAppClient = SdkworkAppClient['app'] & {
  listStoreApps?: (params?: Record<string, number | string | undefined>) => Promise<unknown>;
  listStoreCategories?: () => Promise<unknown>;
  retrieveStore?: (appId: string | number) => Promise<unknown>;
};

type AppStoreCatalogClient = {
  app: AppStoreCatalogSdkAppClient;
};

interface AppStoreCategoryPayload {
  code?: string;
  name?: string;
  count?: number | string;
}

interface AppStoreCatalogCandidate extends AppVO, AppDetailVO {
  id?: string | number;
  developer?: string;
  category?: string;
}

export interface AppStoreCatalogQuery {
  keyword?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

export interface AppStoreCatalogApp {
  id: string;
  name: string;
  developer: string;
  category: string;
  description?: string;
  iconUrl?: string;
  version?: string;
  storeUrl?: string;
  downloadUrl?: string;
}

export interface AppStoreCatalogCategory {
  code: string;
  name: string;
  count: number;
}

export interface AppStoreCatalogPage {
  items: AppStoreCatalogApp[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CreateAppStoreCatalogServiceOptions {
  getClient?: () => AppStoreCatalogClient;
}

export interface AppStoreCatalogService {
  listApps(params?: AppStoreCatalogQuery): Promise<AppStoreCatalogPage>;
  listCategories(): Promise<AppStoreCatalogCategory[]>;
  getApp(id: string): Promise<AppStoreCatalogApp>;
}

const FALLBACK_SEARCH_PAGE_SIZE = 100;

function getDefaultClient(): AppStoreCatalogClient {
  return getAppSdkClientWithSession();
}

function toOptionalString(value: string | number | undefined | null): string | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : undefined;
  }

  const normalized = (value || '').trim();
  return normalized || undefined;
}

function toIdString(value: string | number | undefined | null): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return toOptionalString(value) || '';
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

function withDefinedQuery<T extends Record<string, number | string | undefined>>(query: T): T {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined),
  ) as T;
}

function normalizeLookupKey(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function toCategoryCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatFallbackCategoryToken(token: string) {
  const upper = token.toUpperCase();
  if (upper.length <= 3) {
    return upper;
  }

  return upper[0] + upper.slice(1).toLowerCase();
}

function resolveFallbackCategory(appType?: string) {
  const normalized = toOptionalString(appType);
  if (!normalized) {
    return 'General';
  }

  const rawCategory = normalized.startsWith('APP_') ? normalized.slice(4) : normalized;
  const tokens = rawCategory
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map(formatFallbackCategoryToken);

  return tokens.length > 0 ? tokens.join(' ') : 'General';
}

function resolveIconUrl(value: AppVO | AppDetailVO) {
  return toOptionalString(value.icon?.url) || toOptionalString(value.iconUrl);
}

function mapCatalogApp(value: AppVO | AppDetailVO | null | undefined): AppStoreCatalogApp {
  const candidate = (value || {}) as AppStoreCatalogCandidate;
  const id = toIdString(candidate.appId ?? candidate.id);

  return {
    id,
    name: toOptionalString(candidate.name) || id || 'Unnamed App',
    developer:
      toOptionalString(candidate.developer) ||
      toOptionalString(candidate.installSkill?.name) ||
      'SDKWork',
    category: toOptionalString(candidate.category) || resolveFallbackCategory(candidate.appType),
    description: toOptionalString(candidate.description),
    iconUrl: resolveIconUrl(candidate),
    version: toOptionalString(candidate.version),
    storeUrl: toOptionalString(candidate.storeUrl),
    downloadUrl: toOptionalString(candidate.downloadUrl),
  };
}

function mapCatalogCategory(value: AppStoreCategoryPayload | null | undefined): AppStoreCatalogCategory | null {
  const code = toOptionalString(value?.code);
  const name = toOptionalString(value?.name);
  if (!code || !name) {
    return null;
  }

  return {
    code,
    name,
    count: toNumber(value?.count),
  };
}

function mapCatalogPage(
  payload: PageAppVO | null | undefined,
  fallbackPage: number,
  fallbackPageSize: number,
): AppStoreCatalogPage {
  const page = payload || {};
  const items = (page.content || []).map(mapCatalogApp);
  const currentPage = Math.max(1, toNumber(page.number, fallbackPage - 1) + 1);
  const pageSize = Math.max(1, toNumber(page.size, fallbackPageSize));
  const total = Math.max(items.length, toNumber(page.totalElements, items.length));
  const hasMore = page.last === undefined ? currentPage * pageSize < total : page.last === false;

  return {
    items,
    total,
    page: currentPage,
    pageSize,
    hasMore,
  };
}

function paginateCatalogItems(
  items: AppStoreCatalogApp[],
  page: number,
  pageSize: number,
): AppStoreCatalogPage {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const startIndex = (safePage - 1) * safePageSize;
  const pagedItems = items.slice(startIndex, startIndex + safePageSize);

  return {
    items: pagedItems,
    total: items.length,
    page: safePage,
    pageSize: safePageSize,
    hasMore: startIndex + pagedItems.length < items.length,
  };
}

async function searchAppCatalogPage(
  client: AppStoreCatalogClient,
  params: {
    keyword?: string;
    page: number;
    size: number;
  },
) {
  return unwrapAppSdkResponse<PageAppVO>(
    await client.app.searchApps(
      withDefinedQuery({
        keyword: toOptionalString(params.keyword),
        page: params.page,
        size: params.size,
      }),
    ),
    'Failed to load AppStore apps.',
  );
}

async function searchAllAppCatalogApps(
  client: AppStoreCatalogClient,
  keyword?: string,
) {
  const collectedApps: AppVO[] = [];
  let page = 1;

  while (true) {
    const payload = await searchAppCatalogPage(client, {
      keyword,
      page,
      size: FALLBACK_SEARCH_PAGE_SIZE,
    });
    const content = payload.content || [];
    collectedApps.push(...content);

    if (payload.last === true || content.length === 0) {
      break;
    }

    const totalPages = toNumber(payload.totalPages);
    if (totalPages > 0 && page >= totalPages) {
      break;
    }

    if (payload.last === undefined && totalPages <= 1 && content.length < FALLBACK_SEARCH_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return collectedApps.map(mapCatalogApp);
}

function filterCatalogItemsByCategory(
  items: AppStoreCatalogApp[],
  category?: string,
) {
  const normalizedCategory = normalizeLookupKey(category);
  if (!normalizedCategory) {
    return items;
  }

  return items.filter(
    (item) => normalizeLookupKey(item.category) === normalizedCategory,
  );
}

function deriveCatalogCategories(
  items: AppStoreCatalogApp[],
): AppStoreCatalogCategory[] {
  const categoryCounts = new Map<string, number>();

  items.forEach((item) => {
    const categoryName = item.category || 'General';
    categoryCounts.set(categoryName, (categoryCounts.get(categoryName) || 0) + 1);
  });

  return [...categoryCounts.entries()]
    .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
    .map(([name, count]) => ({
      code: toCategoryCode(name) || 'general',
      name,
      count,
    }));
}

export function createAppStoreCatalogService(
  options: CreateAppStoreCatalogServiceOptions = {},
): AppStoreCatalogService {
  const getClient = options.getClient;

  return {
    async listApps(params = {}) {
      const client = getClient ? getClient() : getDefaultClient();
      const requestedPage = Math.max(1, params.page || 1);
      const requestedPageSize = Math.max(1, params.pageSize || 20);

      if (typeof client.app.listStoreApps === 'function') {
        return mapCatalogPage(
          unwrapAppSdkResponse<PageAppVO>(
            await client.app.listStoreApps(
              withDefinedQuery({
                keyword: toOptionalString(params.keyword),
                category: toOptionalString(params.category),
                page: requestedPage,
                size: requestedPageSize,
              }),
            ),
            'Failed to load AppStore apps.',
          ),
          requestedPage,
          requestedPageSize,
        );
      }

      if (toOptionalString(params.category)) {
        const filteredItems = filterCatalogItemsByCategory(
          await searchAllAppCatalogApps(client, params.keyword),
          params.category,
        );
        return paginateCatalogItems(filteredItems, requestedPage, requestedPageSize);
      }

      return mapCatalogPage(
        await searchAppCatalogPage(client, {
          keyword: params.keyword,
          page: requestedPage,
          size: requestedPageSize,
        }),
        requestedPage,
        requestedPageSize,
      );
    },

    async listCategories() {
      const client = getClient ? getClient() : getDefaultClient();

      if (typeof client.app.listStoreCategories === 'function') {
        const payload = unwrapAppSdkResponse<AppStoreCategoryPayload[]>(
          await client.app.listStoreCategories(),
          'Failed to load AppStore categories.',
        );
        return payload
          .map(mapCatalogCategory)
          .filter((item): item is AppStoreCatalogCategory => Boolean(item));
      }

      return deriveCatalogCategories(await searchAllAppCatalogApps(client));
    },

    async getApp(id: string) {
      const client = getClient ? getClient() : getDefaultClient();

      if (typeof client.app.retrieveStore === 'function') {
        return mapCatalogApp(
          unwrapAppSdkResponse<AppDetailVO>(
            await client.app.retrieveStore(id),
            'Failed to load AppStore app detail.',
          ),
        );
      }

      return mapCatalogApp(
        unwrapAppSdkResponse<AppDetailVO>(
          await client.app.retrieve(id),
          'Failed to load AppStore app detail.',
        ),
      );
    },
  };
}

export const appStoreCatalogService = createAppStoreCatalogService();
