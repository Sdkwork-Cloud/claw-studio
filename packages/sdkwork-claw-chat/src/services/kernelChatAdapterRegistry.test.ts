import assert from 'node:assert/strict';
import type { StudioInstanceRecord } from '@sdkwork/claw-types';
import { createKernelChatAdapterCapabilities } from './kernelChatAdapter.ts';
import { createKernelChatAdapterRegistry } from './kernelChatAdapterRegistry.ts';

function runTest(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

function createInstance(
  input: Partial<StudioInstanceRecord> & Pick<StudioInstanceRecord, 'id'>,
): StudioInstanceRecord {
  return {
    id: input.id,
    name: input.name ?? 'Kernel Runtime',
    description: input.description ?? 'Fixture',
    runtimeKind: input.runtimeKind ?? 'custom',
    deploymentMode: input.deploymentMode ?? 'remote',
    transportKind: input.transportKind ?? 'customHttp',
    status: input.status ?? 'online',
    isBuiltIn: input.isBuiltIn ?? false,
    isDefault: input.isDefault ?? false,
    iconType: input.iconType ?? 'server',
    version: input.version ?? 'test',
    typeLabel: input.typeLabel ?? 'Fixture',
    host: input.host ?? '127.0.0.1',
    port: input.port ?? 18080,
    baseUrl: input.baseUrl ?? 'http://127.0.0.1:18080',
    websocketUrl: input.websocketUrl ?? 'ws://127.0.0.1:18080',
    cpu: input.cpu ?? 0,
    memory: input.memory ?? 0,
    totalMemory: input.totalMemory ?? '0 GB',
    uptime: input.uptime ?? '0m',
    capabilities: input.capabilities ?? ['chat'],
    storage: input.storage ?? {
      provider: 'localFile',
      namespace: 'fixture',
    },
    config: input.config ?? {
      port: '18080',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
    },
    createdAt: input.createdAt ?? 1,
    updatedAt: input.updatedAt ?? 1,
    lastSeenAt: input.lastSeenAt ?? 1,
  };
}

await runTest('kernel chat adapter registry resolves OpenClaw gateway runtimes through the gateway adapter', async () => {
  const registry = createKernelChatAdapterRegistry({
    async resolveInstance(instanceId) {
      assert.equal(instanceId, 'instance-openclaw');
      return createInstance({
        id: instanceId,
        runtimeKind: 'openclaw',
        transportKind: 'openclawGatewayWs',
        deploymentMode: 'local-managed',
      });
    },
    createOpenClawGatewayAdapter() {
      return {
        adapterId: 'openclawGateway',
        getCapabilities() {
          return createKernelChatAdapterCapabilities({
            adapterId: 'openclawGateway',
            authorityKind: 'gateway',
          });
        },
      };
    },
    createTransportBackedAdapter() {
      throw new Error('transport adapter should not be resolved for openclaw gateway');
    },
    createHermesAdapter() {
      throw new Error('hermes adapter should not be resolved for openclaw gateway');
    },
    createUnsupportedAdapter() {
      throw new Error('unsupported adapter should not be resolved for openclaw gateway');
    },
  });

  const resolution = await registry.resolveForInstance('instance-openclaw');

  assert.equal(resolution.adapterId, 'openclawGateway');
  assert.equal(resolution.capabilities.authorityKind, 'gateway');
  assert.equal(resolution.capabilities.durable, true);
});

await runTest('kernel chat adapter registry resolves transport-backed and hermes runtimes without route-first fallbacks', async () => {
  const registry = createKernelChatAdapterRegistry({
    async resolveInstance(instanceId) {
      if (instanceId === 'instance-http') {
        return createInstance({
          id: instanceId,
          runtimeKind: 'zeroclaw',
          transportKind: 'openaiHttp',
          deploymentMode: 'remote',
        });
      }

      return createInstance({
        id: instanceId,
        runtimeKind: 'hermes',
        transportKind: 'customHttp',
        deploymentMode: 'remote',
      });
    },
    createOpenClawGatewayAdapter() {
      throw new Error('openclaw adapter should not be resolved in this test');
    },
    createTransportBackedAdapter() {
      return {
        adapterId: 'transportBacked',
        getCapabilities() {
          return createKernelChatAdapterCapabilities({
            adapterId: 'transportBacked',
            authorityKind: 'http',
            durable: false,
            supportsAgentProfiles: false,
          });
        },
      };
    },
    createHermesAdapter() {
      return {
        adapterId: 'hermes',
        getCapabilities() {
          return createKernelChatAdapterCapabilities({
            adapterId: 'hermes',
            authorityKind: 'sqlite',
            supported: false,
            reason: 'Hermes chat transport is not wired yet.',
          });
        },
      };
    },
    createUnsupportedAdapter() {
      throw new Error('unsupported adapter should not be resolved in this test');
    },
  });

  const httpResolution = await registry.resolveForInstance('instance-http');
  const hermesResolution = await registry.resolveForInstance('instance-hermes');

  assert.equal(httpResolution.adapterId, 'transportBacked');
  assert.equal(httpResolution.capabilities.authorityKind, 'http');
  assert.equal(httpResolution.capabilities.durable, false);
  assert.equal(hermesResolution.adapterId, 'hermes');
  assert.equal(hermesResolution.capabilities.authorityKind, 'sqlite');
  assert.equal(hermesResolution.capabilities.supported, false);
});
