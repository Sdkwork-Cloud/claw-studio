import assert from 'node:assert/strict';
import type {
  StudioConversationRecord,
  StudioInstanceConfig,
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
} from '@sdkwork/claw-types';
import {
  bootstrapServerBrowserPlatformBridge,
  configurePlatformBridge,
  configureServerBrowserPlatformBridge,
  getPlatformBridge,
  SERVER_API_BASE_PATH_META_NAME,
  SERVER_HOST_MODE_META_NAME,
  SERVER_INTERNAL_BASE_PATH_META_NAME,
  SERVER_MANAGE_BASE_PATH_META_NAME,
  internal,
  manage,
  platform,
  studio,
} from './index.ts';

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

function createMetaDocument(meta: Record<string, string>) {
  return {
    querySelector(selector: string) {
      const metaNamePrefix = 'meta[name="';
      if (!selector.startsWith(metaNamePrefix) || !selector.endsWith('"]')) {
        return null;
      }

      const name = selector.slice(metaNamePrefix.length, -2);
      const content = meta[name];

      if (content === undefined) {
        return null;
      }

      return {
        getAttribute(attribute: string) {
          return attribute === 'content' ? content : null;
        },
      };
    },
  };
}

function createMutableMetaDocument(initialMeta: Record<string, string>) {
  let currentMeta = { ...initialMeta };

  return {
    document: createMetaDocumentProxy(() => currentMeta),
    setMeta(nextMeta: Record<string, string>) {
      currentMeta = { ...nextMeta };
    },
  };
}

function createMetaDocumentProxy(readMeta: () => Record<string, string>) {
  return {
    querySelector(selector: string) {
      const metaNamePrefix = 'meta[name="';
      if (!selector.startsWith(metaNamePrefix) || !selector.endsWith('"]')) {
        return null;
      }

      const name = selector.slice(metaNamePrefix.length, -2);
      const content = readMeta()[name];

      if (content === undefined) {
        return null;
      }

      return {
        getAttribute(attribute: string) {
          return attribute === 'content' ? content : null;
        },
      };
    },
  };
}

function createJsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get(name: string) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null;
      },
    },
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    },
  };
}

function readHeaderValue(
  headers: HeadersInit | undefined,
  name: string,
): string | null {
  if (!headers) {
    return null;
  }

  if (headers instanceof Headers) {
    return headers.get(name);
  }

  if (Array.isArray(headers)) {
    const matched = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return matched?.[1] ?? null;
  }

  const matched = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return typeof matched?.[1] === 'string' ? matched[1] : null;
}

function createInstance(id: string): StudioInstanceRecord {
  return {
    id,
    name: `Instance ${id}`,
    description: 'Hosted studio instance fixture.',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    status: 'online',
    isBuiltIn: false,
    isDefault: false,
    iconType: 'server',
    version: '2026.04.04',
    typeLabel: 'OpenClaw',
    host: '127.0.0.1',
    port: 18789,
    baseUrl: 'http://127.0.0.1:18789',
    websocketUrl: 'ws://127.0.0.1:18789',
    cpu: 0,
    memory: 0,
    totalMemory: '0 GB',
    uptime: '0m',
    capabilities: [],
    storage: {
      provider: 'localFile',
      namespace: id,
    },
    config: {
      port: '18789',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
    },
    createdAt: 1,
    updatedAt: 1,
    lastSeenAt: 1,
  };
}

