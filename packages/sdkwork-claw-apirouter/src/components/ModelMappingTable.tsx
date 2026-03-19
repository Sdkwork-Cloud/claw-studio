import { useTranslation } from 'react-i18next';
import type { ModelMapping } from '@sdkwork/claw-types';
import { Button } from '@sdkwork/claw-ui';
import { ProxyProviderStatusBadge } from './ProxyProviderStatusBadge';

interface ModelMappingTableProps {
  items: ModelMapping[];
  onOpenDetail: (item: ModelMapping) => void;
  onOpenEdit: (item: ModelMapping) => void;
  onToggleStatus: (item: ModelMapping) => void;
  onDelete: (item: ModelMapping) => void;
}

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function formatDateTime(value: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function ModelMappingTable({
  items,
  onOpenDetail,
  onOpenEdit,
  onToggleStatus,
  onDelete,
}: ModelMappingTableProps) {
  const { t, i18n } = useTranslation();

  if (items.length === 0) {
    return (
      <div className="rounded-[32px] border border-dashed border-zinc-300 bg-white/80 p-10 text-center shadow-[0_18px_48px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/50">
        <div className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          {t('apiRouterPage.modelMapping.table.emptyTitle')}
        </div>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {t('apiRouterPage.modelMapping.table.emptyDescription')}
        </p>
      </div>
    );
  }

  return (
    <div
      data-slot="api-router-model-mapping-table"
      className="overflow-hidden rounded-[32px] border border-zinc-200/80 bg-white/92 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70"
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50/90 dark:bg-zinc-900/80">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              <th className="px-5 py-4">{t('apiRouterPage.modelMapping.table.name')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.modelMapping.table.description')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.modelMapping.table.status')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.modelMapping.table.effectiveTime')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.modelMapping.table.createdAt')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.modelMapping.table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="px-5 py-5">
                  <div className="min-w-[16rem]">
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {item.name}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-500">
                        {t('apiRouterPage.modelMapping.values.ruleCount', {
                          count: item.rules.length,
                        })}
                      </span>
                      {item.rules.slice(0, 2).map((rule) => (
                        <span
                          key={rule.id}
                          className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          {`${rule.source.modelName} -> ${rule.target.modelName}`}
                        </span>
                      ))}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-5">
                  <div className="min-w-[18rem] text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    {item.description || t('apiRouterPage.modelMapping.values.noDescription')}
                  </div>
                </td>
                <td className="px-5 py-5">
                  <ProxyProviderStatusBadge status={item.status} />
                </td>
                <td className="px-5 py-5">
                  <div className="min-w-[13rem] text-sm text-zinc-600 dark:text-zinc-300">
                    <div>{formatDate(item.effectiveFrom, i18n.language)}</div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {t('apiRouterPage.modelMapping.values.until')}{' '}
                      {formatDate(item.effectiveTo, i18n.language)}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-5 text-sm text-zinc-600 dark:text-zinc-300">
                  {formatDateTime(item.createdAt, i18n.language)}
                </td>
                <td className="px-5 py-5">
                  <div className="flex min-w-[19rem] flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenDetail(item)}
                    >
                      {t('apiRouterPage.modelMapping.actions.viewDetail')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenEdit(item)}
                    >
                      {t('apiRouterPage.modelMapping.actions.edit')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onToggleStatus(item)}
                    >
                      {item.status === 'disabled'
                        ? t('apiRouterPage.modelMapping.actions.enable')
                        : t('apiRouterPage.modelMapping.actions.disable')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(item)}
                    >
                      {t('apiRouterPage.modelMapping.actions.delete')}
                    </Button>
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
