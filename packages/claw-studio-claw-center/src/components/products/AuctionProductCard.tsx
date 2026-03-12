import { Calendar, Gavel, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AuctionProduct } from '../../services';
import { ProductCardWrapper } from './ProductCardWrapper';

interface AuctionProductCardProps {
  product: AuctionProduct;
  onRequest: (name: string) => void;
}

export function AuctionProductCard({
  product,
  onRequest,
}: AuctionProductCardProps) {
  const { t } = useTranslation();

  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="flex items-center gap-1.5">
        <Gavel className="h-3.5 w-3.5" />
        {t('products.labels.currentBid', 'Current Bid')}:
        <span className="font-bold text-rose-600 dark:text-rose-400">
          {product.currentBid}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5" />
        {t('products.labels.ends', 'Ends')}:
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {new Date(product.endTime).toLocaleDateString()}
        </span>
      </div>
      <div className="col-span-2 flex items-center gap-1.5">
        <MessageCircle className="h-3.5 w-3.5" />
        {t('products.labels.bids', 'Bids')}:
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {product.bidCount}
        </span>
      </div>
    </ProductCardWrapper>
  );
}
