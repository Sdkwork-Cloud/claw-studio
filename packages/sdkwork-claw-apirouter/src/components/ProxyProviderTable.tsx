import { useTranslation } from 'react-i18next';
import type {
  ApiRouterChannel,
  ProxyProvider,
  ProxyProviderGroup,
} from '@sdkwork/claw-types';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sdkwork/claw-ui';
import { ProxyProviderStatusBadge } from './ProxyProviderStatusBadge';

interface ProxyProviderTableProps {
  channels?: ApiRouterChannel[];
  providers: ProxyProvider[];
  groups: ProxyProviderGroup[];
  showChannelBadge?: boolean;
  onCopyApiKey: (provider: ProxyProvider) => void;
  onGroupChange: (providerId: string, groupId: string) => void;
  onOpenUsage: (provider: ProxyProvider) => void;
  onOpenEdit: (provider: ProxyProvider) => void;
  onToggleStatus: (provider: ProxyProvider) => void;
  onDelete: (provider: ProxyProvider) => void;
}

function maskApiKey(apiKey: string) {
  if (apiKey.length <= 12) {
    return apiKey;
  }

  return `${apiKey.slice(0, 7)}********${apiKey.slice(-4)}`;
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

export function ProxyProviderTable({
  channels = [],
  providers,
  groups,
  showChannelBadge = false,
  onCopyApiKey,
  onGroupChange,
  onOpenUsage,
  onOpenEdit,
  onToggleStatus,
  onDelete,
}: ProxyProviderTableProps) {
  const { t, i18n } = useTranslation();
  const channelNameById = Object.fromEntries(
    channels.map((channel) => [channel.id, channel.name] as const),
  );

  if (providers.length === 0) {
    return (
      <div className="rounded-[32px] border border-dashed border-zinc-300 bg-white/80 p-10 text-center shadow-[0_18px_48px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/50">
        <div className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          {t('apiRouterPage.table.emptyTitle')}
        </div>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {t('apiRouterPage.table.emptyDescription')}
        </p>
      </div>
    );
  }

  return (
    <div
      data-slot="api-router-provider-table"
      className="overflow-hidden rounded-[32px] border border-zinc-200/80 bg-white/92 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70"
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50/90 dark:bg-zinc-900/80">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              <th className="px-5 py-4">{t('apiRouterPage.table.name')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.table.apiKey')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.table.group')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.table.usage')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.table.expiresAt')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.table.status')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.table.createdAt')}</th>
              <th className="px-5 py-4">{t('apiRouterPage.table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {providers.map((provider) => (
              <tr key={provider.id} className="align-top">
                <td className="px-5 py-5">
                  <div className="min-w-[15rem]">
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {provider.name}
                    </div>
                    {showChannelBadge ? (
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-2 rounded-full border border-primary-500/15 bg-primary-500/10 px-3 py-1 text-[11px] font-semibold text-primary-600 dark:border-primary-500/20 dark:text-primary-300">
                          <span>{t('apiRouterPage.table.channel')}</span>
                          <span className="text-zinc-700 dark:text-zinc-200">
                            {channelNameById[provider.channelId] || provider.channelId}
                          </span>
                        </span>
                      </div>
                    ) : null}
                    <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {provider.baseUrl}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {provider.models.map((model) => (
                        <span
                          key={model.id}
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
                          title={model.id}
                        >
                          <span>{model.name}</span>
                          {model.name !== model.id ? (
                            <span className="font-mono text-zinc-400 dark:text-zinc-500">
                              {model.id}
                            </span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  </div>
                </td>

                <td className="px-5 py-5">
                  <div className="flex min-w-[13rem] items-start gap-3">
                    <div className="flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                      {maskApiKey(provider.apiKey)}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onCopyApiKey(provider)}
                    >
                      {t('apiRouterPage.actions.copyKey')}
                    </Button>
                  </div>
                </td>

                <td className="px-5 py-5">
                  <div className="min-w-[11rem]">
                    <Select
                      value={provider.groupId}
                      onValueChange={(value) => onGroupChange(provider.id, value)}
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
                        value: formatNumber(provider.usage.requestCount, i18n.language),
                      })}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {t('apiRouterPage.values.tokenCountShort', {
                        value: formatNumber(provider.usage.tokenCount, i18n.language),
                      })}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-primary-500">
                      {formatCurrency(provider.usage.spendUsd, i18n.language)} / {provider.usage.period}
                    </div>
                  </div>
                </td>

                <td className="px-5 py-5 text-sm text-zinc-600 dark:text-zinc-300">
                  {formatDate(provider.expiresAt, i18n.language, t('apiRouterPage.values.never'))}
                </td>

                <td className="px-5 py-5">
                  <ProxyProviderStatusBadge status={provider.status} />
                </td>

                <td className="px-5 py-5 text-sm text-zinc-600 dark:text-zinc-300">
                  {formatDate(provider.createdAt, i18n.language, t('apiRouterPage.values.never'))}
                </td>

                <td className="px-5 py-5">
                  <div className="flex min-w-[17rem] flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenUsage(provider)}
                    >
                      {t('apiRouterPage.actions.usageMethod')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onToggleStatus(provider)}
                    >
                      {provider.status === 'disabled'
                        ? t('apiRouterPage.actions.enable')
                        : t('apiRouterPage.actions.disable')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenEdit(provider)}
                    >
                      {t('apiRouterPage.actions.edit')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(provider)}
                    >
                      {t('apiRouterPage.actions.delete')}
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
