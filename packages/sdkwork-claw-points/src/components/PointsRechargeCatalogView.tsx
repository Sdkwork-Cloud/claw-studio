import { Check, Coins, MessageCircle, Wallet } from 'lucide-react';
import { Button } from '@sdkwork/claw-ui';
import type { PointsDashboardData, PointsRechargePack } from '../services';
import { formatCurrencyCny, formatPoints } from './pointsCopy';

type Translate = (key: string, options?: Record<string, unknown>) => string;
type RechargePaymentMethod = 'wechat' | 'alipay';

interface PointsRechargeCatalogViewProps {
  t: Translate;
  language: string;
  data: PointsDashboardData;
  selectedPack: PointsRechargePack | null;
  paymentMethod: RechargePaymentMethod;
  isSubmitting: boolean;
  onSelectPack: (packId: number) => void;
  onSelectPaymentMethod: (method: RechargePaymentMethod) => void;
  onStartCheckout: () => void;
}

const PAYMENT_METHODS: RechargePaymentMethod[] = ['wechat', 'alipay'];

export function PointsRechargeCatalogView({
  t,
  language,
  data,
  selectedPack,
  paymentMethod,
  isSubmitting,
  onSelectPack,
  onSelectPaymentMethod,
  onStartCheckout,
}: PointsRechargeCatalogViewProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
      <section className="rounded-[32px] border border-zinc-200/80 bg-white/94 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              {t('points.rechargeDialog.catalogEyebrow')}
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t('points.rechargeDialog.catalogTitle')}
            </h3>
            <p className="mt-2 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
              {t('points.rechargeDialog.catalogDescription')}
            </p>
          </div>
        </div>

        {data.rechargePacks.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50/90 px-4 py-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
            {t('points.rechargeDialog.noPacks')}
          </div>
        ) : (
          <div data-slot="points-recharge-pack-grid" className="mt-6 grid gap-4 md:grid-cols-2">
            {data.rechargePacks.map((pack) => {
              const isSelected = selectedPack?.packId === pack.packId;
              return (
                <article
                  key={pack.packId}
                  data-slot="points-recharge-pack-card"
                  className={`relative rounded-[28px] border px-6 py-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50/80 dark:border-sky-400 dark:bg-sky-500/10'
                      : 'border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950/72'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                        {t('points.rechargeDialog.packageLabel')}
                      </div>
                      <h4 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                        {pack.name}
                      </h4>
                      <p className="mt-2 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                        {pack.description || t('points.rechargeDialog.packageDescriptionFallback')}
                      </p>
                    </div>
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-[20px] bg-sky-500/10 text-sky-600 dark:bg-sky-500/14 dark:text-sky-200">
                      <Coins className="h-5 w-5" />
                    </span>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] bg-white/80 px-4 py-3 dark:bg-white/5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                        {t('points.rechargeDialog.selectedPointsLabel')}
                      </div>
                      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                        {formatPoints(pack.includedPoints, language)}
                      </div>
                    </div>
                    <div className="rounded-[22px] bg-white/80 px-4 py-3 dark:bg-white/5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                        {t('points.rechargeDialog.actualPriceLabel')}
                      </div>
                      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                        {formatCurrencyCny(pack.priceCny, language)}
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => onSelectPack(pack.packId)}
                    variant={isSelected ? 'default' : 'outline'}
                    className="mt-6 w-full rounded-2xl py-6 text-base font-semibold"
                  >
                    {isSelected ? t('points.actions.selectedPlan') : t('points.actions.selectPlan')}
                    {isSelected ? <Check className="h-4 w-4" /> : null}
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section
        data-slot="points-recharge-summary"
        className="rounded-[32px] border border-zinc-200/80 bg-white/94 p-8 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-zinc-950/80"
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
          {t('points.rechargeDialog.summaryEyebrow')}
        </div>
        <h3 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {t('points.rechargeDialog.summaryTitle')}
        </h3>
        <p className="mt-3 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
          {t('points.rechargeDialog.summaryDescription')}
        </p>

        <div className="mt-6 rounded-[28px] border border-zinc-200/80 bg-zinc-50/90 p-5 dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {t('points.rechargeDialog.availableBalanceLabel')}
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {formatPoints(data.summary.balancePoints, language)}
          </div>
        </div>

        {!data.summary.isAuthenticated ? (
          <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {t('points.auth.signInRequired')}
          </div>
        ) : null}

        {!selectedPack ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50/90 px-4 py-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
            {t('points.rechargeDialog.noPacks')}
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-[28px] border border-zinc-200/80 bg-zinc-50/90 p-5 dark:border-zinc-800 dark:bg-zinc-900/80">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                {t('points.rechargeDialog.rechargeDetailsTitle')}
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {selectedPack.name}
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {selectedPack.description || t('points.rechargeDialog.packageDescriptionFallback')}
              </div>

              <div data-slot="points-recharge-summary-rows" className="mt-5 grid gap-3">
                <div className="flex items-center justify-between gap-4 rounded-[20px] bg-white/80 px-4 py-3 dark:bg-white/5">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {t('points.rechargeDialog.selectedPointsLabel')}
                  </span>
                  <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {formatPoints(selectedPack.includedPoints, language)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-[20px] bg-white/80 px-4 py-3 dark:bg-white/5">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {t('points.rechargeDialog.actualPriceLabel')}
                  </span>
                  <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {formatCurrencyCny(selectedPack.priceCny, language)}
                  </span>
                </div>
              </div>
            </div>

            <div data-slot="points-recharge-payment" className="mt-6 grid gap-4 sm:grid-cols-2">
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

            <Button
              type="button"
              onClick={onStartCheckout}
              disabled={!data.summary.isAuthenticated || !selectedPack || isSubmitting}
              className="mt-8 h-12 rounded-2xl bg-zinc-950 px-8 text-base font-semibold hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
            >
              {isSubmitting
                ? t('points.actions.processing')
                : t('points.rechargeDialog.checkoutAction')}
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
