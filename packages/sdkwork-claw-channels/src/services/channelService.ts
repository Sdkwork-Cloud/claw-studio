import React from 'react';
import { openClawConfigService } from '@sdkwork/claw-core';
import { studio, studioMockService } from '@sdkwork/claw-infrastructure';
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
import { type ListParams, type PaginatedResult } from '@sdkwork/claw-types';

export interface ChannelField {
  key: string;
  label: string;
  type?: React.HTMLInputTypeAttribute;
  placeholder: string;
  value?: string;
  helpText?: string;
  required?: boolean;
  multiline?: boolean;
  sensitive?: boolean;
  inputMode?: 'text' | 'url' | 'numeric';
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'connected' | 'disconnected' | 'not_configured';
  enabled: boolean;
  configurationMode?: 'required' | 'none';
  fields: ChannelField[];
  setupGuide: string[];
  fieldCount?: number;
  configuredFieldCount?: number;
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
  getList(instanceId: string, params?: ListParams): Promise<PaginatedResult<Channel>>;
  getById(instanceId: string, id: string): Promise<Channel | null>;
  create(instanceId: string, data: CreateChannelDTO): Promise<Channel>;
  update(id: string, data: UpdateChannelDTO): Promise<Channel>;
  delete(id: string): Promise<boolean>;
  getChannels(instanceId: string): Promise<Channel[]>;
  updateChannelStatus(instanceId: string, channelId: string, enabled: boolean): Promise<Channel[]>;
  saveChannelConfig(instanceId: string, channelId: string, configData: Record<string, string>): Promise<Channel[]>;
  deleteChannelConfig(instanceId: string, channelId: string): Promise<Channel[]>;
}

const channelIconNameMap: Record<string, string> = {
  sdkworkchat: 'MessageSquare',
  wehcat: 'Send',
  feishu: 'MessageCircle',
  qq: 'Smile',
  dingtalk: 'Zap',
  wecom: 'Building2',
  telegram: 'Send',
  discord: 'MessageSquare',
  slack: 'Hash',
  googlechat: 'Webhook',
};

const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'MessageCircle':
      return React.createElement(MessageCircle, { className: 'h-6 w-6 text-[#00D1B2]' });
    case 'Smile':
      return React.createElement(Smile, { className: 'h-6 w-6 text-[#12B7F5]' });
    case 'Zap':
      return React.createElement(Zap, { className: 'h-6 w-6 text-[#008CEE]' });
    case 'Building2':
      return React.createElement(Building2, { className: 'h-6 w-6 text-[#2B82E4]' });
    case 'Send':
      return React.createElement(Send, { className: 'h-6 w-6 text-[#229ED9]' });
    case 'MessageSquare':
      return React.createElement(MessageSquare, { className: 'h-6 w-6 text-[#5865F2]' });
    case 'Hash':
      return React.createElement(Hash, { className: 'h-6 w-6 text-[#E01E5A]' });
    case 'Webhook':
      return React.createElement(Webhook, { className: 'h-6 w-6 text-primary-500' });
    default:
      return React.createElement(MessageCircle, { className: 'h-6 w-6 text-gray-500' });
  }
};

function resolveChannelIcon(channelId: string, iconName?: string) {
  return getIconComponent(iconName || channelIconNameMap[channelId] || 'MessageCircle');
}

type OpenClawChannelSnapshot = Awaited<
  ReturnType<typeof openClawConfigService.readConfigSnapshot>
>['channelSnapshots'][number];

type MockChannelRecord = Awaited<ReturnType<typeof studioMockService.listChannels>>[number];

class ChannelService implements IChannelService {
  private async resolveManagedConfigPath(instanceId: string) {
    const detail = await studio.getInstanceDetail(instanceId);
    return openClawConfigService.resolveInstanceConfigPath(detail);
  }

