import { useTranslation } from 'react-i18next';
import type { ProxyProviderStatus } from '@sdkwork/claw-types';

const statusClassNames: Record<ProxyProviderStatus, string> = {
  active: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  disabled: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-300',
  expired: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
};

export function ProxyProviderStatusBadge({ status }: { status: ProxyProviderStatus }) {
  const { t } = useTranslation();

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassNames[status]}`}
    >
      {t(`apiRouterPage.status.${status}`)}
    </span>
  );
}
