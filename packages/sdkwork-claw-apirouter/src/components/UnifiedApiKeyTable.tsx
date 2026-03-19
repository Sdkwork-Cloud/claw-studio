import { useTranslation } from 'react-i18next';
import type { ModelMapping, ProxyProviderGroup, UnifiedApiKey } from '@sdkwork/claw-types';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sdkwork/claw-ui';
import { ProxyProviderStatusBadge } from './ProxyProviderStatusBadge';

interface UnifiedApiKeyTableProps {
  items: UnifiedApiKey[];
  modelMappings: ModelMapping[];
  groups: ProxyProviderGroup[];
  onCopyApiKey: (item: UnifiedApiKey) => void;
  onGroupChange: (itemId: string, groupId: string) => void;
  onOpenUsage: (item: UnifiedApiKey) => void;
  onOpenEdit: (item: UnifiedApiKey) => void;
  onOpenAssociateMapping: (item: UnifiedApiKey) => void;
  onToggleStatus: (item: UnifiedApiKey) => void;
  onDelete: (item: UnifiedApiKey) => void;
}

function maskApiKey(apiKey: string) {
  if (apiKey.length <= 14) {
    return apiKey;
  }

  return `${apiKey.slice(0, 10)}********${apiKey.slice(-4)}`;
}

function formatDate(value: string | null, language: string, fallback: string) {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function formatNumber(value: number, language: string) {
  return new Intl.NumberFormat(language, {
    notation: value > 100000 ? 'compact' : 'standard',
    maximumFractionDigits: value > 100000 ? 1 : 0,
  }).format(value);
}

function formatCurrency(value: number, language: string) {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

export function UnifiedApiKeyTable({
  items,
  modelMappings,
  groups,
  onCopyApiKey,
  onGroupChange,
  onOpenUsage,
  onOpenEdit,
  onOpenAssociateMapping,
  onToggleStatus,
  onDelete,
}: UnifiedApiKeyTableProps) {
  const { t, i18n } = useTranslation();
  const modelMappingsById = new Map(modelMappings.map((item) => [item.id, item]));

  if (items.length === 0) {
    return (
      <div className="rounded-[32px] border border-dashed border-zinc-300 bg-white/80 p-10 text-center shadow-[0_18px_48px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/50">
        <div className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          {t('apiRouterPage.unifiedApiKey.table.emptyTitle')}
        </div>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {t('apiRouterPage.unifiedApiKey.table.emptyDescription')}
        </p>
      </div>
    );
  }

  return (
    <div
      data-slot="api-router-unified-key-table"
      className="overflow-hidden rounded-[32px] border border-zinc-200/80 bg-white/92 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70"
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50/90 dark:bg-zinc-900/80">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              <th className="px-5 py-4">{t('apiRouterPage.unifiedApiKey.table.name')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.unifiedApiKey.table.apiKey')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.unifiedApiKey.table.source')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.unifiedApiKey.table.group')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.unifiedApiKey.table.usage')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.unifiedApiKey.table.expiresAt')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.unifiedApiKey.table.status')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.unifiedApiKey.table.createdAt')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.unifiedApiKey.table.actions')}</th>
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
                    {item.modelMappingId ? (
                      <div className="mt-2">
                        <span className="inline-flex items-center rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-500">
                          {t('apiRouterPage.unifiedApiKey.values.mappedTo', {
                            name:
                              modelMappingsById.get(item.modelMappingId)?.name ||
                              t('apiRouterPage.unifiedApiKey.values.mappingUnavailable'),
                          })}
                        </span>
                      </div>
                    ) : null}
                    {item.notes ? (
                      <div className="mt-2 max-w-[24rem] text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                        {item.notes}
                      </div>
                    ) : null}
                  </div>
                </td>

                <td className="px-5 py-5">
                  <div className="flex min-w-[14rem] items-start gap-3">
                    <div className="flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                      {maskApiKey(item.apiKey)}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onCopyApiKey(item)}
                    >
                      {t('apiRouterPage.unifiedApiKey.actions.copyKey')}
                    </Button>
                  </div>
                </td>

                <td className="px-5 py-5">
                  <span className="inline-flex min-w-[8rem] items-center justify-center rounded-full border border-primary-500/15 bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-600 dark:border-primary-500/20 dark:text-primary-300">
                    {t(`apiRouterPage.unifiedApiKey.sources.${item.source}`)}
                  </span>
                </td>

                <td className="px-5 py-5">
                  <div className="min-w-[11rem]">
                    <Select
                      value={item.groupId}
                      onValueChange={(value) => onGroupChange(item.id, value)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </td>

                <td className="px-5 py-5">
                  <div className="min-w-[10rem]">
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {t('apiRouterPage.values.requestCountShort', {
                        value: formatNumber(item.usage.requestCount, i18n.language),
                      })}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {t('apiRouterPage.values.tokenCountShort', {
                        value: formatNumber(item.usage.tokenCount, i18n.language),
                      })}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-primary-500">
                      {formatCurrency(item.usage.spendUsd, i18n.language)} / {item.usage.period}
                    </div>
                  </div>
                </td>

                <td className="px-5 py-5 text-sm text-zinc-600 dark:text-zinc-300">
                  {formatDate(
                    item.expiresAt,
                    i18n.language,
                    t('apiRouterPage.unifiedApiKey.values.never'),
                  )}
                </td>

                <td className="px-5 py-5">
                  <ProxyProviderStatusBadge status={item.status} />
                </td>

                <td className="px-5 py-5 text-sm text-zinc-600 dark:text-zinc-300">
                  {formatDate(
                    item.createdAt,
                    i18n.language,
                    t('apiRouterPage.unifiedApiKey.values.never'),
                  )}
                </td>

                <td className="px-5 py-5">
                  <div className="flex min-w-[24rem] flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenUsage(item)}
                    >
                      {t('apiRouterPage.unifiedApiKey.actions.usageMethod')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenAssociateMapping(item)}
                    >
                      {t('apiRouterPage.unifiedApiKey.actions.associateModelMapping')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onToggleStatus(item)}
                    >
                      {item.status === 'disabled'
                        ? t('apiRouterPage.unifiedApiKey.actions.enable')
                        : t('apiRouterPage.unifiedApiKey.actions.disable')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenEdit(item)}
                    >
                      {t('apiRouterPage.unifiedApiKey.actions.edit')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(item)}
                    >
                      {t('apiRouterPage.unifiedApiKey.actions.delete')}
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
