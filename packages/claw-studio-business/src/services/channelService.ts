import { MessageSquare, Send, Hash, Webhook, Smile, MessageCircle, Zap, Building2 } from 'lucide-react';
import React from 'react';

export interface ChannelField {
  key: string;
  label: string;
  type: string;
  placeholder: string;
  value?: string;
  helpText?: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'connected' | 'disconnected' | 'not_configured';
  enabled: boolean;
  fields: ChannelField[];
  setupGuide: string[];
}

// Initial mock data
const INITIAL_CHANNELS: Channel[] = [
  {
    id: 'sdkwork_chat',
    name: 'Sdkwork Chat',
    description: 'Connect Claw Studio to Sdkwork Chat for enterprise team collaboration and automated assistance.',
    icon: React.createElement(MessageCircle, { className: "w-6 h-6 text-[#00D1B2]" }),
    status: 'not_configured',
    enabled: false,
    fields: [
      { key: 'app_id', label: 'App ID', type: 'text', placeholder: 'cli_a1b2c3d4e5f6' },
      { key: 'app_secret', label: 'App Secret', type: 'password', placeholder: 'Your Sdkwork Chat App Secret' },
      { key: 'verification_token', label: 'Verification Token', type: 'password', placeholder: 'Optional: For event verification', helpText: 'Used to verify requests from Sdkwork Chat.' }
    ],
    setupGuide: [
      'Go to the Sdkwork Open Platform.',
      'Create a Custom App and navigate to "Credentials & Basic Info".',
      'Copy the App ID and App Secret.',
      'Enable the "Bot" feature under "Add Features".',
      'Configure the Event Subscription URL using your OpenClaw webhook endpoint.'
    ]
  },
  {
    id: 'feishu',
    name: '飞书 (Feishu)',
    description: 'Connect Claw Studio to Feishu for enterprise team collaboration and automated assistance.',
    icon: React.createElement(MessageCircle, { className: "w-6 h-6 text-[#3370FF]" }),
    status: 'not_configured',
    enabled: false,
    fields: [
      { key: 'app_id', label: 'App ID', type: 'text', placeholder: 'cli_a1b2c3d4e5f6' },
      { key: 'app_secret', label: 'App Secret', type: 'password', placeholder: 'Your Feishu App Secret' },
      { key: 'verification_token', label: 'Verification Token', type: 'password', placeholder: 'Optional: For event verification', helpText: 'Used to verify requests from Feishu.' }
    ],
    setupGuide: [
      'Go to the Feishu Open Platform (open.feishu.cn).',
      'Create a Custom App and navigate to "Credentials & Basic Info".',
      'Copy the App ID and App Secret.',
      'Enable the "Bot" feature under "Add Features".',
      'Configure the Event Subscription URL using your OpenClaw webhook endpoint.'
    ]
  },
  {
    id: 'qq',
    name: 'QQ Bot (QQ机器人)',
    description: 'Integrate with QQ Guilds or Groups to interact with users directly in QQ.',
    icon: React.createElement(Smile, { className: "w-6 h-6 text-[#12B7F5]" }),
    status: 'not_configured',
    enabled: false,
    fields: [
      { key: 'app_id', label: 'Bot App ID', type: 'text', placeholder: '102030405' },
      { key: 'token', label: 'Bot Token', type: 'password', placeholder: 'Your QQ Bot Token' },
      { key: 'secret', label: 'Bot Secret', type: 'password', placeholder: 'Your QQ Bot Secret' }
    ],
    setupGuide: [
      'Go to the QQ Open Platform (q.qq.com).',
      'Create a new Bot application.',
      'Navigate to the Development settings to get your App ID, Token, and Secret.',
      'Add the bot to your QQ Guild for testing.'
    ]
  },
  {
    id: 'dingtalk',
    name: '钉钉 (DingTalk)',
    description: 'Connect to DingTalk for enterprise automation, notifications, and chat.',
    icon: React.createElement(Zap, { className: "w-6 h-6 text-[#008CEE]" }),
    status: 'not_configured',
    enabled: false,
    fields: [
      { key: 'app_key', label: 'AppKey', type: 'text', placeholder: 'dingxxxxxxxxxxxx' },
      { key: 'app_secret', label: 'AppSecret', type: 'password', placeholder: 'Your DingTalk App Secret' }
    ],
    setupGuide: [
      'Go to the DingTalk Developer Platform (open-dev.dingtalk.com).',
      'Create an internal enterprise application.',
      'Add the "Robot" feature to your application.',
      'Copy the AppKey and AppSecret from the App Credentials page.'
    ]
  },
  {
    id: 'wecom',
    name: '企业微信 (WeCom)',
    description: 'Integrate with WeCom for internal company assistance and workflow automation.',
    icon: React.createElement(Building2, { className: "w-6 h-6 text-[#2B82E4]" }),
    status: 'not_configured',
    enabled: false,
    fields: [
      { key: 'corp_id', label: 'CorpID', type: 'text', placeholder: 'wwxxxxxxxxxxxx' },
      { key: 'agent_id', label: 'AgentId', type: 'text', placeholder: '1000001' },
      { key: 'secret', label: 'Secret', type: 'password', placeholder: 'Your WeCom App Secret' }
    ],
    setupGuide: [
      'Go to the WeCom Admin Console (work.weixin.qq.com).',
      'Navigate to "App Management" and create a self-built app.',
      'Get the AgentId and Secret from the app details page.',
      'Get the CorpID from "My Enterprise" > "Enterprise Info".'
    ]
  },
  {
    id: 'telegram',
    name: 'Telegram Bot',
    description: 'Connect your OpenClaw agent to a Telegram bot to interact via chat.',
    icon: React.createElement(Send, { className: "w-6 h-6 text-[#229ED9]" }),
    status: 'not_configured',
    enabled: false,
    fields: [
      { key: 'bot_token', label: 'Bot Token', type: 'password', placeholder: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz', helpText: 'The HTTP API token provided by BotFather.' }
    ],
    setupGuide: [
      'Open Telegram and search for @BotFather.',
      'Send the /newbot command and follow the prompts.',
      'Copy the HTTP API Token provided at the end.',
      'Paste the token here and save.'
    ]
  },
  {
    id: 'discord',
    name: 'Discord Integration',
    description: 'Add OpenClaw to your Discord server to manage tasks and answer questions.',
    icon: React.createElement(MessageSquare, { className: "w-6 h-6 text-[#5865F2]" }),
    status: 'connected',
    enabled: true,
    fields: [
      { key: 'bot_token', label: 'Bot Token', type: 'password', placeholder: 'MTE... (Your Discord Bot Token)', value: '************************' },
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'Application ID', value: '112233445566778899' }
    ],
    setupGuide: [
      'Go to the Discord Developer Portal.',
      'Click "New Application" and give it a name.',
      'Navigate to the "Bot" tab and click "Add Bot".',
      'Click "Reset Token" and copy the new token.',
      'Enable "Message Content Intent" under Privileged Gateway Intents.'
    ]
  },
  {
    id: 'slack',
    name: 'Slack App',
    description: 'Integrate with Slack workspaces for team collaboration and agent assistance.',
    icon: React.createElement(Hash, { className: "w-6 h-6 text-[#E01E5A]" }),
    status: 'not_configured',
    enabled: false,
    fields: [
      { key: 'bot_token', label: 'Bot User OAuth Token', type: 'password', placeholder: 'xoxb-...' },
      { key: 'app_token', label: 'App-Level Token', type: 'password', placeholder: 'xapp-...' }
    ],
    setupGuide: [
      'Go to api.slack.com/apps and create a new app.',
      'Under "Socket Mode", enable it and generate an App-Level Token (xapp-...).',
      'Under "OAuth & Permissions", add necessary bot token scopes (chat:write, etc.).',
      'Install the app to your workspace to get the Bot User OAuth Token (xoxb-...).'
    ]
  },
  {
    id: 'webhook',
    name: 'Custom Webhook',
    description: 'Send and receive events via standard HTTP webhooks for custom integrations.',
    icon: React.createElement(Webhook, { className: "w-6 h-6 text-primary-500" }),
    status: 'connected',
    enabled: true,
    fields: [
      { key: 'webhook_url', label: 'Webhook URL', type: 'url', placeholder: 'https://your-domain.com/webhook', value: 'https://api.example.com/openclaw/callback' },
      { key: 'secret', label: 'Secret Key', type: 'password', placeholder: 'Optional signing secret', value: '********' }
    ],
    setupGuide: [
      'Provide an HTTPS URL that accepts POST requests.',
      'OpenClaw will send JSON payloads to this URL for every event.',
      'Optionally provide a Secret Key to verify webhook signatures via the X-OpenClaw-Signature header.'
    ]
  }
];

