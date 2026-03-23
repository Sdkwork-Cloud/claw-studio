import type { StudioInstanceDataAccessEntry } from '@sdkwork/claw-types';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';

export type InstanceManagementEntryTone = 'neutral' | 'success' | 'warning';

export interface InstanceManagementEntry {
  id:
    | 'controlPlane'
    | 'installMethod'
    | 'configAuthority'
    | 'defaultWorkspace'
    | 'managementScope';
  labelKey: string;
  value: string;
  detailKey: string;
  tone: InstanceManagementEntryTone;
  mono?: boolean;
}

export interface InstanceManagementSummary {
  entries: InstanceManagementEntry[];
  notes: string[];
}

const VALUE_LABELS: Record<string, string> = {
  appManaged: 'App Managed',
  externalProcess: 'External Process',
  remoteService: 'Remote Service',
  'local-managed': 'Local Managed',
  'local-external': 'Local External',
  remote: 'Remote',
  bundled: 'Bundled',
  installerScript: 'Installer Script',
  cliScript: 'CLI Script',
  npm: 'npm',
  pnpm: 'pnpm',
  source: 'Source',
  git: 'Git',
  wsl: 'WSL',
  docker: 'Docker',
  podman: 'Podman',
  ansible: 'Ansible',
  bun: 'Bun',
  nix: 'Nix',
  unknown: 'Unknown',
};

function formatValue(value?: string | null) {
  const normalized = value?.trim() || '';
  if (!normalized) {
    return 'Unknown';
  }

  if (VALUE_LABELS[normalized]) {
    return VALUE_LABELS[normalized];
  }

  return normalized
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (segment) => segment.toUpperCase());
}

function resolveConfigAuthorityRoute(workbench: InstanceWorkbenchSnapshot) {
  return (
    workbench.detail.dataAccess.routes.find(
      (route) => route.scope === 'config' && Boolean(route.target),
    ) || null
  );
}

function buildConfigAuthorityEntry(
  workbench: InstanceWorkbenchSnapshot,
): InstanceManagementEntry {
  if (workbench.managedConfigPath) {
    return {
      id: 'configAuthority',
      labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.configAuthority',
      value: workbench.managedConfigPath,
      detailKey: 'instances.detail.instanceWorkbench.overview.management.details.configManagedFile',
      tone: 'success',
      mono: true,
    };
  }

  const configRoute = resolveConfigAuthorityRoute(workbench);
  if (configRoute?.target) {
    return {
      id: 'configAuthority',
      labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.configAuthority',
      value: configRoute.target,
      detailKey: getConfigAuthorityDetailKey(configRoute),
      tone:
        configRoute.mode === 'remoteEndpoint' || configRoute.mode === 'metadataOnly'
          ? 'warning'
          : 'neutral',
      mono: true,
    };
  }

  return {
    id: 'configAuthority',
    labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.configAuthority',
    value: '--',
    detailKey: 'instances.detail.instanceWorkbench.overview.management.details.configUnavailable',
    tone: 'warning',
  };
}

function getConfigAuthorityDetailKey(route: StudioInstanceDataAccessEntry) {
  if (route.mode === 'managedDirectory') {
    return 'instances.detail.instanceWorkbench.overview.management.details.configManagedDirectory';
  }
  if (route.mode === 'remoteEndpoint') {
    return 'instances.detail.instanceWorkbench.overview.management.details.configRemoteEndpoint';
  }
  if (route.mode === 'metadataOnly') {
    return 'instances.detail.instanceWorkbench.overview.management.details.configMetadataOnly';
  }
  return 'instances.detail.instanceWorkbench.overview.management.details.configManagedFile';
}

function buildDefaultWorkspaceEntry(
  workbench: InstanceWorkbenchSnapshot,
): InstanceManagementEntry {
  const defaultAgent = workbench.agents.find((agent) => agent.isDefault) || workbench.agents[0];
  if (defaultAgent?.workspace) {
    return {
      id: 'defaultWorkspace',
      labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.defaultWorkspace',
      value: defaultAgent.workspace,
      detailKey: 'instances.detail.instanceWorkbench.overview.management.details.workspaceAgent',
      tone: 'neutral',
      mono: true,
    };
  }

  const workspaceArtifact = workbench.detail.artifacts.find(
    (artifact) => artifact.kind === 'workspaceDirectory' && artifact.location,
  );
  if (workspaceArtifact?.location) {
    return {
      id: 'defaultWorkspace',
      labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.defaultWorkspace',
      value: workspaceArtifact.location,
      detailKey: 'instances.detail.instanceWorkbench.overview.management.details.workspaceArtifact',
      tone: 'neutral',
      mono: true,
    };
  }

  return {
    id: 'defaultWorkspace',
    labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.defaultWorkspace',
    value: workbench.detail.storage.namespace || '--',
    detailKey: 'instances.detail.instanceWorkbench.overview.management.details.workspaceNamespace',
    tone: 'neutral',
  };
}

function buildManagementScopeEntry(
  workbench: InstanceWorkbenchSnapshot,
): InstanceManagementEntry {
  if (workbench.managedConfigPath && workbench.detail.lifecycle.configWritable) {
    return {
      id: 'managementScope',
      labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.managementScope',
      value: 'Full config-backed control',
      detailKey: 'instances.detail.instanceWorkbench.overview.management.details.scopeFull',
      tone: 'success',
    };
  }

  if (workbench.detail.instance.runtimeKind === 'openclaw' && workbench.detail.lifecycle.configWritable) {
    return {
      id: 'managementScope',
      labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.managementScope',
      value: 'Partial runtime control',
      detailKey: 'instances.detail.instanceWorkbench.overview.management.details.scopePartial',
      tone: 'warning',
    };
  }

  return {
    id: 'managementScope',
    labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.managementScope',
    value: 'Read-only discovery',
    detailKey: 'instances.detail.instanceWorkbench.overview.management.details.scopeReadonly',
    tone: 'warning',
  };
}

function buildNotes(workbench: InstanceWorkbenchSnapshot) {
  return [
    ...workbench.detail.lifecycle.notes,
    ...workbench.detail.officialRuntimeNotes.map((note) =>
      note.content ? `${note.title}: ${note.content}` : note.title,
    ),
  ].filter((note, index, items) => note && items.indexOf(note) === index);
}

export function buildInstanceManagementSummary(
  workbench: InstanceWorkbenchSnapshot,
): InstanceManagementSummary {
  const installMethod = workbench.detail.consoleAccess?.installMethod || null;

  return {
    entries: [
      {
        id: 'controlPlane',
        labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.controlPlane',
        value: `${formatValue(workbench.detail.lifecycle.owner)} / ${formatValue(workbench.detail.instance.deploymentMode)}`,
        detailKey: 'instances.detail.instanceWorkbench.overview.management.details.controlPlane',
        tone: 'neutral',
      },
      {
        id: 'installMethod',
        labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.installMethod',
        value: installMethod ? formatValue(installMethod) : 'Unknown',
        detailKey: installMethod
          ? 'instances.detail.instanceWorkbench.overview.management.details.installMethod'
          : 'instances.detail.instanceWorkbench.overview.management.details.installMethodUnknown',
        tone: installMethod ? 'neutral' : 'warning',
      },
      buildConfigAuthorityEntry(workbench),
      buildDefaultWorkspaceEntry(workbench),
      buildManagementScopeEntry(workbench),
    ],
    notes: buildNotes(workbench),
  };
}
