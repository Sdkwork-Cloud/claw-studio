import { studio } from '@sdkwork/claw-infrastructure';
import type { StudioInstanceRecord } from '@sdkwork/claw-types';

export interface InstanceDirectoryItem {
  id: string;
  name: string;
  ip: string;
  status: 'online' | 'offline' | 'starting' | 'error';
  iconType?: 'apple' | 'box' | 'server';
}

interface InstanceDirectoryServiceDependencies {
  listInstances(): Promise<StudioInstanceRecord[]>;
  now?: () => number;
  cacheTtlMs?: number;
}

const DEFAULT_INSTANCE_DIRECTORY_CACHE_TTL_MS = 1_000;

class InstanceDirectoryService {
  private readonly listInstancesFromStudio: () => Promise<StudioInstanceRecord[]>;

  private readonly now: () => number;

  private readonly cacheTtlMs: number;

  private cachedInstances: InstanceDirectoryItem[] | null = null;

  private cachedAtMs = 0;

  private inflightRequest: Promise<InstanceDirectoryItem[]> | null = null;

  constructor({
    listInstances,
    now = () => Date.now(),
    cacheTtlMs = DEFAULT_INSTANCE_DIRECTORY_CACHE_TTL_MS,
  }: InstanceDirectoryServiceDependencies) {
    this.listInstancesFromStudio = listInstances;
    this.now = now;
    this.cacheTtlMs = cacheTtlMs;
  }

  async listInstances(options: { force?: boolean } = {}): Promise<InstanceDirectoryItem[]> {
    const currentTimeMs = this.now();
    if (
      !options.force &&
      this.cachedInstances &&
      currentTimeMs - this.cachedAtMs < this.cacheTtlMs
    ) {
      return this.cachedInstances;
    }

    if (!options.force && this.inflightRequest) {
      return this.inflightRequest;
    }

    const request = this.listInstancesFromStudio().then((instances) => {
      const mappedInstances = instances.map(({ id, name, host, status, iconType }) => {
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

      this.cachedInstances = mappedInstances;
      this.cachedAtMs = this.now();
      return mappedInstances;
    });

    const inflightRequest = request.finally(() => {
      if (this.inflightRequest === inflightRequest) {
        this.inflightRequest = null;
      }
    });
    this.inflightRequest = inflightRequest;

    return request;
  }

  invalidate() {
    this.cachedInstances = null;
    this.cachedAtMs = 0;
  }
}

export function createInstanceDirectoryService(
  dependencies: InstanceDirectoryServiceDependencies,
) {
  return new InstanceDirectoryService(dependencies);
}

export const instanceDirectoryService = createInstanceDirectoryService({
  listInstances: () => studio.listInstances(),
});
