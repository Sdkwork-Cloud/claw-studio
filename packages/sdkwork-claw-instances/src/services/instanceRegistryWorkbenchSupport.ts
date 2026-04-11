import type {
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
} from '@sdkwork/claw-types';
import type { Instance, InstanceConfig } from '../types/index.ts';
import { isNonEmptyString } from './openClawSupport.ts';

function resolveRegistryRuntimeKind(
  instance: Instance,
): StudioInstanceRecord['runtimeKind'] {
  if (
    instance.runtimeKind === 'openclaw' ||
    instance.runtimeKind === 'zeroclaw' ||
    instance.runtimeKind === 'ironclaw' ||
    instance.runtimeKind === 'custom'
  ) {
    return instance.runtimeKind;
  }

  const type = instance.type.toLowerCase();
  if (type.includes('openclaw')) {
    return 'openclaw';
  }
  if (type.includes('zeroclaw')) {
    return 'zeroclaw';
  }
  if (type.includes('ironclaw')) {
    return 'ironclaw';
  }

  return 'custom';
}

function resolveRegistryDeploymentMode(
  instance: Instance,
): StudioInstanceRecord['deploymentMode'] {
  if (
    instance.deploymentMode === 'local-managed' ||
    instance.deploymentMode === 'local-external' ||
    instance.deploymentMode === 'remote'
  ) {
    return instance.deploymentMode;
  }

  return instance.isBuiltIn ? 'local-managed' : 'remote';
}

function resolveRegistryTransportKind(
  instance: Instance,
  runtimeKind: StudioInstanceRecord['runtimeKind'],
): StudioInstanceRecord['transportKind'] {
  if (
    instance.transportKind === 'openclawGatewayWs' ||
    instance.transportKind === 'zeroclawHttp' ||
    instance.transportKind === 'ironclawWeb' ||
    instance.transportKind === 'openaiHttp' ||
    instance.transportKind === 'customHttp' ||
    instance.transportKind === 'customWs'
  ) {
    return instance.transportKind;
  }

  switch (runtimeKind) {
    case 'openclaw':
      return 'openclawGatewayWs';
    case 'zeroclaw':
      return 'zeroclawHttp';
    case 'ironclaw':
      return 'ironclawWeb';
    default:
      return 'customHttp';
  }
}

function resolveRegistryStorageBinding(
  instance: Instance,
  deploymentMode: StudioInstanceRecord['deploymentMode'],
): StudioInstanceRecord['storage'] {
  const provider =
    instance.storage?.provider || (deploymentMode === 'remote' ? 'remoteApi' : 'localFile');

  return {
    provider,
    namespace: instance.storage?.namespace || instance.id,
    ...(instance.storage?.profileId ? { profileId: instance.storage.profileId } : {}),
    ...(instance.storage?.database ? { database: instance.storage.database } : {}),
    ...(instance.storage?.connectionHint
      ? { connectionHint: instance.storage.connectionHint }
      : {}),
    ...(instance.storage?.endpoint ? { endpoint: instance.storage.endpoint } : {}),
  };
}

function storageCapabilitiesForProvider(
  provider: StudioInstanceRecord['storage']['provider'],
) {
  switch (provider) {
    case 'memory':
      return [false, true, false, false] as const;
    case 'localFile':
      return [true, false, false, false] as const;
    case 'sqlite':
      return [true, true, true, false] as const;
    case 'postgres':
      return [true, true, true, true] as const;
    case 'remoteApi':
      return [true, true, false, true] as const;
    default:
      return [true, false, false, false] as const;
  }
}

function resolveRegistryStorageStatus(
  storage: StudioInstanceRecord['storage'],
): StudioInstanceDetailRecord['storage']['status'] {
  switch (storage.provider) {
    case 'memory':
    case 'localFile':
      return 'ready';
    case 'sqlite':
      return isNonEmptyString(storage.namespace) ? 'ready' : 'configurationRequired';
    case 'postgres':
      return isNonEmptyString(storage.connectionHint) ? 'ready' : 'configurationRequired';
    case 'remoteApi':
      return isNonEmptyString(storage.endpoint) ? 'planned' : 'configurationRequired';
    default:
      return 'planned';
  }
}

