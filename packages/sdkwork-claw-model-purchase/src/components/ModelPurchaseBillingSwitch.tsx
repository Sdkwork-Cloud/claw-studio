import { useTranslation } from 'react-i18next';
import { Button } from '@sdkwork/claw-ui';
import type {
  ModelPurchaseBillingCycle,
  ModelPurchaseBillingCycleId,
  ModelPurchaseVendor,
} from '../services';

interface ModelPurchaseBillingSwitchProps {
  vendor: ModelPurchaseVendor;
  cycles: ModelPurchaseBillingCycle[];
  activeCycle: ModelPurchaseBillingCycleId;
  onChange: (cycle: ModelPurchaseBillingCycleId) => void;
}

const billingCycleIds: ModelPurchaseBillingCycleId[] = ['monthly', 'quarterly', 'yearly'];

export function ModelPurchaseBillingSwitch({
  vendor,
  cycles,
  activeCycle,
  onChange,
}: ModelPurchaseBillingSwitchProps) {
  const { t } = useTranslation();
  const orderedCycles = billingCycleIds
    .map((cycleId) => cycles.find((cycle) => cycle.id === cycleId))
    .filter((cycle): cycle is ModelPurchaseBillingCycle => Boolean(cycle));
  const activeCycleData = orderedCycles.find((cycle) => cycle.id === activeCycle) ?? orderedCycles[0];

  return (
    <section
      data-slot="model-purchase-billing-switch"
      className="rounded-[28px] border border-zinc-200/80 bg-white/94 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70"
    >
      <div className="min-w-0 max-w-4xl">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          <span>{t('modelPurchase.eyebrow')}</span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] tracking-[0.18em] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            {t('modelPurchase.billingCycle.title')}
          </span>
        </div>
        <div className="mt-3 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {vendor.name}
          </h1>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {vendor.tagline}
          </p>
        </div>
      </div>
      {activeCycleData ? (
        <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          {activeCycleData.description}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 rounded-[24px] bg-zinc-100/80 p-1.5 md:grid-cols-3 dark:bg-zinc-900/70">
        {orderedCycles.map((cycle) => {
          const isActive = cycle.id === activeCycle;

          return (
            <Button
              key={cycle.id}
              type="button"
              variant="ghost"
              onClick={() => onChange(cycle.id)}
              aria-pressed={isActive}
              className={`flex h-auto flex-col items-start rounded-[18px] px-4 py-3 text-left ${
                isActive
                  ? 'bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200'
                  : 'bg-transparent text-zinc-600 hover:bg-white hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-950 dark:hover:text-zinc-50'
              }`}
            >
              <span className="text-sm font-semibold">{cycle.label}</span>
              <span
                className={`mt-1 text-[11px] leading-5 ${
                  isActive ? 'text-white/75 dark:text-zinc-600' : 'text-zinc-500'
                }`}
              >
                {cycle.savingsHint}
              </span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
