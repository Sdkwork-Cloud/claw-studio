import { Clock, Star, Store } from 'lucide-react';
import type { FoodProduct } from '../../services';
import { ProductCardWrapper } from './ProductCardWrapper';

interface FoodProductCardProps {
  product: FoodProduct;
  onRequest: (name: string) => void;
}

export function FoodProductCard({ product, onRequest }: FoodProductCardProps) {
  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="col-span-2 flex items-center gap-1.5">
        <Store className="h-3.5 w-3.5 text-zinc-400" />
        <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">
          {product.restaurant}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-zinc-400" />
        <span>{product.deliveryTime}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
        <span className="font-bold text-zinc-700 dark:text-zinc-300">{product.rating}</span>
      </div>
    </ProductCardWrapper>
  );
}
