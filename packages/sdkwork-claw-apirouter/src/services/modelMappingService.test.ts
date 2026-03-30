import assert from 'node:assert/strict';
import './apiRouterTestSetup.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

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

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: new MemoryStorage(),
});

await runTest('modelMappingService exposes the mapping and catalog service surface', async () => {
  let module: typeof import('./modelMappingService.ts');

  try {
    module = await import('./modelMappingService.ts');
  } catch (error) {
    assert.fail(`modelMappingService module is missing: ${String(error)}`);
  }

  assert.equal(typeof module.modelMappingService.getModelMappings, 'function');
  assert.equal(typeof module.modelMappingService.createModelMapping, 'function');
  assert.equal(typeof module.modelMappingService.updateModelMapping, 'function');
  assert.equal(typeof module.modelMappingService.updateStatus, 'function');
  assert.equal(typeof module.modelMappingService.deleteModelMapping, 'function');
  assert.equal(typeof module.modelMappingService.getModelCatalog, 'function');
});

await runTest('modelMappingService reads catalog and mappings from the shared studio mock layer', async () => {
  const infrastructure = await import('@sdkwork/claw-infrastructure');
  const { modelMappingService } = await import('./modelMappingService.ts');
  const originalMock = {
    listModelMappingCatalog: infrastructure.studioMockService.listModelMappingCatalog,
    listModelMappings: infrastructure.studioMockService.listModelMappings,
  };

  infrastructure.studioMockService.listModelMappingCatalog = async () =>
    clone([
      {
        channelId: 'google',
        channelName: 'Google',
        models: [
          {
            modelId: 'gemini-3.1-pro-preview',
            modelName: 'gemini-3.1-pro-preview',
          },
        ],
      },
      {
        channelId: 'openai',
        channelName: 'OpenAI',
        models: [
          {
            modelId: 'gpt-4.1-mini',
            modelName: 'gpt-4.1-mini',
          },
          {
            modelId: 'gpt-5.4',
            modelName: 'gpt-5.4',
          },
        ],
      },
    ]);
  infrastructure.studioMockService.listModelMappings = async () =>
    clone([
      {
        id: 'mapping-google-prod',
        name: 'Google Production',
        description: 'Gemini high-quality route',
        status: 'active',
        effectiveFrom: '2026-03-21T00:00:00.000Z',
        effectiveTo: '2026-12-31T23:59:59.000Z',
        rules: [
          {
            id: 'rule-google-prod',
            source: {
              channelId: 'google',
              channelName: 'Google',
              modelId: 'gemini-3.1-pro-preview',
              modelName: 'gemini-3.1-pro-preview',
            },
            target: {
              channelId: 'openai',
              channelName: 'OpenAI',
              modelId: 'gpt-5.4',
              modelName: 'gpt-5.4',
            },
          },
        ],
        createdAt: '2026-03-21T00:00:00.000Z',
        updatedAt: '2026-03-21T00:00:00.000Z',
      },
    ]);

  try {
    const catalog = await modelMappingService.getModelCatalog();
    const mappings = await modelMappingService.getModelMappings({
      keyword: 'gemini',
    });

    assert.deepEqual(catalog, [
      {
        channelId: 'google',
        channelName: 'Google',
        models: [
          {
            modelId: 'gemini-3.1-pro-preview',
            modelName: 'gemini-3.1-pro-preview',
          },
        ],
      },
      {
        channelId: 'openai',
        channelName: 'OpenAI',
        models: [
          {
            modelId: 'gpt-4.1-mini',
            modelName: 'gpt-4.1-mini',
          },
          {
            modelId: 'gpt-5.4',
            modelName: 'gpt-5.4',
          },
        ],
      },
    ]);
    assert.equal(mappings.length, 1);
    assert.equal(mappings[0]?.id, 'mapping-google-prod');
  } finally {
    infrastructure.studioMockService.listModelMappingCatalog =
      originalMock.listModelMappingCatalog;
    infrastructure.studioMockService.listModelMappings =
      originalMock.listModelMappings;
  }
});

