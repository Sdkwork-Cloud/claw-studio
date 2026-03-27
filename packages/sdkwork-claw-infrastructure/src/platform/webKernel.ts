import type {
  KernelPlatformAPI,
  RuntimeDesktopKernelHostInfo,
} from './contracts/kernel.ts';
import type {
  RuntimeDesktopKernelInfo,
  RuntimeStorageInfo,
} from './contracts/runtime.ts';

export class WebKernelPlatform implements KernelPlatformAPI {
  async getInfo(): Promise<RuntimeDesktopKernelInfo | null> {
    return null;
  }

  async getStorageInfo(): Promise<RuntimeStorageInfo | null> {
    return null;
  }

  async getStatus(): Promise<RuntimeDesktopKernelHostInfo | null> {
    return null;
  }

  async ensureRunning(): Promise<RuntimeDesktopKernelHostInfo | null> {
    return null;
  }

  async restart(): Promise<RuntimeDesktopKernelHostInfo | null> {
    return null;
  }
}
