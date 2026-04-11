import { createInstanceWorkbenchHydrationResetState } from './instanceWorkbenchHydration.ts';
import { createOpenClawAgentWorkspaceResetState } from './openClawAgentPresentation.ts';
import {
  createOpenClawManagedConfigResetState,
} from './openClawManagedConfigDrafts.ts';
import {
  createOpenClawProviderWorkspaceResetState,
  type OpenClawProviderDialogResetDrafts,
} from './openClawProviderPresentation.ts';

type Setter<T> = (value: T) => void;

type WorkbenchHydrationResetState = ReturnType<typeof createInstanceWorkbenchHydrationResetState>;
type ManagedConfigResetState = ReturnType<typeof createOpenClawManagedConfigResetState>;
type AgentWorkspaceResetState = ReturnType<typeof createOpenClawAgentWorkspaceResetState>;

export interface ApplyInstanceDetailInstanceSwitchResetStateInput {
  providerDialogResetDrafts: OpenClawProviderDialogResetDrafts;
  setIsWorkbenchFilesLoading: Setter<WorkbenchHydrationResetState['isFilesLoading']>;
  setIsWorkbenchMemoryLoading: Setter<WorkbenchHydrationResetState['isMemoryLoading']>;
  setIsProviderDialogOpen: Setter<boolean>;
  setProviderDialogDraft: Setter<OpenClawProviderDialogResetDrafts['providerDialogDraft']>;
  setProviderRequestDrafts: Setter<Record<string, string>>;
  setIsProviderModelDialogOpen: Setter<boolean>;
  setProviderModelDialogDraft: Setter<OpenClawProviderDialogResetDrafts['providerModelDialogDraft']>;
  setProviderModelDeleteId: Setter<string | null>;
  setProviderDeleteId: Setter<string | null>;
  setSelectedWebSearchProviderId: Setter<ManagedConfigResetState['webSearch']['selectedProviderId']>;
  setWebSearchSharedDraft: Setter<ManagedConfigResetState['webSearch']['sharedDraft']>;
  setWebSearchProviderDrafts: Setter<ManagedConfigResetState['webSearch']['providerDrafts']>;
  setWebSearchError: Setter<ManagedConfigResetState['webSearch']['error']>;
  setIsSavingWebSearch: Setter<ManagedConfigResetState['webSearch']['isSaving']>;
  setXSearchDraft: Setter<ManagedConfigResetState['xSearch']['draft']>;
  setXSearchError: Setter<ManagedConfigResetState['xSearch']['error']>;
  setIsSavingXSearch: Setter<ManagedConfigResetState['xSearch']['isSaving']>;
  setWebSearchNativeCodexDraft: Setter<ManagedConfigResetState['webSearchNativeCodex']['draft']>;
  setWebSearchNativeCodexError: Setter<ManagedConfigResetState['webSearchNativeCodex']['error']>;
  setIsSavingWebSearchNativeCodex: Setter<ManagedConfigResetState['webSearchNativeCodex']['isSaving']>;
  setWebFetchSharedDraft: Setter<ManagedConfigResetState['webFetch']['sharedDraft']>;
  setWebFetchFallbackDraft: Setter<ManagedConfigResetState['webFetch']['fallbackDraft']>;
  setWebFetchError: Setter<ManagedConfigResetState['webFetch']['error']>;
  setIsSavingWebFetch: Setter<ManagedConfigResetState['webFetch']['isSaving']>;
  setAuthCooldownsDraft: Setter<ManagedConfigResetState['authCooldowns']['draft']>;
  setAuthCooldownsError: Setter<ManagedConfigResetState['authCooldowns']['error']>;
  setIsSavingAuthCooldowns: Setter<ManagedConfigResetState['authCooldowns']['isSaving']>;
  setDreamingDraft: Setter<ManagedConfigResetState['dreaming']['draft']>;
  setDreamingError: Setter<ManagedConfigResetState['dreaming']['error']>;
  setIsSavingDreaming: Setter<ManagedConfigResetState['dreaming']['isSaving']>;
  setIsAgentDialogOpen: Setter<AgentWorkspaceResetState['isDialogOpen']>;
  setSelectedAgentId: Setter<AgentWorkspaceResetState['selectedAgentId']>;
  setSelectedAgentWorkbench: Setter<AgentWorkspaceResetState['selectedAgentWorkbench']>;
  setAgentWorkbenchError: Setter<AgentWorkspaceResetState['workbenchError']>;
  setIsAgentWorkbenchLoading: Setter<AgentWorkspaceResetState['isWorkbenchLoading']>;
  setAgentDialogDraft: Setter<AgentWorkspaceResetState['dialogState']['draft']>;
  setEditingAgentId: Setter<AgentWorkspaceResetState['dialogState']['editingAgentId']>;
  setAgentDeleteId: Setter<AgentWorkspaceResetState['deleteId']>;
  setIsInstallingAgentSkill: Setter<AgentWorkspaceResetState['isInstallingSkill']>;
  setUpdatingAgentSkillKeys: Setter<AgentWorkspaceResetState['updatingSkillKeys']>;
  setRemovingAgentSkillKeys: Setter<AgentWorkspaceResetState['removingSkillKeys']>;
}

