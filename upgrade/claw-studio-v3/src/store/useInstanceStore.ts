import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface InstanceState {
  activeInstanceId: string | null;
  setActiveInstanceId: (id: string | null) => void;
}

export const useInstanceStore = create<InstanceState>()(
  persist(
    (set) => ({
      activeInstanceId: null,
      setActiveInstanceId: (id) => set({ activeInstanceId: id }),
    }),
    {
      name: 'claw-studio-instance-storage',
    }
  )
);
