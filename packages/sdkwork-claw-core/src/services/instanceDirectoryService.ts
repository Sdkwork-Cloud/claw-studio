import { studio } from '@sdkwork/claw-infrastructure';

export interface InstanceDirectoryItem {
  id: string;
  name: string;
  ip: string;
  status: 'online' | 'offline' | 'starting' | 'error';
  iconType?: 'apple' | 'box' | 'server';
}

class InstanceDirectoryService {
  async listInstances(): Promise<InstanceDirectoryItem[]> {
    const instances = await studio.listInstances();
    return instances.map(({ id, name, host, status, iconType }) => {
      const normalizedStatus: InstanceDirectoryItem['status'] =
        status === 'syncing' ? 'starting' : status;

      return {
        id,
        name,
        ip: host,
        status: normalizedStatus,
        iconType,
      };
    });
  }
}

export const instanceDirectoryService = new InstanceDirectoryService();
