import { useTranslation } from 'react-i18next';
import { Check, Crown, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@sdkwork/claw-ui';
import type {
  ModelPurchaseBillingCycle,
  ModelPurchasePlan,
  ModelPurchaseVendor,
} from '../services';

interface ModelPurchasePlanGridProps {
  vendor: ModelPurchaseVendor;
  cycle: ModelPurchaseBillingCycle;
  onPurchasePlan: (plan: ModelPurchasePlan) => void;
}

type ModelPurchaseDisplayCard =
  | {
      kind: 'free';
      id: 'free-membership';
      badge: string;
      title: string;
      tagline: string;
      audienceLabel: string;
      audience: string;
      note: string;
      benefits: string[];
    }
  | {
      kind: 'paid';
      id: string;
      plan: ModelPurchasePlan;
    };

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

function buildFreeMembershipCard(
  t: (key: string, options?: Record<string, unknown>) => string,
  vendor: ModelPurchaseVendor,
): ModelPurchaseDisplayCard {
  return {
    kind: 'free',
    id: 'free-membership',
    badge: t('modelPurchase.freeMembership.badge'),
    title: t('modelPurchase.freeMembership.title'),
    tagline: t('modelPurchase.freeMembership.tagline'),
    audienceLabel: t('modelPurchase.freeMembership.audienceLabel'),
    audience: t('modelPurchase.freeMembership.audience'),
    note: t('modelPurchase.freeMembership.note'),
    benefits: [
      t('modelPurchase.freeMembership.benefits.previewVendorPlans', { vendor: vendor.name }),
      t('modelPurchase.freeMembership.benefits.savePreferences'),
      t('modelPurchase.freeMembership.benefits.memberUpdates'),
      t('modelPurchase.freeMembership.benefits.upgradeAnytime'),
    ],
  };
}

export function ModelPurchasePlanGrid({
  vendor,
  cycle,
  onPurchasePlan,
}: ModelPurchasePlanGridProps) {
  const { t, i18n } = useTranslation();
  const periodKey =
    cycle.id === 'monthly' ? 'month' : cycle.id === 'quarterly' ? 'quarter' : 'year';
  const numberFormatter = new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language);
  const displayCards: ModelPurchaseDisplayCard[] = [
    buildFreeMembershipCard(t, vendor),
    ...cycle.plans.map(
      (plan): ModelPurchaseDisplayCard => ({
        kind: 'paid',
        id: plan.id,
        plan,
      }),
    ),
  ];

  return (
    <section
      data-slot="model-purchase-plan-grid"
      className="grid h-full gap-4 md:grid-cols-2 xl:grid-cols-4"
    >
      {displayCards.map((card) => {
        if (card.kind === 'free') {
          return (
            <article
              key={card.id}
              className="flex h-full flex-col rounded-[30px] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(250,250,250,0.96)_0%,rgba(255,255,255,0.92)_100%)] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)] dark:border-zinc-800/80 dark:bg-[linear-gradient(180deg,rgba(39,39,42,0.94)_0%,rgba(24,24,27,0.92)_100%)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    {card.badge}
                  </div>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {card.tagline}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                  {card.badge}
                </span>
              </div>

              <div className="mt-5 rounded-[24px] border border-zinc-200/80 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {card.audienceLabel}
                </div>
                <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {card.audience}
                </div>
              </div>

              <ul className="mt-5 space-y-2.5">
                {card.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 rounded-[22px] border border-dashed border-zinc-200/90 bg-zinc-50/85 px-4 py-3 text-xs leading-5 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
                {card.note}
              </div>
            </article>
          );
        }

        const plan = card.plan;
        const badgeLabel = getBadgeLabel(t, plan);
        const primaryBenefits = plan.benefits.slice(0, 3);

        return (
          <article
            key={card.id}
            className={`flex h-full flex-col rounded-[30px] border p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] ${
              plan.badge === 'recommended'
                ? 'border-primary-400/60 bg-white shadow-primary-500/10 dark:border-primary-500/60 dark:bg-zinc-950'
                : 'border-zinc-200/80 bg-white/94 dark:border-zinc-800/80 dark:bg-zinc-950/70'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {plan.tagline}
                </p>
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

            <div className="mt-5 flex items-end gap-2">
              <div className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
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

            <Button
              type="button"
              className="mt-4 w-full"
              onClick={() => onPurchasePlan(plan)}
            >
              {t('modelPurchase.planGrid.startPlan', { planName: plan.name })}
            </Button>

            <div className="mt-5 grid grid-cols-2 gap-3 rounded-[24px] bg-zinc-50 p-4 dark:bg-zinc-900/80">
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

            <div className="mt-5 rounded-[24px] border border-zinc-200/80 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {t('modelPurchase.metrics.modelFamily.label')}
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

            <ul className="mt-5 space-y-2.5">
              {primaryBenefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-300">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </section>
  );
}
