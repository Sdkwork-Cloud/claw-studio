import type { ChannelWorkspaceItem } from '@sdkwork/claw-ui';
import type {
  InstanceLLMProviderUpdate,
  InstanceWorkbenchSnapshot,
} from '../types/index.ts';
import { buildInstanceActionCapabilities } from './instanceActionCapabilities.ts';
import {
  buildInstanceManagementSummary,
  type InstanceManagementSummary,
} from './instanceManagementPresentation.ts';
import {
  buildInstanceMemoryWorkbenchState,
  type InstanceMemoryWorkbenchState,
} from './instanceMemoryWorkbenchPresentation.ts';
import { buildOpenClawAgentModelOptions } from './openClawAgentPresentation.ts';
import { buildReadonlyChannelWorkspaceItems } from './openClawChannelPresentation.ts';
import {
  buildOpenClawManagedChannelSelectionState,
  buildOpenClawManagedChannelWorkspaceItems,
  type OpenClawManagedChannelSelectionState,
} from './openClawManagedChannelPresentation.ts';
import {
  buildOpenClawWebSearchProviderSelectionState,
  type OpenClawWebSearchProviderDraftValue,
  type OpenClawWebSearchProviderSelectionState,
} from './openClawManagedConfigDrafts.ts';
import type { OpenClawProviderFormState } from './openClawProviderDrafts.ts';
import {
  buildOpenClawProviderDialogPresentation,
  type OpenClawProviderDialogPresentation,
} from './openClawProviderPresentation.ts';
import {
  buildOpenClawProviderSelectionState,
  buildOpenClawProviderWorkspaceState,
  type OpenClawProviderSelectionState,
} from './openClawProviderWorkspacePresentation.ts';
import { buildKernelAuthorityProjection } from './kernelAuthorityProjection.ts';

interface TranslateFunction {
  (key: string): string;
}

export interface BuildInstanceDetailDerivedStateInput {
  id: string | null | undefined;
  workbench: InstanceWorkbenchSnapshot | null;
  selectedProviderId: string | null;
  providerDeleteId: string | null;
  providerModelDeleteId: string | null;
  providerDrafts: Record<string, InstanceLLMProviderUpdate>;
  providerRequestDrafts: Record<string, string>;
  selectedManagedChannelId: string | null;
  managedChannelDrafts: Record<string, Record<string, string>>;
  selectedWebSearchProviderId: string | null;
  webSearchProviderDrafts: Record<string, OpenClawWebSearchProviderDraftValue>;
  providerDialogDraft: OpenClawProviderFormState;
  t: TranslateFunction;
}

export interface InstanceDetailDerivedState {
  instance: InstanceWorkbenchSnapshot['instance'] | null;
  detail: InstanceWorkbenchSnapshot['detail'] | null;
  managedConfigPath: string | null;
  managedChannels: InstanceWorkbenchSnapshot['managedChannels'];
  managedWebSearchConfig: InstanceWorkbenchSnapshot['managedWebSearchConfig'] | null;
  managedXSearchConfig: InstanceWorkbenchSnapshot['managedXSearchConfig'] | null;
  managedWebSearchNativeCodexConfig:
    InstanceWorkbenchSnapshot['managedWebSearchNativeCodexConfig'] | null;
  managedWebFetchConfig: InstanceWorkbenchSnapshot['managedWebFetchConfig'] | null;
  managedAuthCooldownsConfig: InstanceWorkbenchSnapshot['managedAuthCooldownsConfig'] | null;
  managedDreamingConfig: InstanceWorkbenchSnapshot['managedDreamingConfig'] | null;
  isOpenClawConfigWritable: boolean;
  canControlLifecycle: boolean;
  canRestartLifecycle: boolean;
  canStopLifecycle: boolean;
  canStartLifecycle: boolean;
  canDelete: boolean;
  canSetActive: boolean;
  canEditManagedChannels: boolean;
  canEditManagedWebSearch: boolean;
  canEditManagedXSearch: boolean;
  canEditManagedWebSearchNativeCodex: boolean;
  canEditManagedWebFetch: boolean;
  canEditManagedAuthCooldowns: boolean;
  canEditManagedDreaming: boolean;
  isProviderConfigReadonly: boolean;
  canManageOpenClawProviders: boolean;
  canOpenControlPage: boolean;
  memoryWorkbenchState: InstanceMemoryWorkbenchState;
  managementSummary: InstanceManagementSummary | null;
  providerSelectionState: OpenClawProviderSelectionState;
  managedChannelSelectionState: OpenClawManagedChannelSelectionState;
  webSearchProviderSelectionState: OpenClawWebSearchProviderSelectionState;
  providerDialogPresentation: OpenClawProviderDialogPresentation;
  availableAgentModelOptions: ReturnType<typeof buildOpenClawAgentModelOptions>;
  readonlyChannelWorkspaceItems: ChannelWorkspaceItem[];
  managedChannelWorkspaceItems: ChannelWorkspaceItem[];
}

