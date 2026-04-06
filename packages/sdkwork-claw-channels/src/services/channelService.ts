import React from 'react';
import { openClawConfigService } from '@sdkwork/claw-core';
import { getPlatformBridge } from '@sdkwork/claw-infrastructure';
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
import type {
  ListParams,
  PaginatedResult,
  StudioInstanceDetailRecord,
} from '@sdkwork/claw-types';

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

interface WorkbenchChannelWriteBridge {
  setInstanceChannelEnabled?: (
    instanceId: string,
    channelId: string,
    enabled: boolean,
  ) => Promise<boolean>;
  saveInstanceChannelConfig?: (
    instanceId: string,
    channelId: string,
    values: Record<string, string>,
  ) => Promise<boolean>;
  deleteInstanceChannelConfig?: (instanceId: string, channelId: string) => Promise<boolean>;
}

type OpenClawChannelDefinition = ReturnType<typeof openClawConfigService.getChannelDefinitions>[number];
type WorkbenchChannelRecord = NonNullable<StudioInstanceDetailRecord['workbench']>['channels'][number] & {
  values?: Record<string, string>;
};

const CHANNEL_WRITE_UNAVAILABLE_ERROR =
  'Channel configuration is not writable for this instance.';

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

function normalizeChannelValues(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, candidate]) => typeof candidate === 'string')
      .map(([key, candidate]) => [key, candidate as string]),
  );
}

function countConfiguredValues(values: Record<string, string>) {
  return Object.values(values).filter((value) => value.trim().length > 0).length;
}

function mapField(
  field: OpenClawChannelDefinition['fields'][number],
  values: Record<string, string>,
): ChannelField {
  return {
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
    value: values[field.key],
    helpText: field.helpText,
    required: field.required,
    multiline: field.multiline,
    sensitive: field.sensitive,
    inputMode: field.inputMode,
  };
}

function mapManagedChannel(
  channel: Awaited<ReturnType<typeof openClawConfigService.readConfigSnapshot>>['channelSnapshots'][number],
): Channel {
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
    fields: channel.fields.map((field) => mapField(field, channel.values)),
  };
}

function mapWorkbenchChannel(
  definition: OpenClawChannelDefinition,
  current?: WorkbenchChannelRecord,
): Channel {
  const values = normalizeChannelValues(current?.values);
  const configuredFieldCount =
    typeof current?.configuredFieldCount === 'number'
      ? current.configuredFieldCount
      : countConfiguredValues(values);
  const configurationMode =
    current?.configurationMode || definition.configurationMode || 'required';
  const enabled =
    typeof current?.enabled === 'boolean' ? current.enabled : configurationMode === 'none';
  const status =
    current?.status ||
    (configurationMode === 'none'
      ? enabled
        ? 'connected'
        : 'disconnected'
      : configuredFieldCount > 0
        ? enabled
          ? 'connected'
          : 'disconnected'
        : 'not_configured');

  return {
    id: definition.id,
    name: current?.name || definition.name,
    description: current?.description || definition.description,
    icon: resolveChannelIcon(definition.id),
    status,
    enabled,
    configurationMode,
    fieldCount: definition.fields.length,
    configuredFieldCount,
    setupGuide:
      current?.setupSteps && current.setupSteps.length > 0
        ? [...current.setupSteps]
        : [...definition.setupSteps],
    fields: definition.fields.map((field) => mapField(field, values)),
  };
}

function mapUnknownWorkbenchChannel(current: WorkbenchChannelRecord): Channel {
  const values = normalizeChannelValues(current.values);

  return {
    id: current.id,
    name: current.name,
    description: current.description,
    icon: resolveChannelIcon(current.id),
    status: current.status,
    enabled: current.enabled,
    configurationMode: current.configurationMode || 'required',
    fieldCount: current.fieldCount,
    configuredFieldCount:
      typeof current.configuredFieldCount === 'number'
        ? current.configuredFieldCount
        : countConfiguredValues(values),
    setupGuide: [...current.setupSteps],
    fields: [],
  };
}

class ChannelService implements IChannelService {
  private getStudioApi() {
    return getPlatformBridge().studio as ReturnType<typeof getPlatformBridge>['studio'] &
      WorkbenchChannelWriteBridge;
  }

  private async getInstanceDetail(instanceId: string) {
    return this.getStudioApi().getInstanceDetail(instanceId);
  }

  private resolveManagedConfigPath(detail: StudioInstanceDetailRecord | null | undefined) {
    return openClawConfigService.resolveInstanceConfigPath(detail);
  }

