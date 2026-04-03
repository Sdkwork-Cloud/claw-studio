import { configureServerBrowserPlatformBridge } from '@sdkwork/claw-core';
import { ensureI18n } from '@sdkwork/claw-i18n';

export async function bootstrapShellRuntime() {
  configureServerBrowserPlatformBridge();
  await ensureI18n();
}
