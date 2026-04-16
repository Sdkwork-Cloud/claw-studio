import assert from 'node:assert/strict';
import type {
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
} from '@sdkwork/claw-types';
import { configurePlatformBridge, getPlatformBridge } from '@sdkwork/claw-infrastructure';
import { chatStore } from './chatStore.ts';

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

function createGatewaySnapshotInstance(instanceId: string): StudioInstanceRecord {
  return {
    id: instanceId,
    name: 'Local Built-In Snapshot',
    description: 'Stale snapshot authority.',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    status: 'online',
    isBuiltIn: true,
    isDefault: true,
    iconType: 'server',
    version: '2026.4.2',
    typeLabel: 'Built-In OpenClaw',
    host: '127.0.0.1',
    port: 18797,
    baseUrl: 'http://127.0.0.1:18797/openclaw',
    websocketUrl: 'ws://127.0.0.1:18797/openclaw/ws',
    cpu: 0,
    memory: 0,
    totalMemory: '0 GB',
    uptime: '0m',
    capabilities: ['chat'],
    storage: {
      provider: 'localFile',
      namespace: 'fixture',
    },
    config: {
      port: '18797',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://127.0.0.1:18797/openclaw',
      websocketUrl: 'ws://127.0.0.1:18797/openclaw/ws',
      authToken: 'snapshot-token',
    },
    createdAt: 1,
    updatedAt: 1,
    lastSeenAt: 1,
  };
}

function createStartingDetail(instanceId: string): StudioInstanceDetailRecord {
  return {
    instance: {
      ...createGatewaySnapshotInstance(instanceId),
      status: 'starting',
      baseUrl: null,
      websocketUrl: null,
      config: {
        ...createGatewaySnapshotInstance(instanceId).config,
        baseUrl: null,
        websocketUrl: null,
        authToken: 'detail-token',
      },
    },
    config: {
      ...createGatewaySnapshotInstance(instanceId).config,
      baseUrl: null,
      websocketUrl: null,
      authToken: 'detail-token',
    },
    logs: '',
    health: {
      score: 50,
      status: 'degraded',
      checks: [],
      evaluatedAt: 1,
    },
    lifecycle: {
      owner: 'appManaged',
      startStopSupported: true,
      configWritable: true,
      lifecycleControllable: true,
      workbenchManaged: true,
      endpointObserved: false,
      notes: [],
    },
    storage: {
      status: 'ready',
      provider: 'localFile',
      namespace: 'fixture',
      durable: true,
      queryable: false,
      transactional: false,
      remote: false,
    },
    connectivity: {
      primaryTransport: 'openclawGatewayWs',
      endpoints: [],
    },
    observability: {
      status: 'limited',
      logAvailable: true,
      logPreview: [],
      metricsSource: 'runtime',
      lastSeenAt: 1,
    },
    dataAccess: {
      routes: [],
    },
    artifacts: [],
    capabilities: [],
    officialRuntimeNotes: [],
    consoleAccess: null,
    workbench: null,
  };
}

function createUnsupportedWsInstance(instanceId: string): StudioInstanceRecord {
  return {
    ...createGatewaySnapshotInstance(instanceId),
    name: 'Unsupported Gateway Snapshot',
    runtimeKind: 'custom',
    deploymentMode: 'remote',
    transportKind: 'customWs',
    status: 'online',
    baseUrl: null,
    websocketUrl: null,
    config: {
      ...createGatewaySnapshotInstance(instanceId).config,
      baseUrl: null,
      websocketUrl: null,
      authToken: undefined,
    },
  };
}

function createSupportedHttpInstance(instanceId: string): StudioInstanceRecord {
  return {
    ...createGatewaySnapshotInstance(instanceId),
    name: 'Supported HTTP Instance',
    runtimeKind: 'custom',
    deploymentMode: 'remote',
    transportKind: 'customHttp',
    status: 'online',
    baseUrl: 'https://chat.example.com',
    websocketUrl: null,
    config: {
      ...createGatewaySnapshotInstance(instanceId).config,
      baseUrl: 'https://chat.example.com',
      websocketUrl: null,
      authToken: undefined,
    },
  };
}