export function buildInstanceDetailDerivedState({
  id,
  workbench,
  selectedProviderId,
  providerDeleteId,
  providerModelDeleteId,
  providerDrafts,
  providerRequestDrafts,
  selectedManagedChannelId,
  managedChannelDrafts,
  selectedWebSearchProviderId,
  webSearchProviderDrafts,
  providerDialogDraft,
  t,
}: BuildInstanceDetailDerivedStateInput): InstanceDetailDerivedState {
  const instance = workbench?.instance || null;
  const detail = workbench?.detail || null;
  const kernelConfig = workbench?.kernelConfig || null;
  const kernelAuthority =
    workbench?.kernelAuthority || buildKernelAuthorityProjection(detail);
  const managedConfigPath = workbench?.managedConfigPath || null;
  const managedChannels = workbench?.managedChannels || [];
  const managedWebSearchConfig = workbench?.managedWebSearchConfig || null;
  const managedXSearchConfig = workbench?.managedXSearchConfig || null;
  const managedWebSearchNativeCodexConfig = workbench?.managedWebSearchNativeCodexConfig || null;
  const managedWebFetchConfig = workbench?.managedWebFetchConfig || null;
  const managedAuthCooldownsConfig = workbench?.managedAuthCooldownsConfig || null;
  const managedDreamingConfig = workbench?.managedDreamingConfig || null;
  const actionCapabilityInstance = instance
    ? {
        ...instance,
        isBuiltIn: instance.isBuiltIn ?? detail?.instance.isBuiltIn,
      }
    : null;
  const actionCapabilities = buildInstanceActionCapabilities(actionCapabilityInstance, detail);
  const isOpenClawConfigWritable =
    detail?.instance.runtimeKind === 'openclaw' &&
    Boolean(kernelConfig?.resolved && kernelConfig.writable && kernelAuthority?.configControl);
  const providerWorkspaceState = buildOpenClawProviderWorkspaceState({
    detail,
    kernelConfig,
    kernelAuthority,
  });
  const consoleAccess = detail?.consoleAccess || null;

  return {
    instance,
    detail,
    managedConfigPath,
    managedChannels,
    managedWebSearchConfig,
    managedXSearchConfig,
    managedWebSearchNativeCodexConfig,
    managedWebFetchConfig,
    managedAuthCooldownsConfig,
    managedDreamingConfig,
    isOpenClawConfigWritable,
    canControlLifecycle: actionCapabilities.canControlLifecycle,
    canRestartLifecycle: actionCapabilities.canRestart,
    canStopLifecycle: actionCapabilities.canStop,
    canStartLifecycle: actionCapabilities.canStart,
    canDelete: actionCapabilities.canDelete,
    canSetActive: actionCapabilities.canSetActive,
    canEditManagedChannels: Boolean(id && isOpenClawConfigWritable && managedChannels.length),
    canEditManagedWebSearch: Boolean(
      id && isOpenClawConfigWritable && managedWebSearchConfig?.providers.length,
    ),
    canEditManagedXSearch: Boolean(id && isOpenClawConfigWritable && managedXSearchConfig),
    canEditManagedWebSearchNativeCodex: Boolean(
      id && isOpenClawConfigWritable && managedWebSearchNativeCodexConfig,
    ),
    canEditManagedWebFetch: Boolean(id && isOpenClawConfigWritable && managedWebFetchConfig),
    canEditManagedAuthCooldowns: Boolean(
      id && isOpenClawConfigWritable && managedAuthCooldownsConfig,
    ),
    canEditManagedDreaming: Boolean(id && isOpenClawConfigWritable && managedDreamingConfig),
    isProviderConfigReadonly: providerWorkspaceState.isProviderConfigReadonly,
    canManageOpenClawProviders: providerWorkspaceState.canManageProviderCatalog,
    canOpenControlPage: Boolean(
      consoleAccess?.available && (consoleAccess.autoLoginUrl || consoleAccess.url),
    ),
    memoryWorkbenchState: buildInstanceMemoryWorkbenchState(workbench),
    managementSummary: workbench ? buildInstanceManagementSummary(workbench) : null,
    providerSelectionState: buildOpenClawProviderSelectionState({
      workbench,
      selectedProviderId,
      providerDeleteId,
      providerModelDeleteId,
      providerDrafts,
      providerRequestDrafts,
      t,
    }),
    managedChannelSelectionState: buildOpenClawManagedChannelSelectionState({
      managedChannels,
      selectedManagedChannelId,
      managedChannelDrafts,
    }),
    webSearchProviderSelectionState: buildOpenClawWebSearchProviderSelectionState({
      config: managedWebSearchConfig,
      selectedProviderId: selectedWebSearchProviderId,
      providerDrafts: webSearchProviderDrafts,
    }),
    providerDialogPresentation: buildOpenClawProviderDialogPresentation({
      draft: providerDialogDraft,
      t,
    }),
    availableAgentModelOptions: buildOpenClawAgentModelOptions(workbench?.llmProviders),
    readonlyChannelWorkspaceItems: buildReadonlyChannelWorkspaceItems(workbench?.channels),
    managedChannelWorkspaceItems: buildOpenClawManagedChannelWorkspaceItems({
      managedChannels,
      runtimeChannels: workbench?.channels,
      managedChannelDrafts,
    }),
  };
}
