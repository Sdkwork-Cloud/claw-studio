import assert from 'node:assert/strict';
import {
  applyInstanceDetailInstanceSwitchResetState,
} from './instanceDetailResetState.ts';
import {
  createOpenClawAgentWorkspaceResetState,
} from './openClawAgentPresentation.ts';
import {
  createOpenClawManagedConfigResetState,
} from './openClawManagedConfigDrafts.ts';
import {
  createOpenClawProviderDialogResetDrafts,
  createOpenClawProviderWorkspaceResetState,
} from './openClawProviderPresentation.ts';
import {
  createInstanceWorkbenchHydrationResetState,
} from './instanceWorkbenchHydration.ts';

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest(
  'applyInstanceDetailInstanceSwitchResetState routes the shared reset baselines through page-owned setters',
  () => {
    const providerDialogResetDrafts = createOpenClawProviderDialogResetDrafts();
    providerDialogResetDrafts.providerDialogDraft.id = 'reset-provider';
    providerDialogResetDrafts.providerModelDialogDraft.id = 'reset-model';

    const providerWorkspaceResetState =
      createOpenClawProviderWorkspaceResetState(providerDialogResetDrafts);
    const managedConfigResetState = createOpenClawManagedConfigResetState();
    const agentWorkspaceResetState = createOpenClawAgentWorkspaceResetState();
    const workbenchHydrationResetState = createInstanceWorkbenchHydrationResetState();

    const captured = {
      isWorkbenchFilesLoading: true,
      isWorkbenchMemoryLoading: true,
      isProviderDialogOpen: true,
      providerDialogDraft: null as typeof providerWorkspaceResetState.providerDialogDraft | null,
      providerRequestDrafts: { stale: 'stale' } as Record<string, string>,
      isProviderModelDialogOpen: true,
      providerModelDialogDraft:
        null as typeof providerWorkspaceResetState.providerModelDialogDraft | null,
      providerModelDeleteId: 'stale-model' as string | null,
      providerDeleteId: 'stale-provider' as string | null,
      selectedWebSearchProviderId: 'stale-provider' as string | null,
      webSearchSharedDraft: { enabled: true } as typeof managedConfigResetState.webSearch.sharedDraft,
      webSearchProviderDrafts: {
        stale: {
          apiKeySource: 'env:STALE',
          baseUrl: '',
          model: '',
          advancedConfig: '',
        },
      },
      webSearchError: 'stale-error' as string | null,
      isSavingWebSearch: true,
      xSearchDraft: { enabled: true } as typeof managedConfigResetState.xSearch.draft,
      xSearchError: 'stale-error' as string | null,
      isSavingXSearch: true,
      webSearchNativeCodexDraft:
        { enabled: true } as typeof managedConfigResetState.webSearchNativeCodex.draft,
      webSearchNativeCodexError: 'stale-error' as string | null,
      isSavingWebSearchNativeCodex: true,
      webFetchSharedDraft: { enabled: true } as typeof managedConfigResetState.webFetch.sharedDraft,
      webFetchFallbackDraft: {
        apiKeySource: 'env:STALE',
        baseUrl: 'https://stale.example',
        advancedConfig: '{"stale":true}',
      },
      webFetchError: 'stale-error' as string | null,
      isSavingWebFetch: true,
      authCooldownsDraft:
        { rateLimitedProfileRotations: '10' } as typeof managedConfigResetState.authCooldowns.draft,
      authCooldownsError: 'stale-error' as string | null,
      isSavingAuthCooldowns: true,
      dreamingDraft: { goal: 'stale' } as typeof managedConfigResetState.dreaming.draft,
      dreamingError: 'stale-error' as string | null,
      isSavingDreaming: true,
      isAgentDialogOpen: true,
      selectedAgentId: 'stale-agent' as string | null,
      selectedAgentWorkbench: null as typeof agentWorkspaceResetState.selectedAgentWorkbench,
      agentWorkbenchError: 'stale-error' as string | null,
      isAgentWorkbenchLoading: true,
      agentDialogDraft: null as typeof agentWorkspaceResetState.dialogState.draft | null,
      editingAgentId: 'stale-agent' as string | null,
      agentDeleteId: 'stale-agent' as string | null,
      isInstallingAgentSkill: true,
      updatingAgentSkillKeys: ['stale'],
      removingAgentSkillKeys: ['stale'],
    };

    applyInstanceDetailInstanceSwitchResetState({
      providerDialogResetDrafts,
      setIsWorkbenchFilesLoading: (value) => {
        captured.isWorkbenchFilesLoading = value;
      },
      setIsWorkbenchMemoryLoading: (value) => {
        captured.isWorkbenchMemoryLoading = value;
      },
      setIsProviderDialogOpen: (value) => {
        captured.isProviderDialogOpen = value;
      },
      setProviderDialogDraft: (value) => {
        captured.providerDialogDraft = value;
      },
      setProviderRequestDrafts: (value) => {
        captured.providerRequestDrafts = value;
      },
      setIsProviderModelDialogOpen: (value) => {
        captured.isProviderModelDialogOpen = value;
      },
      setProviderModelDialogDraft: (value) => {
        captured.providerModelDialogDraft = value;
      },
      setProviderModelDeleteId: (value) => {
        captured.providerModelDeleteId = value;
      },
      setProviderDeleteId: (value) => {
        captured.providerDeleteId = value;
      },
      setSelectedWebSearchProviderId: (value) => {
        captured.selectedWebSearchProviderId = value;
      },
      setWebSearchSharedDraft: (value) => {
        captured.webSearchSharedDraft = value;
      },
      setWebSearchProviderDrafts: (value) => {
        captured.webSearchProviderDrafts = value;
      },
      setWebSearchError: (value) => {
        captured.webSearchError = value;
      },
      setIsSavingWebSearch: (value) => {
        captured.isSavingWebSearch = value;
      },
      setXSearchDraft: (value) => {
        captured.xSearchDraft = value;
      },
      setXSearchError: (value) => {
        captured.xSearchError = value;
      },
      setIsSavingXSearch: (value) => {
        captured.isSavingXSearch = value;
      },
      setWebSearchNativeCodexDraft: (value) => {
        captured.webSearchNativeCodexDraft = value;
      },
      setWebSearchNativeCodexError: (value) => {
        captured.webSearchNativeCodexError = value;
      },
      setIsSavingWebSearchNativeCodex: (value) => {
        captured.isSavingWebSearchNativeCodex = value;
      },
      setWebFetchSharedDraft: (value) => {
        captured.webFetchSharedDraft = value;
      },
      setWebFetchFallbackDraft: (value) => {
        captured.webFetchFallbackDraft = value;
      },
      setWebFetchError: (value) => {
        captured.webFetchError = value;
      },
      setIsSavingWebFetch: (value) => {
        captured.isSavingWebFetch = value;
      },
      setAuthCooldownsDraft: (value) => {
        captured.authCooldownsDraft = value;
      },
      setAuthCooldownsError: (value) => {
        captured.authCooldownsError = value;
      },
      setIsSavingAuthCooldowns: (value) => {
        captured.isSavingAuthCooldowns = value;
      },
      setDreamingDraft: (value) => {
        captured.dreamingDraft = value;
      },
      setDreamingError: (value) => {
        captured.dreamingError = value;
      },
      setIsSavingDreaming: (value) => {
        captured.isSavingDreaming = value;
      },
      setIsAgentDialogOpen: (value) => {
        captured.isAgentDialogOpen = value;
      },
      setSelectedAgentId: (value) => {
        captured.selectedAgentId = value;
      },
      setSelectedAgentWorkbench: (value) => {
        captured.selectedAgentWorkbench = value;
      },
      setAgentWorkbenchError: (value) => {
        captured.agentWorkbenchError = value;
      },
      setIsAgentWorkbenchLoading: (value) => {
        captured.isAgentWorkbenchLoading = value;
      },
      setAgentDialogDraft: (value) => {
        captured.agentDialogDraft = value;
      },
      setEditingAgentId: (value) => {
        captured.editingAgentId = value;
      },
      setAgentDeleteId: (value) => {
        captured.agentDeleteId = value;
      },
      setIsInstallingAgentSkill: (value) => {
        captured.isInstallingAgentSkill = value;
      },
      setUpdatingAgentSkillKeys: (value) => {
        captured.updatingAgentSkillKeys = value;
      },
      setRemovingAgentSkillKeys: (value) => {
        captured.removingAgentSkillKeys = value;
      },
    });

    assert.deepEqual(captured, {
      isWorkbenchFilesLoading: workbenchHydrationResetState.isFilesLoading,
      isWorkbenchMemoryLoading: workbenchHydrationResetState.isMemoryLoading,
      isProviderDialogOpen: providerWorkspaceResetState.isProviderDialogOpen,
      providerDialogDraft: providerWorkspaceResetState.providerDialogDraft,
      providerRequestDrafts: providerWorkspaceResetState.providerRequestDrafts,
      isProviderModelDialogOpen: providerWorkspaceResetState.isProviderModelDialogOpen,
      providerModelDialogDraft: providerWorkspaceResetState.providerModelDialogDraft,
      providerModelDeleteId: providerWorkspaceResetState.providerModelDeleteId,
      providerDeleteId: providerWorkspaceResetState.providerDeleteId,
      selectedWebSearchProviderId: managedConfigResetState.webSearch.selectedProviderId,
      webSearchSharedDraft: managedConfigResetState.webSearch.sharedDraft,
      webSearchProviderDrafts: managedConfigResetState.webSearch.providerDrafts,
      webSearchError: managedConfigResetState.webSearch.error,
      isSavingWebSearch: managedConfigResetState.webSearch.isSaving,
      xSearchDraft: managedConfigResetState.xSearch.draft,
      xSearchError: managedConfigResetState.xSearch.error,
      isSavingXSearch: managedConfigResetState.xSearch.isSaving,
      webSearchNativeCodexDraft: managedConfigResetState.webSearchNativeCodex.draft,
      webSearchNativeCodexError: managedConfigResetState.webSearchNativeCodex.error,
      isSavingWebSearchNativeCodex: managedConfigResetState.webSearchNativeCodex.isSaving,
      webFetchSharedDraft: managedConfigResetState.webFetch.sharedDraft,
      webFetchFallbackDraft: managedConfigResetState.webFetch.fallbackDraft,
      webFetchError: managedConfigResetState.webFetch.error,
      isSavingWebFetch: managedConfigResetState.webFetch.isSaving,
      authCooldownsDraft: managedConfigResetState.authCooldowns.draft,
      authCooldownsError: managedConfigResetState.authCooldowns.error,
      isSavingAuthCooldowns: managedConfigResetState.authCooldowns.isSaving,
      dreamingDraft: managedConfigResetState.dreaming.draft,
      dreamingError: managedConfigResetState.dreaming.error,
      isSavingDreaming: managedConfigResetState.dreaming.isSaving,
      isAgentDialogOpen: agentWorkspaceResetState.isDialogOpen,
      selectedAgentId: agentWorkspaceResetState.selectedAgentId,
      selectedAgentWorkbench: agentWorkspaceResetState.selectedAgentWorkbench,
      agentWorkbenchError: agentWorkspaceResetState.workbenchError,
      isAgentWorkbenchLoading: agentWorkspaceResetState.isWorkbenchLoading,
      agentDialogDraft: agentWorkspaceResetState.dialogState.draft,
      editingAgentId: agentWorkspaceResetState.dialogState.editingAgentId,
      agentDeleteId: agentWorkspaceResetState.deleteId,
      isInstallingAgentSkill: agentWorkspaceResetState.isInstallingSkill,
      updatingAgentSkillKeys: agentWorkspaceResetState.updatingSkillKeys,
      removingAgentSkillKeys: agentWorkspaceResetState.removingSkillKeys,
    });
  },
);