function resetChatStore() {
  chatStore.setState((state) => ({
    ...state,
    sessions: [],
    activeSessionIdByInstance: {},
    syncStateByInstance: {},
    gatewayConnectionStatusByInstance: {},
    lastErrorByInstance: {},
    instanceRouteModeById: {},
  }));
}

async function flushAsyncTasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

await runTest(
  'chatStore connectGatewayInstances uses instance detail authority before hydrating the built-in OpenClaw gateway',
  async () => {
    const instanceId = 'authority-mismatch-instance';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createGatewaySnapshotInstance(requestedInstanceId);
        },
        async getInstanceDetail(requestedInstanceId) {
          return createStartingDetail(requestedInstanceId);
        },
      },
    });

    try {
      await chatStore.getState().connectGatewayInstances([instanceId]);
      const state = chatStore.getState();

      assert.equal(state.instanceRouteModeById[instanceId], 'unsupported');
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore createSession refuses unsupported instance routes instead of creating a fake local chat session',
  async () => {
    const instanceId = 'unsupported-chat-session-instance';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createUnsupportedWsInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      const sessionId = await chatStore.getState().createSession(undefined, instanceId);
      const state = chatStore.getState();

      assert.equal(sessionId, '');
      assert.deepEqual(
        state.sessions.filter((session) => session.instanceId === instanceId),
        [],
      );
      assert.equal(state.instanceRouteModeById[instanceId], 'unsupported');
      assert.match(state.lastErrorByInstance[instanceId] ?? '', /supported chat route/i);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore hydrateInstance blocks unsupported instance routes from hydrating or retaining hidden local conversation snapshots',
  async () => {
    const instanceId = 'unsupported-chat-hydrate-instance';
    const originalBridge = getPlatformBridge();
    const listCalls: string[] = [];
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: 'stale-session-1',
          title: 'Stale hidden conversation',
          createdAt: 1,
          updatedAt: 1,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: 'stale-session-1',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createUnsupportedWsInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listConversations(requestedInstanceId) {
          listCalls.push(requestedInstanceId);
          return [
            {
              id: 'unexpected-session-1',
              title: 'Unexpected unsupported conversation',
              createdAt: 1,
              updatedAt: 1,
              model: 'gpt-4.1',
              messages: [],
              instanceId: requestedInstanceId,
            },
          ];
        },
      },
    });

    try {
      await chatStore.getState().hydrateInstance(instanceId);
      const state = chatStore.getState();

      assert.deepEqual(listCalls, []);
      assert.deepEqual(
        state.sessions.filter((session) => session.instanceId === instanceId),
        [],
      );
      assert.equal(state.activeSessionIdByInstance[instanceId] ?? null, null);
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.instanceRouteModeById[instanceId], 'unsupported');
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore createSession clears stale unsupported scope sessions instead of returning a hidden active session id',
  async () => {
    const instanceId = 'unsupported-chat-create-stale-instance';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: 'stale-session-create-1',
          title: 'Hidden stale conversation',
          createdAt: 1,
          updatedAt: 1,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: 'stale-session-create-1',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createUnsupportedWsInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      const sessionId = await chatStore.getState().createSession(undefined, instanceId);
      const state = chatStore.getState();

      assert.equal(sessionId, '');
      assert.deepEqual(
        state.sessions.filter((session) => session.instanceId === instanceId),
        [],
      );
      assert.equal(state.activeSessionIdByInstance[instanceId] ?? null, null);
      assert.equal(state.instanceRouteModeById[instanceId], 'unsupported');
      assert.match(state.lastErrorByInstance[instanceId] ?? '', /supported chat route/i);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore startNewSession clears stale unsupported scope sessions instead of leaving hidden state behind',
  async () => {
    const instanceId = 'unsupported-chat-start-new-stale-instance';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: 'stale-session-start-new-1',
          title: 'Hidden stale conversation',
          createdAt: 1,
          updatedAt: 1,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: 'stale-session-start-new-1',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createUnsupportedWsInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      const sessionId = await chatStore.getState().startNewSession(undefined, instanceId);
      const state = chatStore.getState();

      assert.equal(sessionId, null);
      assert.deepEqual(
        state.sessions.filter((session) => session.instanceId === instanceId),
        [],
      );
      assert.equal(state.activeSessionIdByInstance[instanceId] ?? null, null);
      assert.equal(state.instanceRouteModeById[instanceId], 'unsupported');
      assert.match(state.lastErrorByInstance[instanceId] ?? '', /supported chat route/i);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore createSession re-resolves authoritative routes instead of trusting a stale unsupported cache entry',
  async () => {
    const instanceId = 'stale-unsupported-create-instance';
    const putConversationCalls: string[] = [];
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      instanceRouteModeById: {
        [instanceId]: 'unsupported',
      },
      lastErrorByInstance: {
        [instanceId]: 'This instance does not expose a supported chat route yet.',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async putConversation(record) {
          putConversationCalls.push(record.id);
          return record;
        },
        async deleteConversation() {
          return true;
        },
      },
    });

    try {
      const sessionId = await chatStore.getState().createSession('gpt-4.1', instanceId);
      for (let attempt = 0; attempt < 20 && putConversationCalls.length === 0; attempt += 1) {
        await flushAsyncTasks();
      }
      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.ok(sessionId);
      assert.ok(putConversationCalls.includes(sessionId));
      assert.ok(session);
      assert.equal(session?.instanceId, instanceId);
      assert.equal(session?.transport, 'local');
      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.activeSessionIdByInstance[instanceId], sessionId);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore createSession on local routes drops stale gateway sessions while creating a new authoritative local session',
  async () => {
    const instanceId = 'local-create-stale-gateway-scope-instance';
    const staleGatewaySessionId = 'gateway-session-create-stale';
    const existingLocalSessionId = 'local-session-existing';
    const putConversationCalls: string[] = [];
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: staleGatewaySessionId,
          title: 'Stale Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
        {
          id: existingLocalSessionId,
          title: 'Existing Local Session',
          createdAt: 1,
          updatedAt: 1,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: existingLocalSessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenAiHttp',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async putConversation(record) {
          putConversationCalls.push(record.id);
          return record;
        },
      },
    });

    try {
      const sessionId = await chatStore.getState().createSession('gpt-4.1', instanceId);
      for (let attempt = 0; attempt < 20 && putConversationCalls.length === 0; attempt += 1) {
        await flushAsyncTasks();
      }

      const state = chatStore.getState();
      const scopedSessions = state.sessions.filter((session) => session.instanceId === instanceId);

      assert.ok(sessionId);
      assert.ok(putConversationCalls.includes(sessionId));
      assert.equal(state.activeSessionIdByInstance[instanceId], sessionId);
      assert.deepEqual(
        scopedSessions.map((session) => ({ id: session.id, transport: session.transport })),
        [
          { id: sessionId, transport: 'local' },
          { id: existingLocalSessionId, transport: 'local' },
        ],
      );
      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore startNewSession re-resolves authoritative routes instead of trusting a stale unsupported cache entry',
  async () => {
    const instanceId = 'stale-unsupported-start-new-instance';
    const putConversationCalls: string[] = [];
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      instanceRouteModeById: {
        [instanceId]: 'unsupported',
      },
      lastErrorByInstance: {
        [instanceId]: 'This instance does not expose a supported chat route yet.',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async putConversation(record) {
          putConversationCalls.push(record.id);
          return record;
        },
      },
    });

    try {
      const sessionId = await chatStore.getState().startNewSession('gpt-4.1', instanceId);
      for (let attempt = 0; attempt < 20 && putConversationCalls.length === 0; attempt += 1) {
        await flushAsyncTasks();
      }
      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.ok(sessionId);
      assert.ok(putConversationCalls.includes(String(sessionId)));
      assert.ok(session);
      assert.equal(session?.instanceId, instanceId);
      assert.equal(session?.transport, 'local');
      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.activeSessionIdByInstance[instanceId], sessionId);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore setActiveSession re-resolves authoritative routes instead of trusting a stale gateway cache entry',
  async () => {
    const instanceId = 'stale-gateway-active-session-instance';
    const sessionId = 'local-session-1';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Recovered HTTP Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: null,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenClawGatewayWs',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      await chatStore.getState().setActiveSession(sessionId, instanceId);
      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.activeSessionIdByInstance[instanceId], sessionId);
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.sessions.length, 1);
      assert.ok(session);
      assert.equal(session?.transport, 'local');
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore setActiveSession clears stale unsupported scope sessions instead of keeping a hidden active session id',
  async () => {
    const instanceId = 'stale-unsupported-active-session-instance';
    const sessionId = 'local-session-unsupported';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Stale Unsupported Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: null,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenAiHttp',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createUnsupportedWsInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      await chatStore.getState().setActiveSession(sessionId, instanceId);
      const state = chatStore.getState();

      assert.equal(state.instanceRouteModeById[instanceId], 'unsupported');
      assert.equal(state.activeSessionIdByInstance[instanceId], null);
      assert.equal(state.sessions.length, 0);
      assert.match(state.lastErrorByInstance[instanceId] ?? '', /supported chat route/i);
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore deleteSession re-resolves authoritative routes instead of deleting stale gateway sessions through the gateway store',
  async () => {
    const instanceId = 'stale-gateway-delete-session-instance';
    const sessionId = 'gateway-session-delete';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Stale Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenClawGatewayWs',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      await chatStore.getState().deleteSession(sessionId, instanceId);
      const state = chatStore.getState();

      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.activeSessionIdByInstance[instanceId], null);
      assert.deepEqual(
        state.sessions.filter((session) => session.instanceId === instanceId),
        [],
      );
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore clearSession re-resolves authoritative routes instead of resetting stale gateway sessions through the gateway store',
  async () => {
    const instanceId = 'stale-gateway-clear-session-instance';
    const sessionId = 'gateway-session-clear';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Stale Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenClawGatewayWs',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      await chatStore.getState().clearSession(sessionId, instanceId);
      const state = chatStore.getState();

      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.activeSessionIdByInstance[instanceId], null);
      assert.deepEqual(
        state.sessions.filter((session) => session.instanceId === instanceId),
        [],
      );
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore deleteSession clears stale unsupported gateway scope instead of failing through the gateway store',
  async () => {
    const instanceId = 'stale-gateway-delete-unsupported-instance';
    const sessionId = 'gateway-session-delete-unsupported';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Unsupported Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenClawGatewayWs',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createUnsupportedWsInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      await chatStore.getState().deleteSession(sessionId, instanceId);
      const state = chatStore.getState();

      assert.equal(state.instanceRouteModeById[instanceId], 'unsupported');
      assert.equal(state.activeSessionIdByInstance[instanceId], null);
      assert.deepEqual(
        state.sessions.filter((session) => session.instanceId === instanceId),
        [],
      );
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.match(state.lastErrorByInstance[instanceId] ?? '', /supported chat route/i);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore deleteSession on local routes drops stale gateway sessions before choosing the next active local session',
  async () => {
    const instanceId = 'local-delete-stale-gateway-fallback-instance';
    const activeLocalSessionId = 'local-session-active';
    const staleGatewaySessionId = 'gateway-session-stale';
    const backupLocalSessionId = 'local-session-backup';
    const deleteConversationCalls: string[] = [];
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: activeLocalSessionId,
          title: 'Active Local Session',
          createdAt: 1,
          updatedAt: 3,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
        {
          id: staleGatewaySessionId,
          title: 'Stale Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
        {
          id: backupLocalSessionId,
          title: 'Backup Local Session',
          createdAt: 1,
          updatedAt: 1,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: activeLocalSessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenAiHttp',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async deleteConversation(id) {
          deleteConversationCalls.push(id);
          return true;
        },
      },
    });

    try {
      await chatStore.getState().deleteSession(activeLocalSessionId, instanceId);
      for (let attempt = 0; attempt < 20 && deleteConversationCalls.length === 0; attempt += 1) {
        await flushAsyncTasks();
      }
      const state = chatStore.getState();
      const scopedSessions = state.sessions.filter((session) => session.instanceId === instanceId);

      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.activeSessionIdByInstance[instanceId], backupLocalSessionId);
      assert.deepEqual(deleteConversationCalls, [activeLocalSessionId]);
      assert.deepEqual(
        scopedSessions.map((session) => ({ id: session.id, transport: session.transport })),
        [{ id: backupLocalSessionId, transport: 'local' }],
      );
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore clearSession on local routes drops stale gateway sessions while keeping the cleared local session active',
  async () => {
    const instanceId = 'local-clear-stale-gateway-scope-instance';
    const activeLocalSessionId = 'local-session-clear-active';
    const staleGatewaySessionId = 'gateway-session-clear-stale';
    const backupLocalSessionId = 'local-session-clear-backup';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: activeLocalSessionId,
          title: 'Active Local Session',
          createdAt: 1,
          updatedAt: 3,
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'hello',
              timestamp: 3,
            },
          ],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
        {
          id: staleGatewaySessionId,
          title: 'Stale Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
        {
          id: backupLocalSessionId,
          title: 'Backup Local Session',
          createdAt: 1,
          updatedAt: 1,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: activeLocalSessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenAiHttp',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async putConversation(record) {
          return record;
        },
      },
    });

    try {
      await chatStore.getState().clearSession(activeLocalSessionId, instanceId);
      await flushAsyncTasks();

      const state = chatStore.getState();
      const scopedSessions = state.sessions.filter((session) => session.instanceId === instanceId);
      const clearedSession = scopedSessions.find((session) => session.id === activeLocalSessionId);

      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.activeSessionIdByInstance[instanceId], activeLocalSessionId);
      assert.deepEqual(
        scopedSessions.map((session) => ({ id: session.id, transport: session.transport })),
        [
          { id: activeLocalSessionId, transport: 'local' },
          { id: backupLocalSessionId, transport: 'local' },
        ],
      );
      assert.equal(clearedSession?.messages.length ?? -1, 0);
      assert.equal(state.syncStateByInstance[instanceId] ?? 'idle', 'idle');
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore flushSession on local routes drops stale gateway sessions after persisting the authoritative local session scope',
  async () => {
    const instanceId = 'local-flush-stale-gateway-scope-instance';
    const activeLocalSessionId = 'local-session-flush-active';
    const staleGatewaySessionId = 'gateway-session-flush-stale';
    const backupLocalSessionId = 'local-session-flush-backup';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: activeLocalSessionId,
          title: 'Active Local Session',
          createdAt: 1,
          updatedAt: 3,
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'hello',
              timestamp: 3,
            },
          ],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
        {
          id: staleGatewaySessionId,
          title: 'Stale Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
        {
          id: backupLocalSessionId,
          title: 'Backup Local Session',
          createdAt: 1,
          updatedAt: 1,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: activeLocalSessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenAiHttp',
      },
      syncStateByInstance: {
        [instanceId]: 'loading',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async putConversation(record) {
          return {
            ...record,
            updatedAt: 5,
          };
        },
        async listConversations(requestedInstanceId) {
          return [
            {
              id: activeLocalSessionId,
              title: 'Active Local Session',
              primaryInstanceId: requestedInstanceId,
              participantInstanceIds: [requestedInstanceId],
              createdAt: 1,
              updatedAt: 5,
              messageCount: 1,
              lastMessagePreview: 'hello',
              messages: [
                {
                  id: 'msg-1',
                  conversationId: activeLocalSessionId,
                  role: 'user',
                  content: 'hello',
                  createdAt: 3,
                  updatedAt: 3,
                  senderInstanceId: requestedInstanceId,
                  status: 'complete',
                },
              ],
            },
            {
              id: backupLocalSessionId,
              title: 'Backup Local Session',
              primaryInstanceId: requestedInstanceId,
              participantInstanceIds: [requestedInstanceId],
              createdAt: 1,
              updatedAt: 1,
              messageCount: 0,
              lastMessagePreview: '',
              messages: [],
            },
          ];
        },
      },
    });

    try {
      await chatStore.getState().flushSession(activeLocalSessionId);

      const state = chatStore.getState();
      const scopedSessions = state.sessions.filter((session) => session.instanceId === instanceId);

      assert.equal(state.activeSessionIdByInstance[instanceId], activeLocalSessionId);
      assert.deepEqual(
        scopedSessions.map((session) => ({ id: session.id, transport: session.transport })),
        [
          { id: activeLocalSessionId, transport: 'local' },
          { id: backupLocalSessionId, transport: 'local' },
        ],
      );
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore addMessage on local routes drops stale gateway sessions while updating the authoritative local session',
  async () => {
    const instanceId = 'local-add-message-stale-gateway-scope-instance';
    const activeLocalSessionId = 'local-session-add-message-active';
    const staleGatewaySessionId = 'gateway-session-add-message-stale';
    const backupLocalSessionId = 'local-session-add-message-backup';
    const putConversationCalls: string[] = [];
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: activeLocalSessionId,
          title: 'Untitled',
          createdAt: 1,
          updatedAt: 3,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
        {
          id: staleGatewaySessionId,
          title: 'Stale Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
        {
          id: backupLocalSessionId,
          title: 'Backup Local Session',
          createdAt: 1,
          updatedAt: 1,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: activeLocalSessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenAiHttp',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async putConversation(record) {
          putConversationCalls.push(record.id);
          return record;
        },
      },
    });

    try {
      chatStore.getState().addMessage(activeLocalSessionId, {
        role: 'user',
        content: 'hello local scope',
      });
      for (let attempt = 0; attempt < 20 && putConversationCalls.length === 0; attempt += 1) {
        await flushAsyncTasks();
      }

      const state = chatStore.getState();
      const scopedSessions = state.sessions.filter((session) => session.instanceId === instanceId);
      const activeSession = scopedSessions.find((session) => session.id === activeLocalSessionId);

      assert.deepEqual(
        scopedSessions.map((session) => ({ id: session.id, transport: session.transport })),
        [
          { id: activeLocalSessionId, transport: 'local' },
          { id: backupLocalSessionId, transport: 'local' },
        ],
      );
      assert.equal(state.activeSessionIdByInstance[instanceId], activeLocalSessionId);
      assert.ok(putConversationCalls.includes(activeLocalSessionId));
      assert.equal(activeSession?.messages.length ?? -1, 1);
      assert.equal(activeSession?.messages[0]?.content, 'hello local scope');
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore updateMessage on local routes drops stale gateway sessions while editing the authoritative local session',
  async () => {
    const instanceId = 'local-update-message-stale-gateway-scope-instance';
    const activeLocalSessionId = 'local-session-update-message-active';
    const staleGatewaySessionId = 'gateway-session-update-message-stale';
    const backupLocalSessionId = 'local-session-update-message-backup';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: activeLocalSessionId,
          title: 'Editable Local Session',
          createdAt: 1,
          updatedAt: 3,
          messages: [
            {
              id: 'msg-edit-1',
              role: 'assistant',
              content: 'draft reply',
              timestamp: 3,
            },
          ],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
        {
          id: staleGatewaySessionId,
          title: 'Stale Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
        {
          id: backupLocalSessionId,
          title: 'Backup Local Session',
          createdAt: 1,
          updatedAt: 1,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: activeLocalSessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenAiHttp',
      },
    }));

    try {
      chatStore.getState().updateMessage(activeLocalSessionId, 'msg-edit-1', 'final reply');

      const state = chatStore.getState();
      const scopedSessions = state.sessions.filter((session) => session.instanceId === instanceId);
      const activeSession = scopedSessions.find((session) => session.id === activeLocalSessionId);

      assert.deepEqual(
        scopedSessions.map((session) => ({ id: session.id, transport: session.transport })),
        [
          { id: activeLocalSessionId, transport: 'local' },
          { id: backupLocalSessionId, transport: 'local' },
        ],
      );
      assert.equal(state.activeSessionIdByInstance[instanceId], activeLocalSessionId);
      assert.equal(activeSession?.messages[0]?.content, 'final reply');
    } finally {
      resetChatStore();
    }
  },
);
