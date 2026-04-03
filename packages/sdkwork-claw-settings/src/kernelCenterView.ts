import type { KernelCenterDashboard } from './services';

export function resolveEndpointPortValue(
  dashboard: KernelCenterDashboard | null,
  portKey: 'preferredPort' | 'activePort',
): string | null {
  const value = dashboard?.endpoint?.[portKey] ?? null;
  return value === null || value === undefined ? null : String(value);
}

export function resolveLocalAiProxyPortValue(
  dashboard: KernelCenterDashboard | null,
): string | null {
  const value = dashboard?.localAiProxy?.activePort ?? null;
  return value === null || value === undefined ? null : String(value);
}
