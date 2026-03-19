import { useTranslation } from 'react-i18next';
import type { ApiRouterUsageRecordSummary } from '@sdkwork/claw-types';

interface ApiRouterUsageSummaryCardsProps {
  summary: ApiRouterUsageRecordSummary;
}

function formatCompactNumber(value: number, language: string) {
  return new Intl.NumberFormat(language, {
    notation: value >= 100000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 100000 ? 2 : 0,
  }).format(value);
}

function formatCurrency(value: number, language: string) {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDuration(value: number, language: string) {
  return new Intl.NumberFormat(language, {
    maximumFractionDigits: 0,
  }).format(value);
}

export function ApiRouterUsageSummaryCards({
  summary,
}: ApiRouterUsageSummaryCardsProps) {
  const { t, i18n } = useTranslation();

  return (
    <section
      data-slot="api-router-usage-summary-cards"
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
    >
      <article className="rounded-[28px] border border-zinc-200/80 bg-white/92 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          {t('apiRouterPage.usageRecords.summary.totalRequests')}
        </div>
        <div className="mt-4 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
          {formatCompactNumber(summary.totalRequests, i18n.language)}
        </div>
      </article>

      <article className="rounded-[28px] border border-zinc-200/80 bg-white/92 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          {t('apiRouterPage.usageRecords.summary.totalTokens')}
        </div>
        <div className="mt-4 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
          {formatCompactNumber(summary.totalTokens, i18n.language)}
        </div>
        <div className="mt-4 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <div>
            {t('apiRouterPage.usageRecords.summary.promptTokens')}:{' '}
            {formatCompactNumber(summary.promptTokens, i18n.language)}
          </div>
          <div>
            {t('apiRouterPage.usageRecords.summary.completionTokens')}:{' '}
            {formatCompactNumber(summary.completionTokens, i18n.language)}
          </div>
          <div>
            {t('apiRouterPage.usageRecords.summary.cachedTokens')}:{' '}
            {formatCompactNumber(summary.cachedTokens, i18n.language)}
          </div>
        </div>
      </article>

      <article className="rounded-[28px] border border-emerald-500/15 bg-emerald-500/5 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-emerald-500/20 dark:bg-emerald-500/10">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
          {t('apiRouterPage.usageRecords.summary.totalSpend')}
        </div>
        <div className="mt-4 text-3xl font-semibold text-emerald-700 dark:text-emerald-300">
          {formatCurrency(summary.totalSpendUsd, i18n.language)}
        </div>
      </article>

      <article className="rounded-[28px] border border-sky-500/15 bg-sky-500/5 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-sky-500/20 dark:bg-sky-500/10">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
          {t('apiRouterPage.usageRecords.summary.averageDuration')}
        </div>
        <div className="mt-4 text-3xl font-semibold text-sky-700 dark:text-sky-300">
          {t('apiRouterPage.usageRecords.values.milliseconds', {
            value: formatDuration(summary.averageDurationMs, i18n.language),
          })}
        </div>
      </article>
    </section>
  );
}
