import { studioMockService } from '@sdkwork/claw-infrastructure';

export interface InstanceDirectoryItem {
  id: string;
  name: string;
  ip: string;
  status: 'online' | 'offline' | 'starting' | 'error';
  iconType?: 'apple' | 'box' | 'server';
}

class InstanceDirectoryService {
  async listInstances(): Promise<InstanceDirectoryItem[]> {
    const instances = await studioMockService.listInstances();
    return instances.map(({ id, name, ip, status, iconType }) => ({
      id,
      name,
      ip,
      status,
      iconType,
    }));
  }
}

export const instanceDirectoryService = new InstanceDirectoryService();
