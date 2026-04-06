import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import type { Instance } from '../types/index.ts';

export interface InstanceActionCapabilities {
  canDelete: boolean;
  canSetActive: boolean;
  canControlLifecycle: boolean;
  canStart: boolean;
  canStop: boolean;
  canRestart: boolean;
}

type InstanceActionInstance = Pick<Instance, 'id' | 'status' | 'isBuiltIn'>;

function resolveLifecycleControlSupport(
  detail: Pick<StudioInstanceDetailRecord, 'lifecycle'> | null | undefined,
) {
  return Boolean(detail?.lifecycle.lifecycleControllable ?? detail?.lifecycle.startStopSupported);
}

export function buildInstanceActionCapabilities(
  instance: InstanceActionInstance | null | undefined,
  detail: Pick<StudioInstanceDetailRecord, 'lifecycle'> | null | undefined = null,
): InstanceActionCapabilities {
  if (!instance) {
    return {
      canDelete: false,
      canSetActive: false,
      canControlLifecycle: false,
      canStart: false,
      canStop: false,
      canRestart: false,
    };
  }

  const canControlLifecycle = resolveLifecycleControlSupport(detail);
  const isOnline = instance.status === 'online';

  return {
    canDelete: instance.isBuiltIn !== true,
    canSetActive: true,
    canControlLifecycle,
    canStart: canControlLifecycle && !isOnline,
    canStop: canControlLifecycle && isOnline,
    canRestart: canControlLifecycle && isOnline,
  };
}

export async function loadInstanceActionCapabilities(
  instances: InstanceActionInstance[],
  loadDetail: (instanceId: string) => Promise<StudioInstanceDetailRecord | null>,
) {
  const entries = await Promise.all(
    instances.map(async (instance) => {
      const detail = await loadDetail(instance.id).catch(() => null);
      return [instance.id, buildInstanceActionCapabilities(instance, detail)] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<string, InstanceActionCapabilities>;
}
