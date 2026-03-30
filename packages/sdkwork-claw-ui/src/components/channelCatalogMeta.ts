export interface ChannelOfficialLink {
  href: string;
  label: string;
}

export type ChannelCatalogRegion = 'domestic' | 'global';
export type ChannelCatalogManagementMode = 'managed' | 'reference';

export interface ChannelCatalogRegionGroups<T> {
  domestic: T[];
  global: T[];
}

export interface SupplementalChannelCatalogEntry {
  id: string;
  name: string;
  descriptionKey: string;
  region: ChannelCatalogRegion;
  managementMode: ChannelCatalogManagementMode;
  officialLink: ChannelOfficialLink;
}

interface ChannelCatalogMeta {
  order: number;
  monogram: string;
  tone: string;
  region: ChannelCatalogRegion;
  managementMode?: ChannelCatalogManagementMode;
  officialLink?: ChannelOfficialLink;
  primaryAction?: 'officialSite' | 'downloadApp';
}

const defaultChannelTone =
  'border-zinc-200/80 bg-gradient-to-br from-white to-zinc-50 text-zinc-700 dark:border-zinc-700/80 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-100';

const supplementalChannelCatalogEntries: SupplementalChannelCatalogEntry[] = [
  {
    id: 'wechat',
    name: 'WeChat',
    descriptionKey: 'channels.page.catalog.supplemental.wechat.description',
    region: 'domestic',
    managementMode: 'reference',
    officialLink: {
      href: 'https://developers.weixin.qq.com/',
      label: 'WeChat Open Platform',
    },
  },
  {
    id: 'feishu',
    name: 'Feishu',
    descriptionKey: 'channels.page.catalog.supplemental.feishu.description',
    region: 'domestic',
    managementMode: 'reference',
    officialLink: {
      href: 'https://open.feishu.cn/',
      label: 'Feishu Open Platform',
    },
  },
  {
    id: 'dingtalk',
    name: 'DingTalk',
    descriptionKey: 'channels.page.catalog.supplemental.dingtalk.description',
    region: 'domestic',
    managementMode: 'reference',
    officialLink: {
      href: 'https://open.dingtalk.com/',
      label: 'DingTalk Open Platform',
    },
  },
  {
    id: 'wecom',
    name: 'WeCom',
    descriptionKey: 'channels.page.catalog.supplemental.wecom.description',
    region: 'domestic',
    managementMode: 'reference',
    officialLink: {
      href: 'https://developer.work.weixin.qq.com/',
      label: 'WeCom Developer Center',
    },
  },
  {
    id: 'qq',
    name: 'QQ',
    descriptionKey: 'channels.page.catalog.supplemental.qq.description',
    region: 'domestic',
    managementMode: 'reference',
    officialLink: {
      href: 'https://connect.qq.com/',
      label: 'QQ Connect',
    },
  },
];

