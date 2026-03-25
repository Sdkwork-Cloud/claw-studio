import { useEffect, useState } from 'react';
import {
  ChevronRight,
  Flame,
  Package,
  Search,
  Sparkles,
  Store,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type ClawMallProduct } from '@sdkwork/claw-core/services/clawMallService';
import { clawMallCatalogService as clawMallService } from '../../services/clawMallService.ts';
import {
  flattenMallCategories,
  type FlattenedMallCategory,
} from './mallCatalogPresentation.ts';

export function ClawMall() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | undefined>(undefined);
  const [categories, setCategories] = useState<FlattenedMallCategory[]>([]);
  const [products, setProducts] = useState<ClawMallProduct[]>([]);
  const [hotProducts, setHotProducts] = useState<ClawMallProduct[]>([]);
  const [latestProducts, setLatestProducts] = useState<ClawMallProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    async function loadCatalog() {
      setLoading(true);
      setError(null);

      try {
        const snapshot = await clawMallService.getCatalog({
          categoryId: activeCategoryId,
          keyword: keyword.trim() || undefined,
          page: 1,
          pageSize: 12,
        });

        if (disposed) {
          return;
        }

        setCategories(flattenMallCategories(snapshot.categories));
        setProducts(snapshot.page.items);
        setHotProducts(snapshot.hotProducts);
        setLatestProducts(snapshot.latestProducts);
      } catch (loadError) {
        if (disposed) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load Claw Mall catalog.',
        );
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      disposed = true;
    };
  }, [activeCategoryId, keyword]);

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.12),_transparent_32%),linear-gradient(180deg,_#fff8ef_0%,_#fffdf8_44%,_#ffffff_100%)] px-6 py-8 text-zinc-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[2rem] border border-amber-200/70 bg-white/90 p-8 shadow-[0_32px_100px_rgba(120,53,15,0.10)] backdrop-blur">
          <div className="grid gap-6 lg:grid-cols-[1.35fr,0.9fr]">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
                <Store className="h-3.5 w-3.5" />
                {t('sidebar.clawMall', { defaultValue: 'Claw Mall' })}
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950">
                  {t('mall.hero.title', {
                    defaultValue: 'Browse real products from the PlusProduct catalog',
                  })}
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-zinc-600">
                  {t('mall.hero.description', {
                    defaultValue:
                      'Categories, product lists, hot items, and detail views now run through the generated app SDK instead of handwritten HTTP.',
                  })}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <MallHighlightCard
                icon={Package}
                title={t('mall.metrics.catalog.title', { defaultValue: 'Catalog' })}
                value={String(products.length)}
                description={t('mall.metrics.catalog.description', {
                  defaultValue: 'Visible products in the current query',
                })}
              />
              <MallHighlightCard
                icon={Flame}
                title={t('mall.metrics.hot.title', { defaultValue: 'Hot Picks' })}
                value={String(hotProducts.length)}
                description={t('mall.metrics.hot.description', {
                  defaultValue: 'Popular products from the hot feed',
                })}
              />
              <MallHighlightCard
                icon={Sparkles}
                title={t('mall.metrics.latest.title', { defaultValue: 'Latest' })}
                value={String(latestProducts.length)}
                description={t('mall.metrics.latest.description', {
                  defaultValue: 'Newest products from the latest feed',
                })}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[17rem,minmax(0,1fr)]">
          <aside className="rounded-[1.75rem] border border-zinc-200 bg-white/90 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
            <div className="mb-4 text-sm font-semibold tracking-wide text-zinc-900">
              {t('mall.filters.categories', { defaultValue: 'Categories' })}
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setActiveCategoryId(undefined)}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition ${
                  activeCategoryId === undefined
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <span>{t('mall.filters.all', { defaultValue: 'All products' })}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategoryId(category.id)}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition ${
                    activeCategoryId === category.id
                      ? 'bg-amber-500 text-white'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                  style={{ paddingLeft: `${0.75 + category.depth * 0.75}rem` }}
                >
                  <span>{category.name}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ))}
            </div>
          </aside>

          <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-zinc-200 bg-white/90 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
              <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <Search className="h-4 w-4 text-zinc-400" />
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder={t('mall.search.placeholder', {
                    defaultValue: 'Search products, tags, or categories',
                  })}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
                />
              </label>
            </div>

            <CatalogStrip
              title={t('mall.sections.hot', { defaultValue: 'Hot right now' })}
              items={hotProducts}
              onSelect={(product) => navigate(`/mall/${product.id}`)}
            />

            <CatalogStrip
              title={t('mall.sections.latest', { defaultValue: 'Latest arrivals' })}
              items={latestProducts}
              onSelect={(product) => navigate(`/mall/${product.id}`)}
            />

            <section className="rounded-[1.75rem] border border-zinc-200 bg-white/90 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-950">
                    {t('mall.sections.catalog', { defaultValue: 'Catalog' })}
                  </h2>
                  <p className="text-sm text-zinc-500">
                    {t('mall.sections.catalogDescription', {
                      defaultValue: 'Active products from the current query surface.',
                    })}
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-72 animate-pulse rounded-[1.5rem] bg-zinc-100"
                    />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                  {error}
                </div>
              ) : products.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-sm text-zinc-500">
                  {t('mall.empty.catalog', {
                    defaultValue: 'No products matched the current catalog query.',
                  })}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {products.map((product) => (
                    <MallProductCard
                      key={product.id}
                      product={product}
                      onClick={() => navigate(`/mall/${product.id}`)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}

function MallHighlightCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: typeof Store;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-zinc-200 bg-gradient-to-br from-white to-amber-50/80 p-4">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 text-white">
        <Icon className="h-4 w-4" />
      </div>
      <div className="space-y-1">
        <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">{title}</div>
        <div className="text-2xl font-semibold text-zinc-950">{value}</div>
        <div className="text-xs leading-6 text-zinc-500">{description}</div>
      </div>
    </div>
  );
}

function CatalogStrip({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: ClawMallProduct[];
  onSelect: (product: ClawMallProduct) => void;
}) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[1.75rem] border border-zinc-200 bg-white/90 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
      <div className="mb-4 text-lg font-semibold text-zinc-950">{title}</div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => onSelect(product)}
            className="rounded-[1.4rem] border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_32px_rgba(15,23,42,0.08)]"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-zinc-900">{product.title}</div>
              {product.hot ? (
                <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-600">
                  {t('mall.hotBadge', { defaultValue: 'Hot' })}
                </span>
              ) : null}
            </div>
            <div className="text-sm leading-6 text-zinc-500">
              {product.summary || product.description || 'Claw Mall product'}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function MallProductCard({
  product,
  onClick,
}: {
  product: ClawMallProduct;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-[1.6rem] border border-zinc-200 bg-white text-left transition hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(15,23,42,0.12)]"
    >
      <div className="aspect-[4/3] overflow-hidden bg-gradient-to-br from-amber-100 via-orange-50 to-white">
        {product.mainImage ? (
          <img
            src={product.mainImage}
            alt={product.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400">
            <Package className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="space-y-3 p-5">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-[0.22em] text-zinc-400">
            {product.categoryName || 'Uncategorized'}
          </div>
          <div className="text-lg font-semibold text-zinc-950">{product.title}</div>
          <div className="line-clamp-2 text-sm leading-6 text-zinc-500">
            {product.summary || product.description || 'Claw Mall product'}
          </div>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-950">
              {product.price !== undefined ? `¥${product.price}` : 'Contact'}
            </div>
            {product.originalPrice !== undefined &&
            product.originalPrice !== product.price ? (
              <div className="text-xs text-zinc-400 line-through">
                ¥{product.originalPrice}
              </div>
            ) : null}
          </div>
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
            {product.sales !== undefined ? `${product.sales} sold` : 'View'}
          </div>
        </div>
      </div>
    </button>
  );
}
