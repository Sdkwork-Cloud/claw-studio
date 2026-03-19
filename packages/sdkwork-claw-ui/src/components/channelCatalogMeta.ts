export interface ChannelOfficialLink {
  href: string;
  label: string;
}

const channelOfficialLinkMap: Record<string, ChannelOfficialLink> = {
  feishu: {
    href: 'https://open.feishu.cn/app?lang=zh-CN',
    label: 'Feishu Open Platform',
  },
  qq: {
    href: 'https://q.qq.com/qqbot/#/home',
    label: 'QQ Bot Platform',
  },
  dingtalk: {
    href: 'https://open-dev.dingtalk.com/',
    label: 'DingTalk Developer Console',
  },
  wecom: {
    href: 'https://work.weixin.qq.com/wework_admin/loginpage_wx?redirect_uri=https%3A%2F%2Fwork.weixin.qq.com%2Fwework_admin%2Fframe',
    label: 'WeCom Admin Console',
  },
};

export function getChannelOfficialLink(channelId: string): ChannelOfficialLink | null {
  return channelOfficialLinkMap[channelId] || null;
}