function createInstanceDetail(id: string): StudioInstanceDetailRecord {
  return {
    instance: createInstance(id),
    config: {
      port: '18789',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
    },
    logs: 'Hosted detail log output.',
    health: {
      score: 100,
      status: 'healthy',
      checks: [],
      evaluatedAt: 1,
    },
    lifecycle: {
      owner: 'host',
      startStopSupported: true,
      configWritable: true,
      notes: [],
    },
    storage: {
      status: 'ready',
      provider: 'localFile',
      namespace: id,
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
      status: 'ready',
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
    consoleAccess: {
      supported: false,
      entries: [],
    },
    workbench: null,
  };
}

function createConversation(instanceId: string): StudioConversationRecord {
  return {
    id: 'conversation-1',
    title: 'Hosted conversation',
    primaryInstanceId: instanceId,
    participantInstanceIds: [instanceId],
    createdAt: 1,
    updatedAt: 1,
    messages: [],
  };
}

await runTest('server browser bridge routes canonical studio reads and conversation writes through hosted api paths', async () => {
  const originalBridge = getPlatformBridge();
  const requests: Array<{ input: string; method: string; body?: string | null }> = [];
  const instance = createInstance('local-built-in');
  const detail = createInstanceDetail('local-built-in');
  const config: StudioInstanceConfig = detail.config;
  const conversation = createConversation('local-built-in');

  try {
    const configured = configureServerBrowserPlatformBridge({
      document: createMetaDocument({
        [SERVER_HOST_MODE_META_NAME]: 'server',
        [SERVER_MANAGE_BASE_PATH_META_NAME]: '/claw/manage/v1',
        [SERVER_INTERNAL_BASE_PATH_META_NAME]: '/claw/internal/v1',
        [SERVER_API_BASE_PATH_META_NAME]: '/claw/api/v1',
      }) as Document,
      fetchImpl: async (input, init) => {
        const inputText = String(input);
        requests.push({
          input: inputText,
          method: init?.method ?? 'GET',
          body: typeof init?.body === 'string' ? init.body : null,
        });

        if (inputText === '/claw/api/v1/studio/instances') {
          return createJsonResponse([instance]) as Response;
        }

        if (inputText === '/claw/api/v1/studio/instances/local-built-in') {
          return createJsonResponse(instance) as Response;
        }

        if (inputText === '/claw/api/v1/studio/instances/local-built-in/detail') {
          return createJsonResponse(detail) as Response;
        }

        if (inputText === '/claw/api/v1/studio/instances/local-built-in/config') {
          return createJsonResponse(config) as Response;
        }

        if (inputText === '/claw/api/v1/studio/instances/local-built-in/logs') {
          return createJsonResponse('Hosted logs') as Response;
        }

        if (inputText === '/claw/api/v1/studio/instances/local-built-in/conversations') {
          return createJsonResponse([conversation]) as Response;
        }

        if (inputText === '/claw/api/v1/studio/conversations/conversation-1') {
          if ((init?.method ?? 'GET') === 'PUT') {
            return createJsonResponse(conversation) as Response;
          }

          if ((init?.method ?? 'GET') === 'DELETE') {
            return createJsonResponse(true) as Response;
          }
        }

        throw new Error(`unexpected fetch input: ${inputText}`);
      },
    });

    assert.equal(configured, true);

    const instances = await studio.listInstances();
    const hydrated = await studio.getInstance('local-built-in');
    const hydratedDetail = await studio.getInstanceDetail('local-built-in');
    const hydratedConfig = await studio.getInstanceConfig('local-built-in');
    const logs = await studio.getInstanceLogs('local-built-in');
    const conversations = await studio.listConversations('local-built-in');
    const saved = await studio.putConversation(conversation);
    const deleted = await studio.deleteConversation('conversation-1');

    assert.equal(instances.length, 1);
    assert.equal(hydrated?.id, 'local-built-in');
    assert.equal(hydratedDetail?.instance.id, 'local-built-in');
    assert.equal(hydratedConfig?.port, '18789');
    assert.equal(logs, 'Hosted logs');
    assert.equal(conversations.length, 1);
    assert.equal(saved.id, 'conversation-1');
    assert.equal(deleted, true);
    assert.deepEqual(requests, [
      { input: '/claw/api/v1/studio/instances', method: 'GET', body: null },
      {
        input: '/claw/api/v1/studio/instances/local-built-in',
        method: 'GET',
        body: null,
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in/detail',
        method: 'GET',
        body: null,
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in/config',
        method: 'GET',
        body: null,
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in/logs',
        method: 'GET',
        body: null,
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in/conversations',
        method: 'GET',
        body: null,
      },
      {
        input: '/claw/api/v1/studio/conversations/conversation-1',
        method: 'PUT',
        body: JSON.stringify(conversation),
      },
      {
        input: '/claw/api/v1/studio/conversations/conversation-1',
        method: 'DELETE',
        body: null,
      },
    ]);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('desktopCombined hosted browser mode also routes studio reads through hosted api paths', async () => {
  const originalBridge = getPlatformBridge();
  const requests: Array<{ input: string; method: string }> = [];

  try {
    const configured = configureServerBrowserPlatformBridge({
      document: createMetaDocument({
        [SERVER_HOST_MODE_META_NAME]: 'desktopCombined',
        [SERVER_MANAGE_BASE_PATH_META_NAME]: '/claw/manage/v1',
        [SERVER_INTERNAL_BASE_PATH_META_NAME]: '/claw/internal/v1',
        [SERVER_API_BASE_PATH_META_NAME]: '/claw/api/v1',
      }) as Document,
      fetchImpl: async (input, init) => {
        requests.push({
          input: String(input),
          method: init?.method ?? 'GET',
        });

        return createJsonResponse([createInstance('desktop-built-in')]) as Response;
      },
    });

    assert.equal(configured, true);

    const instances = await studio.listInstances();

    assert.equal(instances[0]?.id, 'desktop-built-in');
    assert.deepEqual(requests, [
      {
        input: '/claw/api/v1/studio/instances',
        method: 'GET',
      },
    ]);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('desktopCombined hosted browser mode forwards browser session token to hosted control plane requests', async () => {
  const originalBridge = getPlatformBridge();
  const requests: Array<{ input: string; method: string; browserSessionToken: string | null }> = [];

  try {
    const configured = configureServerBrowserPlatformBridge({
      document: createMetaDocument({
        [SERVER_HOST_MODE_META_NAME]: 'desktopCombined',
        [SERVER_MANAGE_BASE_PATH_META_NAME]: '/claw/manage/v1',
        [SERVER_INTERNAL_BASE_PATH_META_NAME]: '/claw/internal/v1',
        [SERVER_API_BASE_PATH_META_NAME]: '/claw/api/v1',
        'sdkwork-claw-browser-session-token': 'desktop-session-token',
      }) as Document,
      fetchImpl: async (input, init) => {
        const inputText = String(input);
        requests.push({
          input: inputText,
          method: init?.method ?? 'GET',
          browserSessionToken: readHeaderValue(init?.headers, 'x-claw-browser-session'),
        });

        if (inputText === '/claw/internal/v1/host-platform') {
          return createJsonResponse({
            mode: 'desktopCombined',
            lifecycle: 'ready',
            hostId: 'desktop-local',
            displayName: 'Desktop Combined Host',
            version: 'desktop@test',
            desiredStateProjectionVersion: 'phase2',
            rolloutEngineVersion: 'phase2',
            manageBasePath: '/claw/manage/v1',
            internalBasePath: '/claw/internal/v1',
            stateStoreDriver: 'sqlite',
            stateStore: null,
            capabilityKeys: [],
            updatedAt: 1,
          }) as Response;
        }

        if (inputText === '/claw/manage/v1/host-endpoints') {
          return createJsonResponse([]) as Response;
        }

        if (inputText === '/claw/api/v1/studio/instances') {
          return createJsonResponse([]) as Response;
        }

        throw new Error(`unexpected request: ${inputText}`);
      },
    });

    assert.equal(configured, true);

    await internal.getHostPlatformStatus();
    await manage.getHostEndpoints();
    await studio.listInstances();

    assert.deepEqual(requests, [
      {
        input: '/claw/internal/v1/host-platform',
        method: 'GET',
        browserSessionToken: 'desktop-session-token',
      },
      {
        input: '/claw/manage/v1/host-endpoints',
        method: 'GET',
        browserSessionToken: 'desktop-session-token',
      },
      {
        input: '/claw/api/v1/studio/instances',
        method: 'GET',
        browserSessionToken: 'desktop-session-token',
      },
    ]);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('desktopCombined hosted browser mode refreshes the browser session token after hosted meta changes', async () => {
  const originalBridge = getPlatformBridge();
  const requests: Array<{ input: string; browserSessionToken: string | null }> = [];
  const metaDocument = createMutableMetaDocument({
    [SERVER_HOST_MODE_META_NAME]: 'desktopCombined',
    [SERVER_MANAGE_BASE_PATH_META_NAME]: '/claw/manage/v1',
    [SERVER_INTERNAL_BASE_PATH_META_NAME]: '/claw/internal/v1',
    [SERVER_API_BASE_PATH_META_NAME]: '/claw/api/v1',
    'sdkwork-claw-browser-session-token': 'desktop-session-token-1',
  });

  try {
    const configured = configureServerBrowserPlatformBridge({
      document: metaDocument.document as Document,
      fetchImpl: async (input, init) => {
        requests.push({
          input: String(input),
          browserSessionToken: readHeaderValue(init?.headers, 'x-claw-browser-session'),
        });

        return createJsonResponse([]) as Response;
      },
    });

    assert.equal(configured, true);

    await manage.getHostEndpoints();
    metaDocument.setMeta({
      [SERVER_HOST_MODE_META_NAME]: 'desktopCombined',
      [SERVER_MANAGE_BASE_PATH_META_NAME]: '/claw/manage/v1',
      [SERVER_INTERNAL_BASE_PATH_META_NAME]: '/claw/internal/v1',
      [SERVER_API_BASE_PATH_META_NAME]: '/claw/api/v1',
      'sdkwork-claw-browser-session-token': 'desktop-session-token-2',
    });
    await manage.getHostEndpoints();

    assert.deepEqual(requests, [
      {
        input: '/claw/manage/v1/host-endpoints',
        browserSessionToken: 'desktop-session-token-1',
      },
      {
        input: '/claw/manage/v1/host-endpoints',
        browserSessionToken: 'desktop-session-token-2',
      },
    ]);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('server browser bridge preserves the active desktop authority instead of overriding it with hosted-browser surfaces', async () => {
  const originalBridge = getPlatformBridge();
  const desktopManage = { ...originalBridge.manage };
  const desktopInternal = { ...originalBridge.internal };
  const desktopRuntime = { ...originalBridge.runtime };
  const desktopStudio = { ...originalBridge.studio };

  try {
    configurePlatformBridge({
      platform: {
        ...originalBridge.platform,
        getPlatform: () => 'desktop',
        supportsNativeScreenshot: () => true,
      },
      manage: desktopManage,
      internal: desktopInternal,
      runtime: desktopRuntime,
      studio: desktopStudio,
    });

    const configured = configureServerBrowserPlatformBridge({
      document: createMetaDocument({
        [SERVER_HOST_MODE_META_NAME]: 'desktopCombined',
        [SERVER_MANAGE_BASE_PATH_META_NAME]: '/claw/manage/v1',
        [SERVER_INTERNAL_BASE_PATH_META_NAME]: '/claw/internal/v1',
        [SERVER_API_BASE_PATH_META_NAME]: '/claw/api/v1',
      }) as Document,
    });

    assert.equal(configured, false);
    assert.equal(getPlatformBridge().manage, desktopManage);
    assert.equal(getPlatformBridge().internal, desktopInternal);
    assert.equal(getPlatformBridge().runtime, desktopRuntime);
    assert.equal(getPlatformBridge().studio, desktopStudio);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('desktopCombined hosted browser exposes desktop platform capabilities without pretending to be native desktop', async () => {
  const originalBridge = getPlatformBridge();

  try {
    const configured = configureServerBrowserPlatformBridge({
      document: createMetaDocument({
        [SERVER_HOST_MODE_META_NAME]: 'desktopCombined',
        [SERVER_MANAGE_BASE_PATH_META_NAME]: '/claw/manage/v1',
        [SERVER_INTERNAL_BASE_PATH_META_NAME]: '/claw/internal/v1',
        [SERVER_API_BASE_PATH_META_NAME]: '/claw/api/v1',
      }) as Document,
    });

    assert.equal(configured, true);
    assert.equal(platform.getPlatform(), 'desktop');
    assert.equal(platform.supportsNativeScreenshot(), false);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('server browser bridge can bootstrap from a structured descriptor endpoint without html metadata', async () => {
  const originalBridge = getPlatformBridge();
  const requests: Array<{
    input: string;
    method: string;
    browserSessionToken: string | null;
  }> = [];

  try {
    const configured = await bootstrapServerBrowserPlatformBridge({
      document: {
        baseURI: 'http://127.0.0.1:18797/index.html',
        querySelector() {
          return null;
        },
      } as Document,
      fetchImpl: async (input, init) => {
        const inputText = String(input);
        requests.push({
          input: inputText,
          method: init?.method ?? 'GET',
          browserSessionToken: readHeaderValue(
            init?.headers,
            'x-claw-browser-session',
          ),
        });

        if (inputText === 'http://127.0.0.1:18797/sdkwork-claw-bootstrap.json') {
          return createJsonResponse({
            mode: 'desktopCombined',
            distributionFamily: 'desktop',
            deploymentFamily: 'bareMetal',
            acceleratorProfile: null,
            apiBasePath: '/claw/api/v1',
            manageBasePath: '/claw/manage/v1',
            internalBasePath: '/claw/internal/v1',
            browserSessionToken: 'bootstrap-session-token',
          }) as Response;
        }

        if (inputText === '/claw/internal/v1/host-platform') {
          return createJsonResponse({
            mode: 'desktopCombined',
            lifecycle: 'ready',
            hostId: 'desktop-local',
            displayName: 'Desktop Combined Host',
            version: '1.0.0',
            distributionFamily: 'desktop',
            deploymentFamily: 'bareMetal',
            desiredStateProjectionVersion: 'phase3',
            rolloutEngineVersion: 'phase3',
            manageBasePath: '/claw/manage/v1',
            internalBasePath: '/claw/internal/v1',
            stateStore: {
              activeProfileId: 'default-sqlite',
              providers: [],
              profiles: [],
            },
            capabilityKeys: [],
            updatedAt: 1,
          }) as Response;
        }

        throw new Error(`unexpected fetch input: ${inputText}`);
      },
    });

    assert.equal(configured, true);

    const status = await internal.getHostPlatformStatus();

    assert.equal(status.mode, 'desktopCombined');
    assert.deepEqual(requests, [
      {
        input: 'http://127.0.0.1:18797/sdkwork-claw-bootstrap.json',
        method: 'GET',
        browserSessionToken: null,
      },
      {
        input: '/claw/internal/v1/host-platform',
        method: 'GET',
        browserSessionToken: 'bootstrap-session-token',
      },
    ]);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('server browser bridge bootstrap skips structured descriptor fetches while the desktop authority is already active', async () => {
  const originalBridge = getPlatformBridge();
  const desktopManage = { ...originalBridge.manage };
  const desktopInternal = { ...originalBridge.internal };
  const desktopRuntime = { ...originalBridge.runtime };
  const desktopStudio = { ...originalBridge.studio };
  const requests: string[] = [];

  try {
    configurePlatformBridge({
      platform: {
        ...originalBridge.platform,
        getPlatform: () => 'desktop',
        supportsNativeScreenshot: () => true,
      },
      manage: desktopManage,
      internal: desktopInternal,
      runtime: desktopRuntime,
      studio: desktopStudio,
    });

    const configured = await bootstrapServerBrowserPlatformBridge({
      document: {
        baseURI: 'http://127.0.0.1:18797/index.html',
        querySelector() {
          return null;
        },
      } as Document,
      fetchImpl: async (input) => {
        requests.push(String(input));
        return createJsonResponse({
          mode: 'desktopCombined',
          distributionFamily: 'desktop',
          deploymentFamily: 'bareMetal',
          acceleratorProfile: null,
          apiBasePath: '/claw/api/v1',
          manageBasePath: '/claw/manage/v1',
          internalBasePath: '/claw/internal/v1',
          browserSessionToken: 'bootstrap-session-token',
        }) as Response;
      },
    });

    assert.equal(configured, false);
    assert.deepEqual(requests, []);
    assert.equal(getPlatformBridge().manage, desktopManage);
    assert.equal(getPlatformBridge().internal, desktopInternal);
    assert.equal(getPlatformBridge().runtime, desktopRuntime);
    assert.equal(getPlatformBridge().studio, desktopStudio);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('hosted browser studio bridge routes canonical instance and workbench mutations through hosted api paths', async () => {
  const originalBridge = getPlatformBridge();
  const requests: Array<{ input: string; method: string; body?: string | null }> = [];
  const createdInstance = createInstance('created-instance');
  const updatedInstance = {
    ...createInstance('local-built-in'),
    name: 'Updated instance',
    status: 'offline',
  } satisfies StudioInstanceRecord;
  const updatedConfig: StudioInstanceConfig = {
    port: '28888',
    sandbox: true,
    autoUpdate: false,
    logLevel: 'debug',
    corsOrigins: 'http://localhost:3001',
  };

  try {
    const configured = configureServerBrowserPlatformBridge({
      document: createMetaDocument({
        [SERVER_HOST_MODE_META_NAME]: 'desktopCombined',
        [SERVER_MANAGE_BASE_PATH_META_NAME]: '/claw/manage/v1',
        [SERVER_INTERNAL_BASE_PATH_META_NAME]: '/claw/internal/v1',
        [SERVER_API_BASE_PATH_META_NAME]: '/claw/api/v1',
      }) as Document,
      fetchImpl: async (input, init) => {
        const inputText = String(input);
        requests.push({
          input: inputText,
          method: init?.method ?? 'GET',
          body: typeof init?.body === 'string' ? init.body : null,
        });

        if (inputText === '/claw/api/v1/studio/instances' && (init?.method ?? 'GET') === 'POST') {
          return createJsonResponse(createdInstance) as Response;
        }

        if (inputText === '/claw/api/v1/studio/instances/local-built-in' && (init?.method ?? 'GET') === 'PUT') {
          return createJsonResponse(updatedInstance) as Response;
        }

        if (inputText === '/claw/api/v1/studio/instances/local-built-in' && (init?.method ?? 'GET') === 'DELETE') {
          return createJsonResponse(true) as Response;
        }

        if (inputText === '/claw/api/v1/studio/instances/local-built-in:start') {
          return createJsonResponse({ ...updatedInstance, status: 'online' }) as Response;
        }

        if (inputText === '/claw/api/v1/studio/instances/local-built-in:stop') {
          return createJsonResponse({ ...updatedInstance, status: 'offline' }) as Response;
        }

        if (inputText === '/claw/api/v1/studio/instances/local-built-in:restart') {
          return createJsonResponse({ ...updatedInstance, status: 'online' }) as Response;
        }

        if (inputText === '/claw/api/v1/studio/instances/local-built-in/config' && (init?.method ?? 'GET') === 'PUT') {
          return createJsonResponse(updatedConfig) as Response;
        }

        if (
          inputText === '/claw/api/v1/studio/instances/local-built-in/gateway/invoke' &&
          (init?.method ?? 'GET') === 'POST'
        ) {
          return createJsonResponse({
            accepted: true,
            tool: 'models',
            action: 'list',
            dryRun: false,
          }) as Response;
        }

        if (
          inputText === '/claw/api/v1/studio/instances/local-built-in/tasks' &&
          (init?.method ?? 'GET') === 'POST'
        ) {
          return createJsonResponse(null) as Response;
        }

        if (
          inputText === '/claw/api/v1/studio/instances/local-built-in/tasks/job-1' &&
          (init?.method ?? 'GET') === 'PUT'
        ) {
          return createJsonResponse(null) as Response;
        }

        if (
          inputText === '/claw/api/v1/studio/instances/local-built-in/tasks/job-1:clone' &&
          (init?.method ?? 'GET') === 'POST'
        ) {
          return createJsonResponse(null) as Response;
        }

        if (
          inputText === '/claw/api/v1/studio/instances/local-built-in/tasks/job-1:run' &&
          (init?.method ?? 'GET') === 'POST'
        ) {
          return createJsonResponse({
            id: 'exec-1',
            taskId: 'job-1',
            status: 'success',
            trigger: 'manual',
            startedAt: '2026-04-04T10:00:00.000Z',
            finishedAt: '2026-04-04T10:00:01.000Z',
            summary: 'Task completed.',
          }) as Response;
        }

        if (
          inputText === '/claw/api/v1/studio/instances/local-built-in/tasks/job-1/executions' &&
          (init?.method ?? 'GET') === 'GET'
        ) {
          return createJsonResponse([
            {
              id: 'exec-1',
              taskId: 'job-1',
              status: 'success',
              trigger: 'manual',
              startedAt: '2026-04-04T10:00:00.000Z',
              finishedAt: '2026-04-04T10:00:01.000Z',
              summary: 'Task completed.',
            },
          ]) as Response;
        }

        if (
          inputText === '/claw/api/v1/studio/instances/local-built-in/tasks/job-1:status' &&
          (init?.method ?? 'GET') === 'POST'
        ) {
          return createJsonResponse(null) as Response;
        }

        if (
          inputText === '/claw/api/v1/studio/instances/local-built-in/tasks/job-1' &&
          (init?.method ?? 'GET') === 'DELETE'
        ) {
          return createJsonResponse(true) as Response;
        }

        if (
          inputText ===
            '/claw/api/v1/studio/instances/local-built-in/files/%2Fworkspace%2Fmain%2FAGENTS.md' &&
          (init?.method ?? 'GET') === 'PUT'
        ) {
          return createJsonResponse(true) as Response;
        }

        if (
          inputText === '/claw/api/v1/studio/instances/local-built-in/llm-providers/openai' &&
          (init?.method ?? 'GET') === 'PUT'
        ) {
          return createJsonResponse(true) as Response;
        }

        throw new Error(`unexpected hosted mutation fetch input: ${inputText}`);
      },
    });

    assert.equal(configured, true);

    const created = await studio.createInstance({
      name: 'Created instance',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-managed',
      transportKind: 'openclawGatewayWs',
    });
    const updated = await studio.updateInstance('local-built-in', {
      name: 'Updated instance',
      status: 'offline',
    });
    const deleted = await studio.deleteInstance('local-built-in');
    const started = await studio.startInstance('local-built-in');
    const stopped = await studio.stopInstance('local-built-in');
    const restarted = await studio.restartInstance('local-built-in');
    const config = await studio.updateInstanceConfig('local-built-in', updatedConfig);
    const gatewayInvokeResult = await studio.invokeOpenClawGateway?.(
      'local-built-in',
      {
        tool: 'models',
        action: 'list',
        args: {},
      },
      {
        messageChannel: 'assistant',
      },
    );
    await studio.createInstanceTask('local-built-in', {
      id: 'job-1',
      name: 'Daily Sync',
      schedule: {
        kind: 'cron',
        expr: '0 9 * * *',
        tz: 'Asia/Shanghai',
      },
      payload: {
        kind: 'agentTurn',
        message: 'Summarize updates.',
        model: 'openai/gpt-5.4',
      },
    });
    await studio.updateInstanceTask('local-built-in', 'job-1', {
      id: 'job-1',
      name: 'Updated Daily Sync',
      enabled: false,
      schedule: {
        kind: 'cron',
        expr: '0 10 * * *',
        tz: 'Asia/Shanghai',
      },
      payload: {
        kind: 'agentTurn',
        message: 'Summarize only critical updates.',
        model: 'openai/gpt-5.4',
      },
    });
    await studio.cloneInstanceTask('local-built-in', 'job-1', 'Daily Sync Copy');
    const latestExecution = await studio.runInstanceTaskNow('local-built-in', 'job-1');
    const executions = await studio.listInstanceTaskExecutions('local-built-in', 'job-1');
    await studio.updateInstanceTaskStatus('local-built-in', 'job-1', 'paused');
    const fileUpdated = await studio.updateInstanceFileContent(
      'local-built-in',
      '/workspace/main/AGENTS.md',
      '# Updated main agent',
    );
    const providerUpdated = await studio.updateInstanceLlmProviderConfig(
      'local-built-in',
      'openai',
      {
        endpoint: 'https://api.openai.com/v1',
        apiKeySource: 'env:OPENAI_API_KEY',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
        embeddingModelId: 'text-embedding-3-large',
        config: {
          temperature: 0.1,
          topP: 1,
          maxTokens: 4096,
          timeoutMs: 60000,
          streaming: true,
        },
      },
    );
    const taskDeleted = await studio.deleteInstanceTask('local-built-in', 'job-1');

    assert.equal(created.id, 'created-instance');
    assert.equal(updated.name, 'Updated instance');
    assert.equal(deleted, true);
    assert.equal(started?.status, 'online');
    assert.equal(stopped?.status, 'offline');
    assert.equal(restarted?.status, 'online');
    assert.equal(config?.port, '28888');
    assert.deepEqual(gatewayInvokeResult, {
      accepted: true,
      tool: 'models',
      action: 'list',
      dryRun: false,
    });
    assert.equal(latestExecution.id, 'exec-1');
    assert.equal(executions.length, 1);
    assert.equal(fileUpdated, true);
    assert.equal(providerUpdated, true);
    assert.equal(taskDeleted, true);

    assert.deepEqual(requests, [
      {
        input: '/claw/api/v1/studio/instances',
        method: 'POST',
        body: '{"name":"Created instance","runtimeKind":"openclaw","deploymentMode":"local-managed","transportKind":"openclawGatewayWs"}',
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in',
        method: 'PUT',
        body: '{"name":"Updated instance","status":"offline"}',
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in',
        method: 'DELETE',
        body: null,
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in:start',
        method: 'POST',
        body: null,
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in:stop',
        method: 'POST',
        body: null,
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in:restart',
        method: 'POST',
        body: null,
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in/config',
        method: 'PUT',
        body: '{"port":"28888","sandbox":true,"autoUpdate":false,"logLevel":"debug","corsOrigins":"http://localhost:3001"}',
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in/gateway/invoke',
        method: 'POST',
        body: '{"request":{"tool":"models","action":"list","args":{}},"options":{"messageChannel":"assistant"}}',
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in/tasks',
        method: 'POST',
        body: '{"id":"job-1","name":"Daily Sync","schedule":{"kind":"cron","expr":"0 9 * * *","tz":"Asia/Shanghai"},"payload":{"kind":"agentTurn","message":"Summarize updates.","model":"openai/gpt-5.4"}}',
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in/tasks/job-1',
        method: 'PUT',
        body: '{"id":"job-1","name":"Updated Daily Sync","enabled":false,"schedule":{"kind":"cron","expr":"0 10 * * *","tz":"Asia/Shanghai"},"payload":{"kind":"agentTurn","message":"Summarize only critical updates.","model":"openai/gpt-5.4"}}',
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in/tasks/job-1:clone',
        method: 'POST',
        body: '{"name":"Daily Sync Copy"}',
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in/tasks/job-1:run',
        method: 'POST',
        body: null,
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in/tasks/job-1/executions',
        method: 'GET',
        body: null,
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in/tasks/job-1:status',
        method: 'POST',
        body: '{"status":"paused"}',
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in/files/%2Fworkspace%2Fmain%2FAGENTS.md',
        method: 'PUT',
        body: '{"content":"# Updated main agent"}',
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in/llm-providers/openai',
        method: 'PUT',
        body: '{"endpoint":"https://api.openai.com/v1","apiKeySource":"env:OPENAI_API_KEY","defaultModelId":"gpt-5.4","reasoningModelId":"o4-mini","embeddingModelId":"text-embedding-3-large","config":{"temperature":0.1,"topP":1,"maxTokens":4096,"timeoutMs":60000,"streaming":true}}',
      },
      {
        input: '/claw/api/v1/studio/instances/local-built-in/tasks/job-1',
        method: 'DELETE',
        body: null,
      },
    ]);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});
