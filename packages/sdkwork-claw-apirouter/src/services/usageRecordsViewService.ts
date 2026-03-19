import type {
  ApiRouterUsageRecord,
  ApiRouterUsageTimeRangePreset,
} from '@sdkwork/claw-types';

export type UsagePaginationItem = number | 'ellipsis-left' | 'ellipsis-right';

export function hasInvalidUsageRecordsDateRange(
  timeRange: ApiRouterUsageTimeRangePreset,
  startDate: string,
  endDate: string,
) {
  if (timeRange !== 'custom' || !startDate || !endDate) {
    return false;
  }

  return startDate > endDate;
}

function escapeCsvValue(value: string | number) {
  const normalized = String(value);

  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

export function buildUsageRecordsCsv(items: ApiRouterUsageRecord[]) {
  const header = [
    'API Key',
    'API Key ID',
    'Model',
    'Reasoning Effort',
    'Endpoint',
    'Type',
    'Prompt Tokens',
    'Completion Tokens',
    'Cached Tokens',
    'Cost USD',
    'TTFT Ms',
    'Duration Ms',
    'Started At',
    'User Agent',
  ];

  const rows = items.map((item) => [
    item.apiKeyName,
    item.apiKeyId,
    item.model,
    item.reasoningEffort,
    item.endpoint,
    item.type,
    item.promptTokens,
    item.completionTokens,
    item.cachedTokens,
    item.costUsd.toFixed(6),
    item.ttftMs,
    item.durationMs,
    item.startedAt,
    item.userAgent,
  ]);

  return [header, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(','))
    .join('\n');
}

export function buildUsageRecordsCsvFilename(now: Date = new Date()) {
  return `api-router-usage-records-${now.toISOString().slice(0, 10)}.csv`;
}

export function buildUsagePaginationItems(
  currentPage: number,
  totalPages: number,
): UsagePaginationItem[] {
  if (totalPages <= 0) {
    return [];
  }

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const normalizedCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const pages = new Set<number>([1, totalPages]);

  for (
    let page = Math.max(1, normalizedCurrentPage - 1);
    page <= Math.min(totalPages, normalizedCurrentPage + 1);
    page += 1
  ) {
    pages.add(page);
  }

  const sortedPages = [...pages].sort((left, right) => left - right);
  const items: UsagePaginationItem[] = [];

  sortedPages.forEach((page, index) => {
    const previous = sortedPages[index - 1];

    if (previous != null && page - previous > 1) {
      items.push(previous === 1 ? 'ellipsis-left' : 'ellipsis-right');
    }

    items.push(page);
  });

  return items;
}
