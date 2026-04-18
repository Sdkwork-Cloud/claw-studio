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
  buildOpenClawConfigChannelSelectionState,
  buildOpenClawConfigChannelWorkspaceItems,
  type OpenClawConfigChannelSelectionState,
} from './openClawConfigChannelPresentation.ts';
import {
  buildOpenClawWebSearchProviderSelectionState,
  type OpenClawWebSearchProviderDraftValue,
  type OpenClawWebSearchProviderSelectionState,
} from './openClawConfigDrafts.ts';
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
  selectedConfigChannelId: string | null;
  configChannelDrafts: Record<string, Record<string, string>>;
  selectedWebSearchProviderId: string | null;
  webSearchProviderDrafts: Record<string, OpenClawWebSearchProviderDraftValue>;
  providerDialogDraft: OpenClawProviderFormState;
  t: TranslateFunction;
}

export interface InstanceDetailDerivedState {
  instance: InstanceWorkbenchSnapshot['instance'] | null;
  detail: InstanceWorkbenchSnapshot['detail'] | null;
  configFilePath: string | null;
  configChannels: InstanceWorkbenchSnapshot['configChannels'];
  configWebSearch: InstanceWorkbenchSnapshot['configWebSearch'] | null;
  configXSearch: InstanceWorkbenchSnapshot['configXSearch'] | null;
  configWebSearchNativeCodex:
    InstanceWorkbenchSnapshot['configWebSearchNativeCodex'] | null;
  configWebFetch: InstanceWorkbenchSnapshot['configWebFetch'] | null;
  configAuthCooldowns: InstanceWorkbenchSnapshot['configAuthCooldowns'] | null;
  configDreaming: InstanceWorkbenchSnapshot['configDreaming'] | null;
  isOpenClawConfigWritable: boolean;
  canControlLifecycle: boolean;
  canRestartLifecycle: boolean;
  canStopLifecycle: boolean;
  canStartLifecycle: boolean;
  canDelete: boolean;
  canSetActive: boolean;
  canEditConfigChannels: boolean;
  canEditConfigWebSearch: boolean;
  canEditConfigXSearch: boolean;
  canEditConfigWebSearchNativeCodex: boolean;
  canEditConfigWebFetch: boolean;
  canEditConfigAuthCooldowns: boolean;
  canEditDreamingConfig: boolean;
  isProviderConfigReadonly: boolean;
  canManageOpenClawProviders: boolean;
  canOpenControlPage: boolean;
  memoryWorkbenchState: InstanceMemoryWorkbenchState;
  managementSummary: InstanceManagementSummary | null;
  providerSelectionState: OpenClawProviderSelectionState;
  configChannelSelectionState: OpenClawConfigChannelSelectionState;
  webSearchProviderSelectionState: OpenClawWebSearchProviderSelectionState;
  providerDialogPresentation: OpenClawProviderDialogPresentation;
  availableAgentModelOptions: ReturnType<typeof buildOpenClawAgentModelOptions>;
  readonlyChannelWorkspaceItems: ChannelWorkspaceItem[];
  configChannelWorkspaceItems: ChannelWorkspaceItem[];
}

export function buildInstanceDetailDerivedState({
  id,
  workbench,
  selectedProviderId,
  providerDeleteId,
  providerModelDeleteId,
  providerDrafts,
  providerRequestDrafts,
  selectedConfigChannelId,
  configChannelDrafts,
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
  const configFilePath = kernelConfig?.configFile || null;
  const configChannels = workbench?.configChannels || [];
  const configWebSearch = workbench?.configWebSearch || null;
  const configXSearch = workbench?.configXSearch || null;
  const configWebSearchNativeCodex = workbench?.configWebSearchNativeCodex || null;
  const configWebFetch = workbench?.configWebFetch || null;
  const configAuthCooldowns = workbench?.configAuthCooldowns || null;
  const configDreaming = workbench?.configDreaming || null;
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
    configFilePath,
    configChannels,
    configWebSearch,
    configXSearch,
    configWebSearchNativeCodex,
    configWebFetch,
    configAuthCooldowns,
    configDreaming,
    isOpenClawConfigWritable,
    canControlLifecycle: actionCapabilities.canControlLifecycle,
    canRestartLifecycle: actionCapabilities.canRestart,
    canStopLifecycle: actionCapabilities.canStop,
    canStartLifecycle: actionCapabilities.canStart,
    canDelete: actionCapabilities.canDelete,
    canSetActive: actionCapabilities.canSetActive,
    canEditConfigChannels: Boolean(id && isOpenClawConfigWritable && configChannels.length),
    canEditConfigWebSearch: Boolean(
      id && isOpenClawConfigWritable && configWebSearch?.providers.length,
    ),
    canEditConfigXSearch: Boolean(id && isOpenClawConfigWritable && configXSearch),
    canEditConfigWebSearchNativeCodex: Boolean(
      id && isOpenClawConfigWritable && configWebSearchNativeCodex,
    ),
    canEditConfigWebFetch: Boolean(id && isOpenClawConfigWritable && configWebFetch),
    canEditConfigAuthCooldowns: Boolean(
      id && isOpenClawConfigWritable && configAuthCooldowns,
    ),
    canEditDreamingConfig: Boolean(id && isOpenClawConfigWritable && configDreaming),
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
    configChannelSelectionState: buildOpenClawConfigChannelSelectionState({
      configChannels,
      selectedConfigChannelId,
      configChannelDrafts,
    }),
    webSearchProviderSelectionState: buildOpenClawWebSearchProviderSelectionState({
      config: configWebSearch,
      selectedProviderId: selectedWebSearchProviderId,
      providerDrafts: webSearchProviderDrafts,
    }),
    providerDialogPresentation: buildOpenClawProviderDialogPresentation({
      draft: providerDialogDraft,
      t,
    }),
    availableAgentModelOptions: buildOpenClawAgentModelOptions(workbench?.llmProviders),
    readonlyChannelWorkspaceItems: buildReadonlyChannelWorkspaceItems(workbench?.channels),
    configChannelWorkspaceItems: buildOpenClawConfigChannelWorkspaceItems({
      configChannels,
      runtimeChannels: workbench?.channels,
      configChannelDrafts,
    }),
  };
}
