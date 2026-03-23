import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Coins,
  CreditCard,
  MessageCircle,
  Wallet,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button, Input, OverlaySurface } from '@sdkwork/claw-ui';
import { pointsQueryKeys, pointsService } from '../services';
import { formatCurrencyCny, formatPoints } from './pointsCopy';
import {
  createInitialPointsRechargeDialogState,
  shouldResetPointsRechargeDialogState,
  type RechargePaymentMethod,
} from './pointsRechargeDialogState';

interface PointsRechargeDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const PAYMENT_METHODS: RechargePaymentMethod[] = ['wechat', 'alipay', 'bankcard'];

function sanitizePointsValue(value: string) {
  return value.replaceAll(/\D+/g, '').slice(0, 7);
}

function resolvePaymentMethodIcon(method: RechargePaymentMethod) {
  if (method === 'wechat') {
    return MessageCircle;
  }

  if (method === 'alipay') {
    return Wallet;
  }

  return CreditCard;
}

export function PointsRechargeDialog({
  isOpen,
  onClose,
}: PointsRechargeDialogProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const wasOpenRef = useRef(false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customPointsValue, setCustomPointsValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<RechargePaymentMethod>('wechat');
  const {
    data = pointsService.getEmptyDashboard(),
  } = useQuery({
    queryKey: pointsQueryKeys.dashboard,
    queryFn: () => pointsService.getDashboard(),
    enabled: isOpen,
    placeholderData: pointsService.getEmptyDashboard(),
  });

  const rechargePresets = useMemo(() => pointsService.getRechargePresets(), []);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const rate = data.summary.pointsToCashRate;
  const parsedCustomPoints = Number.parseInt(customPointsValue || '0', 10);
  const resolvedPoints = selectedPreset ?? (Number.isFinite(parsedCustomPoints) ? parsedCustomPoints : 0);
  const payableAmount = rate && rate > 0
    ? Number((resolvedPoints / rate).toFixed(2))
    : null;
  const canSubmit = Boolean(data.summary.isAuthenticated && rate && rate > 0 && resolvedPoints > 0);

  useEffect(() => {
    const shouldReset = shouldResetPointsRechargeDialogState(wasOpenRef.current, isOpen);
    wasOpenRef.current = isOpen;

    if (!shouldReset) {
      return;
    }

    const initialState = createInitialPointsRechargeDialogState(rechargePresets);
    setSelectedPreset(initialState.selectedPreset);
    setCustomPointsValue(initialState.customPointsValue);
    setPaymentMethod(initialState.paymentMethod);
  }, [isOpen, rechargePresets]);

  const selectedPointsText = useMemo(
    () => formatPoints(resolvedPoints, language),
    [resolvedPoints, language],
  );

  const rechargeMutation = useMutation({
    mutationFn: () =>
      pointsService.rechargePoints({
        points: resolvedPoints,
        paymentMethod: paymentMethod.toUpperCase(),
      }),
    onSuccess: async (result) => {
      toast.success(
        t('points.toasts.rechargeSuccess', {
          points: formatPoints(result.points, language),
        }),
      );
      await queryClient.invalidateQueries({
        queryKey: pointsQueryKeys.dashboard,
      });
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('points.toasts.rechargeFailed'));
    },
  });

  return (
    <OverlaySurface
      isOpen={isOpen}
      onClose={onClose}
      modalAlignment="top"
      closeOnBackdrop
      className="max-w-[1180px]"
      backdropClassName="bg-zinc-950/60"
    >
      <div className="border-b border-zinc-200/80 bg-white/94 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950/92">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              {t('points.rechargeDialog.eyebrow')}
            </div>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t('points.rechargeDialog.title')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
              {t('points.rechargeDialog.description')}
            </p>
          </div>

          <button
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.08),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(250,250,250,0.92))] px-6 py-8 dark:bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.10),_transparent_28%),linear-gradient(180deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.98))]">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
          <section
            data-slot="points-recharge-summary"
            className="rounded-[32px] border border-zinc-200/80 bg-white/94 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-zinc-950/80"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              {t('points.rechargeDialog.summaryEyebrow')}
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t('points.rechargeDialog.summaryTitle')}
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t('points.rechargeDialog.summaryDescription')}
            </p>

            <div className="mt-8 rounded-[28px] border border-sky-100 bg-[linear-gradient(135deg,rgba(240,249,255,0.94),rgba(255,255,255,0.96),rgba(239,246,255,0.94))] p-6 shadow-[0_18px_48px_rgba(14,165,233,0.08)] dark:border-sky-400/20 dark:bg-[linear-gradient(135deg,rgba(8,47,73,0.22),rgba(9,9,11,0.96),rgba(15,23,42,0.24))]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-500 dark:text-sky-200">
                    {t('points.rechargeDialog.rechargeDetailsTitle')}
                  </div>
                  <div className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                    {selectedPointsText}
                  </div>
                  <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {t('points.rechargeDialog.selectedPointsLabel')}
                  </div>
                </div>

                <div className="flex h-14 w-14 items-center justify-center rounded-[24px] bg-sky-500/12 text-sky-600 dark:bg-sky-500/14 dark:text-sky-200">
                  <Coins className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-zinc-200/80 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-white/5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {t('points.rechargeDialog.exchangeRateLabel')}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {rate ? t('points.rechargeDialog.exchangeRateValue', { rate: formatPoints(rate, language) }) : '--'}
                  </div>
                </div>
                <div className="rounded-[24px] border border-zinc-200/80 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-white/5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {t('points.rechargeDialog.paymentMethod')}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {t(`points.paymentMethods.${paymentMethod}`)}
                  </div>
                </div>
                <div className="rounded-[24px] border border-zinc-200/80 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-white/5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {t('points.rechargeDialog.actualPriceLabel')}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {formatCurrencyCny(payableAmount, language)}
                  </div>
                </div>
              </div>
            </div>

            {!data.summary.isAuthenticated ? (
              <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                {t('points.auth.signInRequired')}
              </div>
            ) : null}

            {!rate ? (
              <div className="mt-6 rounded-[24px] border border-zinc-200/80 bg-zinc-50/90 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
                {t('points.rechargeDialog.rateUnavailable')}
              </div>
            ) : null}
          </section>

          <section className="rounded-[32px] border border-zinc-200/80 bg-white/94 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-zinc-950/80">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                  {t('points.rechargeDialog.commonAmounts')}
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {t('points.rechargeDialog.configureTitle')}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {t('points.rechargeDialog.configureDescription')}
                </p>
              </div>
            </div>

            <div
              data-slot="points-recharge-preset-grid"
              className="mt-6 grid gap-3 sm:grid-cols-2"
            >
              {rechargePresets.map((points) => {
                const isSelected = selectedPreset === points;
                return (
                  <button
                    key={points}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedPreset(points);
                      setCustomPointsValue('');
                    }}
                    className={`relative rounded-[24px] border px-5 py-4 text-left transition-colors ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50 text-sky-950 shadow-[0_16px_36px_rgba(14,165,233,0.12)] dark:border-sky-400 dark:bg-sky-500/10 dark:text-sky-50'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-950'
                    }`}
                  >
                    {isSelected ? (
                      <span className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm dark:bg-sky-400 dark:text-zinc-950">
                        <Check className="h-4 w-4" />
                      </span>
                    ) : null}
                    <div className="text-xl font-semibold">
                      {formatPoints(points, language)}
                    </div>
                    <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {rate
                        ? t('points.rechargeDialog.presetMeta', {
                          amount: formatCurrencyCny(Number((points / rate).toFixed(2)), language),
                        })
                        : t('points.rechargeDialog.rateUnavailable')}
                    </div>
                  </button>
                );
              })}
            </div>

            <div
              data-slot="points-recharge-custom-panel"
              className="mt-6 rounded-[28px] border border-zinc-200/80 bg-zinc-50/90 p-5 dark:border-zinc-800 dark:bg-zinc-900/80"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                {t('points.rechargeDialog.customAmount')}
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {t('points.rechargeDialog.customPlaceholder')}
              </p>

              <Input
                type="text"
                inputMode="numeric"
                value={customPointsValue}
                placeholder={t('points.rechargeDialog.customPlaceholder')}
                onFocus={() => setSelectedPreset(null)}
                onChange={(event) => {
                  setSelectedPreset(null);
                  setCustomPointsValue(sanitizePointsValue(event.target.value));
                }}
                className="mt-4 h-12 rounded-2xl border-zinc-200 bg-white px-4 text-base shadow-none focus-visible:border-sky-400 focus-visible:bg-white focus-visible:ring-0 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:border-sky-500"
              />
            </div>

            <div
              data-slot="points-recharge-payment"
              className="mt-6 grid gap-4 sm:grid-cols-3"
            >
              {PAYMENT_METHODS.map((method) => {
                const isActive = paymentMethod === method;
                const Icon = resolvePaymentMethodIcon(method);
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`flex items-center justify-center gap-3 rounded-[24px] border px-5 py-4 text-base font-semibold transition-colors ${
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
              onClick={() => rechargeMutation.mutate()}
              disabled={!canSubmit || rechargeMutation.isPending}
              className="mt-8 h-12 w-full rounded-2xl bg-zinc-950 text-base font-semibold hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
            >
              {rechargeMutation.isPending
                ? t('common.processing')
                : t('points.rechargeDialog.confirmPayment')}
            </Button>
          </section>
        </div>
      </div>
    </OverlaySurface>
  );
}
