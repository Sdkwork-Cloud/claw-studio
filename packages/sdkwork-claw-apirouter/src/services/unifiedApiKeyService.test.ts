import assert from 'node:assert/strict';
import {
  clearApiRouterAdminSession,
  configurePlatformBridge,
  writeApiRouterAdminSession,
  type RuntimeApiRouterRuntimeStatus,
} from '@sdkwork/claw-infrastructure';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createRuntimeStatus(
  overrides: Partial<RuntimeApiRouterRuntimeStatus> = {},
): RuntimeApiRouterRuntimeStatus {
  return {
    mode: 'attachedExternal',
    recommendedManagedMode: null,
    sharedRootDir: 'C:/Users/admin/.sdkwork/router',
    configDir: 'C:/Users/admin/.sdkwork/router',
    configSource: 'file',
    resolvedConfigFile: 'C:/Users/admin/.sdkwork/router/config.yml',
    admin: {
      bindAddr: '127.0.0.1:8081',
      healthUrl: 'http://127.0.0.1:8081/admin/health',
      enabled: true,
      publicBaseUrl: 'http://127.0.0.1:13003/api/admin',
      healthy: true,
      portAvailable: false,
    },
    portal: {
      bindAddr: '127.0.0.1:8082',
      healthUrl: 'http://127.0.0.1:8082/portal/health',
      enabled: true,
      publicBaseUrl: 'http://127.0.0.1:13003/api/portal',
      healthy: true,
      portAvailable: false,
    },
    gateway: {
      bindAddr: '127.0.0.1:8080',
      healthUrl: 'http://127.0.0.1:8080/health',
      enabled: true,
      publicBaseUrl: 'http://127.0.0.1:13003/api',
      healthy: true,
      portAvailable: false,
    },
    adminSiteBaseUrl: 'http://127.0.0.1:13003/admin',
    portalSiteBaseUrl: 'http://127.0.0.1:13003/portal',
    reason: 'Detected a healthy independently started sdkwork-api-router runtime.',
    ...overrides,
  };
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: new MemoryStorage(),
});

function configureRouterRuntime() {
  configurePlatformBridge({
    runtime: {
      getRuntimeInfo: async () => ({ platform: 'desktop' }),
      getApiRouterRuntimeStatus: async () => createRuntimeStatus(),
      setAppLanguage: async () => {},
      submitProcessJob: async () => 'job-unified-api-router',
      getJob: async () => ({
        id: 'job-unified-api-router',
        kind: 'process',
        state: 'queued',
        stage: 'queued',
      }),
      listJobs: async () => [],
      cancelJob: async () => ({
        id: 'job-unified-api-router',
        kind: 'process',
        state: 'cancelled',
        stage: 'cancelled',
      }),
      subscribeJobUpdates: async () => () => {},
      subscribeProcessOutput: async () => () => {},
    },
  });
}

function installRouterAdminSession() {
  writeApiRouterAdminSession({
    token: 'router-admin-token',
    user: {
      id: 'admin_local_default',
      email: 'admin@sdkwork.local',
      displayName: 'Admin Operator',
      active: true,
      createdAtMs: 1_700_000_000_000,
    },
  });
}

