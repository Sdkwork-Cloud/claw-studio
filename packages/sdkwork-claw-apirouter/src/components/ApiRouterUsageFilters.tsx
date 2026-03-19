import { Download, RefreshCw, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  ApiRouterUsageRecordApiKeyOption,
  ApiRouterUsageTimeRangePreset,
} from '@sdkwork/claw-types';
import {
  Button,
  DateInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sdkwork/claw-ui';

interface ApiRouterUsageFiltersProps {
  apiKeyId: string;
  apiKeyOptions: ApiRouterUsageRecordApiKeyOption[];
  timeRange: ApiRouterUsageTimeRangePreset;
  startDate: string;
  endDate: string;
  invalidDateRange: boolean;
  disableExport: boolean;
  isRefreshing: boolean;
  onApiKeyChange: (value: string) => void;
  onTimeRangeChange: (value: ApiRouterUsageTimeRangePreset) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onRefresh: () => void;
  onReset: () => void;
  onExportCsv: () => void;
}

export function ApiRouterUsageFilters({
  apiKeyId,
  apiKeyOptions,
  timeRange,
  startDate,
  endDate,
  invalidDateRange,
  disableExport,
  isRefreshing,
  onApiKeyChange,
  onTimeRangeChange,
  onStartDateChange,
  onEndDateChange,
  onRefresh,
  onReset,
  onExportCsv,
}: ApiRouterUsageFiltersProps) {
  const { t } = useTranslation();
  const isCustomRange = timeRange === 'custom';

  return (
    <section
      data-slot="api-router-usage-filters"
      className="rounded-[28px] border border-zinc-200/80 bg-white/92 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70 sm:p-5"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {t('apiRouterPage.usageRecords.filters.apiKey')}
          </div>
          <Select value={apiKeyId} onValueChange={onApiKeyChange}>
            <SelectTrigger className="h-11 rounded-2xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {apiKeyOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.id === 'all'
                    ? t('apiRouterPage.usageRecords.filters.allApiKeys')
                    : option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {t('apiRouterPage.usageRecords.filters.timeRange')}
          </div>
          <Select
            value={timeRange}
            onValueChange={(value) => onTimeRangeChange(value as ApiRouterUsageTimeRangePreset)}
          >
            <SelectTrigger className="h-11 rounded-2xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">{t('apiRouterPage.usageRecords.timeRanges.last24Hours')}</SelectItem>
              <SelectItem value="7d">{t('apiRouterPage.usageRecords.timeRanges.last7Days')}</SelectItem>
              <SelectItem value="30d">{t('apiRouterPage.usageRecords.timeRanges.last30Days')}</SelectItem>
              <SelectItem value="custom">{t('apiRouterPage.usageRecords.timeRanges.custom')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {t('apiRouterPage.usageRecords.filters.startDate')}
          </div>
          <DateInput
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            disabled={!isCustomRange}
            calendarLabel={t('apiRouterPage.usageRecords.filters.startDate')}
            className="h-11 rounded-2xl"
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {t('apiRouterPage.usageRecords.filters.endDate')}
          </div>
          <DateInput
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
            disabled={!isCustomRange}
            calendarLabel={t('apiRouterPage.usageRecords.filters.endDate')}
            className="h-11 rounded-2xl"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3 xl:justify-end">
          <Button type="button" variant="outline" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCw className="h-4 w-4" />
            {t('apiRouterPage.usageRecords.actions.refresh')}
          </Button>

          <Button type="button" variant="secondary" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            {t('apiRouterPage.usageRecords.actions.reset')}
          </Button>

          <Button
            type="button"
            onClick={onExportCsv}
            disabled={disableExport || isRefreshing}
          >
            <Download className="h-4 w-4" />
            {t('apiRouterPage.usageRecords.actions.exportCsv')}
          </Button>
        </div>
      </div>

      {invalidDateRange ? (
        <p className="mt-3 rounded-2xl border border-amber-300/70 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
          {t('apiRouterPage.usageRecords.filters.invalidDateRange')}
        </p>
      ) : null}
    </section>
  );
}
