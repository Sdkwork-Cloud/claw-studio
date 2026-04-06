import { studio } from '@sdkwork/claw-infrastructure';

export interface InstanceDirectoryItem {
  id: string;
  name: string;
  ip: string;
  status: 'online' | 'offline' | 'starting' | 'error';
  iconType?: 'apple' | 'box' | 'server';
}

type StudioDirectoryInstance = Awaited<ReturnType<typeof studio.listInstances>>[number];

interface InstanceDirectoryServiceDependencies {
  loadInstances?: () => Promise<StudioDirectoryInstance[]>;
  now?: () => number;
  cacheTtlMs?: number;
}

interface InstanceDirectoryCacheEntry {
  expiresAt: number;
  value: InstanceDirectoryItem[];
}

function mapDirectoryInstances(
  instances: StudioDirectoryInstance[],
): InstanceDirectoryItem[] {
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

class InstanceDirectoryService {
  private readonly loadInstancesFromSource: () => Promise<StudioDirectoryInstance[]>;

  private readonly now: () => number;

  private readonly cacheTtlMs: number;

  private cache: InstanceDirectoryCacheEntry | null = null;

  private pending: Promise<InstanceDirectoryItem[]> | null = null;

  constructor({
    loadInstances = () => studio.listInstances(),
    now = () => Date.now(),
    cacheTtlMs = 1_500,
  }: InstanceDirectoryServiceDependencies = {}) {
    this.loadInstancesFromSource = loadInstances;
    this.now = now;
    this.cacheTtlMs = cacheTtlMs;
  }

  async listInstances(): Promise<InstanceDirectoryItem[]> {
    const now = this.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.value;
    }

    if (this.pending) {
      return this.pending;
    }

    this.pending = this.loadInstancesFromSource()
      .then((instances) => mapDirectoryInstances(instances))
      .then((instances) => {
        this.cache = {
          expiresAt: this.now() + this.cacheTtlMs,
          value: instances,
        };
        return instances;
      })
      .finally(() => {
        this.pending = null;
      });

    return this.pending;
  }

  invalidate() {
    this.cache = null;
  }
}

export function createInstanceDirectoryService(
  dependencies?: InstanceDirectoryServiceDependencies,
) {
  return new InstanceDirectoryService(dependencies);
}

export const instanceDirectoryService = createInstanceDirectoryService();