const channelCatalogMetaMap: Record<string, ChannelCatalogMeta> = {
  telegram: {
    order: 100,
    monogram: 'TG',
    tone:
      'border-sky-200/80 bg-gradient-to-br from-sky-50 to-blue-100 text-sky-700 dark:border-sky-500/20 dark:from-sky-500/15 dark:to-blue-500/15 dark:text-sky-200',
    region: 'global',
    officialLink: {
      href: 'https://core.telegram.org/bots',
      label: 'Telegram Bot Platform',
    },
  },
  whatsapp: {
    order: 101,
    monogram: 'WA',
    tone:
      'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-green-100 text-emerald-700 dark:border-emerald-500/20 dark:from-emerald-500/15 dark:to-green-500/15 dark:text-emerald-200',
    region: 'global',
    officialLink: {
      href: 'https://web.whatsapp.com/',
      label: 'WhatsApp Web',
    },
  },
  discord: {
    order: 102,
    monogram: 'DS',
    tone:
      'border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-700 dark:border-indigo-500/20 dark:from-indigo-500/15 dark:to-violet-500/15 dark:text-indigo-200',
    region: 'global',
    officialLink: {
      href: 'https://discord.com/developers/applications',
      label: 'Discord Developer Portal',
    },
  },
  irc: {
    order: 103,
    monogram: 'IR',
    tone:
      'border-slate-200/80 bg-gradient-to-br from-slate-50 to-zinc-100 text-slate-700 dark:border-slate-500/20 dark:from-slate-500/15 dark:to-zinc-500/15 dark:text-slate-200',
    region: 'global',
  },
  googlechat: {
    order: 104,
    monogram: 'GC',
    tone:
      'border-amber-200/80 bg-gradient-to-br from-amber-50 to-yellow-100 text-amber-700 dark:border-amber-500/20 dark:from-amber-500/15 dark:to-yellow-500/15 dark:text-amber-200',
    region: 'global',
    officialLink: {
      href: 'https://developers.google.com/workspace/chat',
      label: 'Google Chat Developer Docs',
    },
  },
  slack: {
    order: 105,
    monogram: 'SL',
    tone:
      'border-rose-200/80 bg-gradient-to-br from-rose-50 to-orange-100 text-rose-700 dark:border-rose-500/20 dark:from-rose-500/15 dark:to-orange-500/15 dark:text-rose-200',
    region: 'global',
    officialLink: {
      href: 'https://api.slack.com/apps',
      label: 'Slack API Apps',
    },
  },
  signal: {
    order: 106,
    monogram: 'SI',
    tone:
      'border-sky-200/80 bg-gradient-to-br from-sky-50 to-cyan-100 text-sky-700 dark:border-sky-500/20 dark:from-sky-500/15 dark:to-cyan-500/15 dark:text-sky-200',
    region: 'global',
    officialLink: {
      href: 'https://signal.org/download/',
      label: 'Signal Download',
    },
  },
  imessage: {
    order: 107,
    monogram: 'IM',
    tone:
      'border-blue-200/80 bg-gradient-to-br from-blue-50 to-sky-100 text-blue-700 dark:border-blue-500/20 dark:from-blue-500/15 dark:to-sky-500/15 dark:text-blue-200',
    region: 'global',
    officialLink: {
      href: 'https://support.apple.com/messages',
      label: 'Apple Messages Support',
    },
  },
  line: {
    order: 108,
    monogram: 'LN',
    tone:
      'border-green-200/80 bg-gradient-to-br from-green-50 to-lime-100 text-green-700 dark:border-green-500/20 dark:from-green-500/15 dark:to-lime-500/15 dark:text-green-200',
    region: 'global',
    officialLink: {
      href: 'https://developers.line.biz/en/docs/messaging-api/',
      label: 'LINE Messaging API Docs',
    },
  },
  wechat: {
    order: 0,
    monogram: 'WC',
    tone:
      'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-lime-100 text-emerald-700 dark:border-emerald-500/20 dark:from-emerald-500/15 dark:to-lime-500/15 dark:text-emerald-200',
    region: 'domestic',
    managementMode: 'reference',
    officialLink: {
      href: 'https://developers.weixin.qq.com/',
      label: 'WeChat Open Platform',
    },
  },
  feishu: {
    order: 1,
    monogram: 'FS',
    tone:
      'border-sky-200/80 bg-gradient-to-br from-sky-50 to-cyan-100 text-sky-700 dark:border-sky-500/20 dark:from-sky-500/15 dark:to-cyan-500/15 dark:text-sky-200',
    region: 'domestic',
    managementMode: 'reference',
    officialLink: {
      href: 'https://open.feishu.cn/',
      label: 'Feishu Open Platform',
    },
  },
  dingtalk: {
    order: 2,
    monogram: 'DT',
    tone:
      'border-cyan-200/80 bg-gradient-to-br from-cyan-50 to-sky-100 text-cyan-700 dark:border-cyan-500/20 dark:from-cyan-500/15 dark:to-sky-500/15 dark:text-cyan-200',
    region: 'domestic',
    managementMode: 'reference',
    officialLink: {
      href: 'https://open.dingtalk.com/',
      label: 'DingTalk Open Platform',
    },
  },
  wecom: {
    order: 3,
    monogram: 'WC',
    tone:
      'border-blue-200/80 bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-700 dark:border-blue-500/20 dark:from-blue-500/15 dark:to-indigo-500/15 dark:text-blue-200',
    region: 'domestic',
    managementMode: 'reference',
    officialLink: {
      href: 'https://developer.work.weixin.qq.com/',
      label: 'WeCom Developer Center',
    },
  },
  qq: {
    order: 4,
    monogram: 'QQ',
    tone:
      'border-slate-200/80 bg-gradient-to-br from-slate-50 to-zinc-100 text-slate-700 dark:border-slate-500/20 dark:from-slate-500/15 dark:to-zinc-500/15 dark:text-slate-200',
    region: 'domestic',
    managementMode: 'reference',
    officialLink: {
      href: 'https://connect.qq.com/',
      label: 'QQ Connect',
    },
  },
};

