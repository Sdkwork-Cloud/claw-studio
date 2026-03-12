import { BookOpen, Calendar, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ContentProduct } from '../../services';
import { ProductCardWrapper } from './ProductCardWrapper';

interface ContentProductCardProps {
  product: ContentProduct;
  onRequest: (name: string) => void;
}

export function ContentProductCard({
  product,
  onRequest,
}: ContentProductCardProps) {
  const { t } = useTranslation();

  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="flex items-center gap-1.5">
        <BookOpen className="h-3.5 w-3.5" />
        {t('products.labels.category', 'Category')}:
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {product.category}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5" />
        {t('products.labels.chapters', 'Chapters')}:
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {product.chapters}
        </span>
      </div>
      <div className="col-span-2 flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5" />
        {t('products.labels.updated', 'Updated')}:
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {product.latestUpdate}
        </span>
      </div>
    </ProductCardWrapper>
  );
}
