import { create, type StateCreator } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export interface InstanceStoreState {
  activeInstanceId: string | null;
  setActiveInstanceId: (id: string | null) => void;
  reset: () => void;
}

const STORAGE_KEY = 'claw-studio-instance-storage';

const createInstanceStoreState: StateCreator<InstanceStoreState, [], [], InstanceStoreState> = (set) => ({
  activeInstanceId: null,
  setActiveInstanceId(id) {
    set({ activeInstanceId: id });
  },
  reset() {
    set({ activeInstanceId: null });
  },
});

function createPersistOptions(storage?: StateStorage) {
  return storage
    ? {
        name: STORAGE_KEY,
        storage: createJSONStorage(() => storage),
      }
    : {
        name: STORAGE_KEY,
      };
}

export function createInstanceStore(storage?: StateStorage) {
  return createStore<InstanceStoreState>()(
    persist(createInstanceStoreState, createPersistOptions(storage)),
  );
}

export const useInstanceStore = create<InstanceStoreState>()(
  persist(createInstanceStoreState, createPersistOptions()),
);