await runTest('unifiedApiKeyService maps router tenants and gateway API keys into the unified access model', async () => {
  configureRouterRuntime();
  installRouterAdminSession();

  const now = Date.now();
  const responses = new Map<string, unknown>([
    [
      '/api/admin/tenants',
      [
        {
          id: 'tenant-acme',
          name: 'Acme Workspace',
        },
      ],
    ],
    [
      '/api/admin/projects',
      [
        {
          tenant_id: 'tenant-acme',
          id: 'project-acme-unified-key',
          name: 'Acme Production Key',
        },
      ],
    ],
    [
      '/api/admin/api-keys',
      [
        {
          tenant_id: 'tenant-acme',
          project_id: 'project-acme-unified-key',
          environment: 'live',
          hashed_key: 'hash-acme-primary-key',
          label: 'Acme Production',
          notes: 'Primary external tenant key',
          created_at_ms: now - 2 * 60 * 60 * 1000,
          last_used_at_ms: now - 30 * 60 * 1000,
          expires_at_ms: now + 15 * 24 * 60 * 60 * 1000,
          active: true,
        },
      ],
    ],
    [
      '/api/admin/usage/records',
      [
        {
          project_id: 'project-acme-unified-key',
          model: 'gpt-5.4',
          provider: 'provider-openai-official',
          units: 1,
          amount: 0.42,
          input_tokens: 120,
          output_tokens: 80,
          total_tokens: 200,
          created_at_ms: now - 15 * 60 * 1000,
        },
        {
          project_id: 'project-acme-unified-key',
          model: 'claude-sonnet-4',
          provider: 'provider-anthropic-official',
          units: 1,
          amount: 0.58,
          input_tokens: 210,
          output_tokens: 90,
          total_tokens: 300,
          created_at_ms: now - 5 * 60 * 1000,
        },
      ],
    ],
  ]);

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const payload = responses.get(url.pathname);
    if (payload === undefined) {
      return new Response('Not found', { status: 404 });
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    });
  }) as typeof fetch;

  const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');

  const groups = await unifiedApiKeyService.getGroups();
  const items = await unifiedApiKeyService.getUnifiedApiKeys({
    groupId: 'tenant-acme',
    keyword: 'acme',
  });

  assert.deepEqual(groups, [
    {
      id: 'tenant-acme',
      name: 'Acme Workspace',
      description: 'Tenant tenant-acme',
    },
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0]?.id, 'hash-acme-primary-key');
  assert.equal(items[0]?.name, 'Acme Production');
  assert.equal(items[0]?.groupId, 'tenant-acme');
  assert.equal(items[0]?.tenantId, 'tenant-acme');
  assert.equal(items[0]?.projectId, 'project-acme-unified-key');
  assert.equal(items[0]?.environment, 'live');
  assert.equal(items[0]?.apiKey, '');
  assert.equal(items[0]?.hashedKey, 'hash-acme-primary-key');
  assert.equal(items[0]?.canCopyApiKey, false);
  assert.equal(items[0]?.source, 'system-generated');
  assert.equal(items[0]?.usage.requestCount, 2);
  assert.equal(items[0]?.usage.tokenCount, 500);
  assert.equal(items[0]?.usage.spendUsd, 1);
  assert.equal(items[0]?.notes, 'Primary external tenant key');
  assert.equal(items[0]?.status, 'active');
  assert.equal((items[0] as Record<string, unknown>)?.routeMode, 'sdkwork-remote');
  assert.equal((items[0] as Record<string, unknown>)?.routeProviderId, undefined);
});

await runTest('unifiedApiKeyService hydrates plaintext router keys from admin list responses and keeps them copyable', async () => {
  configureRouterRuntime();
  installRouterAdminSession();

  const now = Date.now();
  const responses = new Map<string, unknown>([
    [
      '/api/admin/tenants',
      [
        {
          id: 'tenant-acme',
          name: 'Acme Workspace',
        },
      ],
    ],
    [
      '/api/admin/projects',
      [
        {
          tenant_id: 'tenant-acme',
          id: 'project-acme-unified-key',
          name: 'Acme Production Key',
        },
      ],
    ],
    [
      '/api/admin/api-keys',
      [
        {
          tenant_id: 'tenant-acme',
          project_id: 'project-acme-unified-key',
          environment: 'live',
          hashed_key: 'hash-acme-primary-key',
          plaintext: 'sk-ar-v1-abc123def456ghi789jkl012mno345pq',
          label: 'Acme Production',
          notes: 'Primary external tenant key',
          source: 'custom',
          created_at_ms: now - 2 * 60 * 60 * 1000,
          last_used_at_ms: now - 30 * 60 * 1000,
          expires_at_ms: now + 15 * 24 * 60 * 60 * 1000,
          active: true,
        },
      ],
    ],
    ['/api/admin/usage/records', []],
  ]);

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const payload = responses.get(url.pathname);
    if (payload === undefined) {
      return new Response('Not found', { status: 404 });
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    });
  }) as typeof fetch;

  const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');
  const items = await unifiedApiKeyService.getUnifiedApiKeys({
    groupId: 'tenant-acme',
  });

  assert.equal(items.length, 1);
  assert.equal(items[0]?.apiKey, 'sk-ar-v1-abc123def456ghi789jkl012mno345pq');
  assert.equal(items[0]?.canCopyApiKey, true);
  assert.equal(items[0]?.source, 'custom');
});