function resolveRegistryLifecycleOwner(
  instance: Instance,
  deploymentMode: StudioInstanceRecord['deploymentMode'],
): StudioInstanceDetailRecord['lifecycle']['owner'] {
  if (deploymentMode === 'remote') {
    return 'remoteService';
  }

  if (instance.isBuiltIn && deploymentMode === 'local-managed') {
    return 'appManaged';
  }

  return 'externalProcess';
}

function defaultCapabilitiesForRuntime(
  runtimeKind: StudioInstanceRecord['runtimeKind'],
): StudioInstanceRecord['capabilities'] {
  if (runtimeKind === 'openclaw') {
    return ['chat', 'health', 'files', 'memory', 'tasks', 'tools', 'models'];
  }

  if (runtimeKind === 'custom') {
    return ['chat', 'health'];
  }

  return ['chat', 'health', 'models'];
}

function isLoopbackHost(value: string) {
  const fallback = value.trim().replace(/^\[|\]$/g, '').toLowerCase();
  return (
    fallback === '127.0.0.1' ||
    fallback === '::1' ||
    fallback === 'localhost' ||
    fallback.endsWith('.localhost')
  );
}

function buildRegistryConnectivityEndpoints(
  instance: Instance,
  token: string | undefined,
  deploymentMode: StudioInstanceRecord['deploymentMode'],
  baseUrl: string | null,
  websocketUrl: string | null,
): StudioInstanceDetailRecord['connectivity']['endpoints'] {
  const exposure: StudioInstanceDetailRecord['connectivity']['endpoints'][number]['exposure'] =
    deploymentMode === 'remote'
      ? 'remote'
      : isLoopbackHost(instance.ip)
        ? 'loopback'
        : 'private';
  const auth: StudioInstanceDetailRecord['connectivity']['endpoints'][number]['auth'] = token
    ? 'token'
    : deploymentMode === 'remote'
      ? 'external'
      : 'unknown';
  const endpoints: StudioInstanceDetailRecord['connectivity']['endpoints'] = [];

  if (baseUrl) {
    endpoints.push({
      id: 'base-url',
      label: 'Base URL',
      kind: 'http',
      status: 'ready',
      url: baseUrl,
      exposure,
      auth,
      source: 'config',
    });
  }

  if (websocketUrl) {
    endpoints.push({
      id: 'websocket-url',
      label: 'WebSocket URL',
      kind: 'websocket',
      status: 'ready',
      url: websocketUrl,
      exposure,
      auth,
      source: 'config',
    });
  }

  return endpoints;
}

