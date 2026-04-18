import {
  createKernelChatAdapterCapabilities,
  type KernelChatAdapter,
} from '../kernelChatAdapter.ts';

export function createHermesKernelChatAdapter(): KernelChatAdapter {
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
}
