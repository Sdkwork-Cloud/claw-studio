import { Device, InstalledSkill } from '../types';
import { ListParams, PaginatedResult } from '../types/service';

export interface CreateDeviceDTO {
  name: string;
}

export interface UpdateDeviceDTO extends Partial<CreateDeviceDTO> {}

export interface IDeviceService {
  getList(params?: ListParams): Promise<PaginatedResult<Device>>;
  getById(id: string): Promise<Device | null>;
  create(data: CreateDeviceDTO): Promise<Device>;
  update(id: string, data: UpdateDeviceDTO): Promise<Device>;
  delete(id: string): Promise<boolean>;
  
  // Legacy methods
  getDevices(): Promise<Device[]>;
  registerDevice(name: string): Promise<Device>;
  deleteDevice(id: string): Promise<void>;
  getDeviceSkills(deviceId: string): Promise<InstalledSkill[]>;
  uninstallSkill(deviceId: string, skillId: string): Promise<void>;
}

class DeviceService implements IDeviceService {
  async getList(params: ListParams = {}): Promise<PaginatedResult<Device>> {
    const devices = await this.getDevices();
    
    let filtered = devices;
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(d => d.name.toLowerCase().includes(lowerKeyword));
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

  async getById(id: string): Promise<Device | null> {
    const devices = await this.getDevices();
    return devices.find(d => d.id === id) || null;
  }

  async create(data: CreateDeviceDTO): Promise<Device> {
    return this.registerDevice(data.name);
  }

  async update(id: string, data: UpdateDeviceDTO): Promise<Device> {
    throw new Error('Method not implemented.');
  }

  async delete(id: string): Promise<boolean> {
    await this.deleteDevice(id);
    return true;
  }

  // Legacy methods
  async getDevices(): Promise<Device[]> {
    const res = await fetch('/api/devices');
    if (!res.ok) throw new Error('Failed to fetch devices');
    return res.json();
  }

  async registerDevice(name: string): Promise<Device> {
    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('Failed to register device');
    return res.json();
  }

  async deleteDevice(id: string): Promise<void> {
    const res = await fetch(`/api/devices/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete device');
    return res.json();
  }

  async getDeviceSkills(deviceId: string): Promise<InstalledSkill[]> {
    const res = await fetch(`/api/devices/${deviceId}/skills`);
    if (!res.ok) throw new Error('Failed to fetch device skills');
    return res.json();
  }

  async uninstallSkill(deviceId: string, skillId: string): Promise<void> {
    const res = await fetch('/api/installations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, skill_id: skillId })
    });
    if (!res.ok) throw new Error('Failed to uninstall skill');
    return res.json();
  }
}

export const deviceService = new DeviceService();
