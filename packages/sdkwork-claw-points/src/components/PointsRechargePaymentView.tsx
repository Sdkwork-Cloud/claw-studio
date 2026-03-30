import { Check, ExternalLink, QrCode, Wallet } from 'lucide-react';
import { Button } from '@sdkwork/claw-ui';
import type {
  PointsPaymentRecord,
  PointsRechargePack,
  PointsRechargeResult,
} from '../services';
import { formatCurrencyCny, formatPoints } from './pointsCopy';

type Translate = (key: string, options?: Record<string, unknown>) => string;
type RechargePaymentMethod = 'wechat' | 'alipay';

interface PointsRechargePaymentViewProps {
  t: Translate;
  language: string;
  paymentMethod: RechargePaymentMethod;
  selectedPack: PointsRechargePack | null;
  checkoutSession: PointsRechargeResult;
  paymentParamsEntries: Array<[string, unknown]>;
  paymentRecords: PointsPaymentRecord[];
  isConfirming: boolean;
  onOpenPayment: () => void;
  onConfirmPayment: () => void;
}

function formatDateTime(value: string | undefined, language: string) {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function PointsRechargePaymentView({
  t,
  language,
  paymentMethod,
  selectedPack,
  checkoutSession,
  paymentParamsEntries,
  paymentRecords,
  isConfirming,
  onOpenPayment,
  onConfirmPayment,
}: PointsRechargePaymentViewProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(340px,0.98fr)]">
      <section className="rounded-[32px] border border-zinc-200/80 bg-white/94 p-8 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-[26px] border border-zinc-200/80 bg-zinc-50/85 p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              {t('points.rechargeDialog.paymentSummaryEyebrow')}
            </div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {checkoutSession.packName || selectedPack?.name}
            </div>
            <p className="mt-2 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
              {t('points.rechargeDialog.paymentSummaryDescription')}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 shadow-sm dark:bg-zinc-950 dark:text-zinc-300">
            <Check className="h-4 w-4 text-emerald-500" />
            {t('points.rechargeDialog.lockedBadge')}
          </span>
        </div>

        <div data-slot="points-recharge-payment-summary-rows" className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-zinc-200/80 bg-white/88 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/55">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {t('points.rechargeDialog.orderIdLabel')}
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {checkoutSession.orderId || '--'}
            </div>
          </div>
          <div className="rounded-[22px] border border-zinc-200/80 bg-white/88 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/55">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {t('points.rechargeDialog.orderSnLabel')}
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {checkoutSession.orderSn || '--'}
            </div>
          </div>
          <div className="rounded-[22px] border border-zinc-200/80 bg-white/88 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/55">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {t('points.rechargeDialog.selectedPointsLabel')}
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {formatPoints(checkoutSession.points ?? selectedPack?.includedPoints ?? 0, language)}
            </div>
          </div>
          <div className="rounded-[22px] border border-zinc-200/80 bg-white/88 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/55">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {t('points.rechargeDialog.actualPriceLabel')}
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {formatCurrencyCny(checkoutSession.amountCny, language)}
            </div>
          </div>
          <div className="rounded-[22px] border border-zinc-200/80 bg-white/88 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/55">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {t('points.rechargeDialog.expireTimeLabel')}
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {formatDateTime(checkoutSession.expireTime, language)}
            </div>
          </div>
          <div className="rounded-[22px] border border-zinc-200/80 bg-white/88 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/55">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {t('points.rechargeDialog.outTradeNoLabel')}
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {checkoutSession.paymentSession?.outTradeNo || '--'}
            </div>
          </div>
        </div>
      </section>

      <section
        data-slot="points-recharge-payment"
        className="rounded-[32px] border border-zinc-200/80 bg-white/94 p-8 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-zinc-950/80"
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
          {t('points.rechargeDialog.paymentEyebrow')}
        </div>
        <h3 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {t('points.rechargeDialog.paymentSessionTitle')}
        </h3>
        <p className="mt-3 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
          {t('points.rechargeDialog.paymentSessionDescription')}
        </p>

        <div className="mt-6 rounded-[28px] border border-zinc-200/80 bg-zinc-50/90 p-5 dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('points.rechargeDialog.paymentMethodLabel')}
              </div>
              <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                {t(`points.paymentMethods.${paymentMethod}`)}
              </div>
            </div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-[20px] bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {paymentMethod === 'wechat' ? <QrCode className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
            </span>
          </div>

          {checkoutSession.paymentSession?.paymentUrl ? (
            <Button type="button" onClick={onOpenPayment} className="mt-5 w-full">
              {t('points.rechargeDialog.paymentOpenAction')}
              <ExternalLink className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <div className="mt-5 rounded-[28px] border border-zinc-200/80 bg-white/88 p-5 dark:border-zinc-800 dark:bg-zinc-950/55">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {t('points.rechargeDialog.paymentParamsTitle')}
          </div>
          <div className="mt-4 space-y-3">
            {paymentParamsEntries.length > 0 ? paymentParamsEntries.map(([key, value]) => (
              <div key={key} className="rounded-[20px] bg-zinc-50/90 px-4 py-3 dark:bg-zinc-900/70">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {key}
                </div>
                <div className="mt-1 break-all text-sm text-zinc-700 dark:text-zinc-200">
                  {String(value)}
                </div>
              </div>
            )) : (
              <div className="rounded-[20px] border border-dashed border-zinc-200 bg-zinc-50/90 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
                {t('points.rechargeDialog.paymentParamsEmpty')}
              </div>
            )}
          </div>
        </div>

        <div
          data-slot="points-recharge-payment-records"
          className="mt-5 rounded-[28px] border border-zinc-200/80 bg-white/88 p-5 dark:border-zinc-800 dark:bg-zinc-950/55"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {t('points.rechargeDialog.paymentRecordsTitle')}
          </div>
          <div className="mt-4 space-y-3">
            {paymentRecords.length > 0 ? paymentRecords.map((payment) => (
              <div
                key={`${payment.paymentId || 'payment'}-${payment.outTradeNo || payment.orderId || ''}`}
                className="rounded-[20px] bg-zinc-50/90 px-4 py-3 dark:bg-zinc-900/70"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {payment.paymentMethod || payment.paymentProvider || '--'}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {payment.statusName || t(`points.status.${payment.status}`)}
                  </div>
                </div>
                <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {formatCurrencyCny(payment.amountCny, language)}
                </div>
              </div>
            )) : (
              <div className="rounded-[20px] border border-dashed border-zinc-200 bg-zinc-50/90 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
                {t('points.rechargeDialog.paymentRecordsEmpty')}
              </div>
            )}
          </div>
        </div>

        <Button
          type="button"
          onClick={onConfirmPayment}
          disabled={isConfirming}
          className="mt-8 h-12 w-full rounded-2xl bg-zinc-950 px-8 text-base font-semibold hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
        >
          {isConfirming
            ? t('points.actions.processing')
            : t('points.rechargeDialog.confirmPayment')}
        </Button>
      </section>
    </div>
  );
}
