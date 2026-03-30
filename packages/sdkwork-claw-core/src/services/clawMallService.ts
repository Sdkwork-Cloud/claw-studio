import type {
  PageProductVO,
  ProductCategoryVO,
  ProductDetailVO,
  ProductVO,
  SdkworkAppClient,
} from '@sdkwork/app-sdk';
import { unwrapAppSdkResponse } from '../sdk/appSdkResult.ts';

type ClawMallClient = Pick<SdkworkAppClient, 'product'>;

export interface ClawMallCategory {
  id: string;
  parentId?: string;
  name: string;
  description?: string;
  icon?: string;
  children: ClawMallCategory[];
}

export interface ClawMallProduct {
  id: string;
  title: string;
  summary?: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  mainImage?: string;
  images: string[];
  videoUrl?: string;
  price?: number;
  originalPrice?: number;
  stock?: number;
  sales?: number;
  status?: string;
  hot: boolean;
  recommended: boolean;
  tags: string[];
  attributes: Array<Record<string, unknown>>;
  skus: Array<Record<string, unknown>>;
}

export interface ClawMallProductQuery {
  categoryId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface ClawMallProductPage {
  items: ClawMallProduct[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CreateClawMallServiceOptions {
  getClient?: () => ClawMallClient | Promise<ClawMallClient>;
}

export interface ClawMallService {
  listCategories(): Promise<ClawMallCategory[]>;
  listProducts(query?: ClawMallProductQuery): Promise<ClawMallProductPage>;
  listLatestProducts(limit?: number): Promise<ClawMallProduct[]>;
  listHotProducts(limit?: number): Promise<ClawMallProduct[]>;
  getProduct(id: string): Promise<ClawMallProduct>;
}

async function getDefaultClient(): Promise<ClawMallClient> {
  const { getAppSdkClientWithSession } = await import('../sdk/useAppSdkClient.ts');
  return getAppSdkClientWithSession();
}

function toOptionalString(value: string | number | undefined | null): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function toIdString(value: string | number | undefined | null): string {
  return toOptionalString(value) || '';
}

function toNumber(value: number | string | undefined | null): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function toMallStatus(value: string | undefined | null): string | undefined {
  const normalized = toOptionalString(value);
  return normalized ? normalized.toLowerCase() : undefined;
}

function isActiveProduct(product: ClawMallProduct): boolean {
  return !product.status || product.status === 'active';
}

function mapMallCategory(value: ProductCategoryVO | null | undefined): ClawMallCategory | null {
  const id = toIdString(value?.id);
  const name = toOptionalString(value?.name);
  if (!id || !name) {
    return null;
  }

  return {
    id,
    parentId: toOptionalString(value?.parentId),
    name,
    description: toOptionalString(value?.description),
    icon: toOptionalString(value?.icon),
    children: (value?.children || [])
      .map(mapMallCategory)
      .filter((item): item is ClawMallCategory => Boolean(item)),
  };
}

function mapMallProduct(
  value: ProductVO | ProductDetailVO | null | undefined,
  fallbackCategoryId?: string,
): ClawMallProduct {
  const candidate = (value || {}) as ProductVO &
    ProductDetailVO & {
      categoryId?: string | number;
      attributes?: Array<Record<string, unknown>>;
      skus?: Array<Record<string, unknown>>;
    };
  const images = (candidate.images || []).filter(
    (item): item is string => Boolean(toOptionalString(item)),
  );
  const mainImage = toOptionalString(candidate.mainImage) || images[0];

  return {
    id: toIdString(candidate.id),
    title: toOptionalString(candidate.title) || 'Unnamed Product',
    summary: toOptionalString(candidate.summary),
    description: toOptionalString(candidate.description),
    categoryId: toOptionalString(candidate.categoryId) || fallbackCategoryId,
    categoryName: toOptionalString(candidate.categoryName),
    mainImage,
    images,
    videoUrl: toOptionalString(candidate.videoUrl),
    price: toNumber(candidate.price),
    originalPrice: toNumber(candidate.originalPrice),
    stock: toNumber(candidate.stock),
    sales: toNumber(candidate.sales),
    status: toMallStatus(candidate.status),
    hot: Boolean(candidate.hot),
    recommended: Boolean(candidate.recommended),
    tags: (candidate.tags || []).filter(
      (item): item is string => Boolean(toOptionalString(item)),
    ),
    attributes: candidate.attributes || [],
    skus: candidate.skus || [],
  };
}

function mapMallProductPage(
  payload: PageProductVO | null | undefined,
  fallbackPage: number,
  fallbackPageSize: number,
  fallbackCategoryId?: string,
): ClawMallProductPage {
  const page = payload || {};
  const pageNumber = (toNumber(page.number) ?? Math.max(0, fallbackPage - 1)) + 1;
  const pageSize = toNumber(page.size) ?? fallbackPageSize;
  const items = (page.content || [])
    .map((item) => mapMallProduct(item, fallbackCategoryId))
    .filter(isActiveProduct);
  const total = Math.max(items.length, toNumber(page.totalElements) ?? items.length);
  const hasMore =
    page.last === false || (page.last === undefined && pageNumber * pageSize < total);

  return {
    items,
    total,
    page: pageNumber,
    pageSize,
    hasMore,
  };
}

function ensureProductIsAvailable(product: ClawMallProduct): ClawMallProduct {
  if (product.status && product.status !== 'active') {
    throw new Error(`Product ${product.id} is not available for Claw Mall.`);
  }

  return product;
}

export function createClawMallService(
  options: CreateClawMallServiceOptions = {},
): ClawMallService {
  const getClient = options.getClient;

  return {
    async listCategories() {
      const client = getClient ? await getClient() : await getDefaultClient();
      return unwrapAppSdkResponse<ProductCategoryVO[]>(
        await client.product.getProductCategoryTree(),
        'Failed to load Claw Mall categories.',
      )
        .map(mapMallCategory)
        .filter((item): item is ClawMallCategory => Boolean(item));
    },

    async listProducts(query = {}) {
      const client = getClient ? await getClient() : await getDefaultClient();
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const categoryId = toOptionalString(query.categoryId);
      const keyword = toOptionalString(query.keyword);

      if (keyword) {
        return mapMallProductPage(
          unwrapAppSdkResponse<PageProductVO>(
            await client.product.searchProducts({
              keyword,
              categoryId,
              page,
              size: pageSize,
            }),
            'Failed to search Claw Mall products.',
          ),
          page,
          pageSize,
          categoryId,
        );
      }

      if (categoryId) {
        return mapMallProductPage(
          unwrapAppSdkResponse<PageProductVO>(
            await client.product.getProductsByCategory(categoryId, {
              page,
              size: pageSize,
              status: 'ACTIVE',
            }),
            'Failed to load Claw Mall products by category.',
          ),
          page,
          pageSize,
          categoryId,
        );
      }

      return mapMallProductPage(
        unwrapAppSdkResponse<PageProductVO>(
          await client.product.getProducts({
            page,
            size: pageSize,
            status: 'ACTIVE',
          }),
          'Failed to load Claw Mall products.',
        ),
        page,
        pageSize,
      );
    },

    async listLatestProducts(limit = 6) {
      const client = getClient ? await getClient() : await getDefaultClient();
      return unwrapAppSdkResponse<ProductVO[]>(
        await client.product.getLatestProducts({
          limit,
        }),
        'Failed to load latest Claw Mall products.',
      )
        .map((item) => mapMallProduct(item))
        .filter(isActiveProduct);
    },

    async listHotProducts(limit = 6) {
      const client = getClient ? await getClient() : await getDefaultClient();
      return unwrapAppSdkResponse<ProductVO[]>(
        await client.product.getHotProducts({
          limit,
        }),
        'Failed to load hot Claw Mall products.',
      )
        .map((item) => mapMallProduct(item))
        .filter(isActiveProduct);
    },

    async getProduct(id: string) {
      const client = getClient ? await getClient() : await getDefaultClient();
      return ensureProductIsAvailable(
        mapMallProduct(
          unwrapAppSdkResponse<ProductDetailVO>(
            await client.product.getProductDetail(id),
            'Failed to load Claw Mall product detail.',
          ),
        ),
      );
    },
  };
}

export const clawMallService = createClawMallService();
