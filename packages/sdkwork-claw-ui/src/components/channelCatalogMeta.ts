export interface ChannelOfficialLink {
  href: string;
  label: string;
}

const channelOfficialLinkMap: Record<string, ChannelOfficialLink> = {
  feishu: {
    href: 'https://open.feishu.cn/app?lang=zh-CN',
    label: 'Feishu Open Platform',
  },
  telegram: {
    href: 'https://core.telegram.org/bots',
    label: 'Telegram Bot Platform',
  },
  discord: {
    href: 'https://discord.com/developers/applications',
    label: 'Discord Developer Portal',
  },
  slack: {
    href: 'https://api.slack.com/apps',
    label: 'Slack API Apps',
  },
  googlechat: {
    href: 'https://developers.google.com/workspace/chat',
    label: 'Google Chat Developer Docs',
  },
};

export function getChannelOfficialLink(channelId: string): ChannelOfficialLink | null {
  return channelOfficialLinkMap[channelId] || null;
}
