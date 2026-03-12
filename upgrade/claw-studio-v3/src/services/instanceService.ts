import React from 'react';
import { Apple, Box, Server } from 'lucide-react';
import { ListParams, PaginatedResult } from '../types/service';

export interface Instance {
  id: string;
  name: string;
  type: string;
  iconType: 'apple' | 'box' | 'server';
  status: 'online' | 'offline' | 'starting' | 'error';
  version: string;
  uptime: string;
  ip: string;
  cpu: number;
  memory: number;
  totalMemory: string;
}

export interface InstanceConfig {
  port: string;
  sandbox: boolean;
  autoUpdate: boolean;
  logLevel: string;
  corsOrigins: string;
}

export interface CreateInstanceDTO {
  name: string;
  type: string;
  iconType: 'apple' | 'box' | 'server';
}

export interface UpdateInstanceDTO extends Partial<CreateInstanceDTO> {
  status?: 'online' | 'offline' | 'starting' | 'error';
}

export interface IInstanceService {
  getList(params?: ListParams): Promise<PaginatedResult<Instance>>;
  getById(id: string): Promise<Instance | null>;
  create(data: CreateInstanceDTO): Promise<Instance>;
  update(id: string, data: UpdateInstanceDTO): Promise<Instance>;
  delete(id: string): Promise<boolean>;
  
  // Legacy methods
  getInstances(): Promise<Instance[]>;
  getInstanceById(id: string): Promise<Instance | undefined>;
  startInstance(id: string): Promise<void>;
  stopInstance(id: string): Promise<void>;
  restartInstance(id: string): Promise<void>;
  getInstanceConfig(id: string): Promise<InstanceConfig | undefined>;
  updateInstanceConfig(id: string, config: InstanceConfig): Promise<void>;
  getInstanceToken(id: string): Promise<string | undefined>;
  deleteInstance(id: string): Promise<void>;
  getInstanceLogs(id: string): Promise<string>;
}

const BUILT_IN_INSTANCE: Instance = {
  id: 'builtin-instance',
  name: 'Built-in Instance',
  type: 'local',
  iconType: 'box',
  status: 'online',
  version: '1.0.0',
  uptime: '99.9%',
  ip: 'localhost',
  cpu: 5,
  memory: 128,
  totalMemory: '1024MB',
};

class InstanceService implements IInstanceService {
  async getInstanceLogs(id: string): Promise<string> {
    // Simulate fetching logs
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`[2023-10-27 14:32:01] INFO Starting OpenClaw Daemon v0.2.1...
[2023-10-27 14:32:01] INFO Loading configuration from ~/.openclaw/config.json
[2023-10-27 14:32:02] INFO Initializing Sandbox environment...
[2023-10-27 14:32:03] SUCCESS Sandbox initialized successfully.
[2023-10-27 14:32:03] INFO Starting HTTP server on port 18789...
[2023-10-27 14:32:03] SUCCESS Server listening on http://127.0.0.1:18789
[2023-10-27 14:35:12] INFO Incoming connection from 127.0.0.1
[2023-10-27 14:35:12] INFO Authenticated client successfully.
[2023-10-27 14:40:05] WARN Skill 'weather-fetcher' took longer than 500ms to respond.
[2023-10-27 15:01:22] INFO Syncing device state...
[2023-10-27 15:01:23] SUCCESS State synced.`);
      }, 500);
    });
  }

  async getList(params: ListParams = {}): Promise<PaginatedResult<Instance>> {
    const instances = await this.getInstances();
    
    let filtered = instances;
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(i => 
        i.name.toLowerCase().includes(lowerKeyword) || 
        i.type.toLowerCase().includes(lowerKeyword)
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

  async getById(id: string): Promise<Instance | null> {
    const instance = await this.getInstanceById(id);
    return instance || null;
  }

  async create(data: CreateInstanceDTO): Promise<Instance> {
    throw new Error('Method not implemented.');
  }

  async update(id: string, data: UpdateInstanceDTO): Promise<Instance> {
    throw new Error('Method not implemented.');
  }

  async delete(id: string): Promise<boolean> {
    await this.deleteInstance(id);
    return true;
  }

  // Legacy methods
  async getInstances(): Promise<Instance[]> {
    try {
      const res = await fetch('/api/instances');
      if (!res.ok) throw new Error('Failed to fetch instances');
      const data = await res.json();
      if (data.length === 0) {
        return [BUILT_IN_INSTANCE];
      }
      return data;
    } catch (error) {
      console.warn('Using built-in instance due to fetch error:', error);
      return [BUILT_IN_INSTANCE];
    }
  }
  
  async getInstanceById(id: string): Promise<Instance | undefined> {
    if (id === BUILT_IN_INSTANCE.id) return BUILT_IN_INSTANCE;
    try {
      const res = await fetch(`/api/instances/${id}`);
      if (!res.ok) {
        if (res.status === 404) return undefined;
        throw new Error('Failed to fetch instance');
      }
      return res.json();
    } catch (error) {
      return undefined;
    }
  }

  async startInstance(id: string): Promise<void> {
    const res = await fetch(`/api/instances/${id}/start`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to start instance');
  }

  async stopInstance(id: string): Promise<void> {
    const res = await fetch(`/api/instances/${id}/stop`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to stop instance');
  }

  async restartInstance(id: string): Promise<void> {
    const res = await fetch(`/api/instances/${id}/restart`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to restart instance');
  }

  async getInstanceConfig(id: string): Promise<InstanceConfig | undefined> {
    const res = await fetch(`/api/instances/${id}/config`);
    if (!res.ok) {
      if (res.status === 404) return undefined;
      throw new Error('Failed to fetch instance config');
    }
    return res.json();
  }

  async updateInstanceConfig(id: string, config: InstanceConfig): Promise<void> {
    const res = await fetch(`/api/instances/${id}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Failed to update instance config');
  }

  async getInstanceToken(id: string): Promise<string | undefined> {
    const res = await fetch(`/api/instances/${id}/token`);
    if (!res.ok) {
      if (res.status === 404) return undefined;
      throw new Error('Failed to fetch instance token');
    }
    const data = await res.json();
    return data.token;
  }

  async deleteInstance(id: string): Promise<void> {
    if (id === BUILT_IN_INSTANCE.id) {
      throw new Error('Cannot delete built-in instance');
    }
    const res = await fetch(`/api/instances/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete instance');
  }
}

export const instanceService = new InstanceService();
