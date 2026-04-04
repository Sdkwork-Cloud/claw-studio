import type { KernelCenterDashboard } from './services';
import { Section } from './Shared';

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function renderValue(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value : fallback;
}

export function HostRuntimeSettings({
  dashboard,
}: {
  dashboard: KernelCenterDashboard | null;
}) {
  const notAvailableLabel = 'Not available';
  const noneLabel = 'None';
  const hostRuntime = dashboard?.hostRuntime ?? {
    mode: 'web' as const,
    modeLabel: 'Web Preview',
    lifecycle: 'inactive' as const,
    lifecycleLabel: 'Inactive',
    browserManagementSupported: false,
    browserManagementAvailable: false,
    browserManagementLabel: 'Browser Management Unavailable',
    manageBasePath: null,
    internalBasePath: null,
  };
  const hostPlatform = dashboard?.hostPlatform ?? {
    status: null,
    modeLabel: 'Unknown',
    lifecycleLabel: 'Unavailable',
    hostId: null,
    displayName: null,
    version: null,
    desiredStateProjectionVersion: null,
    rolloutEngineVersion: null,
    manageBasePath: null,
    internalBasePath: null,
    capabilityKeys: [],
    capabilityCount: 0,
  };
  const hostEndpoints = dashboard?.hostEndpoints ?? {
    totalEndpoints: 0,
    readyEndpoints: 0,
    conflictedEndpoints: 0,
    dynamicPortEndpoints: 0,
    browserBaseUrl: null,
    rows: [],
  };
  const browserBaseUrl = hostEndpoints.browserBaseUrl;

  return (
    <Section title="Host Runtime Governance">
      <div data-slot="host-runtime-settings" className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailCard label="Runtime Mode" value={hostRuntime.modeLabel} />
          <DetailCard label="Lifecycle" value={hostRuntime.lifecycleLabel} />
          <DetailCard
            label="Browser Access"
            value={hostRuntime.browserManagementLabel}
          />
          <DetailCard
            label="Browser Base URL"
            value={renderValue(browserBaseUrl, notAvailableLabel)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailCard
            label="Display Name"
            value={renderValue(hostPlatform.displayName, notAvailableLabel)}
          />
          <DetailCard
            label="Host ID"
            value={renderValue(hostPlatform.hostId, notAvailableLabel)}
          />
          <DetailCard
            label="Manage Path"
            value={renderValue(hostRuntime.manageBasePath, notAvailableLabel)}
          />
          <DetailCard
            label="Internal Path"
            value={renderValue(hostRuntime.internalBasePath, notAvailableLabel)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailCard label="Endpoints" value={String(hostEndpoints.totalEndpoints)} />
          <DetailCard label="Ready" value={String(hostEndpoints.readyEndpoints)} />
          <DetailCard label="Port Fallbacks" value={String(hostEndpoints.conflictedEndpoints)} />
          <DetailCard label="Dynamic Ports" value={String(hostEndpoints.dynamicPortEndpoints)} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-100 dark:border-zinc-800">
          <div className="overflow-x-auto" data-slot="host-runtime-endpoints-table">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50/80 dark:bg-zinc-900/80">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  <th className="px-4 py-3">Endpoint</th>
                  <th className="px-4 py-3">Bind</th>
                  <th className="px-4 py-3">Requested Port</th>
                  <th className="px-4 py-3">Active Port</th>
                  <th className="px-4 py-3">Exposure</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Conflict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {hostEndpoints.rows.length === 0
                  ? (
                    <tr>
                      <td
                        className="px-4 py-4 text-zinc-500 dark:text-zinc-400"
                        colSpan={7}
                      >
                        {noneLabel}
                      </td>
                    </tr>
                  )
                  : hostEndpoints.rows.map((row) => (
                    <tr key={row.endpointId} className="align-top">
                      <td className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                        {row.endpointId}
                      </td>
                      <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                        {row.bindHost}
                      </td>
                      <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                        {row.requestedPort}
                      </td>
                      <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                        {row.activePort ?? notAvailableLabel}
                      </td>
                      <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                        {row.exposureLabel}
                      </td>
                      <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                        <div>{row.statusLabel}</div>
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {row.portBindingLabel}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                        {row.conflictSummary ?? noneLabel}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Section>
  );
}
