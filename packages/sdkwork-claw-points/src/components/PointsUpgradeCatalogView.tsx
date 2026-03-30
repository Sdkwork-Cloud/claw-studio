import { Check, Crown, Layers3, MessageCircle, Wallet } from 'lucide-react';
import { Button } from '@sdkwork/claw-ui';
import type { PointsDashboardData, PointsPlan } from '../services';
import { formatCurrencyCny, formatPoints, getCurrentPlanTitle } from './pointsCopy';

type Translate = (key: string, options?: Record<string, unknown>) => string;
type UpgradePaymentMethod = 'wechat' | 'alipay';

interface PointsUpgradeCatalogViewProps {
  t: Translate;
  language: string;
  data: PointsDashboardData;
  selectedPlan: PointsPlan | null;
  paymentMethod: UpgradePaymentMethod;
  isSubmitting: boolean;
  onSelectPack: (packId: number) => void;
  onSelectPaymentMethod: (method: UpgradePaymentMethod) => void;
  onStartCheckout: () => void;
}

const PAYMENT_METHODS: UpgradePaymentMethod[] = ['wechat', 'alipay'];

export function PointsUpgradeCatalogView({
  t,
  language,
  data,
  selectedPlan,
  paymentMethod,
  isSubmitting,
  onSelectPack,
  onSelectPaymentMethod,
  onStartCheckout,
}: PointsUpgradeCatalogViewProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
      <section className="space-y-6">
        {data.planGroups.map((group) => (
          <div
            key={group.groupId}
            data-slot="points-upgrade-group"
            className="rounded-[32px] border border-zinc-200/80 bg-white/90 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-zinc-800/80 dark:bg-zinc-950/72"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                  {t('points.upgradeDialog.groupEyebrow')}
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {group.groupName}
                </h3>
                <p className="mt-2 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                  {group.description || t('points.upgradeDialog.groupDescriptionFallback')}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                <Layers3 className="h-3.5 w-3.5" />
                {group.plans.length}
              </span>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              {group.plans.map((plan) => {
                const isSelected = selectedPlan?.packId === plan.packId;
                const showOriginalPrice = plan.originalPriceCny !== null && plan.originalPriceCny > plan.priceCny;

                return (
                  <article
                    key={plan.packId}
                    data-slot="points-upgrade-plan-card"
                    className={`relative flex h-full flex-col rounded-[30px] border bg-white px-7 py-8 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:bg-zinc-950/74 ${
                      isSelected
                        ? 'border-rose-500 shadow-rose-500/10'
                        : 'border-zinc-200/80 dark:border-zinc-800/80'
                    }`}
                  >
                    {plan.recommended ? (
                      <div className="absolute left-1/2 top-0 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full bg-rose-500 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_24px_rgba(244,63,94,0.3)]">
                        <Crown className="h-3.5 w-3.5" />
                        {t('points.planBadges.recommended')}
                      </div>
                    ) : null}

                    <div className="pt-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                        {plan.levelName || group.groupName}
                      </div>
                      <h4 className="mt-2 text-[2rem] font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                        {plan.name}
                      </h4>
                      <p className="mt-3 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                        {plan.description || t('points.upgradeDialog.defaultPlanDescription')}
                      </p>
                    </div>

                    <div className="mt-8">
                      {showOriginalPrice ? (
                        <div className="text-sm text-zinc-400 line-through dark:text-zinc-500">
                          {formatCurrencyCny(plan.originalPriceCny, language)}
                        </div>
                      ) : null}
                      <div className="mt-2 flex items-end gap-2">
                        <div className="text-5xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                          {formatCurrencyCny(plan.priceCny, language)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 rounded-[24px] bg-zinc-50/90 p-4 dark:bg-zinc-900/80">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                        {t('points.upgradeDialog.pointsGrant')}
                      </div>
                      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                        {formatPoints(plan.includedPoints, language)}
                      </div>
                      <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        {plan.durationDays
                          ? t('points.upgradeDialog.durationValue', { days: plan.durationDays })
                          : t('points.upgradeDialog.durationUnknown')}
                      </div>
                    </div>

                    {plan.tags.length > 0 ? (
                      <div className="mt-6 flex flex-wrap gap-2">
                        {plan.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      onClick={() => onSelectPack(plan.packId)}
                      className="mt-8 rounded-2xl py-6 text-base font-semibold"
                      variant={isSelected ? 'default' : 'outline'}
                    >
                      {isSelected ? t('points.actions.selectedPlan') : t('points.actions.selectPlan')}
                      {isSelected ? <Check className="h-4 w-4" /> : null}
                    </Button>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section
        data-slot="points-upgrade-payment"
        className="rounded-[32px] border border-zinc-200/80 bg-white/94 p-8 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-zinc-950/80"
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
          {t('points.upgradeDialog.summaryEyebrow')}
        </div>
        <h3 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {t('points.upgradeDialog.summaryTitle')}
        </h3>
        <p className="mt-3 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
          {t('points.upgradeDialog.summaryDescription')}
        </p>

        <div className="mt-8 rounded-[28px] border border-zinc-200/80 bg-zinc-50/90 p-5 dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
            {t('points.upgradeDialog.currentMembership')}
          </div>
          <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            {getCurrentPlanTitle(t, data.summary.currentPlan)}
          </div>
        </div>

        {!data.summary.isAuthenticated ? (
          <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {t('points.auth.signInRequired')}
          </div>
        ) : null}

        {!selectedPlan ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50/90 px-4 py-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
            {t('points.upgradeDialog.noPlans')}
          </div>
        ) : (
          <>
            <div
              data-slot="points-upgrade-summary"
              className="mt-6 rounded-[28px] border border-zinc-200/80 bg-zinc-50/90 p-5 dark:border-zinc-800 dark:bg-zinc-900/80"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                {t('points.upgradeDialog.packageDetailsTitle')}
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {selectedPlan.name}
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {selectedPlan.description || t('points.upgradeDialog.defaultPlanDescription')}
              </div>

              <div data-slot="points-upgrade-summary-rows" className="mt-5 grid gap-3">
                <div className="flex items-center justify-between gap-4 rounded-[20px] bg-white/80 px-4 py-3 dark:bg-white/5">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {t('points.upgradeDialog.groupLabel')}
                  </span>
                  <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {selectedPlan.groupName || '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-[20px] bg-white/80 px-4 py-3 dark:bg-white/5">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {t('points.upgradeDialog.durationLabel')}
                  </span>
                  <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {selectedPlan.durationDays
                      ? t('points.upgradeDialog.durationValue', { days: selectedPlan.durationDays })
                      : t('points.upgradeDialog.durationUnknown')}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-[20px] bg-white/80 px-4 py-3 dark:bg-white/5">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {t('points.upgradeDialog.grantPointsLabel')}
                  </span>
                  <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {formatPoints(selectedPlan.includedPoints, language)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[28px] border border-zinc-200/80 bg-white/88 p-5 dark:border-zinc-800 dark:bg-zinc-950/55">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                {t('points.upgradeDialog.includedBenefitsTitle')}
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {t('points.upgradeDialog.includedBenefitsDescription')}
              </p>
              <div className="mt-4 space-y-3">
                {selectedPlan.benefits.length > 0 ? selectedPlan.benefits.map((benefit) => (
                  <div
                    key={benefit.id}
                    className="rounded-[22px] bg-zinc-50/90 px-4 py-3 dark:bg-zinc-900/70"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                          {benefit.name}
                        </div>
                        {benefit.description ? (
                          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            {benefit.description}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[22px] border border-dashed border-zinc-200 bg-zinc-50/90 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
                    {t('points.upgradeDialog.includedBenefitsEmpty')}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {PAYMENT_METHODS.map((method) => {
                const isActive = paymentMethod === method;
                const Icon = method === 'wechat' ? MessageCircle : Wallet;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => onSelectPaymentMethod(method)}
                    className={`flex items-center justify-center gap-3 rounded-[24px] border px-6 py-4 text-lg font-semibold transition-colors ${
                      isActive
                        ? 'border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200'
                        : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100'
                    }`}
                  >
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${
                      isActive
                        ? 'bg-sky-500 text-white'
                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    {t(`points.paymentMethods.${method}`)}
                  </button>
                );
              })}
            </div>

            <div className="mt-8 rounded-[30px] border border-rose-100 bg-rose-50/70 px-8 py-7 shadow-[0_18px_40px_rgba(244,63,94,0.08)] dark:border-rose-500/20 dark:bg-rose-500/10">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600 dark:text-rose-200">
                {t('points.upgradeDialog.totalPriceLabel')}
              </div>
              <div className="mt-3 text-6xl font-semibold tracking-tight text-rose-500">
                {formatCurrencyCny(selectedPlan.priceCny, language)}
              </div>
              {selectedPlan.originalPriceCny !== null && selectedPlan.originalPriceCny > selectedPlan.priceCny ? (
                <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  {t('points.upgradeDialog.originalPriceLabel')}{' '}
                  <span className="line-through">
                    {formatCurrencyCny(selectedPlan.originalPriceCny, language)}
                  </span>
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              onClick={onStartCheckout}
              disabled={!data.summary.isAuthenticated || !selectedPlan || isSubmitting}
              className="mt-8 h-12 rounded-2xl bg-rose-500 px-8 text-base font-semibold hover:bg-rose-600"
            >
              {isSubmitting
                ? t('points.actions.processing')
                : t('points.upgradeDialog.checkoutAction')}
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
