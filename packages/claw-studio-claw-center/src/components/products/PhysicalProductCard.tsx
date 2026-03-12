import { MapPin, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PhysicalProduct } from '../../services';
import { ProductCardWrapper } from './ProductCardWrapper';

interface PhysicalProductCardProps {
  product: PhysicalProduct;
  onRequest: (name: string) => void;
}

export function PhysicalProductCard({
  product,
  onRequest,
}: PhysicalProductCardProps) {
  const { t } = useTranslation();

  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="flex items-center gap-1.5">
        <Package className="h-3.5 w-3.5" />
        {t('products.labels.stock', 'Stock')}:
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{product.stock}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5" />
        {t('products.labels.shipping', 'Shipping')}:
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {product.shippingCost}
        </span>
      </div>
    </ProductCardWrapper>
  );
}
