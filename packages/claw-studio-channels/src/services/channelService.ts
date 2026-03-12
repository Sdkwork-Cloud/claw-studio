import React from 'react';
import {
  Building2,
  Hash,
  MessageCircle,
  MessageSquare,
  Send,
  Smile,
  Webhook,
  Zap,
} from 'lucide-react';

export interface ListParams {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

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

export interface CreateChannelDTO {
  name: string;
  description: string;
  icon: string;
  fields: ChannelField[];
  setupGuide: string[];
}

export interface UpdateChannelDTO extends Partial<CreateChannelDTO> {
  enabled?: boolean;
  status?: 'connected' | 'disconnected' | 'not_configured';
}

export interface IChannelService {
  getList(params?: ListParams): Promise<PaginatedResult<Channel>>;
  getById(id: string): Promise<Channel | null>;
  create(data: CreateChannelDTO): Promise<Channel>;
  update(id: string, data: UpdateChannelDTO): Promise<Channel>;
  delete(id: string): Promise<boolean>;
  getChannels(): Promise<Channel[]>;
  updateChannelStatus(channelId: string, enabled: boolean): Promise<Channel[]>;
  saveChannelConfig(channelId: string, configData: Record<string, string>): Promise<Channel[]>;
  deleteChannelConfig(channelId: string): Promise<Channel[]>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getIconComponent(iconName: string) {
  switch (iconName) {
    case 'MessageCircle':
      return React.createElement(MessageCircle, { className: 'w-6 h-6 text-[#00D1B2]' });
    case 'Smile':
      return React.createElement(Smile, { className: 'w-6 h-6 text-[#12B7F5]' });
    case 'Zap':
      return React.createElement(Zap, { className: 'w-6 h-6 text-[#008CEE]' });
    case 'Building2':
      return React.createElement(Building2, { className: 'w-6 h-6 text-[#2B82E4]' });
    case 'Send':
      return React.createElement(Send, { className: 'w-6 h-6 text-[#229ED9]' });
    case 'MessageSquare':
      return React.createElement(MessageSquare, { className: 'w-6 h-6 text-[#5865F2]' });
    case 'Hash':
      return React.createElement(Hash, { className: 'w-6 h-6 text-[#E01E5A]' });
    case 'Webhook':
      return React.createElement(Webhook, { className: 'w-6 h-6 text-primary-500' });
    default:
      return React.createElement(MessageCircle, { className: 'w-6 h-6 text-gray-500' });
  }
}

const INITIAL_CHANNELS: Array<
  Omit<Channel, 'icon'> & {
    iconName: string;
  }
> = [
  {
    id: 'sdkwork_chat',
    name: 'Sdkwork Chat',
    description:
      'Connect Claw Studio to Sdkwork Chat for enterprise team collaboration and automated assistance.',
    iconName: 'MessageCircle',
    status: 'not_configured',
    enabled: false,
    fields: [
      { key: 'app_id', label: 'App ID', type: 'text', placeholder: 'cli_a1b2c3d4e5f6' },
      {
        key: 'app_secret',
        label: 'App Secret',
        type: 'password',
        placeholder: 'Your Sdkwork Chat App Secret',
      },
      {
        key: 'verification_token',
        label: 'Verification Token',
        type: 'password',
        placeholder: 'Optional: For event verification',
        helpText: 'Used to verify requests from Sdkwork Chat.',
      },
    ],
    setupGuide: [
      'Go to the Sdkwork Open Platform.',
      'Create a Custom App and navigate to "Credentials & Basic Info".',
      'Copy the App ID and App Secret.',
      'Enable the "Bot" feature under "Add Features".',
      'Configure the Event Subscription URL using your OpenClaw webhook endpoint.',
    ],
  },
  {
    id: 'feishu',
    name: '椋炰功 (Feishu)',
    description: 'Connect Claw Studio to Feishu for enterprise team collaboration and automated assistance.',
    iconName: 'MessageCircle',
    status: 'not_configured',
    enabled: false,
    fields: [
      { key: 'app_id', label: 'App ID', type: 'text', placeholder: 'cli_a1b2c3d4e5f6' },
      { key: 'app_secret', label: 'App Secret', type: 'password', placeholder: 'Your Feishu App Secret' },
      {
        key: 'verification_token',
        label: 'Verification Token',
        type: 'password',
        placeholder: 'Optional: For event verification',
        helpText: 'Used to verify requests from Feishu.',
      },
    ],
    setupGuide: [
      'Go to the Feishu Open Platform (open.feishu.cn).',
      'Create a Custom App and navigate to "Credentials & Basic Info".',
      'Copy the App ID and App Secret.',
      'Enable the "Bot" feature under "Add Features".',
      'Configure the Event Subscription URL using your OpenClaw webhook endpoint.',
    ],
  },
  {
    id: 'qq',
    name: 'QQ Bot (QQ鏈哄櫒浜�)',
    description: 'Integrate with QQ Guilds or Groups to interact with users directly in QQ.',
    iconName: 'Smile',
    status: 'not_configured',
    enabled: false,
    fields: [
      { key: 'app_id', label: 'Bot App ID', type: 'text', placeholder: '102030405' },
      { key: 'token', label: 'Bot Token', type: 'password', placeholder: 'Your QQ Bot Token' },
      { key: 'secret', label: 'Bot Secret', type: 'password', placeholder: 'Your QQ Bot Secret' },
    ],
    setupGuide: [
      'Go to the QQ Open Platform (q.qq.com).',
      'Create a new Bot application.',
      'Navigate to the Development settings to get your App ID, Token, and Secret.',
      'Add the bot to your QQ Guild for testing.',
    ],
  },
  {
    id: 'dingtalk',
    name: '閽夐拤 (DingTalk)',
    description: 'Connect to DingTalk for enterprise automation, notifications, and chat.',
    iconName: 'Zap',
    status: 'not_configured',
    enabled: false,
    fields: [
      { key: 'app_key', label: 'AppKey', type: 'text', placeholder: 'dingxxxxxxxxxxxx' },
      { key: 'app_secret', label: 'AppSecret', type: 'password', placeholder: 'Your DingTalk App Secret' },
    ],
    setupGuide: [
      'Go to the DingTalk Developer Platform (open-dev.dingtalk.com).',
      'Create an internal enterprise application.',
      'Add the "Robot" feature to your application.',
      'Copy the AppKey and AppSecret from the App Credentials page.',
    ],
  },
  {
    id: 'wecom',
    name: '浼佷笟寰俊 (WeCom)',
    description: 'Integrate with WeCom for internal company assistance and workflow automation.',
    iconName: 'Building2',
    status: 'not_configured',
    enabled: false,
    fields: [
      { key: 'corp_id', label: 'CorpID', type: 'text', placeholder: 'wwxxxxxxxxxxxx' },
      { key: 'agent_id', label: 'AgentId', type: 'text', placeholder: '1000001' },
      { key: 'secret', label: 'Secret', type: 'password', placeholder: 'Your WeCom App Secret' },
    ],
    setupGuide: [
      'Go to the WeCom Admin Console (work.weixin.qq.com).',
      'Navigate to "App Management" and create a self-built app.',
      'Get the AgentId and Secret from the app details page.',
      'Get the CorpID from "My Enterprise" > "Enterprise Info".',
    ],
  },
  {
    id: 'telegram',
    name: 'Telegram Bot',
    description: 'Connect your OpenClaw agent to a Telegram bot to interact via chat.',
    iconName: 'Send',
    status: 'not_configured',
    enabled: false,
    fields: [
      {
        key: 'bot_token',
        label: 'Bot Token',
        type: 'password',
        placeholder: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
        helpText: 'The HTTP API token provided by BotFather.',
      },
    ],
    setupGuide: [
      'Open Telegram and search for @BotFather.',
      'Send the /newbot command and follow the prompts.',
      'Copy the HTTP API Token provided at the end.',
      'Paste the token here and save.',
    ],
  },
  {
    id: 'discord',
    name: 'Discord Integration',
    description: 'Add OpenClaw to your Discord server to manage tasks and answer questions.',
    iconName: 'MessageSquare',
    status: 'connected',
    enabled: true,
    fields: [
      {
        key: 'bot_token',
        label: 'Bot Token',
        type: 'password',
        placeholder: 'MTE... (Your Discord Bot Token)',
        value: '************************',
      },
      {
        key: 'client_id',
        label: 'Client ID',
        type: 'text',
        placeholder: 'Application ID',
        value: '112233445566778899',
      },
    ],
    setupGuide: [
      'Go to the Discord Developer Portal.',
      'Click "New Application" and give it a name.',
      'Navigate to the "Bot" tab and click "Add Bot".',
      'Click "Reset Token" and copy the new token.',
      'Enable "Message Content Intent" under Privileged Gateway Intents.',
    ],
  },
  {
    id: 'slack',
    name: 'Slack App',
    description: 'Integrate with Slack workspaces for team collaboration and agent assistance.',
    iconName: 'Hash',
    status: 'not_configured',
    enabled: false,
    fields: [
      { key: 'bot_token', label: 'Bot User OAuth Token', type: 'password', placeholder: 'xoxb-...' },
      { key: 'app_token', label: 'App-Level Token', type: 'password', placeholder: 'xapp-...' },
    ],
    setupGuide: [
      'Go to api.slack.com/apps and create a new app.',
      'Under "Socket Mode", enable it and generate an App-Level Token (xapp-...).',
      'Under "OAuth & Permissions", add necessary bot token scopes (chat:write, etc.).',
      'Install the app to your workspace to get the Bot User OAuth Token (xoxb-...).',
    ],
  },
  {
    id: 'webhook',
    name: 'Custom Webhook',
    description: 'Send and receive events via standard HTTP webhooks for custom integrations.',
    iconName: 'Webhook',
    status: 'connected',
    enabled: true,
    fields: [
      {
        key: 'webhook_url',
        label: 'Webhook URL',
        type: 'url',
        placeholder: 'https://your-domain.com/webhook',
        value: 'https://api.example.com/openclaw/callback',
      },
      {
        key: 'secret',
        label: 'Secret Key',
        type: 'password',
        placeholder: 'Optional signing secret',
        value: '********',
      },
    ],
    setupGuide: [
      'Provide an HTTPS URL that accepts POST requests.',
      'OpenClaw will send JSON payloads to this URL for every event.',
      'Optionally provide a Secret Key to verify webhook signatures via the X-OpenClaw-Signature header.',
    ],
  },
];

function createInitialChannels(): Channel[] {
  return INITIAL_CHANNELS.map((channel) => ({
    ...channel,
    icon: getIconComponent(channel.iconName),
    fields: channel.fields.map((field) => ({ ...field })),
    setupGuide: [...channel.setupGuide],
  }));
}

function cloneChannel(channel: Channel): Channel {
  return {
    ...channel,
    fields: channel.fields.map((field) => ({ ...field })),
    setupGuide: [...channel.setupGuide],
  };
}

class ChannelService implements IChannelService {
  private channelsData = createInitialChannels();

