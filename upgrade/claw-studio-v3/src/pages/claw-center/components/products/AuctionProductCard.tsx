import React from 'react';
import { Gavel, Calendar, MessageCircle } from 'lucide-react';
import { AuctionProduct } from '../../../../services/clawService';
import { ProductCardWrapper } from './ProductCardWrapper';
import { useTranslation } from 'react-i18next';

export const AuctionProductCard = ({ product, onRequest }: { product: AuctionProduct, onRequest: (name: string) => void }) => {
  const { t } = useTranslation();
  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="flex items-center gap-1.5"><Gavel className="w-3.5 h-3.5" /> {t('products.labels.currentBid', 'Current Bid')}: <span className="font-bold text-rose-600 dark:text-rose-400">{product.currentBid}</span></div>
      <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {t('products.labels.ends', 'Ends')}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{new Date(product.endTime).toLocaleDateString()}</span></div>
      <div className="flex items-center gap-1.5 col-span-2"><MessageCircle className="w-3.5 h-3.5" /> {t('products.labels.bids', 'Bids')}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{product.bidCount}</span></div>
    </ProductCardWrapper>
  );
};
