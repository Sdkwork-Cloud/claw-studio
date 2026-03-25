import { lazy } from 'react';

const ProductDetailPage = lazy(() =>
  import('./pages/mall/ProductDetail').then((module) => ({
    default: module.ProductDetail,
  })),
);

export function ProductDetail() {
  return <ProductDetailPage />;
}
