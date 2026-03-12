import { MessageSquare, Send, Hash, Webhook, Smile, MessageCircle, Zap, Building2 } from 'lucide-react';
import React from 'react';
import { ListParams, PaginatedResult } from '../types/service';

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
  getList(params?: ListParams): Promise<PaginatedResult<Channel>>;
  getById(id: string): Promise<Channel | null>;
  create(data: CreateChannelDTO): Promise<Channel>;
  update(id: string, data: UpdateChannelDTO): Promise<Channel>;
  delete(id: string): Promise<boolean>;
  
  // Legacy methods
  getChannels(): Promise<Channel[]>;
  updateChannelStatus(channelId: string, enabled: boolean): Promise<Channel[]>;
  saveChannelConfig(channelId: string, configData: Record<string, string>): Promise<Channel[]>;
  deleteChannelConfig(channelId: string): Promise<Channel[]>;
}

const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'MessageCircle': return React.createElement(MessageCircle, { className: "w-6 h-6 text-[#00D1B2]" });
    case 'Smile': return React.createElement(Smile, { className: "w-6 h-6 text-[#12B7F5]" });
    case 'Zap': return React.createElement(Zap, { className: "w-6 h-6 text-[#008CEE]" });
    case 'Building2': return React.createElement(Building2, { className: "w-6 h-6 text-[#2B82E4]" });
    case 'Send': return React.createElement(Send, { className: "w-6 h-6 text-[#229ED9]" });
    case 'MessageSquare': return React.createElement(MessageSquare, { className: "w-6 h-6 text-[#5865F2]" });
    case 'Hash': return React.createElement(Hash, { className: "w-6 h-6 text-[#E01E5A]" });
    case 'Webhook': return React.createElement(Webhook, { className: "w-6 h-6 text-primary-500" });
    default: return React.createElement(MessageCircle, { className: "w-6 h-6 text-gray-500" });
  }
};

class ChannelService implements IChannelService {
  async getList(params: ListParams = {}): Promise<PaginatedResult<Channel>> {
    const channels = await this.getChannels();
    
    let filtered = channels;
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(lowerKeyword) || 
        c.description.toLowerCase().includes(lowerKeyword)
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
      hasMore: start + pageSize < total
    };
  }

  async getById(id: string): Promise<Channel | null> {
    const channels = await this.getChannels();
    return channels.find(c => c.id === id) || null;
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

  // Legacy methods
  async getChannels(): Promise<Channel[]> {
    const res = await fetch(`/api/channels`);
    if (!res.ok) throw new Error('Failed to fetch channels');
    const channels = await res.json();
    return channels.map((c: any) => ({
      ...c,
      icon: getIconComponent(c.icon)
    }));
  }

  async updateChannelStatus(channelId: string, enabled: boolean): Promise<Channel[]> {
    const res = await fetch(`/api/channels/${channelId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    if (!res.ok) throw new Error('Failed to update channel status');
    return this.getChannels();
  }

  async saveChannelConfig(channelId: string, configData: Record<string, string>): Promise<Channel[]> {
    const res = await fetch(`/api/channels/${channelId}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData)
    });
    if (!res.ok) throw new Error('Failed to save channel config');
    return this.getChannels();
  }

  async deleteChannelConfig(channelId: string): Promise<Channel[]> {
    const res = await fetch(`/api/channels/${channelId}/config`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete channel config');
    return this.getChannels();
  }
}

export const channelService = new ChannelService();
