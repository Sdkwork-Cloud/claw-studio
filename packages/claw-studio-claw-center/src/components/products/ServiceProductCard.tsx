import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ServiceProduct } from '../../services';
import { ProductCardWrapper } from './ProductCardWrapper';

interface ServiceProductCardProps {
  product: ServiceProduct;
  onRequest: (name: string) => void;
}

export function ServiceProductCard({
  product,
  onRequest,
}: ServiceProductCardProps) {
  const { t } = useTranslation();

  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="col-span-2 flex items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5" />
        {t('products.labels.category', 'Category')}:
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {product.category}
        </span>
      </div>
    </ProductCardWrapper>
  );
}