  private mapWorkbenchChannels(detail: StudioInstanceDetailRecord): Channel[] {
    const definitions = openClawConfigService.getChannelDefinitions();
    const definitionById = new Map(definitions.map((definition) => [definition.id, definition] as const));
    const workbenchChannels = detail.workbench?.channels || [];
    const workbenchById = new Map(
      workbenchChannels.map((channel) => [channel.id, channel as WorkbenchChannelRecord] as const),
    );

    const orderedIds = Array.from(
      new Set([
        ...definitions.map((definition) => definition.id),
        ...workbenchChannels.map((channel) => channel.id),
      ]),
    );

    return orderedIds.map((channelId) => {
      const definition = definitionById.get(channelId);
      const workbenchChannel = workbenchById.get(channelId);

      if (definition) {
        return mapWorkbenchChannel(definition, workbenchChannel);
      }

      if (!workbenchChannel) {
        throw new Error(`Missing workbench channel mapping for "${channelId}"`);
      }

      return mapUnknownWorkbenchChannel(workbenchChannel);
    });
  }

  private requireWorkbenchBridge() {
    const studioApi = this.getStudioApi();
    if (
      typeof studioApi.setInstanceChannelEnabled !== 'function' ||
      typeof studioApi.saveInstanceChannelConfig !== 'function' ||
      typeof studioApi.deleteInstanceChannelConfig !== 'function'
    ) {
      throw new Error(CHANNEL_WRITE_UNAVAILABLE_ERROR);
    }

    return studioApi;
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
    const detail = await this.getInstanceDetail(instanceId);
    const configPath = this.resolveManagedConfigPath(detail);
    if (configPath) {
      const snapshot = await openClawConfigService.readConfigSnapshot(configPath);
      return snapshot.channelSnapshots.map((channel) => mapManagedChannel(channel));
    }

    if (detail?.workbench) {
      return this.mapWorkbenchChannels(detail);
    }

    return [];
  }

  async updateChannelStatus(
    instanceId: string,
    channelId: string,
    enabled: boolean,
  ): Promise<Channel[]> {
    const detail = await this.getInstanceDetail(instanceId);
    const configPath = this.resolveManagedConfigPath(detail);
    if (configPath) {
      await openClawConfigService.setChannelEnabled({
        configPath,
        channelId,
        enabled,
      });
      return this.getChannels(instanceId);
    }

    if (detail?.workbench) {
      const bridge = this.requireWorkbenchBridge();
      const updated = await bridge.setInstanceChannelEnabled!(instanceId, channelId, enabled);
      if (!updated) {
        throw new Error('Failed to update channel status');
      }
      return this.getChannels(instanceId);
    }

    throw new Error(CHANNEL_WRITE_UNAVAILABLE_ERROR);
  }

  async saveChannelConfig(
    instanceId: string,
    channelId: string,
    configData: Record<string, string>,
  ): Promise<Channel[]> {
    const detail = await this.getInstanceDetail(instanceId);
    const configPath = this.resolveManagedConfigPath(detail);
    if (configPath) {
      await openClawConfigService.saveChannelConfiguration({
        configPath,
        channelId,
        values: configData,
        enabled: true,
      });
      return this.getChannels(instanceId);
    }

    if (detail?.workbench) {
      const bridge = this.requireWorkbenchBridge();
      const updated = await bridge.saveInstanceChannelConfig!(
        instanceId,
        channelId,
        configData,
      );
      if (!updated) {
        throw new Error('Failed to save channel config');
      }
      return this.getChannels(instanceId);
    }

    throw new Error(CHANNEL_WRITE_UNAVAILABLE_ERROR);
  }

  async deleteChannelConfig(instanceId: string, channelId: string): Promise<Channel[]> {
    const detail = await this.getInstanceDetail(instanceId);
    const configPath = this.resolveManagedConfigPath(detail);
    if (configPath) {
      await openClawConfigService.saveChannelConfiguration({
        configPath,
        channelId,
        values: {},
        enabled: false,
      });
      return this.getChannels(instanceId);
    }

    if (detail?.workbench) {
      const bridge = this.requireWorkbenchBridge();
      const updated = await bridge.deleteInstanceChannelConfig!(instanceId, channelId);
      if (!updated) {
        throw new Error('Failed to delete channel config');
      }
      return this.getChannels(instanceId);
    }

    throw new Error(CHANNEL_WRITE_UNAVAILABLE_ERROR);
  }
}

export const channelService = new ChannelService();
