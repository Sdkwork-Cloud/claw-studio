import React from 'react';
import { studioMockService } from '@sdkwork/claw-infrastructure';
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
  type: string;
  placeholder: string;
  value?: string;
  helpText?: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  icon: string | React.ReactNode;
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
  getList(instanceId: string, params?: ListParams): Promise<PaginatedResult<Channel>>;
  getById(instanceId: string, id: string): Promise<Channel | null>;
  create(instanceId: string, data: CreateChannelDTO): Promise<Channel>;
  update(id: string, data: UpdateChannelDTO): Promise<Channel>;
  delete(id: string): Promise<boolean>;

  // Legacy methods
  getChannels(instanceId: string): Promise<Channel[]>;
  updateChannelStatus(instanceId: string, channelId: string, enabled: boolean): Promise<Channel[]>;
  saveChannelConfig(instanceId: string, channelId: string, configData: Record<string, string>): Promise<Channel[]>;
  deleteChannelConfig(instanceId: string, channelId: string): Promise<Channel[]>;
}

const getIconComponent = (iconName: string) => {
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
};

class ChannelService implements IChannelService {
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
    const channels = await studioMockService.listChannels(instanceId);
    return channels.map((channel) => ({
      ...channel,
      icon: getIconComponent(channel.icon),
    }));
  }

  async updateChannelStatus(
    instanceId: string,
    channelId: string,
    enabled: boolean,
  ): Promise<Channel[]> {
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
    const updated = await studioMockService.saveChannelConfig(channelId, configData);
    if (!updated) {
      throw new Error('Failed to save channel config');
    }
    return this.getChannels(instanceId);
  }

  async deleteChannelConfig(instanceId: string, channelId: string): Promise<Channel[]> {
    const updated = await studioMockService.deleteChannelConfig(channelId);
    if (!updated) {
      throw new Error('Failed to delete channel config');
    }
    return this.getChannels(instanceId);
  }
}

export const channelService = new ChannelService();