  private mapManagedChannel(channel: OpenClawChannelSnapshot): Channel {
    return {
      id: channel.id,
      name: channel.name,
      description: channel.description,
      icon: resolveChannelIcon(channel.id),
      status: channel.status,
      enabled: channel.enabled,
      configurationMode: channel.configurationMode,
      fieldCount: channel.fieldCount,
      configuredFieldCount: channel.configuredFieldCount,
      setupGuide: [...channel.setupSteps],
      fields: channel.fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.sensitive
          ? 'password'
          : field.inputMode === 'numeric'
            ? 'number'
            : field.inputMode === 'url'
              ? 'url'
              : 'text',
        placeholder: field.placeholder,
        value: channel.values[field.key],
        helpText: field.helpText,
        required: field.required,
        multiline: field.multiline,
        sensitive: field.sensitive,
        inputMode: field.inputMode,
      })),
    };
  }

  private mapMockChannel(channel: MockChannelRecord): Channel {
    const configuredFieldCount = channel.fields.filter((field) => Boolean(field.value?.trim())).length;

    return {
      ...channel,
      icon: resolveChannelIcon(channel.id, channel.icon),
      configurationMode: channel.configurationMode || 'required',
      fieldCount: channel.fields.length,
      configuredFieldCount,
    };
  }

  async getList(instanceId: string, params: ListParams = {}): Promise<PaginatedResult<Channel>> {
    const channels = await this.getChannels(instanceId);

    let filtered = channels;
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(
        (channel) =>
          channel.name.toLowerCase().includes(lowerKeyword) ||
          channel.description.toLowerCase().includes(lowerKeyword),
      );
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  }

  async getById(instanceId: string, id: string): Promise<Channel | null> {
    const channels = await this.getChannels(instanceId);
    return channels.find((channel) => channel.id === id) || null;
  }

  async create(_instanceId: string, _data: CreateChannelDTO): Promise<Channel> {
    throw new Error('Method not implemented.');
  }

  async update(_id: string, _data: UpdateChannelDTO): Promise<Channel> {
    throw new Error('Method not implemented.');
  }

  async delete(_id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  async getChannels(instanceId: string): Promise<Channel[]> {
    const configPath = await this.resolveManagedConfigPath(instanceId);
    if (configPath) {
      const snapshot = await openClawConfigService.readConfigSnapshot(configPath);
      return snapshot.channelSnapshots.map((channel) => this.mapManagedChannel(channel));
    }

    const channels = await studioMockService.listChannels(instanceId);
    return channels.map((channel) => this.mapMockChannel(channel));
  }

  async updateChannelStatus(
    instanceId: string,
    channelId: string,
    enabled: boolean,
  ): Promise<Channel[]> {
    const configPath = await this.resolveManagedConfigPath(instanceId);
    if (configPath) {
      await openClawConfigService.setChannelEnabled({
        configPath,
        channelId,
        enabled,
      });
      return this.getChannels(instanceId);
    }

    const updated = await studioMockService.updateChannelStatus(channelId, enabled);
    if (!updated) {
      throw new Error('Failed to update channel status');
    }
    return this.getChannels(instanceId);
  }

  async saveChannelConfig(
    instanceId: string,
    channelId: string,
    configData: Record<string, string>,
  ): Promise<Channel[]> {
    const configPath = await this.resolveManagedConfigPath(instanceId);
    if (configPath) {
      await openClawConfigService.saveChannelConfiguration({
        configPath,
        channelId,
        values: configData,
        enabled: true,
      });
      return this.getChannels(instanceId);
    }

    const updated = await studioMockService.saveChannelConfig(channelId, configData);
    if (!updated) {
      throw new Error('Failed to save channel config');
    }
    return this.getChannels(instanceId);
  }

  async deleteChannelConfig(instanceId: string, channelId: string): Promise<Channel[]> {
    const configPath = await this.resolveManagedConfigPath(instanceId);
    if (configPath) {
      await openClawConfigService.saveChannelConfiguration({
        configPath,
        channelId,
        values: {},
        enabled: false,
      });
      return this.getChannels(instanceId);
    }

    const updated = await studioMockService.deleteChannelConfig(channelId);
    if (!updated) {
      throw new Error('Failed to delete channel config');
    }
    return this.getChannels(instanceId);
  }
}

export const channelService = new ChannelService();
