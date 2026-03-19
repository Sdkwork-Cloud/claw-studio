import type { ApiRouterChannel } from '@sdkwork/claw-types';
import { Button } from '@sdkwork/claw-ui';

interface ApiRouterChannelSidebarProps {
  channels: ApiRouterChannel[];
  selectedChannelId: string | null;
  onSelect: (channelId: string) => void;
}

interface ChannelBadgeConfig {
  label: string;
  className: string;
}

const channelBadgeMap: Record<string, ChannelBadgeConfig> = {
  openai: {
    label: 'OA',
    className: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-200',
  },
  anthropic: {
    label: 'AT',
    className: 'bg-amber-500/12 text-amber-700 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-200',
  },
  google: {
    label: 'GG',
    className: 'bg-sky-500/12 text-sky-700 ring-sky-500/20 dark:bg-sky-500/15 dark:text-sky-200',
  },
  xai: {
    label: 'XI',
    className: 'bg-fuchsia-500/12 text-fuchsia-700 ring-fuchsia-500/20 dark:bg-fuchsia-500/15 dark:text-fuchsia-200',
  },
  meta: {
    label: 'ME',
    className: 'bg-blue-500/12 text-blue-700 ring-blue-500/20 dark:bg-blue-500/15 dark:text-blue-200',
  },
  mistral: {
    label: 'MI',
    className: 'bg-orange-500/12 text-orange-700 ring-orange-500/20 dark:bg-orange-500/15 dark:text-orange-200',
  },
  cohere: {
    label: 'CO',
    className: 'bg-violet-500/12 text-violet-700 ring-violet-500/20 dark:bg-violet-500/15 dark:text-violet-200',
  },
  'amazon-nova': {
    label: 'AN',
    className: 'bg-indigo-500/12 text-indigo-700 ring-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-200',
  },
  microsoft: {
    label: 'MS',
    className: 'bg-cyan-500/12 text-cyan-700 ring-cyan-500/20 dark:bg-cyan-500/15 dark:text-cyan-200',
  },
  nvidia: {
    label: 'NV',
    className: 'bg-lime-500/12 text-lime-700 ring-lime-500/20 dark:bg-lime-500/15 dark:text-lime-200',
  },
  deepseek: {
    label: 'DS',
    className: 'bg-teal-500/12 text-teal-700 ring-teal-500/20 dark:bg-teal-500/15 dark:text-teal-200',
  },
  qwen: {
    label: 'QW',
    className: 'bg-cyan-500/12 text-cyan-700 ring-cyan-500/20 dark:bg-cyan-500/15 dark:text-cyan-200',
  },
  zhipu: {
    label: 'ZP',
    className: 'bg-rose-500/12 text-rose-700 ring-rose-500/20 dark:bg-rose-500/15 dark:text-rose-200',
  },
  baidu: {
    label: 'BD',
    className: 'bg-red-500/12 text-red-700 ring-red-500/20 dark:bg-red-500/15 dark:text-red-200',
  },
  'tencent-hunyuan': {
    label: 'TH',
    className: 'bg-sky-500/12 text-sky-700 ring-sky-500/20 dark:bg-sky-500/15 dark:text-sky-200',
  },
  doubao: {
    label: 'DB',
    className: 'bg-orange-500/12 text-orange-700 ring-orange-500/20 dark:bg-orange-500/15 dark:text-orange-200',
  },
  moonshot: {
    label: 'KI',
    className: 'bg-indigo-500/12 text-indigo-700 ring-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-200',
  },
  minimax: {
    label: 'MM',
    className: 'bg-pink-500/12 text-pink-700 ring-pink-500/20 dark:bg-pink-500/15 dark:text-pink-200',
  },
  stepfun: {
    label: 'ST',
    className: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-200',
  },
  sensenova: {
    label: 'SN',
    className: 'bg-violet-500/12 text-violet-700 ring-violet-500/20 dark:bg-violet-500/15 dark:text-violet-200',
  },
  baichuan: {
    label: 'BC',
    className: 'bg-amber-500/12 text-amber-700 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-200',
  },
  yi: {
    label: 'YI',
    className: 'bg-blue-500/12 text-blue-700 ring-blue-500/20 dark:bg-blue-500/15 dark:text-blue-200',
  },
  'iflytek-spark': {
    label: 'SP',
    className: 'bg-fuchsia-500/12 text-fuchsia-700 ring-fuchsia-500/20 dark:bg-fuchsia-500/15 dark:text-fuchsia-200',
  },
  'huawei-pangu': {
    label: 'PG',
    className: 'bg-red-500/12 text-red-700 ring-red-500/20 dark:bg-red-500/15 dark:text-red-200',
  },
};

function getBadgeLabel(name: string) {
  const compactName = name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase())
    .join('');

  return compactName.slice(0, 2) || 'AI';
}

function getChannelBadge(channel: ApiRouterChannel) {
  return (
    channelBadgeMap[channel.id] || {
      label: getBadgeLabel(channel.name),
      className:
        'bg-zinc-500/10 text-zinc-700 ring-zinc-500/15 dark:bg-zinc-500/15 dark:text-zinc-200',
    }
  );
}

export function ApiRouterChannelSidebar({
  channels,
  selectedChannelId,
  onSelect,
}: ApiRouterChannelSidebarProps) {
  return (
    <aside
      data-slot="api-router-channel-sidebar"
      className="w-full shrink-0 xl:w-[15rem]"
    >
      <nav className="rounded-[28px] border border-zinc-200/80 bg-white/92 p-2 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70">
        <ul className="flex gap-2 overflow-x-auto pb-1 xl:max-h-[calc(100vh-9rem)] xl:flex-col xl:overflow-x-hidden xl:overflow-y-auto xl:pb-0">
          {channels.map((channel) => {
            const isSelected = channel.id === selectedChannelId;
            const badge = getChannelBadge(channel);

            return (
              <li key={channel.id} className="shrink-0 xl:shrink">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onSelect(channel.id)}
                  aria-current={isSelected ? 'page' : undefined}
                  className={`h-11 min-w-[9.25rem] justify-start gap-3 rounded-2xl px-3 xl:min-w-0 ${
                    isSelected
                      ? 'bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50'
                  }`}
                >
                  <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[11px] font-semibold ring-1 ring-inset ${
                      isSelected
                        ? 'bg-white/12 text-white ring-white/15 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-zinc-800'
                        : badge.className
                    }`}
                  >
                    {badge.label}
                  </span>
                  <span className="truncate text-sm font-medium">{channel.name}</span>
                </Button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
