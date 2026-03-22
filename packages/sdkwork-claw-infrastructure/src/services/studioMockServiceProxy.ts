export type {
  MockChannel,
  MockChannelField,
  MockInstance,
  MockInstanceConfig,
  MockInstanceFile,
  MockInstanceLLMProvider,
  MockInstanceLLMProviderConfig,
  MockInstanceLLMProviderCreate,
  MockInstanceLLMProviderModel,
  MockInstanceLLMProviderUpdate,
  MockInstanceMemoryEntry,
  MockInstanceTool,
  MockTask,
  MockTaskExecutionHistoryEntry,
} from './studioMockService.ts';

type StudioMockService = typeof import('./studioMockService.ts')['studioMockService'];

let studioMockServicePromise: Promise<StudioMockService> | null = null;
const studioMockServiceOverrides = new Map<PropertyKey, unknown>();
const studioMockServiceWrappers = new Map<PropertyKey, unknown>();

export async function getStudioMockService(): Promise<StudioMockService> {
  if (!studioMockServicePromise) {
    studioMockServicePromise = import('./studioMockService.ts')
      .then((module) => module.studioMockService)
      .catch((error) => {
        studioMockServicePromise = null;
        throw error;
      });
  }

  return studioMockServicePromise;
}

function getStudioMockServiceWrapper(prop: PropertyKey) {
  if (!studioMockServiceWrappers.has(prop)) {
    studioMockServiceWrappers.set(
      prop,
      async (...args: unknown[]) => {
        const studioMockService = await getStudioMockService();
        const member = studioMockService[prop as keyof StudioMockService];
        if (typeof member !== 'function') {
          return member;
        }

        return (member as (...callArgs: unknown[]) => unknown).apply(studioMockService, args);
      },
    );
  }

  return studioMockServiceWrappers.get(prop);
}

export const studioMockService = new Proxy({} as StudioMockService, {
  get(_target, prop) {
    if (prop === 'then' || typeof prop === 'symbol') {
      return undefined;
    }

    if (studioMockServiceOverrides.has(prop)) {
      return studioMockServiceOverrides.get(prop);
    }

    return getStudioMockServiceWrapper(prop);
  },
  set(_target, prop, value) {
    studioMockServiceOverrides.set(prop, value);
    return true;
  },
  deleteProperty(_target, prop) {
    return studioMockServiceOverrides.delete(prop);
  },
  getOwnPropertyDescriptor(_target, prop) {
    if (prop === 'then' || typeof prop === 'symbol') {
      return undefined;
    }

    return {
      configurable: true,
      enumerable: true,
      writable: true,
      value: studioMockServiceOverrides.has(prop)
        ? studioMockServiceOverrides.get(prop)
        : getStudioMockServiceWrapper(prop),
    };
  },
});
