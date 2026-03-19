import { useTranslation } from 'react-i18next';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sdkwork/claw-ui';
import { buildUsagePaginationItems } from '../services';

interface ApiRouterUsagePaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function ApiRouterUsagePagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: ApiRouterUsagePaginationProps) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = total === 0 ? 0 : Math.min(total, currentPage * pageSize);
  const visiblePages = buildUsagePaginationItems(currentPage, totalPages);

  return (
    <section
      data-slot="api-router-usage-pagination"
      className="rounded-[28px] border border-zinc-200/80 bg-white/92 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
          <div>{t('apiRouterPage.usageRecords.pagination.totalResults', { count: total })}</div>
          <div>{t('apiRouterPage.usageRecords.pagination.showingRange', { start, end })}</div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:w-[10rem]">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t('apiRouterPage.usageRecords.pagination.pageSize')}
            </div>
            <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
              <SelectTrigger className="h-10 rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[20, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              {t('apiRouterPage.usageRecords.pagination.previous')}
            </Button>

            {visiblePages.map((pageItem) =>
              typeof pageItem === 'number' ? (
                <Button
                  key={pageItem}
                  type="button"
                  variant={pageItem === currentPage ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onPageChange(pageItem)}
                >
                  {pageItem}
                </Button>
              ) : (
                <span
                  key={pageItem}
                  className="inline-flex h-9 min-w-9 items-center justify-center px-1 text-sm font-medium text-zinc-400 dark:text-zinc-500"
                >
                  ...
                </span>
              ),
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            >
              {t('apiRouterPage.usageRecords.pagination.next')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
