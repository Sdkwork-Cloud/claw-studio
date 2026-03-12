import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ClawProduct } from '../../services';

interface ProductCardWrapperProps {
  children: ReactNode;
  product: ClawProduct;
  onRequest: (name: string) => void;
}

export function ProductCardWrapper({
  children,
  product,
  onRequest,
}: ProductCardWrapperProps) {
  const { t } = useTranslation();

  const getButtonText = (type: string) => {
    switch (type) {
      case 'physical':
        return t('products.buttons.buyNow', 'Buy Now');
      case 'auction':
        return t('products.buttons.placeBid', 'Place Bid');
      case 'recharge':
        return t('products.buttons.topUp', 'Top Up');
      case 'content':
        return t('products.buttons.readSubscribe', 'Read / Subscribe');
      case 'ai_image':
      case 'ai_video':
      case 'ai_music':
        return t('products.buttons.generateNow', 'Generate Now');
      case 'service':
        return t('products.buttons.inquire', 'Inquire');
      case 'coupon':
        return t('products.buttons.claim', 'Claim Coupon');
      case 'food':
        return t('products.buttons.orderFood', 'Order Now');
      default:
        return t('products.buttons.viewDetails', 'View Details');
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'physical':
        return 'bg-blue-500/90';
      case 'auction':
        return 'bg-rose-500/90';
      case 'recharge':
        return 'bg-emerald-500/90';
      case 'content':
        return 'bg-purple-500/90';
      case 'ai_image':
      case 'ai_video':
      case 'ai_music':
        return 'bg-indigo-500/90';
      case 'service':
        return 'bg-zinc-800/90';
      case 'coupon':
        return 'bg-amber-500/90';
      case 'food':
        return 'bg-orange-500/90';
      default:
        return 'bg-black/60';
    }
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row">
      {product.coverImage && (
        <div className="relative h-48 shrink-0 overflow-hidden sm:h-auto sm:w-48">
          <img
            src={product.coverImage}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
          <div
            className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur-md ${getBadgeColor(product.type)}`}
          >
            {t(`products.labels.${product.type}`, product.type.replace('_', ' '))}
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-2 flex items-start justify-between gap-4">
          <h3 className="text-lg font-bold text-zinc-900 transition-colors group-hover:text-primary-600 dark:text-zinc-100 dark:group-hover:text-primary-400">
            {product.name}
          </h3>
          <div className="whitespace-nowrap text-lg font-black text-primary-600 dark:text-primary-400">
            {product.price}
          </div>
        </div>
        <p className="mb-4 line-clamp-2 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
          {product.description}
        </p>

        <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
          {children}
        </div>

        <div className="mt-auto flex justify-end">
          <button
            onClick={() => onRequest(product.name)}
            className="flex items-center gap-1.5 rounded-xl bg-primary-50 px-5 py-2.5 text-sm font-bold text-primary-700 transition-colors hover:bg-primary-100 dark:bg-primary-500/10 dark:text-primary-400 dark:hover:bg-primary-500/20"
          >
            {getButtonText(product.type)} <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
