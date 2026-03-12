import type { Device, InstalledSkill } from '@sdkwork/claw-studio-domain';

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
  getDevices(): Promise<Device[]>;
  registerDevice(name: string): Promise<Device>;
  deleteDevice(id: string): Promise<void>;
  getDeviceSkills(deviceId: string): Promise<InstalledSkill[]>;
  uninstallSkill(deviceId: string, skillId: string): Promise<void>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const devicesData: Device[] = [];
const skillsByDevice = new Map<string, InstalledSkill[]>();

function cloneDevice(device: Device): Device {
  return {
    ...device,
    hardwareSpecs: device.hardwareSpecs ? { ...device.hardwareSpecs } : undefined,
  };
}

function cloneInstalledSkill(skill: InstalledSkill): InstalledSkill {
  return { ...skill };
}

function randomDeviceId() {
  return `claw-${Math.random().toString(36).slice(2, 8)}`;
}

class DeviceService implements IDeviceService {
  async getList(params: ListParams = {}): Promise<PaginatedResult<Device>> {
    const devices = await this.getDevices();
    let items = devices;

    if (params.keyword) {
      const keyword = params.keyword.toLowerCase();
      items = items.filter((device) => device.name.toLowerCase().includes(keyword));
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

  async getById(id: string): Promise<Device | null> {
    return (await this.getDevices()).find((device) => device.id === id) ?? null;
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

  async getDevices(): Promise<Device[]> {
    await delay(50);
    return devicesData.map(cloneDevice);
  }

  async registerDevice(name: string): Promise<Device> {
    await delay(50);
    const device: Device = {
      id: randomDeviceId(),
      name,
      ip_address: `192.168.1.${Math.floor(Math.random() * 200) + 20}`,
      battery: Math.floor(Math.random() * 40) + 60,
      status: 'online',
      created_at: new Date().toISOString(),
    };

    devicesData.unshift(device);
    skillsByDevice.set(device.id, []);
    return cloneDevice(device);
  }

  async deleteDevice(id: string): Promise<void> {
    await delay(50);
    const index = devicesData.findIndex((device) => device.id === id);
    if (index >= 0) {
      devicesData.splice(index, 1);
    }
    skillsByDevice.delete(id);
  }

  async getDeviceSkills(deviceId: string): Promise<InstalledSkill[]> {
    await delay(50);
    return (skillsByDevice.get(deviceId) ?? []).map(cloneInstalledSkill);
  }

  async uninstallSkill(deviceId: string, skillId: string): Promise<void> {
    await delay(50);
    const skills = skillsByDevice.get(deviceId) ?? [];
    skillsByDevice.set(
      deviceId,
      skills.filter((skill) => skill.id !== skillId),
    );
  }
}

export const deviceService = new DeviceService();

