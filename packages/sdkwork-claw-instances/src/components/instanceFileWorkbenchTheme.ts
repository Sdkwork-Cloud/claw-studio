import type { ThemeMode } from '@sdkwork/claw-core';

export function resolveInstanceFileWorkbenchDarkMode(
  themeMode: ThemeMode,
  prefersDark: boolean,
) {
  return themeMode === 'dark' || (themeMode === 'system' && prefersDark);
}

export function resolveInstanceFileWorkbenchEditorTheme(
  themeMode: ThemeMode,
  prefersDark: boolean,
) {
  return resolveInstanceFileWorkbenchDarkMode(themeMode, prefersDark) ? 'vs-dark' : 'vs';
}