await runTest('unifiedApiKeyService creates one hidden router project per key and keeps the plaintext secret available for immediate setup', async () => {
  configureRouterRuntime();
  installRouterAdminSession();

  const now = Date.now();
  const requests: Array<{ method: string; pathname: string; body: unknown }> = [];
  const createdProjects = new Map<string, { tenant_id: string; id: string; name: string }>();
  const createdKeys = new Map<
    string,
    {
      tenant_id: string;
      project_id: string;
      environment: string;
      hashed_key: string;
      label: string;
      notes?: string | null;
      created_at_ms: number;
      expires_at_ms?: number | null;
      active: boolean;
    }
  >();

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const parsedBody = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({
      method,
      pathname: url.pathname,
      body: parsedBody,
    });

    if (method === 'GET' && url.pathname === '/api/admin/tenants') {
      return new Response(
        JSON.stringify([
          {
            id: 'tenant-acme',
            name: 'Acme Workspace',
          },
        ]),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      );
    }

    if (method === 'GET' && url.pathname === '/api/admin/projects') {
      return new Response(JSON.stringify([...createdProjects.values()]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    if (method === 'GET' && url.pathname === '/api/admin/api-keys') {
      return new Response(JSON.stringify([...createdKeys.values()]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    if (method === 'GET' && url.pathname === '/api/admin/usage/records') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    if (method === 'POST' && url.pathname === '/api/admin/projects') {
      createdProjects.set(String(parsedBody.id), {
        tenant_id: String(parsedBody.tenant_id),
        id: String(parsedBody.id),
        name: String(parsedBody.name),
      });

      return new Response(JSON.stringify(createdProjects.get(String(parsedBody.id))), {
        status: 201,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    if (method === 'POST' && url.pathname === '/api/admin/api-keys') {
      const hashedKey = `hash-${String(parsedBody.project_id)}`;
      createdKeys.set(hashedKey, {
        tenant_id: String(parsedBody.tenant_id),
        project_id: String(parsedBody.project_id),
        environment: String(parsedBody.environment),
        hashed_key: hashedKey,
        label: String(parsedBody.label),
        notes: parsedBody.notes ? String(parsedBody.notes) : null,
        created_at_ms: now,
        expires_at_ms:
          typeof parsedBody.expires_at_ms === 'number' ? parsedBody.expires_at_ms : null,
        active: true,
      });

      return new Response(
        JSON.stringify({
          plaintext: String(parsedBody.plaintext_key),
          hashed: hashedKey,
          tenant_id: String(parsedBody.tenant_id),
          project_id: String(parsedBody.project_id),
          environment: String(parsedBody.environment),
          label: String(parsedBody.label),
          notes: parsedBody.notes ? String(parsedBody.notes) : null,
          created_at_ms: now,
          expires_at_ms:
            typeof parsedBody.expires_at_ms === 'number' ? parsedBody.expires_at_ms : null,
        }),
        {
          status: 201,
          headers: {
            'content-type': 'application/json',
          },
        },
      );
    }

    return new Response('Not found', { status: 404 });
  }) as typeof fetch;

  const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');

  const created = await unifiedApiKeyService.createUnifiedApiKey({
    name: 'Acme Imported Key',
    groupId: 'tenant-acme',
    source: 'custom',
    apiKey: 'sk-ar-v1-customimportedkey0000000000000',
    expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Imported from enterprise operator console',
  });

  assert.equal(created.groupId, 'tenant-acme');
  assert.equal(created.projectId?.startsWith('uak-'), true);
  assert.equal(created.apiKey, 'sk-ar-v1-customimportedkey0000000000000');
  assert.equal(created.canCopyApiKey, true);
  assert.equal(created.source, 'custom');
  assert.equal(created.notes, 'Imported from enterprise operator console');

  const projectCreateRequest = requests.find(
    (request) => request.method === 'POST' && request.pathname === '/api/admin/projects',
  );
  const apiKeyCreateRequest = requests.find(
    (request) => request.method === 'POST' && request.pathname === '/api/admin/api-keys',
  );

  assert.ok(projectCreateRequest);
  assert.ok(apiKeyCreateRequest);
  assert.equal(typeof (projectCreateRequest?.body as { id?: unknown }).id, 'string');
  assert.equal((projectCreateRequest?.body as { tenant_id?: unknown }).tenant_id, 'tenant-acme');
  assert.equal((apiKeyCreateRequest?.body as { tenant_id?: unknown }).tenant_id, 'tenant-acme');
  assert.equal(
    (apiKeyCreateRequest?.body as { project_id?: unknown }).project_id,
    (projectCreateRequest?.body as { id?: unknown }).id,
  );
  assert.equal(
    (apiKeyCreateRequest?.body as { plaintext_key?: unknown }).plaintext_key,
    'sk-ar-v1-customimportedkey0000000000000',
  );
  assert.equal(
    (apiKeyCreateRequest?.body as { notes?: unknown }).notes,
    'Imported from enterprise operator console',
  );

  const items = await unifiedApiKeyService.getUnifiedApiKeys({
    groupId: 'tenant-acme',
  });
  const createdAgain = items.find((item) => item.id === created.id);

  assert.ok(createdAgain);
  assert.equal(createdAgain?.apiKey, 'sk-ar-v1-customimportedkey0000000000000');
  assert.equal(createdAgain?.canCopyApiKey, true);
  assert.equal(createdAgain?.hashedKey, created.id);
  assert.equal(createdAgain?.projectId, created.projectId);
});

await runTest('unifiedApiKeyService generates OpenAI-like sk-ar-v1 router keys for system-generated mode and persists them locally', async () => {
  configureRouterRuntime();
  installRouterAdminSession();

  const now = Date.now();
  const requests: Array<{ method: string; pathname: string; body: unknown }> = [];
  const createdProjects = new Map<string, { tenant_id: string; id: string; name: string }>();
  const createdKeys = new Map<
    string,
    {
      tenant_id: string;
      project_id: string;
      environment: string;
      hashed_key: string;
      label: string;
      notes?: string | null;
      created_at_ms: number;
      expires_at_ms?: number | null;
      active: boolean;
    }
  >();

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const parsedBody = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({
      method,
      pathname: url.pathname,
      body: parsedBody,
    });

    if (method === 'GET' && url.pathname === '/api/admin/tenants') {
      return new Response(
        JSON.stringify([
          {
            id: 'tenant-acme',
            name: 'Acme Workspace',
          },
        ]),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      );
    }

    if (method === 'GET' && url.pathname === '/api/admin/projects') {
      return new Response(JSON.stringify([...createdProjects.values()]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    if (method === 'GET' && url.pathname === '/api/admin/api-keys') {
      return new Response(JSON.stringify([...createdKeys.values()]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    if (method === 'GET' && url.pathname === '/api/admin/usage/records') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    if (method === 'POST' && url.pathname === '/api/admin/projects') {
      createdProjects.set(String(parsedBody.id), {
        tenant_id: String(parsedBody.tenant_id),
        id: String(parsedBody.id),
        name: String(parsedBody.name),
      });

      return new Response(JSON.stringify(createdProjects.get(String(parsedBody.id))), {
        status: 201,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    if (method === 'POST' && url.pathname === '/api/admin/api-keys') {
      const hashedKey = `hash-${String(parsedBody.project_id)}`;
      createdKeys.set(hashedKey, {
        tenant_id: String(parsedBody.tenant_id),
        project_id: String(parsedBody.project_id),
        environment: String(parsedBody.environment),
        hashed_key: hashedKey,
        label: String(parsedBody.label),
        notes: parsedBody.notes ? String(parsedBody.notes) : null,
        created_at_ms: now,
        expires_at_ms:
          typeof parsedBody.expires_at_ms === 'number' ? parsedBody.expires_at_ms : null,
        active: true,
      });

      return new Response(
        JSON.stringify({
          plaintext: String(parsedBody.plaintext_key),
          hashed: hashedKey,
          tenant_id: String(parsedBody.tenant_id),
          project_id: String(parsedBody.project_id),
          environment: String(parsedBody.environment),
          label: String(parsedBody.label),
          notes: parsedBody.notes ? String(parsedBody.notes) : null,
          created_at_ms: now,
          expires_at_ms:
            typeof parsedBody.expires_at_ms === 'number' ? parsedBody.expires_at_ms : null,
        }),
        {
          status: 201,
          headers: {
            'content-type': 'application/json',
          },
        },
      );
    }

    return new Response('Not found', { status: 404 });
  }) as typeof fetch;

  const {
    ROUTER_PLAINTEXT_KEY_STORAGE_KEY,
    unifiedApiKeyService,
  } = await import('./unifiedApiKeyService.ts');

  const created = await unifiedApiKeyService.createUnifiedApiKey({
    name: 'Acme Generated Key',
    groupId: 'tenant-acme',
    source: 'system-generated',
    notes: 'Generated by router manager',
  });

  assert.match(created.apiKey, /^sk-ar-v1-[a-z0-9]{32}$/);
  assert.equal(created.canCopyApiKey, true);

  const apiKeyCreateRequest = requests.find(
    (request) => request.method === 'POST' && request.pathname === '/api/admin/api-keys',
  );

  assert.ok(apiKeyCreateRequest);
  assert.match(
    String((apiKeyCreateRequest?.body as { plaintext_key?: unknown }).plaintext_key),
    /^sk-ar-v1-[a-z0-9]{32}$/,
  );

  const persistedSecrets = JSON.parse(
    globalThis.localStorage.getItem(ROUTER_PLAINTEXT_KEY_STORAGE_KEY) || '{}',
  ) as Record<string, { apiKey?: string }>;

  assert.equal(persistedSecrets[created.id]?.apiKey, created.apiKey);
});

await runTest('unifiedApiKeyService ignores caller-supplied plaintext when system-generated mode is requested', async () => {
  configureRouterRuntime();
  installRouterAdminSession();

  const now = Date.now();
  const requests: Array<{ method: string; pathname: string; body: unknown }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const parsedBody = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({
      method,
      pathname: url.pathname,
      body: parsedBody,
    });

    if (method === 'GET' && url.pathname === '/api/admin/tenants') {
      return new Response(
        JSON.stringify([
          {
            id: 'tenant-acme',
            name: 'Acme Workspace',
          },
        ]),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      );
    }

    if (method === 'POST' && url.pathname === '/api/admin/projects') {
      return new Response(JSON.stringify(parsedBody), {
        status: 201,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    if (method === 'POST' && url.pathname === '/api/admin/api-keys') {
      return new Response(
        JSON.stringify({
          plaintext: String(parsedBody.plaintext_key),
          hashed: 'hash-system-generated-enforced',
          tenant_id: String(parsedBody.tenant_id),
          project_id: String(parsedBody.project_id),
          environment: String(parsedBody.environment),
          label: String(parsedBody.label),
          notes: parsedBody.notes ? String(parsedBody.notes) : null,
          created_at_ms: now,
          expires_at_ms: null,
        }),
        {
          status: 201,
          headers: {
            'content-type': 'application/json',
          },
        },
      );
    }

    if (method === 'GET' && url.pathname === '/api/admin/projects') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    if (method === 'GET' && url.pathname === '/api/admin/api-keys') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    if (method === 'GET' && url.pathname === '/api/admin/usage/records') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    return new Response('Not found', { status: 404 });
  }) as typeof fetch;

  const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');

  const created = await unifiedApiKeyService.createUnifiedApiKey({
    name: 'Acme Forced Generated Key',
    groupId: 'tenant-acme',
    source: 'system-generated',
    apiKey: 'sk-ar-v1-shouldnotbeused000000000000000',
  });

  const apiKeyCreateRequest = requests.find(
    (request) => request.method === 'POST' && request.pathname === '/api/admin/api-keys',
  );

  assert.ok(apiKeyCreateRequest);
  assert.match(
    String((apiKeyCreateRequest?.body as { plaintext_key?: unknown }).plaintext_key),
    /^sk-ar-v1-[a-z0-9]{32}$/,
  );
  assert.notEqual(
    (apiKeyCreateRequest?.body as { plaintext_key?: unknown }).plaintext_key,
    'sk-ar-v1-shouldnotbeused000000000000000',
  );
  assert.equal(
    created.apiKey,
    (apiKeyCreateRequest?.body as { plaintext_key?: string }).plaintext_key,
  );
});

await runTest('unifiedApiKeyService updates router-backed key metadata and tenant ownership through the admin API', async () => {
  configureRouterRuntime();
  installRouterAdminSession();

  const now = Date.now();
  const requests: Array<{ method: string; pathname: string; body: unknown }> = [];
  const projects = new Map<string, { tenant_id: string; id: string; name: string }>([
    [
      'project-acme-unified-key',
      {
        tenant_id: 'tenant-acme',
        id: 'project-acme-unified-key',
        name: 'Acme Production Project',
      },
    ],
  ]);
  const apiKeys = new Map<
    string,
    {
      tenant_id: string;
      project_id: string;
      environment: string;
      hashed_key: string;
      label: string;
      notes?: string | null;
      created_at_ms: number;
      expires_at_ms?: number | null;
      active: boolean;
    }
  >([
    [
      'hash-acme-primary-key',
      {
        tenant_id: 'tenant-acme',
        project_id: 'project-acme-unified-key',
        environment: 'live',
        hashed_key: 'hash-acme-primary-key',
        label: 'Acme Primary Key',
        notes: 'Initial tenant-owned key',
        created_at_ms: now - 60 * 60 * 1000,
        expires_at_ms: now + 5 * 24 * 60 * 60 * 1000,
        active: true,
      },
    ],
  ]);

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const parsedBody = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({
      method,
      pathname: url.pathname,
      body: parsedBody,
    });

    if (method === 'GET' && url.pathname === '/api/admin/tenants') {
      return new Response(
        JSON.stringify([
          { id: 'tenant-acme', name: 'Acme Workspace' },
          { id: 'tenant-globex', name: 'Globex Workspace' },
        ]),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    }

    if (method === 'GET' && url.pathname === '/api/admin/projects') {
      return new Response(JSON.stringify([...projects.values()]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (method === 'GET' && url.pathname === '/api/admin/api-keys') {
      return new Response(JSON.stringify([...apiKeys.values()]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (method === 'GET' && url.pathname === '/api/admin/usage/records') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (method === 'POST' && url.pathname === '/api/admin/projects') {
      projects.set(String(parsedBody.id), {
        tenant_id: String(parsedBody.tenant_id),
        id: String(parsedBody.id),
        name: String(parsedBody.name),
      });

      return new Response(JSON.stringify(projects.get(String(parsedBody.id))), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (method === 'PUT' && url.pathname === '/api/admin/api-keys/hash-acme-primary-key') {
      apiKeys.set('hash-acme-primary-key', {
        tenant_id: String(parsedBody.tenant_id),
        project_id: String(parsedBody.project_id),
        environment: 'live',
        hashed_key: 'hash-acme-primary-key',
        label: String(parsedBody.label),
        notes: parsedBody.notes ? String(parsedBody.notes) : null,
        created_at_ms: now - 60 * 60 * 1000,
        expires_at_ms:
          typeof parsedBody.expires_at_ms === 'number' ? parsedBody.expires_at_ms : null,
        active: true,
      });

      return new Response(JSON.stringify(apiKeys.get('hash-acme-primary-key')), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }) as typeof fetch;

  const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');

  const updated = await unifiedApiKeyService.updateUnifiedApiKey('hash-acme-primary-key', {
    name: 'Globex Primary Key',
    groupId: 'tenant-globex',
    notes: 'Moved to Globex tenant',
    expiresAt: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });

  assert.equal(updated.groupId, 'tenant-globex');
  assert.equal(updated.tenantId, 'tenant-globex');
  assert.equal(updated.projectId, 'project-acme-unified-key');
  assert.equal(updated.name, 'Globex Primary Key');
  assert.equal(updated.notes, 'Moved to Globex tenant');

  const projectCreateRequest = requests.find(
    (request) => request.method === 'POST' && request.pathname === '/api/admin/projects',
  );
  const apiKeyUpdateRequest = requests.find(
    (request) => request.method === 'PUT' && request.pathname === '/api/admin/api-keys/hash-acme-primary-key',
  );

  assert.ok(projectCreateRequest);
  assert.ok(apiKeyUpdateRequest);
  assert.equal((projectCreateRequest?.body as { tenant_id?: unknown }).tenant_id, 'tenant-globex');
  assert.equal((apiKeyUpdateRequest?.body as { tenant_id?: unknown }).tenant_id, 'tenant-globex');
  assert.equal(
    (apiKeyUpdateRequest?.body as { label?: unknown }).label,
    'Globex Primary Key',
  );
  assert.equal(
    (apiKeyUpdateRequest?.body as { notes?: unknown }).notes,
    'Moved to Globex tenant',
  );
});

await runTest('unifiedApiKeyService persists local route preferences and model mapping overlays for hybrid routing', async () => {
  globalThis.localStorage.clear();
  configureRouterRuntime();
  installRouterAdminSession();

  const now = Date.now();
  const apiKeys = [
    {
      tenant_id: 'tenant-acme',
      project_id: 'project-routing-overlay',
      environment: 'live',
      hashed_key: 'hash-routing-overlay',
      label: 'Routing Overlay Key',
      notes: 'Hybrid routing demo key',
      created_at_ms: now - 60 * 60 * 1000,
      expires_at_ms: now + 5 * 24 * 60 * 60 * 1000,
      active: true,
    },
  ];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const parsedBody = init?.body ? JSON.parse(String(init.body)) : null;

    if (method === 'GET' && url.pathname === '/api/admin/tenants') {
      return new Response(
        JSON.stringify([
          { id: 'tenant-acme', name: 'Acme Workspace' },
        ]),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    }

    if (method === 'GET' && url.pathname === '/api/admin/projects') {
      return new Response(
        JSON.stringify([
          {
            tenant_id: 'tenant-acme',
            id: 'project-routing-overlay',
            name: 'Routing Overlay Project',
          },
        ]),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    }

    if (method === 'GET' && url.pathname === '/api/admin/api-keys') {
      return new Response(JSON.stringify(apiKeys), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (method === 'GET' && url.pathname === '/api/admin/usage/records') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (method === 'POST' && url.pathname === '/api/admin/projects') {
      return new Response(JSON.stringify(parsedBody), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (method === 'PUT' && url.pathname === '/api/admin/api-keys/hash-routing-overlay') {
      return new Response(
        JSON.stringify({
          ...apiKeys[0],
          tenant_id: parsedBody.tenant_id ?? apiKeys[0].tenant_id,
          project_id: parsedBody.project_id ?? apiKeys[0].project_id,
          label: parsedBody.label ?? apiKeys[0].label,
          notes: parsedBody.notes ?? apiKeys[0].notes,
          expires_at_ms:
            typeof parsedBody.expires_at_ms === 'number'
              ? parsedBody.expires_at_ms
              : apiKeys[0].expires_at_ms,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    }

    return new Response('Not found', { status: 404 });
  }) as typeof fetch;

  const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');

  const updated = await unifiedApiKeyService.updateUnifiedApiKey('hash-routing-overlay', {
    modelMappingId: 'mapping-local-overlay',
    routeMode: 'custom',
    routeProviderId: 'provider-openai-official',
  } as Record<string, unknown> as never);

  assert.equal((updated as Record<string, unknown>).modelMappingId, 'mapping-local-overlay');
  assert.equal((updated as Record<string, unknown>).routeMode, 'custom');
  assert.equal((updated as Record<string, unknown>).routeProviderId, 'provider-openai-official');

  const reloaded = await unifiedApiKeyService.getUnifiedApiKeys();
  assert.equal(
    (reloaded[0] as Record<string, unknown>).modelMappingId,
    'mapping-local-overlay',
  );
  assert.equal((reloaded[0] as Record<string, unknown>).routeMode, 'custom');
  assert.equal(
    (reloaded[0] as Record<string, unknown>).routeProviderId,
    'provider-openai-official',
  );
});

await runTest('unifiedApiKeyService creates the first router tenant from a freeform group name before creating the key', async () => {
  configureRouterRuntime();
  installRouterAdminSession();

  const now = Date.now();
  const requests: Array<{ method: string; pathname: string; body: unknown }> = [];
  const createdTenants = new Map<string, { id: string; name: string }>();
  const createdProjects = new Map<string, { tenant_id: string; id: string; name: string }>();
  const createdKeys = new Map<
    string,
    {
      tenant_id: string;
      project_id: string;
      environment: string;
      hashed_key: string;
      label: string;
      notes?: string | null;
      created_at_ms: number;
      expires_at_ms?: number | null;
      active: boolean;
    }
  >();

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const parsedBody = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({
      method,
      pathname: url.pathname,
      body: parsedBody,
    });

    if (method === 'GET' && url.pathname === '/api/admin/tenants') {
      return new Response(JSON.stringify([...createdTenants.values()]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    if (method === 'POST' && url.pathname === '/api/admin/tenants') {
      createdTenants.set(String(parsedBody.id), {
        id: String(parsedBody.id),
        name: String(parsedBody.name),
      });

      return new Response(JSON.stringify(createdTenants.get(String(parsedBody.id))), {
        status: 201,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    if (method === 'GET' && url.pathname === '/api/admin/projects') {
      return new Response(JSON.stringify([...createdProjects.values()]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    if (method === 'POST' && url.pathname === '/api/admin/projects') {
      createdProjects.set(String(parsedBody.id), {
        tenant_id: String(parsedBody.tenant_id),
        id: String(parsedBody.id),
        name: String(parsedBody.name),
      });

      return new Response(JSON.stringify(createdProjects.get(String(parsedBody.id))), {
        status: 201,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    if (method === 'GET' && url.pathname === '/api/admin/api-keys') {
      return new Response(JSON.stringify([...createdKeys.values()]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    if (method === 'POST' && url.pathname === '/api/admin/api-keys') {
      const hashedKey = `hash-${String(parsedBody.project_id)}`;
      createdKeys.set(hashedKey, {
        tenant_id: String(parsedBody.tenant_id),
        project_id: String(parsedBody.project_id),
        environment: String(parsedBody.environment),
        hashed_key: hashedKey,
        label: String(parsedBody.label),
        notes: parsedBody.notes ? String(parsedBody.notes) : null,
        created_at_ms: now,
        expires_at_ms:
          typeof parsedBody.expires_at_ms === 'number' ? parsedBody.expires_at_ms : null,
        active: true,
      });

      return new Response(
        JSON.stringify({
          plaintext: 'sk-ar-v1-generatedbootstrapkey00000000000',
          hashed: hashedKey,
          tenant_id: String(parsedBody.tenant_id),
          project_id: String(parsedBody.project_id),
          environment: String(parsedBody.environment),
          label: String(parsedBody.label),
          notes: parsedBody.notes ? String(parsedBody.notes) : null,
          created_at_ms: now,
          expires_at_ms:
            typeof parsedBody.expires_at_ms === 'number' ? parsedBody.expires_at_ms : null,
        }),
        {
          status: 201,
          headers: {
            'content-type': 'application/json',
          },
        },
      );
    }

    if (method === 'GET' && url.pathname === '/api/admin/usage/records') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    return new Response('Not found', { status: 404 });
  }) as typeof fetch;

  const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');

  const created = await unifiedApiKeyService.createUnifiedApiKey({
    name: 'Bootstrap Key',
    groupId: '',
    groupName: 'Acme Workspace',
    source: 'system-generated',
    notes: 'Initial tenant bootstrap',
  });

  assert.equal(created.apiKey, 'sk-ar-v1-generatedbootstrapkey00000000000');
  assert.match(created.groupId, /^tenant-/);

  const tenantCreateRequest = requests.find(
    (request) => request.method === 'POST' && request.pathname === '/api/admin/tenants',
  );
  const projectCreateRequest = requests.find(
    (request) => request.method === 'POST' && request.pathname === '/api/admin/projects',
  );
  const apiKeyCreateRequest = requests.find(
    (request) => request.method === 'POST' && request.pathname === '/api/admin/api-keys',
  );

  assert.ok(tenantCreateRequest);
  assert.ok(projectCreateRequest);
  assert.ok(apiKeyCreateRequest);
  assert.match(String((tenantCreateRequest?.body as { id?: unknown }).id), /^tenant-/);
  assert.equal((tenantCreateRequest?.body as { name?: unknown }).name, 'Acme Workspace');
  assert.equal(
    (projectCreateRequest?.body as { tenant_id?: unknown }).tenant_id,
    (tenantCreateRequest?.body as { id?: unknown }).id,
  );
  assert.equal(
    (apiKeyCreateRequest?.body as { tenant_id?: unknown }).tenant_id,
    (tenantCreateRequest?.body as { id?: unknown }).id,
  );
});

await runTest('unifiedApiKeyService rejects reads when router admin access is unavailable instead of falling back to mock data', async () => {
  configureRouterRuntime();
  clearApiRouterAdminSession();

  globalThis.fetch = (async () => new Response('Unauthorized', { status: 401 })) as typeof fetch;

  const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');

  await assert.rejects(
    () => unifiedApiKeyService.getUnifiedApiKeys(),
    /401|unauthorized/i,
  );
});

await runTest('unifiedApiKeyService rejects writes when router admin access is unavailable instead of creating mock keys', async () => {
  configureRouterRuntime();
  clearApiRouterAdminSession();

  globalThis.fetch = (async () => new Response('Unauthorized', { status: 401 })) as typeof fetch;

  const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');

  await assert.rejects(
    () =>
      unifiedApiKeyService.createUnifiedApiKey({
        name: 'Unavailable Key',
        groupId: 'tenant-local',
        source: 'system-generated',
      }),
    /401|unauthorized/i,
  );
});
