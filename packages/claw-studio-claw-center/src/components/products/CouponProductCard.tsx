import { Calendar, Store, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CouponProduct } from '../../services';
import { ProductCardWrapper } from './ProductCardWrapper';

interface CouponProductCardProps {
  product: CouponProduct;
  onRequest: (name: string) => void;
}

export function CouponProductCard({
  product,
  onRequest,
}: CouponProductCardProps) {
  const { t } = useTranslation();

  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="flex items-center gap-1.5">
        <Store className="h-3.5 w-3.5 text-zinc-400" />
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {product.merchant}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Tag className="h-3.5 w-3.5 text-amber-500" />
        <span className="font-bold text-amber-600 dark:text-amber-500">{product.discount}</span>
      </div>
      <div className="col-span-2 flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5 text-zinc-400" />
        <span>
          {t('products.validUntil', 'Valid Until')}: {product.validUntil}
        </span>
      </div>
    </ProductCardWrapper>
  );
}
