import type {
  ClawMallCategory,
  ClawMallProduct,
} from '@sdkwork/claw-core/services/clawMallService';

export interface FlattenedMallCategory extends ClawMallCategory {
  depth: number;
}

export function flattenMallCategories(
  categories: ClawMallCategory[],
  depth = 0,
): FlattenedMallCategory[] {
  return categories.flatMap((category) => [
    {
      ...category,
      depth,
    },
    ...flattenMallCategories(category.children || [], depth + 1),
  ]);
}

export function selectRelatedProducts(
  currentProductId: string,
  products: ClawMallProduct[],
  limit = 4,
): ClawMallProduct[] {
  return products.filter((product) => product.id !== currentProductId).slice(0, limit);
}
