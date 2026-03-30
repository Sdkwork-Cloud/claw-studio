import type { StudioInstanceRecord } from '@sdkwork/claw-types';
import { openClawConfigService } from '@sdkwork/claw-core';
import { studio } from '@sdkwork/claw-infrastructure';

export interface OpenClawInstanceAuthTokenResolverDependencies {
  getInstanceDetail?: typeof studio.getInstanceDetail;
  resolveInstanceConfigPath?: typeof openClawConfigService.resolveInstanceConfigPath;
  readConfigSnapshot?: typeof openClawConfigService.readConfigSnapshot;
}

export interface OpenClawInstanceAuthTokenLike {
  id: string;
  runtimeKind: StudioInstanceRecord['runtimeKind'];
  config: Pick<StudioInstanceRecord['config'], 'authToken'>;
}

function trimToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function readManagedOpenClawAuthToken(root: unknown, fallbackAuthToken: string | null) {
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    return fallbackAuthToken;
  }

  const gateway = (root as Record<string, unknown>).gateway;
  if (!gateway || typeof gateway !== 'object' || Array.isArray(gateway)) {
    return fallbackAuthToken;
  }

  const auth = (gateway as Record<string, unknown>).auth;
  if (!auth || typeof auth !== 'object' || Array.isArray(auth)) {
    return fallbackAuthToken;
  }

  const configuredToken = trimToNull((auth as Record<string, unknown>).token as string | null | undefined);
  return configuredToken ?? fallbackAuthToken;
}

export async function resolveOpenClawInstanceAuthToken(
  instance: OpenClawInstanceAuthTokenLike,
  dependencies: OpenClawInstanceAuthTokenResolverDependencies = {},
) {
  const fallbackAuthToken = trimToNull(instance.config.authToken);
  if (instance.runtimeKind !== 'openclaw') {
    return fallbackAuthToken;
  }

  const getInstanceDetail = dependencies.getInstanceDetail ?? studio.getInstanceDetail.bind(studio);
  const resolveInstanceConfigPath =
    dependencies.resolveInstanceConfigPath ?? openClawConfigService.resolveInstanceConfigPath.bind(openClawConfigService);
  const readConfigSnapshot =
    dependencies.readConfigSnapshot ?? openClawConfigService.readConfigSnapshot.bind(openClawConfigService);

  try {
    const detail = await getInstanceDetail(instance.id);
    const configPath = resolveInstanceConfigPath(detail);
    if (configPath) {
      const snapshot = await readConfigSnapshot(configPath);
      const managedToken = readManagedOpenClawAuthToken(snapshot.root, fallbackAuthToken);
      if (managedToken) {
        return managedToken;
      }
    }

    const candidates = [detail?.config?.authToken, detail?.instance?.config?.authToken, fallbackAuthToken];
    for (const candidate of candidates) {
      const token = trimToNull(candidate);
      if (token) {
        return token;
      }
    }
  } catch {
    return fallbackAuthToken;
  }

  return fallbackAuthToken;
}
