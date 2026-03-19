import { startTransition, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type {
  ApiRouterUsageRecordSortField,
  ApiRouterUsageRecordsQuery,
  ApiRouterUsageRecordSummary,
  ApiRouterUsageTimeRangePreset,
} from '@sdkwork/claw-types';
import {
  ApiRouterUsageFilters,
  ApiRouterUsagePagination,
  ApiRouterUsageSummaryCards,
  ApiRouterUsageTable,
} from '../components';
import {
  apiRouterService,
  buildUsageRecordsCsv,
  buildUsageRecordsCsvFilename,
  hasInvalidUsageRecordsDateRange,
} from '../services';

const usageRecordApiKeysQueryKey = ['api-router', 'usage-record-api-keys'] as const;

const emptySummary: ApiRouterUsageRecordSummary = {
  totalRequests: 0,
  totalTokens: 0,
  promptTokens: 0,
  completionTokens: 0,
  cachedTokens: 0,
  totalSpendUsd: 0,
  averageDurationMs: 0,
};

function downloadCsvFile(content: string, filename: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(objectUrl);
}

export function ApiRouterUsageRecordsPage() {
  const { t } = useTranslation();
  const [apiKeyId, setApiKeyId] = useState('all');
  const [timeRange, setTimeRange] = useState<ApiRouterUsageTimeRangePreset>('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<ApiRouterUsageRecordSortField>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filterQuery: ApiRouterUsageRecordsQuery = {
    apiKeyId,
    timeRange,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };
  const hasInvalidDateRange = hasInvalidUsageRecordsDateRange(timeRange, startDate, endDate);

  const recordsQueryInput: ApiRouterUsageRecordsQuery = {
    ...filterQuery,
    page,
    pageSize,
    sortBy,
    sortOrder,
  };

  const apiKeysQuery = useQuery({
    queryKey: usageRecordApiKeysQueryKey,
    queryFn: () => apiRouterService.getUsageRecordApiKeys(),
  });

  const summaryQuery = useQuery({
    queryKey: ['api-router', 'usage-record-summary', filterQuery],
    queryFn: () => apiRouterService.getUsageRecordSummary(filterQuery),
    enabled: !hasInvalidDateRange,
  });

  const recordsQuery = useQuery({
    queryKey: ['api-router', 'usage-records', recordsQueryInput],
    queryFn: () => apiRouterService.getUsageRecords(recordsQueryInput),
    enabled: !hasInvalidDateRange,
  });

  async function handleRefresh() {
    if (hasInvalidDateRange) {
      await apiKeysQuery.refetch();
      return;
    }

    await Promise.all([
      apiKeysQuery.refetch(),
      summaryQuery.refetch(),
      recordsQuery.refetch(),
    ]);
  }

  function handleReset() {
    startTransition(() => {
      setApiKeyId('all');
      setTimeRange('30d');
      setStartDate('');
      setEndDate('');
      setPage(1);
      setPageSize(20);
      setSortBy('time');
      setSortOrder('desc');
    });
  }

  function handleSortChange(field: ApiRouterUsageRecordSortField) {
    startTransition(() => {
      setPage(1);

      if (sortBy === field) {
        setSortOrder((previous) => (previous === 'asc' ? 'desc' : 'asc'));
        return;
      }

      setSortBy(field);
      setSortOrder(field === 'time' ? 'desc' : 'asc');
    });
  }

  async function handleExportCsv() {
    if (hasInvalidDateRange) {
      return;
    }

    try {
      const exportPageSize = Math.max(recordsQuery.data?.total || 0, 1);
      const result = await apiRouterService.getUsageRecords({
        ...filterQuery,
        sortBy,
        sortOrder,
        page: 1,
        pageSize: exportPageSize,
      });

      const csv = buildUsageRecordsCsv(result.items);
      const filename = buildUsageRecordsCsvFilename();
      downloadCsvFile(csv, filename);
      toast.success(t('apiRouterPage.usageRecords.toast.exported'));
    } catch {
      toast.error(t('apiRouterPage.usageRecords.toast.exportFailed'));
    }
  }

  return (
    <div data-slot="api-router-usage-records-page" className="min-w-0 flex-1 space-y-4">
      <ApiRouterUsageSummaryCards summary={summaryQuery.data || emptySummary} />

      <ApiRouterUsageFilters
        apiKeyId={apiKeyId}
        apiKeyOptions={apiKeysQuery.data || []}
        timeRange={timeRange}
        startDate={startDate}
        endDate={endDate}
        invalidDateRange={hasInvalidDateRange}
        disableExport={hasInvalidDateRange || (recordsQuery.data?.total || 0) === 0}
        isRefreshing={apiKeysQuery.isFetching || summaryQuery.isFetching || recordsQuery.isFetching}
        onApiKeyChange={(value) =>
          startTransition(() => {
            setApiKeyId(value);
            setPage(1);
          })
        }
        onTimeRangeChange={(value) =>
          startTransition(() => {
            setTimeRange(value);
            setPage(1);

            if (value !== 'custom') {
              setStartDate('');
              setEndDate('');
            }
          })
        }
        onStartDateChange={(value) =>
          startTransition(() => {
            setStartDate(value);
            setPage(1);
          })
        }
        onEndDateChange={(value) =>
          startTransition(() => {
            setEndDate(value);
            setPage(1);
          })
        }
        onRefresh={() => {
          void handleRefresh();
        }}
        onReset={handleReset}
        onExportCsv={() => {
          void handleExportCsv();
        }}
      />

      <ApiRouterUsageTable
        items={recordsQuery.data?.items || []}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
      />

      <ApiRouterUsagePagination
        total={recordsQuery.data?.total || 0}
        page={recordsQuery.data?.page || page}
        pageSize={recordsQuery.data?.pageSize || pageSize}
        onPageChange={(nextPage) =>
          startTransition(() => {
            setPage(nextPage);
          })
        }
        onPageSizeChange={(nextPageSize) =>
          startTransition(() => {
            setPageSize(nextPageSize);
            setPage(1);
          })
        }
      />
    </div>
  );
}