  async getList(params: ListParams = {}): Promise<PaginatedResult<Channel>> {
    const channels = await this.getChannels();
    let items = channels;

    if (params.keyword) {
      const keyword = params.keyword.toLowerCase();
      items = items.filter(
        (channel) =>
          channel.name.toLowerCase().includes(keyword) ||
          channel.description.toLowerCase().includes(keyword),
      );
    }

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const total = items.length;
    const start = (page - 1) * pageSize;

    return {
      items: items.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  }

  async getById(id: string): Promise<Channel | null> {
    const channel = this.channelsData.find((item) => item.id === id);
    return channel ? cloneChannel(channel) : null;
  }

  async create(data: CreateChannelDTO): Promise<Channel> {
    throw new Error('Method not implemented.');
  }

  async update(id: string, data: UpdateChannelDTO): Promise<Channel> {
    throw new Error('Method not implemented.');
  }

  async delete(id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  async getChannels(): Promise<Channel[]> {
    await delay(50);
    return this.channelsData.map(cloneChannel);
  }

  async updateChannelStatus(channelId: string, enabled: boolean): Promise<Channel[]> {
    await delay(50);
    this.channelsData = this.channelsData.map((channel) =>
      channel.id === channelId
        ? {
            ...channel,
            enabled,
            status: enabled ? 'connected' : 'disconnected',
          }
        : channel,
    );
    return this.getChannels();
  }

  async saveChannelConfig(channelId: string, configData: Record<string, string>): Promise<Channel[]> {
    await delay(50);
    this.channelsData = this.channelsData.map((channel) => {
      if (channel.id !== channelId) {
        return channel;
      }

      return {
        ...channel,
        enabled: true,
        status: 'connected',
        fields: channel.fields.map((field) => ({
          ...field,
          value: configData[field.key] !== undefined ? configData[field.key] : field.value,
        })),
      };
    });
    return this.getChannels();
  }

  async deleteChannelConfig(channelId: string): Promise<Channel[]> {
    await delay(50);
    this.channelsData = this.channelsData.map((channel) => {
      if (channel.id !== channelId) {
        return channel;
      }

      return {
        ...channel,
        enabled: false,
        status: 'not_configured',
        fields: channel.fields.map((field) => ({
          ...field,
          value: undefined,
        })),
      };
    });
    return this.getChannels();
  }
}

export const channelService = new ChannelService();

