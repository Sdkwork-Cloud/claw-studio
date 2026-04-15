export interface StateStorage {
  getItem(name: string): string | null;
  setItem(name: string, value: string): void;
  removeItem?(name: string): void;
}

export type StoreStateUpdate<T> = T | Partial<T> | ((state: T) => T | Partial<T>);
export type StoreListener<T> = (state: T, previousState: T) => void;
export type StoreStateSetter<T> = (partial: StoreStateUpdate<T>, replace?: boolean) => void;

export interface SimpleStoreApi<T> {
  getState(): T;
  getInitialState(): T;
  setState: StoreStateSetter<T>;
  subscribe(listener: StoreListener<T>): () => void;
  destroy(): void;
}

export interface PersistedSimpleStoreApi<T, P = Partial<T>> extends SimpleStoreApi<T> {
  persist: {
    clearStorage(): void;
    getOptions(): SimplePersistOptions<T, P>;
    rehydrate(): void;
  };
}

export type SimpleStoreInitializer<T> = (
  setState: StoreStateSetter<T>,
  getState: () => T,
  store: SimpleStoreApi<T>,
) => T;

export interface SimplePersistOptions<T, P = Partial<T>> {
  name: string;
  storage?: StateStorage;
  partialize?: (state: T) => P;
  merge?: (persistedState: P, currentState: T) => T;
}

function resolveDefaultStateStorage(): StateStorage | undefined {
  if (typeof globalThis === 'undefined') {
    return undefined;
  }

  const candidate = (globalThis as { localStorage?: unknown }).localStorage;
  if (!candidate || typeof candidate !== 'object') {
    return undefined;
  }

  const storage = candidate as Partial<StateStorage>;
  if (typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    return undefined;
  }

  return storage as StateStorage;
}

function resolveNextState<T>(currentState: T, update: StoreStateUpdate<T>, replace = false): T {
  const nextState = typeof update === 'function'
    ? update(currentState)
    : update;

  if (replace) {
    return nextState as T;
  }

  return {
    ...currentState,
    ...(nextState as Partial<T>),
  };
}

export function createSimpleStore<T>(createState: SimpleStoreInitializer<T>): SimpleStoreApi<T> {
  const listeners = new Set<StoreListener<T>>();
  let state!: T;
  let initialState!: T;

  const store: SimpleStoreApi<T> = {
    getState: () => state,
    getInitialState: () => initialState,
    setState(update, replace = false) {
      const nextState = resolveNextState(state, update, replace);
      if (Object.is(nextState, state)) {
        return;
      }

      const previousState = state;
      state = nextState;
      for (const listener of listeners) {
        listener(state, previousState);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    destroy() {
      listeners.clear();
    },
  };

  state = createState(store.setState, store.getState, store);
  initialState = state;
  return store;
}

export function createPersistedSimpleStore<T, P = Partial<T>>(
  createState: SimpleStoreInitializer<T>,
  options: SimplePersistOptions<T, P>,
): PersistedSimpleStoreApi<T, P> {
  const storage = options.storage ?? resolveDefaultStateStorage();
  const store = createSimpleStore(createState) as PersistedSimpleStoreApi<T, P>;

  function persistState() {
    if (!storage) {
      return;
    }

    const snapshot = options.partialize
      ? options.partialize(store.getState())
      : (store.getState() as unknown as P);

    try {
      storage.setItem(options.name, JSON.stringify(snapshot));
    } catch {
      // Ignore storage write failures and keep the in-memory store authoritative.
    }
  }

  function rehydrate() {
    if (!storage) {
      return;
    }

    let rawValue: string | null = null;
    try {
      rawValue = storage.getItem(options.name);
    } catch {
      return;
    }

    if (!rawValue) {
      return;
    }

    try {
      const persistedState = JSON.parse(rawValue) as P;
      const nextState = options.merge
        ? options.merge(persistedState, store.getState())
        : ({
            ...store.getState(),
            ...(persistedState as object),
          } as T);
      store.setState(nextState, true);
    } catch {
      // Ignore malformed persisted payloads and keep the initial in-memory state.
    }
  }

  const originalSetState = store.setState.bind(store);
  store.setState = (update, replace = false) => {
    originalSetState(update, replace);
    persistState();
  };
  store.persist = {
    clearStorage() {
      try {
        storage?.removeItem?.(options.name);
      } catch {
        // Ignore storage cleanup failures.
      }
    },
    getOptions() {
      return options;
    },
    rehydrate,
  };

  rehydrate();
  return store;
}