export function buildRegistryBackedDetail(
  instance: Instance,
  config: InstanceConfig,
  token: string | undefined,
  logs: string,
): StudioInstanceDetailRecord {
  const evaluatedAt = Date.now();
  const healthScore = instance.status === 'online' ? 80 : 35;
  const healthStatus =
    instance.status === 'online'
      ? 'healthy'
      : instance.status === 'offline'
        ? 'offline'
        : 'attention';
  const runtimeKind = resolveRegistryRuntimeKind(instance);
  const deploymentMode = resolveRegistryDeploymentMode(instance);
  const transportKind = resolveRegistryTransportKind(instance, runtimeKind);
  const baseUrl = isNonEmptyString(instance.baseUrl) ? instance.baseUrl : null;
  const websocketUrl = isNonEmptyString(instance.websocketUrl) ? instance.websocketUrl : null;
  const storageBinding = resolveRegistryStorageBinding(instance, deploymentMode);
  const [durable, queryable, transactional, remote] = storageCapabilitiesForProvider(
    storageBinding.provider,
  );
  const lifecycleOwner = resolveRegistryLifecycleOwner(instance, deploymentMode);
  const capabilities = defaultCapabilitiesForRuntime(runtimeKind);
  const connectivityEndpoints = buildRegistryConnectivityEndpoints(
    instance,
    token,
    deploymentMode,
    baseUrl,
    websocketUrl,
  );
  const storageStatus = resolveRegistryStorageStatus(storageBinding);
  const configSnapshot = {
    port: config.port,
    sandbox: config.sandbox,
    autoUpdate: config.autoUpdate,
    logLevel: config.logLevel,
    corsOrigins: config.corsOrigins,
    ...(baseUrl ? { baseUrl } : {}),
    ...(websocketUrl ? { websocketUrl } : {}),
    ...(token ? { authToken: token } : {}),
  };

  return {
    instance: {
      id: instance.id,
      name: instance.name,
      description: undefined,
      runtimeKind,
      deploymentMode,
      transportKind,
      status: instance.status === 'starting' ? 'starting' : instance.status,
      isBuiltIn: instance.isBuiltIn === true,
      isDefault: false,
      iconType: instance.iconType,
      version: instance.version,
      typeLabel: instance.type,
      host: instance.ip,
      port: Number.parseInt(config.port, 10) || null,
      baseUrl,
      websocketUrl,
      cpu: instance.cpu,
      memory: instance.memory,
      totalMemory: instance.totalMemory,
      uptime: instance.uptime,
      capabilities,
      storage: {
        ...storageBinding,
      },
      config: configSnapshot,
      createdAt: evaluatedAt,
      updatedAt: evaluatedAt,
      lastSeenAt: evaluatedAt,
    },
    config: configSnapshot,
    logs,
    health: {
      score: healthScore,
      status: healthStatus,
      checks: [],
      evaluatedAt,
    },
    lifecycle: {
      owner: lifecycleOwner,
      startStopSupported: false,
      configWritable: false,
      workbenchManaged: false,
      endpointObserved: false,
      lifecycleControllable: false,
      notes: ['Registry-backed detail projection.'],
    },
    storage: {
      status: storageStatus,
      ...storageBinding,
      durable,
      queryable,
      transactional,
      remote,
    },
    connectivity: {
      primaryTransport: transportKind,
      endpoints: connectivityEndpoints,
    },
    observability: {
      status: logs ? 'limited' : 'unavailable',
      logAvailable: Boolean(logs),
      logPreview: logs ? logs.split('\n').filter(Boolean).slice(-5) : [],
      metricsSource: 'derived',
      lastSeenAt: evaluatedAt,
    },
    dataAccess: {
      routes: [
        {
          id: 'config',
          label: 'Configuration',
          scope: 'config',
          mode: 'metadataOnly',
          status: 'ready',
          target: 'studio.instances registry metadata',
          readonly: false,
          authoritative: false,
          detail: 'Registry-backed detail projects configuration from Claw Studio metadata.',
          source: 'integration',
        },
        {
          id: 'logs',
          label: 'Logs',
          scope: 'logs',
          mode: 'metadataOnly',
          status: logs ? 'limited' : 'planned',
          target: null,
          readonly: true,
          authoritative: false,
          detail: 'Registry-backed detail only exposes derived log preview lines.',
          source: 'derived',
        },
      ],
    },
    artifacts: [
      {
        id: 'storage-binding',
        label: 'Storage Binding',
        kind: 'storageBinding',
        status:
          storageStatus === 'ready'
            ? remote
              ? 'remote'
              : 'available'
            : storageStatus === 'planned'
              ? 'planned'
              : 'missing',
        location:
          storageBinding.endpoint ||
          storageBinding.database ||
          storageBinding.namespace ||
          instance.id,
        readonly: false,
        detail: 'Registry-backed detail projects storage metadata only.',
        source: 'storage',
      },
    ],
    capabilities: capabilities.map((id) => ({
      id,
      status: 'ready',
      detail: 'Registry-backed detail projection.',
      source: 'runtime',
    })),
    officialRuntimeNotes: [],
  };
}
