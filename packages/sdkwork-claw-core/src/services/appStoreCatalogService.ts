import type {
  AppDetailVO,
  AppStoreCategoryVO,
  AppVO,
  PageAppVO,
  SdkworkAppClient,
} from '@sdkwork/app-sdk';
import { unwrapAppSdkResponse } from '../sdk/appSdkResult.ts';
import { getAppSdkClientWithSession } from '../sdk/useAppSdkClient.ts';

type AppStoreCatalogClient = Pick<SdkworkAppClient, 'app'>;

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

function resolveFallbackCategory(appType?: string) {
  const normalized = toOptionalString(appType);
  if (!normalized) {
    return 'General';
  }

  return normalized.startsWith('APP_') ? normalized.slice(4) : normalized;
}

function resolveIconUrl(value: AppVO | AppDetailVO) {
  return toOptionalString(value.icon?.url) || toOptionalString(value.iconUrl);
}

function mapCatalogApp(value: AppVO | AppDetailVO | null | undefined): AppStoreCatalogApp {
  const candidate = (value || {}) as AppVO & AppDetailVO & { id?: string | number };
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

function mapCatalogCategory(value: AppStoreCategoryVO | null | undefined): AppStoreCatalogCategory | null {
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

function mapCatalogPage(payload: PageAppVO | null | undefined, fallbackPage: number, fallbackPageSize: number): AppStoreCatalogPage {
  const page = payload || {};
  const items = ((page.content || page.records || []) as AppVO[]).map(mapCatalogApp);
  const currentPage = Math.max(1, toNumber(page.number, fallbackPage - 1) + 1);
  const pageSize = Math.max(1, toNumber(page.size, fallbackPageSize));
  const total = Math.max(items.length, toNumber(page.totalElements ?? page.total, items.length));
  const hasMore = page.last === undefined ? currentPage * pageSize < total : page.last === false;

  return {
    items,
    total,
    page: currentPage,
    pageSize,
    hasMore,
  };
}

export function createAppStoreCatalogService(
  options: CreateAppStoreCatalogServiceOptions = {},
): AppStoreCatalogService {
  const getClient = options.getClient;

  return {
    async listApps(params = {}) {
      const client = getClient ? getClient() : await getDefaultClient();
      return mapCatalogPage(
        unwrapAppSdkResponse<PageAppVO>(
          await client.app.listStoreApps(withDefinedQuery({
            keyword: toOptionalString(params.keyword),
            category: toOptionalString(params.category),
            page: params.page,
            size: params.pageSize,
          })),
          'Failed to load AppStore apps.',
        ),
        params.page || 1,
        params.pageSize || 20,
      );
    },

    async listCategories() {
      const client = getClient ? getClient() : await getDefaultClient();
      const payload = unwrapAppSdkResponse<AppStoreCategoryVO[]>(
        await client.app.listStoreCategories(),
        'Failed to load AppStore categories.',
      );
      return payload
        .map(mapCatalogCategory)
        .filter((item): item is AppStoreCatalogCategory => Boolean(item));
    },

    async getApp(id: string) {
      const client = getClient ? getClient() : await getDefaultClient();
      return mapCatalogApp(
        unwrapAppSdkResponse<AppDetailVO>(
          await client.app.retrieveStore(id),
          'Failed to load AppStore app detail.',
        ),
      );
    },
  };
}

export const appStoreCatalogService = createAppStoreCatalogService();
