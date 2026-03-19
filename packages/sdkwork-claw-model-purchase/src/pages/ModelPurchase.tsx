import { startTransition, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@sdkwork/claw-ui';
import {
  ModelPurchaseBillingSwitch,
  ModelPurchasePlanGrid,
  ModelPurchaseSidebar,
  ModelPurchaseVendorHero,
} from '../components';
import type { ModelPurchaseBillingCycleId } from '../services';
import { modelPurchaseCatalogService } from '../services';

export function ModelPurchase() {
  const { t, i18n } = useTranslation();
  const [selectedVendorId, setSelectedVendorId] = useState('default');
  const [activeCycle, setActiveCycle] = useState<ModelPurchaseBillingCycleId>('monthly');
  const {
    data: vendors = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['model-purchase', 'vendors', i18n.resolvedLanguage ?? i18n.language],
    queryFn: () => modelPurchaseCatalogService.listVendors(i18n.resolvedLanguage ?? i18n.language),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.id === selectedVendorId) ?? vendors[0] ?? null,
    [selectedVendorId, vendors],
  );
  const selectedCycle = selectedVendor?.billingCycles.find((cycle) => cycle.id === activeCycle) ??
    selectedVendor?.billingCycles[0] ??
    null;

  const vendorGroups = useMemo(
    () =>
      [
        {
          id: 'default',
          label: t('modelPurchase.sidebar.defaultGroup'),
          vendors: vendors.filter((vendor) => vendor.group === 'default'),
        },
        {
          id: 'us-top10',
          label: t('modelPurchase.sidebar.usTop10'),
          vendors: vendors.filter((vendor) => vendor.group === 'us-top10'),
        },
        {
          id: 'china-top10',
          label: t('modelPurchase.sidebar.chinaTop10'),
          vendors: vendors.filter((vendor) => vendor.group === 'china-top10'),
        },
      ].filter((group) => group.vendors.length > 0),
    [t, vendors],
  );

  const summaryCards = useMemo(() => {
    if (!selectedVendor) {
      return [];
    }

    return [
      {
        id: 'region',
        title: t('modelPurchase.summary.region'),
        value:
          selectedVendor.group === 'default'
            ? t('modelPurchase.summary.globalBlend')
            : selectedVendor.region === 'us'
              ? t('modelPurchase.summary.usTop10Value')
              : t('modelPurchase.summary.chinaTop10Value'),
      },
      {
        id: 'models',
        title: t('modelPurchase.summary.highlightModels'),
        value: selectedVendor.modelHighlights.join(' / '),
      },
      {
        id: 'cycle',
        title: t('modelPurchase.summary.activeCycle'),
        value: selectedCycle?.label ?? '--',
      },
    ];
  }, [selectedCycle?.label, selectedVendor, t]);

  if (isLoading) {
    return (
      <div
        data-slot="model-purchase-page"
        className="flex h-full items-center justify-center px-4 py-8"
      >
        <div className="rounded-[30px] border border-dashed border-zinc-300 bg-white/80 p-10 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60">
          {t('modelPurchase.loading')}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        data-slot="model-purchase-page"
        className="flex h-full items-center justify-center px-4 py-8"
      >
        <div className="max-w-lg rounded-[30px] border border-zinc-200/80 bg-white/92 p-10 text-center shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-zinc-800/80 dark:bg-zinc-950/70">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t('modelPurchase.error.title')}
          </h1>
          <p className="mt-3 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
            {t('modelPurchase.error.description')}
          </p>
          <Button type="button" className="mt-6" onClick={() => void refetch()}>
            {t('modelPurchase.actions.retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (!selectedVendor || !selectedCycle) {
    return (
      <div
        data-slot="model-purchase-page"
        className="flex h-full items-center justify-center px-4 py-8"
      >
        <div className="max-w-lg rounded-[30px] border border-zinc-200/80 bg-white/92 p-10 text-center shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-zinc-800/80 dark:bg-zinc-950/70">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t('modelPurchase.empty.title')}
          </h1>
          <p className="mt-3 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
            {t('modelPurchase.empty.description')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-slot="model-purchase-page"
      className="space-y-4 px-4 py-4 sm:px-4 sm:py-6 xl:px-4 xl:py-6"
    >
      <section className="rounded-[32px] border border-zinc-200/80 bg-white/92 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
          {t('modelPurchase.eyebrow')}
        </div>
        <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t('modelPurchase.title')}
            </h1>
            <p className="mt-3 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
              {t('modelPurchase.description')}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {summaryCards.map((card) => (
              <div
                key={card.id}
                className="rounded-[24px] border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {card.title}
                </div>
                <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <ModelPurchaseSidebar
          groups={vendorGroups}
          selectedVendorId={selectedVendorId}
          onSelect={(vendorId) =>
            startTransition(() => {
              setSelectedVendorId(vendorId);
            })
          }
        />

        <div className="min-w-0 flex-1 space-y-4">
          <ModelPurchaseBillingSwitch
            cycles={selectedVendor.billingCycles}
            activeCycle={activeCycle}
            onChange={(cycle) =>
              startTransition(() => {
                setActiveCycle(cycle);
              })
            }
          />
          <ModelPurchaseVendorHero vendor={selectedVendor} cycle={selectedCycle} />
          <ModelPurchasePlanGrid cycle={selectedCycle} />
        </div>
      </div>
    </div>
  );
}
