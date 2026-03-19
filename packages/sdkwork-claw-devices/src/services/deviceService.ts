import { studioMockService } from '@sdkwork/claw-infrastructure';
import { type Device, type InstalledSkill, type ListParams, type PaginatedResult } from '@sdkwork/claw-types';

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
      filtered = filtered.filter((device) => device.name.toLowerCase().includes(lowerKeyword));
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

  async getById(id: string): Promise<Device | null> {
    const devices = await this.getDevices();
    return devices.find((device) => device.id === id) || null;
  }

  async create(data: CreateDeviceDTO): Promise<Device> {
    return this.registerDevice(data.name);
  }

  async update(_id: string, _data: UpdateDeviceDTO): Promise<Device> {
    throw new Error('Method not implemented.');
  }

  async delete(id: string): Promise<boolean> {
    await this.deleteDevice(id);
    return true;
  }

  async getDevices(): Promise<Device[]> {
    return studioMockService.listDevices();
  }

  async registerDevice(name: string): Promise<Device> {
    return studioMockService.createDevice(name);
  }

  async deleteDevice(id: string): Promise<void> {
    const deleted = await studioMockService.deleteDevice(id);
    if (!deleted) {
      throw new Error('Failed to delete device');
    }
  }

  async getDeviceSkills(deviceId: string): Promise<InstalledSkill[]> {
    return studioMockService.listDeviceInstalledSkills(deviceId);
  }

  async uninstallSkill(deviceId: string, skillId: string): Promise<void> {
    const result = await studioMockService.uninstallSkill(deviceId, skillId);
    if (!result.success) {
      throw new Error('Failed to uninstall skill');
    }
  }
}

export const deviceService = new DeviceService();