function getStatusRank(item: { status?: string; enabled?: boolean }) {
  if (item.status === 'connected' && item.enabled) {
    return 0;
  }
  if (item.status === 'connected') {
    return 1;
  }
  if (item.status === 'disconnected') {
    return 2;
  }
  return 3;
}

function getOrder(channelId: string) {
  return channelCatalogMetaMap[channelId]?.order ?? 1000;
}

function fallbackMonogram(name?: string) {
  const normalized = (name || '')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return normalized || 'CH';
}

export function getChannelOfficialLink(channelId: string): ChannelOfficialLink | null {
  return channelCatalogMetaMap[channelId]?.officialLink || null;
}

export function getChannelCatalogRegion(channelId: string): ChannelCatalogRegion {
  return channelCatalogMetaMap[channelId]?.region || 'global';
}

export function isManagedChannelCatalogEntry(channelId: string) {
  return (channelCatalogMetaMap[channelId]?.managementMode || 'managed') === 'managed';
}

export function getSupplementalChannelCatalogEntries() {
  return supplementalChannelCatalogEntries.map((entry) => ({
    ...entry,
    officialLink: { ...entry.officialLink },
  }));
}

export function isChannelDownloadAppAction(channelId: string) {
  return channelCatalogMetaMap[channelId]?.primaryAction === 'downloadApp';
}

export function getChannelCatalogMonogram(channelId: string, name?: string) {
  return channelCatalogMetaMap[channelId]?.monogram || fallbackMonogram(name);
}

export function getChannelCatalogTone(channelId: string) {
  return channelCatalogMetaMap[channelId]?.tone || defaultChannelTone;
}

export function sortChannelCatalogItems<
  T extends { id: string; name?: string; status?: string; enabled?: boolean },
>(items: T[]) {
  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const orderDifference = getOrder(left.item.id) - getOrder(right.item.id);
      if (orderDifference !== 0) {
        return orderDifference;
      }

      if (getOrder(left.item.id) >= 100 && getOrder(right.item.id) >= 100) {
        const statusDifference = getStatusRank(left.item) - getStatusRank(right.item);
        if (statusDifference !== 0) {
          return statusDifference;
        }
      }

      const nameDifference = (left.item.name || '').localeCompare(right.item.name || '');
      if (nameDifference !== 0) {
        return nameDifference;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.item);
}

export function partitionChannelCatalogItemsByRegion<
  T extends { id: string; name?: string; status?: string; enabled?: boolean },
>(items: T[]): ChannelCatalogRegionGroups<T> {
  return sortChannelCatalogItems(items).reduce<ChannelCatalogRegionGroups<T>>(
    (groups, item) => {
      const region = getChannelCatalogRegion(item.id);
      groups[region].push(item);
      return groups;
    },
    {
      domestic: [],
      global: [],
    },
  );
}

export function resolveDefaultChannelCatalogRegion<T>(
  groups: ChannelCatalogRegionGroups<T>,
): ChannelCatalogRegion {
  if (groups.domestic.length > 0) {
    return 'domestic';
  }

  return 'global';
}
