import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Package,
  PlayCircle,
  Sparkles,
  Store,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { type ClawMallProduct } from '@sdkwork/claw-core';
import { clawMallCatalogService as clawMallService } from '../../services/index.ts';

export function ProductDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const [product, setProduct] = useState<ClawMallProduct | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<ClawMallProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const productId = params.id?.trim();

    if (!productId) {
      setProduct(null);
      setRelatedProducts([]);
      setLoading(false);
      setError('Missing product id.');
      return;
    }

    const resolvedProductId = productId;

    async function loadProduct() {
      setLoading(true);
      setError(null);

      try {
        const currentProduct = await clawMallService.getProduct(resolvedProductId);
        const nextRelatedProducts = await clawMallService.getRelatedProducts(
          currentProduct,
          4,
        );

        if (disposed) {
          return;
        }

        setProduct(currentProduct);
        setRelatedProducts(nextRelatedProducts);
      } catch (loadError) {
        if (disposed) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load Claw Mall product detail.',
        );
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    void loadProduct();

    return () => {
      disposed = true;
    };
  }, [params.id]);

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.14),_transparent_30%),linear-gradient(180deg,_#fff9f3_0%,_#ffffff_100%)] px-6 py-8 text-zinc-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <button
          type="button"
          onClick={() => navigate('/mall')}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back', { defaultValue: 'Back' })}
        </button>

        {loading ? (
          <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
            <div className="h-[26rem] animate-pulse rounded-[2rem] bg-zinc-100" />
            <div className="h-[26rem] animate-pulse rounded-[2rem] bg-zinc-100" />
          </div>
        ) : error ? (
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">
            {error}
          </div>
        ) : !product ? (
          <div className="rounded-[2rem] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-sm text-zinc-500">
            {t('mall.empty.detail', { defaultValue: 'The requested product could not be found.' })}
          </div>
        ) : (
          <>
            <section className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
              <div className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
                <div className="aspect-[4/3] overflow-hidden bg-gradient-to-br from-amber-100 via-orange-50 to-white">
                  {product.mainImage ? (
                    <img
                      src={product.mainImage}
                      alt={product.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-400">
                      <Package className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="grid gap-3 border-t border-zinc-100 p-5 sm:grid-cols-3">
                  {product.images.length > 0 ? (
                    product.images.slice(0, 3).map((image, index) => (
                      <div
                        key={`${image}-${index}`}
                        className="aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-zinc-100"
                      >
                        <img
                          src={image}
                          alt={`${product.title} ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.25rem] border border-dashed border-zinc-200 p-4 text-sm text-zinc-400">
                      {t('mall.detail.noGallery', { defaultValue: 'No gallery images' })}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                  <Store className="h-3.5 w-3.5" />
                  {product.categoryName || t('sidebar.clawMall', { defaultValue: 'Claw Mall' })}
                </div>
                <div className="space-y-4">
                  <div>
                    <h1 className="text-4xl font-semibold tracking-tight text-zinc-950">
                      {product.title}
                    </h1>
                    <p className="mt-3 text-sm leading-7 text-zinc-600">
                      {product.summary || product.description || 'Claw Mall product detail'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <div className="rounded-[1.2rem] border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                        {t('mall.detail.price', { defaultValue: 'Price' })}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-zinc-950">
                        {product.price !== undefined ? `¥${product.price}` : 'Contact'}
                      </div>
                    </div>
                    <div className="rounded-[1.2rem] border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                        {t('mall.detail.stock', { defaultValue: 'Stock' })}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-zinc-950">
                        {product.stock ?? '--'}
                      </div>
                    </div>
                    <div className="rounded-[1.2rem] border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                        {t('mall.detail.sales', { defaultValue: 'Sales' })}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-zinc-950">
                        {product.sales ?? '--'}
                      </div>
                    </div>
                  </div>

                  {product.videoUrl ? (
                    <a
                      href={product.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm text-white transition hover:bg-zinc-800"
                    >
                      <PlayCircle className="h-4 w-4" />
                      {t('mall.detail.video', { defaultValue: 'Watch product video' })}
                    </a>
                  ) : null}

                  {product.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {product.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1fr,0.9fr]">
              <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
                <div className="mb-4 text-lg font-semibold text-zinc-950">
                  {t('mall.detail.descriptionTitle', { defaultValue: 'Product overview' })}
                </div>
                <div className="prose prose-zinc max-w-none text-sm leading-7 text-zinc-600">
                  {product.description || product.summary || 'No product description available.'}
                </div>
              </div>

              <div className="space-y-6">
                <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
                  <div className="mb-4 text-lg font-semibold text-zinc-950">
                    {t('mall.detail.attributesTitle', { defaultValue: 'Attributes' })}
                  </div>
                  {product.attributes.length === 0 ? (
                    <div className="text-sm text-zinc-500">
                      {t('mall.detail.noAttributes', {
                        defaultValue: 'No structured attributes were returned for this product.',
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {product.attributes.map((attribute, index) => (
                        <div
                          key={String(attribute.id || index)}
                          className="rounded-[1.25rem] border border-zinc-200 bg-zinc-50 px-4 py-3"
                        >
                          <div className="text-sm font-semibold text-zinc-900">
                            {String(attribute.name || `Attribute ${index + 1}`)}
                          </div>
                          <div className="mt-1 text-sm text-zinc-500">
                            {Array.isArray(attribute.values)
                              ? attribute.values.join(', ')
                              : '--'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
                  <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-950">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    {t('mall.detail.relatedTitle', { defaultValue: 'Related products' })}
                  </div>
                  {relatedProducts.length === 0 ? (
                    <div className="text-sm text-zinc-500">
                      {t('mall.detail.noRelated', {
                        defaultValue: 'No related products are available in this category yet.',
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {relatedProducts.map((relatedProduct) => (
                        <button
                          key={relatedProduct.id}
                          type="button"
                          onClick={() => navigate(`/mall/${relatedProduct.id}`)}
                          className="flex w-full items-center justify-between rounded-[1.25rem] border border-zinc-200 bg-zinc-50 px-4 py-3 text-left transition hover:bg-white hover:shadow-[0_16px_32px_rgba(15,23,42,0.08)]"
                        >
                          <div>
                            <div className="text-sm font-semibold text-zinc-900">
                              {relatedProduct.title}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {relatedProduct.summary || relatedProduct.categoryName || 'Claw Mall'}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-zinc-900">
                            {relatedProduct.price !== undefined ? `¥${relatedProduct.price}` : '--'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
