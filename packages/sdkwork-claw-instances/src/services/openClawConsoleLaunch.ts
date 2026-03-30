import type { StudioInstanceConsoleAccessRecord } from '@sdkwork/claw-types';

export function resolveOpenClawConsoleLaunchUrl(
  consoleAccess: StudioInstanceConsoleAccessRecord | null | undefined,
) {
  if (!consoleAccess?.available) {
    return null;
  }

  if (consoleAccess.installMethod === 'bundled' && consoleAccess.url) {
    return consoleAccess.url;
  }

  return consoleAccess.autoLoginUrl || consoleAccess.url || null;
}
