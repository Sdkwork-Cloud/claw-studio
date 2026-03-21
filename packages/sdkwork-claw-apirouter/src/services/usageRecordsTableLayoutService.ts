export type ApiRouterUsageTableColumnId =
  | 'apiKey'
  | 'model'
  | 'reasoningEffort'
  | 'endpoint'
  | 'type'
  | 'tokenDetail'
  | 'cost'
  | 'ttft'
  | 'duration'
  | 'time'
  | 'userAgent';

export interface ApiRouterUsageTableColumnLayout {
  id: ApiRouterUsageTableColumnId;
  colClassName: string;
  cellClassName?: string;
  contentClassName?: string;
  metaClassName?: string;
}

export interface ApiRouterUsageTableLayout {
  tableClassName: string;
  columns: ApiRouterUsageTableColumnLayout[];
}

const usageRecordsTableColumns: ApiRouterUsageTableColumnLayout[] = [
  {
    id: 'apiKey',
    colClassName: 'w-[16%]',
    cellClassName: 'min-w-0',
    contentClassName: 'truncate',
    metaClassName: 'truncate',
  },
  {
    id: 'model',
    colClassName: 'w-[12%]',
    cellClassName: 'min-w-0',
    contentClassName: 'truncate',
  },
  {
    id: 'reasoningEffort',
    colClassName: 'w-[6%]',
    cellClassName: 'whitespace-nowrap',
  },
  {
    id: 'endpoint',
    colClassName: 'w-[7%]',
    cellClassName: 'min-w-0',
    contentClassName: 'truncate',
  },
  {
    id: 'type',
    colClassName: 'w-[5%]',
    cellClassName: 'whitespace-nowrap',
  },
  {
    id: 'tokenDetail',
    colClassName: 'w-[12%]',
    cellClassName: 'whitespace-nowrap tabular-nums',
  },
  {
    id: 'cost',
    colClassName: 'w-[8%]',
    cellClassName: 'whitespace-nowrap tabular-nums',
  },
  {
    id: 'ttft',
    colClassName: 'w-[6%]',
    cellClassName: 'whitespace-nowrap tabular-nums',
  },
  {
    id: 'duration',
    colClassName: 'w-[6%]',
    cellClassName: 'whitespace-nowrap tabular-nums',
  },
  {
    id: 'time',
    colClassName: 'w-[8%]',
    cellClassName: 'whitespace-nowrap tabular-nums',
  },
  {
    id: 'userAgent',
    colClassName: 'w-[14%]',
    cellClassName: 'min-w-0',
    contentClassName: 'truncate',
  },
];

export function getUsageRecordsTableLayout(): ApiRouterUsageTableLayout {
  return {
    tableClassName: 'w-full min-w-[960px] table-fixed divide-y divide-zinc-200 dark:divide-zinc-800',
    columns: usageRecordsTableColumns,
  };
}
