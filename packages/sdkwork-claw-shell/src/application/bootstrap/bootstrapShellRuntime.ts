import { ensureI18n } from '@sdkwork/claw-i18n';

export async function bootstrapShellRuntime() {
  await ensureI18n();
}
