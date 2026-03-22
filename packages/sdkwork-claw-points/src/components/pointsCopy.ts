import type {
  PointsCurrentPlan,
  PointsTransaction,
} from '../services';

type Translate = (key: string, options?: Record<string, unknown>) => unknown;

export function formatPoints(value: number, language: string) {
  return new Intl.NumberFormat(language).format(value);
}

export function formatCurrencyCny(value: number | null | undefined, language: string) {
  if (value === null || value === undefined) {
    return '--';
  }

  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPointsRate(rate: number | null | undefined, language: string) {
  if (!rate || rate <= 0) {
    return '--';
  }

  return `${formatPoints(rate, language)} pts / CNY 1`;
}

export function getCurrentPlanTitle(t: Translate, currentPlan: PointsCurrentPlan) {
  if (currentPlan.status === 'guest') {
    return String(t('points.membership.guest'));
  }

  if (currentPlan.status === 'free') {
    return String(t('points.membership.free'));
  }

  return currentPlan.name || String(t('points.membership.vip'));
}

export function getTransactionCopy(t: Translate, transaction: PointsTransaction) {
  return {
    title: transaction.title || String(t('points.transactions.fallback.title')),
    description:
      transaction.description
      || String(t('points.transactions.fallback.description')),
  };
}
