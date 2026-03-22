import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CreditCard,
  QrCode,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@sdkwork/claw-ui';
import type {
  ModelPurchaseBillingCycle,
  ModelPurchasePlan,
  ModelPurchaseVendor,
} from '../services';

export type ModelPurchasePaymentMethod = 'wechat' | 'alipay' | 'bankcard';

interface ModelPurchasePaymentViewProps {
  vendor: ModelPurchaseVendor;
  cycle: ModelPurchaseBillingCycle;
  plan: ModelPurchasePlan;
  paymentMethod: ModelPurchasePaymentMethod;
  onPaymentMethodChange: (method: ModelPurchasePaymentMethod) => void;
  onBack: () => void;
  onConfirmPayment: () => void;
}

interface PaymentMethodMeta {
  id: ModelPurchasePaymentMethod;
  icon: LucideIcon;
  accentClassName: string;
  panelClassName: string;
}

const PAYMENT_METHODS: PaymentMethodMeta[] = [
  {
    id: 'wechat',
    icon: QrCode,
    accentClassName: 'text-emerald-600 dark:text-emerald-300',
    panelClassName:
      'border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10',
  },
  {
    id: 'alipay',
    icon: WalletCards,
    accentClassName: 'text-sky-600 dark:text-sky-300',
    panelClassName:
      'border-sky-200/80 bg-sky-50/80 dark:border-sky-500/20 dark:bg-sky-500/10',
  },
  {
    id: 'bankcard',
    icon: CreditCard,
    accentClassName: 'text-violet-600 dark:text-violet-300',
    panelClassName:
      'border-violet-200/80 bg-violet-50/80 dark:border-violet-500/20 dark:bg-violet-500/10',
  },
];

