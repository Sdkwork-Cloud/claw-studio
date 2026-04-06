import {
  bootstrapServerBrowserPlatformBridge,
  getPlatformBridge,
} from '@sdkwork/claw-core';
import { ensureI18n } from '@sdkwork/claw-i18n';

export interface BootstrapShellRuntimeDependencies {
  getActivePlatform: () => string;
  bootstrapHostedBrowserBridge: () => Promise<boolean>;
  ensureI18n: () => Promise<void>;
}

function createBootstrapShellRuntimeDependencies(): BootstrapShellRuntimeDependencies {
  return {
    getActivePlatform: () => getPlatformBridge().platform.getPlatform(),
    bootstrapHostedBrowserBridge: () => bootstrapServerBrowserPlatformBridge(),
    ensureI18n: async () => {
      await ensureI18n();
    },
  };
}

export async function runBootstrapShellRuntime(
  dependencies: BootstrapShellRuntimeDependencies = createBootstrapShellRuntimeDependencies(),
) {
  if (dependencies.getActivePlatform() !== 'desktop') {
    await dependencies.bootstrapHostedBrowserBridge();
  }

  await dependencies.ensureI18n();
}

export async function bootstrapShellRuntime() {
  await runBootstrapShellRuntime();
}