export function applyInstanceDetailInstanceSwitchResetState(
  args: ApplyInstanceDetailInstanceSwitchResetStateInput,
) {
  const providerDialogResetDrafts = args.providerDialogResetDrafts;
  const providerWorkspaceResetState =
    createOpenClawProviderWorkspaceResetState(providerDialogResetDrafts);
  const managedConfigResetState = createOpenClawManagedConfigResetState();
  const agentWorkspaceResetState = createOpenClawAgentWorkspaceResetState();
  const workbenchHydrationResetState = createInstanceWorkbenchHydrationResetState();

  args.setIsWorkbenchFilesLoading(workbenchHydrationResetState.isFilesLoading);
  args.setIsWorkbenchMemoryLoading(workbenchHydrationResetState.isMemoryLoading);
  args.setIsProviderDialogOpen(providerWorkspaceResetState.isProviderDialogOpen);
  args.setProviderDialogDraft(providerWorkspaceResetState.providerDialogDraft);
  args.setProviderRequestDrafts(providerWorkspaceResetState.providerRequestDrafts);
  args.setIsProviderModelDialogOpen(providerWorkspaceResetState.isProviderModelDialogOpen);
  args.setProviderModelDialogDraft(providerWorkspaceResetState.providerModelDialogDraft);
  args.setProviderModelDeleteId(providerWorkspaceResetState.providerModelDeleteId);
  args.setProviderDeleteId(providerWorkspaceResetState.providerDeleteId);
  args.setSelectedWebSearchProviderId(managedConfigResetState.webSearch.selectedProviderId);
  args.setWebSearchSharedDraft(managedConfigResetState.webSearch.sharedDraft);
  args.setWebSearchProviderDrafts(managedConfigResetState.webSearch.providerDrafts);
  args.setWebSearchError(managedConfigResetState.webSearch.error);
  args.setIsSavingWebSearch(managedConfigResetState.webSearch.isSaving);
  args.setXSearchDraft(managedConfigResetState.xSearch.draft);
  args.setXSearchError(managedConfigResetState.xSearch.error);
  args.setIsSavingXSearch(managedConfigResetState.xSearch.isSaving);
  args.setWebSearchNativeCodexDraft(managedConfigResetState.webSearchNativeCodex.draft);
  args.setWebSearchNativeCodexError(managedConfigResetState.webSearchNativeCodex.error);
  args.setIsSavingWebSearchNativeCodex(managedConfigResetState.webSearchNativeCodex.isSaving);
  args.setWebFetchSharedDraft(managedConfigResetState.webFetch.sharedDraft);
  args.setWebFetchFallbackDraft(managedConfigResetState.webFetch.fallbackDraft);
  args.setWebFetchError(managedConfigResetState.webFetch.error);
  args.setIsSavingWebFetch(managedConfigResetState.webFetch.isSaving);
  args.setAuthCooldownsDraft(managedConfigResetState.authCooldowns.draft);
  args.setAuthCooldownsError(managedConfigResetState.authCooldowns.error);
  args.setIsSavingAuthCooldowns(managedConfigResetState.authCooldowns.isSaving);
  args.setDreamingDraft(managedConfigResetState.dreaming.draft);
  args.setDreamingError(managedConfigResetState.dreaming.error);
  args.setIsSavingDreaming(managedConfigResetState.dreaming.isSaving);
  args.setIsAgentDialogOpen(agentWorkspaceResetState.isDialogOpen);
  args.setSelectedAgentId(agentWorkspaceResetState.selectedAgentId);
  args.setSelectedAgentWorkbench(agentWorkspaceResetState.selectedAgentWorkbench);
  args.setAgentWorkbenchError(agentWorkspaceResetState.workbenchError);
  args.setIsAgentWorkbenchLoading(agentWorkspaceResetState.isWorkbenchLoading);
  args.setAgentDialogDraft(agentWorkspaceResetState.dialogState.draft);
  args.setEditingAgentId(agentWorkspaceResetState.dialogState.editingAgentId);
  args.setAgentDeleteId(agentWorkspaceResetState.deleteId);
  args.setIsInstallingAgentSkill(agentWorkspaceResetState.isInstallingSkill);
  args.setUpdatingAgentSkillKeys(agentWorkspaceResetState.updatingSkillKeys);
  args.setRemovingAgentSkillKeys(agentWorkspaceResetState.removingSkillKeys);
}
