import { Image as ImageIcon, Music, Video, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AIGenerationProduct } from '../../services';
import { ProductCardWrapper } from './ProductCardWrapper';

interface AIGenerationProductCardProps {
  product: AIGenerationProduct;
  onRequest: (name: string) => void;
}

export function AIGenerationProductCard({
  product,
  onRequest,
}: AIGenerationProductCardProps) {
  const { t } = useTranslation();
  const Icon = product.type === 'ai_image' ? ImageIcon : product.type === 'ai_video' ? Video : Music;

  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {t('products.labels.format', 'Format')}:
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {product.format}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5" />
        {t('products.labels.delivery', 'Delivery')}:
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {product.deliveryTime}
        </span>
      </div>
      {product.resolution && (
        <div className="col-span-2 flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5" />
          {t('products.labels.resolution', 'Resolution')}:
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {product.resolution}
          </span>
        </div>
      )}
      {product.duration && (
        <div className="col-span-2 flex items-center gap-1.5">
          <Video className="h-3.5 w-3.5" />
          {t('products.labels.duration', 'Duration')}:
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {product.duration}
          </span>
        </div>
      )}
    </ProductCardWrapper>
  );
}
