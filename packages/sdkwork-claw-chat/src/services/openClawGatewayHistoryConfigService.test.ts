import assert from 'node:assert/strict';
import type {
  OpenClawConfigSnapshot,
} from '@sdkwork/claw-core';
import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import {
  createOpenClawGatewayHistoryConfigService,
} from './openClawGatewayHistoryConfigService.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

function createDetail(): StudioInstanceDetailRecord {
  return {
    instance: {
      id: 'instance-a',
      name: 'OpenClaw A',
      runtimeKind: 'openclaw',
      deploymentMode: 'managed',
      transportKind: 'openclawGatewayWs',
      status: 'running',
      isBuiltIn: true,
      isDefault: false,
      iconType: 'server',
      version: '2026.4.1',
      typeLabel: 'OpenClaw',
      host: '127.0.0.1',
      baseUrl: 'http://127.0.0.1:18888',
      websocketUrl: 'ws://127.0.0.1:18888/ws',
      cpu: 0,
      memory: 0,
      totalMemory: '0 GB',
      uptime: '1m',
      capabilities: [],
      storage: {
        provider: 'filesystem',
        namespace: 'default',
      },
      config: {
        port: '18888',
        sandbox: false,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
      },
      createdAt: 1,
      updatedAt: 1,
    },
    config: {
      port: '18888',
      sandbox: false,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
    },
    logs: '',
    health: {
      status: 'healthy',
      checkedAt: 1,
      message: 'ok',
    },
    lifecycle: {
      autoStart: false,
      restartOnFailure: false,
      restartOnSleepResume: false,
      lastAction: 'start',
      lastActionAt: 1,
    },
    storage: {
      rootPath: 'D:/OpenClaw',
      freeSpaceBytes: 0,
      totalSpaceBytes: 0,
      workspacePath: 'D:/OpenClaw/workspace',
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
    },
    connectivity: {
      endpoints: [],
      listenAddresses: [],
      auth: {
        tokenConfigured: false,
        tokenPreview: null,
      },
    },
    observability: {
      metrics: [],
      checks: [],
      lastUpdatedAt: 1,
    },
    dataAccess: {
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      workspacePath: 'D:/OpenClaw/workspace',
      homePath: 'D:/OpenClaw',
    },
    artifacts: [],
    capabilities: [],
    officialRuntimeNotes: [],
    consoleAccess: null,
    workbench: null,
  };
}

function createSnapshot(root: Record<string, unknown>): OpenClawConfigSnapshot {
  return {
    configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
    providerSnapshots: [],
    agentSnapshots: [],
    channelSnapshots: [],
    root,
  };
}

await runTest(
  'openclaw gateway history config service reads gateway.webchat.chatHistoryMaxChars from the managed config root',
  async () => {
    const service = createOpenClawGatewayHistoryConfigService({
      getInstanceDetail: async () => createDetail(),
      resolveOpenClawConfigPath: () => 'D:/OpenClaw/.openclaw/openclaw.json',
      readOpenClawConfigSnapshot: async () =>
        createSnapshot({
          gateway: {
            webchat: {
              chatHistoryMaxChars: 4096,
            },
          },
        }),
    });

    assert.equal(await service.getHistoryMaxChars('instance-a'), 4096);
  },
);

await runTest(
  'openclaw gateway history config service falls back to gateway.webchat.chatHistory.maxChars and caches repeated lookups',
  async () => {
    let readCount = 0;
    const service = createOpenClawGatewayHistoryConfigService({
      getInstanceDetail: async () => createDetail(),
      resolveOpenClawConfigPath: () => 'D:/OpenClaw/.openclaw/openclaw.json',
      readOpenClawConfigSnapshot: async () => {
        readCount += 1;
        return createSnapshot({
          gateway: {
            webchat: {
              chatHistory: {
                maxChars: 2048,
              },
            },
          },
        });
      },
      now: () => 1_000,
    });

    assert.equal(await service.getHistoryMaxChars('instance-a'), 2048);
    assert.equal(await service.getHistoryMaxChars('instance-a'), 2048);
    assert.equal(readCount, 1);
  },
);

await runTest(
  'openclaw gateway history config service returns undefined when the instance has no managed config path',
  async () => {
    const service = createOpenClawGatewayHistoryConfigService({
      getInstanceDetail: async () => createDetail(),
      resolveOpenClawConfigPath: () => null,
      readOpenClawConfigSnapshot: async () => {
        throw new Error('should not read config without a path');
      },
    });

    assert.equal(await service.getHistoryMaxChars('instance-a'), undefined);
  },
);
