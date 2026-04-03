import { startTransition, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@sdkwork/claw-ui';
import {
  ModelPurchaseBillingSwitch,
  ModelPurchasePaymentView,
  ModelPurchasePlanGrid,
  ModelPurchaseSidebar,
} from '../components';
import type { ModelPurchasePaymentMethod } from '../components';
import type { ModelPurchaseBillingCycleId, ModelPurchasePlan } from '../services';
import { modelPurchaseCatalogService } from '../services';

interface ModelPurchaseCheckoutSelection {
  vendorId: string;
  cycleId: ModelPurchaseBillingCycleId;
  planId: string;
}

export function ModelPurchase() {
  const { t, i18n } = useTranslation();
  const [selectedVendorId, setSelectedVendorId] = useState('default');
  const [activeCycle, setActiveCycle] = useState<ModelPurchaseBillingCycleId>('monthly');
  const [view, setView] = useState<'plans' | 'payment'>('plans');
  const [checkoutSelection, setCheckoutSelection] = useState<ModelPurchaseCheckoutSelection | null>(
    null,
  );
  const [paymentMethod, setPaymentMethod] = useState<ModelPurchasePaymentMethod>('wechat');
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
  const checkoutVendor =
    checkoutSelection
      ? vendors.find((vendor) => vendor.id === checkoutSelection.vendorId) ?? null
      : null;
  const checkoutCycle =
    checkoutVendor && checkoutSelection
      ? checkoutVendor.billingCycles.find((cycle) => cycle.id === checkoutSelection.cycleId) ?? null
      : null;
  const checkoutPlan =
    checkoutCycle && checkoutSelection
      ? checkoutCycle.plans.find((plan) => plan.id === checkoutSelection.planId) ?? null
      : null;

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

  if (isLoading) {
    return (
      <div
        data-slot="model-purchase-page"
        className="flex h-full min-h-0 items-center justify-center px-4 py-8"
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

  const handleStartPlan = (plan: ModelPurchasePlan) => {
    startTransition(() => {
      setCheckoutSelection({
        vendorId: selectedVendor.id,
        cycleId: selectedCycle.id,
        planId: plan.id,
      });
      setPaymentMethod('wechat');
      setView('payment');
    });
  };

  const handleBackToPlans = () => {
    startTransition(() => {
      setView('plans');
    });
  };

  const handleConfirmPayment = () => {
    // Order submission is intentionally disabled until this workspace
    // is connected to a live commercial checkout contract.
  };

  const paymentViewModel =
    view === 'payment' && checkoutVendor && checkoutCycle && checkoutPlan
      ? {
          vendor: checkoutVendor,
          cycle: checkoutCycle,
          plan: checkoutPlan,
        }
      : null;

  return (
    <div
      data-slot="model-purchase-page"
      className="h-full min-h-0 px-4 py-4 sm:px-4 sm:py-5 xl:overflow-hidden"
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        {paymentViewModel ? (
          <section
            data-slot="model-purchase-main-panel"
            className="min-h-0 flex-1 rounded-[32px] border border-zinc-200/80 bg-white/86 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/58 sm:p-5"
          >
            <ModelPurchasePaymentView
              vendor={paymentViewModel.vendor}
              cycle={paymentViewModel.cycle}
              plan={paymentViewModel.plan}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={(method) =>
                startTransition(() => {
                  setPaymentMethod(method);
                })
              }
              onBack={handleBackToPlans}
              onConfirmPayment={handleConfirmPayment}
              checkoutEnabled={false}
              checkoutUnavailableMessage={t('modelPurchase.payment.unavailableMessage')}
            />
          </section>
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-4 xl:flex-row xl:items-stretch">
            <ModelPurchaseSidebar
              groups={vendorGroups}
              selectedVendorId={selectedVendorId}
              onSelect={(vendorId) =>
                startTransition(() => {
                  setSelectedVendorId(vendorId);
                })
              }
            />

            <section
              data-slot="model-purchase-main-panel"
              className="min-w-0 flex-1 rounded-[32px] border border-zinc-200/80 bg-white/86 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/58 xl:min-h-0"
            >
              <div className="flex h-full min-h-0 flex-col gap-3 p-4 sm:p-5">
                <div className="shrink-0">
                  <ModelPurchaseBillingSwitch
                    vendor={selectedVendor}
                    cycles={selectedVendor.billingCycles}
                    activeCycle={activeCycle}
                    onChange={(cycle) =>
                      startTransition(() => {
                        setActiveCycle(cycle);
                      })
                    }
                  />
                </div>
                <div className="flex-1 xl:min-h-0">
                  <ModelPurchasePlanGrid
                    vendor={selectedVendor}
                    cycle={selectedCycle}
                    onPurchasePlan={handleStartPlan}
                  />
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
