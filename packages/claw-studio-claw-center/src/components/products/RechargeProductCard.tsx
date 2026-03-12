import { Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RechargeProduct } from '../../services';
import { ProductCardWrapper } from './ProductCardWrapper';

interface RechargeProductCardProps {
  product: RechargeProduct;
  onRequest: (name: string) => void;
}

export function RechargeProductCard({
  product,
  onRequest,
}: RechargeProductCardProps) {
  const { t } = useTranslation();

  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="col-span-2 flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5" />
        {t('products.labels.provider', 'Provider')}:
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {product.provider}
        </span>
      </div>
      <div className="col-span-2 mt-1 flex flex-wrap gap-1">
        {product.denominations.map((denomination) => (
          <span
            key={denomination}
            className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold dark:border-zinc-600 dark:bg-zinc-700"
          >
            {denomination}
          </span>
        ))}
      </div>
    </ProductCardWrapper>
  );
}