export function ModelPurchasePaymentView({
  vendor,
  cycle,
  plan,
  paymentMethod,
  onPaymentMethodChange,
  onBack,
  onConfirmPayment,
}: ModelPurchasePaymentViewProps) {
  const { t, i18n } = useTranslation();
  const numberFormatter = new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language);
  const activeMethod =
    PAYMENT_METHODS.find((method) => method.id === paymentMethod) ?? PAYMENT_METHODS[0]!;
  const ActiveMethodIcon = activeMethod.icon;
  const activeMethodLabel = t(`modelPurchase.payment.methods.${paymentMethod}`);
  const packageDetails = [
    {
      label: t('modelPurchase.payment.vendorLabel'),
      value: vendor.name,
    },
    {
      label: t('modelPurchase.payment.planLabel'),
      value: plan.name,
    },
    {
      label: t('modelPurchase.payment.cycleLabel'),
      value: cycle.label,
    },
    {
      label: t('modelPurchase.payment.quotaLabel'),
      value: plan.tokenAllowance,
    },
    {
      label: t('modelPurchase.payment.supportLabel'),
      value: plan.support,
    },
    {
      label: t('modelPurchase.payment.priceLabel'),
      value: `${t('modelPurchase.currency.cny')} ${numberFormatter.format(plan.priceCny)}`,
    },
  ];

  return (
    <section
      data-slot="model-purchase-payment-view"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Button type="button" variant="ghost" className="-ml-3 rounded-2xl px-3" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('modelPurchase.payment.backToPlans')}
          </Button>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            <span>{t('modelPurchase.payment.eyebrow')}</span>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] tracking-[0.18em] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              {t('modelPurchase.payment.lockedBadge')}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t('modelPurchase.payment.title')}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
            {t('modelPurchase.payment.description')}
          </p>
        </div>

        <div className="rounded-[24px] border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            {t('modelPurchase.payment.summaryLocked')}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="rounded-[30px] border border-zinc-200/80 bg-white/92 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-zinc-800/80 dark:bg-zinc-950/72">
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-[26px] border border-zinc-200/70 bg-zinc-50/85 p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {t('modelPurchase.payment.packageDetailsTitle')}
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {t('modelPurchase.currency.cny')} {numberFormatter.format(plan.priceCny)}
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {t('modelPurchase.payment.packageDetailsDescription')}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm dark:bg-zinc-950 dark:text-zinc-200">
              <BadgeCheck className="h-4 w-4 text-emerald-500" />
              {t('modelPurchase.payment.lockedBadge')}
            </div>
          </div>

          <div
            data-slot="model-purchase-package-details"
            className="mt-5 grid gap-3 sm:grid-cols-2"
          >
            {packageDetails.map((detail) => (
              <div
                key={detail.label}
                className="rounded-[22px] border border-zinc-200/80 bg-white/88 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/55"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {detail.label}
                </div>
                <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {detail.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[24px] border border-dashed border-zinc-200/90 bg-zinc-50/85 px-4 py-3 text-sm leading-6 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
            {t('modelPurchase.payment.lockedHint')}
          </div>

          <div className="mt-5 rounded-[26px] border border-zinc-200/80 bg-white/88 p-5 dark:border-zinc-800 dark:bg-zinc-950/55">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {t('modelPurchase.payment.benefitsLabel')}
            </div>
            <ul className="mt-4 space-y-3">
              {plan.benefits.slice(0, 4).map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-300">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-[30px] border border-zinc-200/80 bg-white/92 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-zinc-800/80 dark:bg-zinc-950/72">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            {t('modelPurchase.payment.methodTitle')}
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('modelPurchase.payment.methodDescription')}
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
            {PAYMENT_METHODS.map((method) => {
              const MethodIcon = method.icon;
              const isActive = method.id === paymentMethod;

              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => onPaymentMethodChange(method.id)}
                  className={`rounded-[22px] border px-4 py-3 text-left transition-colors ${
                    isActive
                      ? `${method.panelClassName} shadow-sm`
                      : 'border-zinc-200/80 bg-zinc-50/85 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${
                        isActive ? 'bg-white/90 dark:bg-zinc-950/80' : 'bg-white dark:bg-zinc-950'
                      }`}
                    >
                      <MethodIcon className={`h-4 w-4 ${method.accentClassName}`} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {t(`modelPurchase.payment.methods.${method.id}`)}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {isActive
                          ? t('modelPurchase.payment.methodSelected')
                          : t('modelPurchase.payment.methodTapToUse')}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-[28px] border border-zinc-200/80 bg-zinc-50/90 p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {t('modelPurchase.payment.scanTitle')}
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {activeMethodLabel}
                </div>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
                {t('modelPurchase.payment.mockTag')}
              </span>
            </div>

            <div className={`mt-4 rounded-[24px] border p-4 ${activeMethod.panelClassName}`}>
              <div className="flex flex-col items-center justify-center rounded-[22px] bg-white/90 px-6 py-8 text-center dark:bg-zinc-950/80">
                <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                  <ActiveMethodIcon className={`h-10 w-10 ${activeMethod.accentClassName}`} />
                </div>
                <div className="mt-4 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {t('modelPurchase.payment.scanDescription', {
                    method: activeMethodLabel,
                  })}
                </div>
                <div className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {plan.name} / {cycle.label}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[26px] border border-zinc-200/80 bg-white/88 p-5 dark:border-zinc-800 dark:bg-zinc-950/55">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {t('modelPurchase.payment.summaryTitle')}
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t('modelPurchase.payment.summaryDescription')}
            </p>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-[22px] bg-zinc-50/90 px-4 py-3 dark:bg-zinc-900/70">
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {plan.name}
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {t(`modelPurchase.payment.methods.${paymentMethod}`)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t('modelPurchase.payment.priceLabel')}
                </div>
                <div className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                  {t('modelPurchase.currency.cny')} {numberFormatter.format(plan.priceCny)}
                </div>
              </div>
            </div>

            <Button type="button" className="mt-5 w-full" onClick={onConfirmPayment}>
              {t('modelPurchase.payment.confirmPayment')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