export interface IChannelService {
  getChannels(): Promise<Channel[]>;
  updateChannelStatus(channelId: string, enabled: boolean): Promise<Channel[]>;
  saveChannelConfig(channelId: string, configData: Record<string, string>): Promise<Channel[]>;
  deleteChannelConfig(channelId: string): Promise<Channel[]>;
}

class ChannelService implements IChannelService {
  private channelsData: Channel[] = [...INITIAL_CHANNELS];

  async getChannels(): Promise<Channel[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...this.channelsData]), 300);
    });
  }

  async updateChannelStatus(channelId: string, enabled: boolean): Promise<Channel[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.channelsData = this.channelsData.map(c => {
          if (c.id === channelId) {
            return { ...c, enabled, status: enabled ? 'connected' : 'disconnected' };
          }
          return c;
        });
        resolve([...this.channelsData]);
      }, 500);
    });
  }

  async saveChannelConfig(channelId: string, configData: Record<string, string>): Promise<Channel[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.channelsData = this.channelsData.map(c => {
          if (c.id === channelId) {
            const updatedFields = c.fields.map(f => ({
              ...f,
              value: configData[f.key] !== undefined ? configData[f.key] : f.value
            }));
            return { ...c, fields: updatedFields, status: 'connected', enabled: true };
          }
          return c;
        });
        resolve([...this.channelsData]);
      }, 800);
    });
  }

  async deleteChannelConfig(channelId: string): Promise<Channel[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.channelsData = this.channelsData.map(c => {
          if (c.id === channelId) {
            const resetFields = c.fields.map(f => ({ ...f, value: undefined }));
            return { ...c, fields: resetFields, status: 'not_configured', enabled: false };
          }
          return c;
        });
        resolve([...this.channelsData]);
      }, 500);
    });
  }
}

export const channelService = new ChannelService();