await runTest('modelMappingService keeps model-mapping CRUD available on top of the shared studio mock layer', async () => {
  const infrastructure = await import('@sdkwork/claw-infrastructure');
  const { modelMappingService } = await import('./modelMappingService.ts');
  const originalMock = {
    createModelMapping: infrastructure.studioMockService.createModelMapping,
    updateModelMapping: infrastructure.studioMockService.updateModelMapping,
    updateModelMappingStatus: infrastructure.studioMockService.updateModelMappingStatus,
    deleteModelMapping: infrastructure.studioMockService.deleteModelMapping,
    listModelMappings: infrastructure.studioMockService.listModelMappings,
  };
  let currentItems: any[] = [];
  let sequence = 0;

  infrastructure.studioMockService.listModelMappings = async () => clone(currentItems);
  infrastructure.studioMockService.createModelMapping = async (input) => {
    const created = {
      id: `mapping-${++sequence}`,
      name: input.name,
      description: input.description,
      status: 'active',
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      rules: input.rules.map((rule, index) => ({
        id: `rule-${index + 1}`,
        source: { ...rule.source },
        target: { ...rule.target },
      })),
      createdAt: '2026-03-21T00:00:00.000Z',
      updatedAt: '2026-03-21T00:00:00.000Z',
    };
    currentItems = [...currentItems, created];
    return clone(created);
  };
  infrastructure.studioMockService.updateModelMapping = async (id, update) => {
    const current = currentItems.find((item) => item.id === id);
    if (!current) {
      return undefined;
    }

    const updated = {
      ...current,
      ...update,
      updatedAt: '2026-03-22T00:00:00.000Z',
    };
    currentItems = currentItems.map((item) => (item.id === id ? updated : item));
    return clone(updated);
  };
  infrastructure.studioMockService.updateModelMappingStatus = async (id, status) => {
    const current = currentItems.find((item) => item.id === id);
    if (!current) {
      return undefined;
    }

    const updated = {
      ...current,
      status,
      updatedAt: '2026-03-22T12:00:00.000Z',
    };
    currentItems = currentItems.map((item) => (item.id === id ? updated : item));
    return clone(updated);
  };
  infrastructure.studioMockService.deleteModelMapping = async (id) => {
    const sizeBefore = currentItems.length;
    currentItems = currentItems.filter((item) => item.id !== id);
    return currentItems.length !== sizeBefore;
  };

  try {
    const before = await modelMappingService.getModelMappings();
    assert.deepEqual(before, []);

    const created = await modelMappingService.createModelMapping({
      name: 'Policy Bridge',
      description: 'Local overlay mapping for hybrid route governance',
      effectiveFrom: '2026-03-21T00:00:00.000Z',
      effectiveTo: '2026-12-31T23:59:59.000Z',
      rules: [
        {
          source: {
            channelId: 'openai',
            channelName: 'OpenAI',
            modelId: 'gpt-5.4',
            modelName: 'GPT-5.4',
          },
          target: {
            channelId: 'google',
            channelName: 'Google',
            modelId: 'gemini-3.1-pro-preview',
            modelName: 'Gemini 3.1 Pro',
          },
        },
      ],
    });

    assert.equal(created.name, 'Policy Bridge');
    assert.equal(created.status, 'active');
    assert.equal(created.rules.length, 1);

    const updated = await modelMappingService.updateModelMapping(created.id, {
      description: 'Updated overlay description',
    });
    assert.equal(updated.description, 'Updated overlay description');

    const disabled = await modelMappingService.updateStatus(created.id, 'disabled');
    assert.equal(disabled.status, 'disabled');

    const filtered = await modelMappingService.getModelMappings({
      keyword: 'policy bridge',
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.id, created.id);

    const deleted = await modelMappingService.deleteModelMapping(created.id);
    assert.equal(deleted, true);

    const afterDelete = await modelMappingService.getModelMappings();
    assert.deepEqual(afterDelete, []);
  } finally {
    infrastructure.studioMockService.createModelMapping =
      originalMock.createModelMapping;
    infrastructure.studioMockService.updateModelMapping =
      originalMock.updateModelMapping;
    infrastructure.studioMockService.updateModelMappingStatus =
      originalMock.updateModelMappingStatus;
    infrastructure.studioMockService.deleteModelMapping =
      originalMock.deleteModelMapping;
    infrastructure.studioMockService.listModelMappings =
      originalMock.listModelMappings;
  }
});
