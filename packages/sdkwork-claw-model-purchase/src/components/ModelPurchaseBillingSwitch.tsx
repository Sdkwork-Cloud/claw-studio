import { useTranslation } from 'react-i18next';
import { Button } from '@sdkwork/claw-ui';
import type { ModelPurchaseBillingCycle, ModelPurchaseBillingCycleId } from '../services';

interface ModelPurchaseBillingSwitchProps {
  cycles: ModelPurchaseBillingCycle[];
  activeCycle: ModelPurchaseBillingCycleId;
  onChange: (cycle: ModelPurchaseBillingCycleId) => void;
}

const billingCycleIds: ModelPurchaseBillingCycleId[] = ['monthly', 'quarterly', 'yearly'];

export function ModelPurchaseBillingSwitch({
  cycles,
  activeCycle,
  onChange,
}: ModelPurchaseBillingSwitchProps) {
  const { t } = useTranslation();
  const orderedCycles = billingCycleIds
    .map((cycleId) => cycles.find((cycle) => cycle.id === cycleId))
    .filter((cycle): cycle is ModelPurchaseBillingCycle => Boolean(cycle));

  return (
    <section
      data-slot="model-purchase-billing-switch"
      className="rounded-[28px] border border-zinc-200/80 bg-white/92 p-3 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70"
    >
      <div className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
        {t('modelPurchase.billingCycle.title')}
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {orderedCycles.map((cycle) => {
          const isActive = cycle.id === activeCycle;

          return (
            <Button
              key={cycle.id}
              type="button"
              variant="ghost"
              onClick={() => onChange(cycle.id)}
              aria-pressed={isActive}
              className={`flex h-auto flex-col items-start rounded-[22px] px-4 py-4 text-left ${
                isActive
                  ? 'bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50'
              }`}
            >
              <span className="text-sm font-semibold">{cycle.label}</span>
              <span className={`mt-1 text-xs ${isActive ? 'text-white/75 dark:text-zinc-600' : 'text-zinc-500'}`}>
                {cycle.description}
              </span>
              <span
                className={`mt-3 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  isActive
                    ? 'bg-white/12 text-white dark:bg-zinc-900 dark:text-zinc-100'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
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
