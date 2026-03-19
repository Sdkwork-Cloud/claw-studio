import { useTranslation } from 'react-i18next';
import { Check, Crown, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@sdkwork/claw-ui';
import type { ModelPurchaseBillingCycle, ModelPurchasePlan } from '../services';

interface ModelPurchasePlanGridProps {
  cycle: ModelPurchaseBillingCycle;
}

function getBadgeLabel(t: (key: string) => string, plan: ModelPurchasePlan) {
  if (plan.badge === 'recommended') {
    return t('modelPurchase.badges.mostPopular');
  }

  if (plan.badge === 'best-value') {
    return t('modelPurchase.badges.bestValue');
  }

  if (plan.badge === 'enterprise') {
    return t('modelPurchase.badges.enterprise');
  }

  return null;
}

export function ModelPurchasePlanGrid({ cycle }: ModelPurchasePlanGridProps) {
  const { t, i18n } = useTranslation();
  const periodKey =
    cycle.id === 'monthly' ? 'month' : cycle.id === 'quarterly' ? 'quarter' : 'year';
  const numberFormatter = new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language);

  return (
    <section
      data-slot="model-purchase-plan-grid"
      className="grid gap-4 xl:grid-cols-3"
    >
      {cycle.plans.map((plan) => {
        const badgeLabel = getBadgeLabel(t, plan);

        return (
          <article
            key={plan.id}
            className={`rounded-[30px] border p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] ${
              plan.badge === 'recommended'
                ? 'border-primary-400/60 bg-white shadow-primary-500/10 dark:border-primary-500/60 dark:bg-zinc-950'
                : 'border-zinc-200/80 bg-white/94 dark:border-zinc-800/80 dark:bg-zinc-950/70'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {cycle.label}
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{plan.tagline}</p>
              </div>
              {badgeLabel ? (
                <div className="inline-flex items-center gap-1 rounded-full bg-primary-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
                  {plan.badge === 'enterprise' ? (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  ) : plan.badge === 'best-value' ? (
                    <Sparkles className="h-3.5 w-3.5" />
                  ) : (
                    <Crown className="h-3.5 w-3.5" />
                  )}
                  {badgeLabel}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex items-end gap-2">
              <div className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {t('modelPurchase.currency.cny')} {numberFormatter.format(plan.priceCny)}
              </div>
              <div className="pb-1 text-sm text-zinc-500 dark:text-zinc-400">
                / {t(`modelPurchase.planGrid.period.${periodKey}`)}
              </div>
            </div>

            {plan.originalPriceCny ? (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-zinc-400 line-through">
                  {t('modelPurchase.currency.cny')} {numberFormatter.format(plan.originalPriceCny)}
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  {plan.savingsLabel}
                </span>
              </div>
            ) : (
              <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {cycle.savingsHint}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3 rounded-[24px] bg-zinc-50 p-4 dark:bg-zinc-900/80">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {t('modelPurchase.planGrid.quota')}
                </div>
                <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {plan.tokenAllowance}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {t('modelPurchase.planGrid.support')}
                </div>
                <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {plan.support}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {t('modelPurchase.planGrid.seats')}
                </div>
                <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {plan.seats}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {t('modelPurchase.planGrid.concurrency')}
                </div>
                <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {plan.concurrency}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {t('modelPurchase.planGrid.includedModels')}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {plan.includedModels.map((model) => (
                  <span
                    key={model}
                    className="rounded-full border border-zinc-200/80 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    {model}
                  </span>
                ))}
              </div>
            </div>

            <ul className="mt-6 space-y-3">
              {plan.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-300">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <Button type="button" className="mt-8 w-full">
              {t('modelPurchase.planGrid.startPlan', { planName: plan.name })}
            </Button>
          </article>
        );
      })}
    </section>
  );
}
