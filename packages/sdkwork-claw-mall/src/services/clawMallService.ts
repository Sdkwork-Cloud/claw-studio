import type {
  ClawMallCategory,
  ClawMallProduct,
  ClawMallProductPage,
  ClawMallProductQuery,
  ClawMallService,
} from '@sdkwork/claw-core/services/clawMallService';
import { selectRelatedProducts } from '../pages/mall/mallCatalogPresentation.ts';

export interface ClawMallCatalogSnapshot {
  categories: ClawMallCategory[];
  page: ClawMallProductPage;
  hotProducts: ClawMallProduct[];
  latestProducts: ClawMallProduct[];
}

export interface CreateClawMallCatalogServiceOptions {
  clawMallService?: ClawMallService;
}

export interface ClawMallCatalogService {
  getCatalog(query?: ClawMallProductQuery): Promise<ClawMallCatalogSnapshot>;
  getProduct(id: string): Promise<ClawMallProduct>;
  getRelatedProducts(product: ClawMallProduct, limit?: number): Promise<ClawMallProduct[]>;
}

async function getDefaultClawMallService(): Promise<ClawMallService> {
  const module = await import('../../../sdkwork-claw-core/src/services/clawMallService.ts');
  return module.clawMallService as ClawMallService;
}

export function createClawMallCatalogService(
  options: CreateClawMallCatalogServiceOptions = {},
): ClawMallCatalogService {
  const configuredClawMallService = options.clawMallService;

  return {
    async getCatalog(query = {}) {
      const clawMallService = configuredClawMallService || await getDefaultClawMallService();
      const [categories, page, hotProducts, latestProducts] = await Promise.all([
        clawMallService.listCategories(),
        clawMallService.listProducts(query),
        clawMallService.listHotProducts(6),
        clawMallService.listLatestProducts(6),
      ]);

      return {
        categories,
        page,
        hotProducts,
        latestProducts,
      };
    },

    async getProduct(id: string) {
      const clawMallService = configuredClawMallService || await getDefaultClawMallService();
      return clawMallService.getProduct(id);
    },

    async getRelatedProducts(product: ClawMallProduct, limit = 4) {
      const clawMallService = configuredClawMallService || await getDefaultClawMallService();
      if (!product.categoryId) {
        return [];
      }

      const page = await clawMallService.listProducts({
        categoryId: product.categoryId,
        page: 1,
        pageSize: limit + 1,
      });

      return selectRelatedProducts(product.id, page.items, limit);
    },
  };
}

export const clawMallCatalogService = createClawMallCatalogService();
