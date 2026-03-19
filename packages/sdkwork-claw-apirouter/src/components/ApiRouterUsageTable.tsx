import { ArrowDown, ArrowUp, ArrowUpDown, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  ApiRouterUsageRecord,
  ApiRouterUsageRecordSortField,
} from '@sdkwork/claw-types';
import { Button } from '@sdkwork/claw-ui';

interface ApiRouterUsageTableProps {
  items: ApiRouterUsageRecord[];
  sortBy: ApiRouterUsageRecordSortField;
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: ApiRouterUsageRecordSortField) => void;
}

function formatInteger(value: number, language: string) {
  return new Intl.NumberFormat(language, {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrency(value: number, language: string) {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  }).format(value);
}

function formatTimestamp(value: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function getSortIcon(
  field: ApiRouterUsageRecordSortField,
  sortBy: ApiRouterUsageRecordSortField,
  sortOrder: 'asc' | 'desc',
) {
  if (field !== sortBy) {
    return <ArrowUpDown className="h-4 w-4" />;
  }

  return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
}

export function ApiRouterUsageTable({
  items,
  sortBy,
  sortOrder,
  onSortChange,
}: ApiRouterUsageTableProps) {
  const { t, i18n } = useTranslation();

  if (items.length === 0) {
    return (
      <div className="rounded-[32px] border border-dashed border-zinc-300 bg-white/80 p-10 text-center shadow-[0_18px_48px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/50">
        <div className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          {t('apiRouterPage.usageRecords.table.emptyTitle')}
        </div>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {t('apiRouterPage.usageRecords.table.emptyDescription')}
        </p>
      </div>
    );
  }

  return (
    <div
      data-slot="api-router-usage-table"
      className="overflow-hidden rounded-[32px] border border-zinc-200/80 bg-white/92 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70"
    >
      <div className="overflow-x-auto">
        <table className="min-w-[1380px] divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50/90 dark:bg-zinc-900/80">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              <th className="px-5 py-4">{t('apiRouterPage.usageRecords.table.apiKey')}</th>
              <th className="px-5 py-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 hover:bg-transparent hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                  onClick={() => onSortChange('model')}
                >
                  {t('apiRouterPage.usageRecords.table.model')}
                  {getSortIcon('model', sortBy, sortOrder)}
                </Button>
              </th>
              <th className="px-5 py-4">{t('apiRouterPage.usageRecords.table.reasoningEffort')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.usageRecords.table.endpoint')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.usageRecords.table.type')}</th>
              <th className="px-5 py-4 text-right">{t('apiRouterPage.usageRecords.table.tokenDetail')}</th>
              <th className="px-5 py-4 text-right">{t('apiRouterPage.usageRecords.table.cost')}</th>
              <th className="px-5 py-4 text-right">{t('apiRouterPage.usageRecords.table.ttft')}</th>
              <th className="px-5 py-4 text-right">{t('apiRouterPage.usageRecords.table.duration')}</th>
              <th className="px-5 py-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 hover:bg-transparent hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                  onClick={() => onSortChange('time')}
                >
                  {t('apiRouterPage.usageRecords.table.time')}
                  {getSortIcon('time', sortBy, sortOrder)}
                </Button>
              </th>
              <th className="px-5 py-4">{t('apiRouterPage.usageRecords.table.userAgent')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="px-5 py-5">
                  <div className="min-w-[10rem]">
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {item.apiKeyName}
                    </div>
                    <div className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      {item.apiKeyId}
                    </div>
                  </div>
                </td>

                <td className="px-5 py-5 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {item.model}
                </td>

                <td className="px-5 py-5">
                  <span className="inline-flex items-center rounded-full border border-primary-500/15 bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-600 dark:border-primary-500/20 dark:text-primary-300">
                    {item.reasoningEffort}
                  </span>
                </td>

                <td className="px-5 py-5">
                  <span className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                    {item.endpoint}
                  </span>
                </td>

                <td className="px-5 py-5 text-sm text-zinc-600 dark:text-zinc-300">
                  {item.type === 'streaming'
                    ? t('apiRouterPage.usageRecords.table.streaming')
                    : t('apiRouterPage.usageRecords.table.standard')}
                </td>

                <td className="px-5 py-5 text-right">
                  <div className="min-w-[11rem] space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="inline-flex w-full items-center justify-end gap-1">
                      <ArrowDown className="h-3.5 w-3.5" />
                      {formatInteger(item.promptTokens, i18n.language)}
                    </div>
                    <div className="inline-flex w-full items-center justify-end gap-1">
                      <ArrowUp className="h-3.5 w-3.5" />
                      {formatInteger(item.completionTokens, i18n.language)}
                    </div>
                    <div className="inline-flex w-full items-center justify-end gap-1">
                      <Database className="h-3.5 w-3.5" />
                      {formatInteger(item.cachedTokens, i18n.language)}
                    </div>
                  </div>
                </td>

                <td className="px-5 py-5 text-right text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                  {formatCurrency(item.costUsd, i18n.language)}
                </td>

                <td className="px-5 py-5 text-right text-sm text-zinc-600 dark:text-zinc-300">
                  {t('apiRouterPage.usageRecords.values.milliseconds', {
                    value: formatInteger(item.ttftMs, i18n.language),
                  })}
                </td>

                <td className="px-5 py-5 text-right text-sm text-zinc-600 dark:text-zinc-300">
                  {t('apiRouterPage.usageRecords.values.milliseconds', {
                    value: formatInteger(item.durationMs, i18n.language),
                  })}
                </td>

                <td className="px-5 py-5 text-sm text-zinc-600 dark:text-zinc-300">
                  {formatTimestamp(item.startedAt, i18n.language)}
                </td>

                <td className="px-5 py-5">
                  <div
                    title={item.userAgent}
                    className="max-w-[22rem] truncate text-sm text-zinc-600 dark:text-zinc-300"
                  >
                    {item.userAgent}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
