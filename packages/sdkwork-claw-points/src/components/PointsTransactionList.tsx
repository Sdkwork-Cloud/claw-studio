import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Crown,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@sdkwork/claw-i18n';
import type { PointsTransaction, PointsTransactionFilter } from '../services';
import { formatCurrencyCny, formatPoints, getTransactionCopy } from './pointsCopy';

interface PointsTransactionListProps {
  transactions: PointsTransaction[];
  activeFilter: PointsTransactionFilter;
  onFilterChange: (filter: PointsTransactionFilter) => void;
}

function getTransactionIcon(transaction: PointsTransaction) {
  const normalizedType = (transaction.transactionType || '').toUpperCase();
  if (normalizedType.includes('RECHARGE')) {
    return CreditCard;
  }

  if (normalizedType.includes('VIP') || normalizedType.includes('PURCHASE')) {
    return Crown;
  }

  return transaction.direction === 'earned' ? ArrowUpRight : ArrowDownRight;
}

export function PointsTransactionList({
  transactions,
  activeFilter,
  onFilterChange,
}: PointsTransactionListProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;

  return (
    <section className="rounded-[32px] border border-zinc-200/80 bg-white/92 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-zinc-800/80 dark:bg-zinc-950/72">
      <div className="flex flex-col gap-4 border-b border-zinc-200/80 px-6 py-5 dark:border-zinc-800/80 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {t('points.page.recordsEyebrow')}
          </div>
          <h2 className="mt-2 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            {t('points.page.recordsTitle')}
          </h2>
        </div>

        <div className="inline-flex rounded-full bg-zinc-100 p-1 dark:bg-zinc-900/80">
          {(['all', 'earned', 'spent'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => onFilterChange(filter)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeFilter === filter
                  ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
              }`}
            >
              {t(`points.filters.${filter}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
        {transactions.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t('points.page.empty')}
          </div>
        ) : (
          transactions.map((transaction) => {
            const Icon = getTransactionIcon(transaction);
            const copy = getTransactionCopy(t, transaction);
            return (
              <article
                key={transaction.id}
                className="flex flex-col gap-4 px-6 py-5 transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <div
                    className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      transaction.direction === 'earned'
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                        {copy.title}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          transaction.direction === 'earned'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {t(`points.filters.${transaction.direction}`)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                      {copy.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
                      <span>
                        {formatDate(transaction.createdAt, language, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                      {transaction.cashAmountCny !== undefined ? (
                        <span>{formatCurrencyCny(transaction.cashAmountCny, language)}</span>
                      ) : null}
                      <span>{t(`points.status.${transaction.status}`)}</span>
                    </div>
                  </div>
                </div>

                <div
                  className={`shrink-0 text-right text-lg font-semibold ${
                    transaction.direction === 'earned'
                      ? 'text-emerald-600 dark:text-emerald-300'
                      : 'text-zinc-950 dark:text-zinc-50'
                  }`}
                >
                  {transaction.direction === 'earned' ? '+' : '-'}
                  {formatPoints(transaction.points, language)}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
