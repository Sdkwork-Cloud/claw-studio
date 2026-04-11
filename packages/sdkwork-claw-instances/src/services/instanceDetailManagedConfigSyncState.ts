import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { createOpenClawDreamingFormState } from './instanceMemoryWorkbenchPresentation.ts';
import {
  createOpenClawAuthCooldownsDraft as createAuthCooldownsFormState,
  createOpenClawWebFetchDraftState,
  createOpenClawWebSearchDraftState,
  createOpenClawWebSearchNativeCodexDraft as createWebSearchNativeCodexFormState,
  createOpenClawXSearchDraft as createXSearchFormState,
} from './openClawManagedConfigDrafts.ts';

type Setter<T> = (value: T) => void;

export interface ApplyInstanceDetailManagedWebSearchSyncStateInput {
  config: InstanceWorkbenchSnapshot['managedWebSearchConfig'] | null | undefined;
  currentProviderId: string | null;
  setSelectedWebSearchProviderId: Setter<string | null>;
  setWebSearchSharedDraft: Setter<ReturnType<typeof createOpenClawWebSearchDraftState>['sharedDraft']>;
  setWebSearchProviderDrafts: Setter<
    ReturnType<typeof createOpenClawWebSearchDraftState>['providerDrafts']
  >;
  setWebSearchError: Setter<string | null>;
}

export interface ApplyInstanceDetailManagedAuthCooldownsSyncStateInput {
  config: InstanceWorkbenchSnapshot['managedAuthCooldownsConfig'] | null | undefined;
  setAuthCooldownsDraft: Setter<ReturnType<typeof createAuthCooldownsFormState>>;
  setAuthCooldownsError: Setter<string | null>;
}

export interface ApplyInstanceDetailManagedDreamingSyncStateInput {
  config: InstanceWorkbenchSnapshot['managedDreamingConfig'] | null | undefined;
  setDreamingDraft: Setter<ReturnType<typeof createOpenClawDreamingFormState>>;
  setDreamingError: Setter<string | null>;
}

export interface ApplyInstanceDetailManagedXSearchSyncStateInput {
  config: InstanceWorkbenchSnapshot['managedXSearchConfig'] | null | undefined;
  setXSearchDraft: Setter<ReturnType<typeof createXSearchFormState>>;
  setXSearchError: Setter<string | null>;
}

export interface ApplyInstanceDetailManagedWebSearchNativeCodexSyncStateInput {
  config: InstanceWorkbenchSnapshot['managedWebSearchNativeCodexConfig'] | null | undefined;
  setWebSearchNativeCodexDraft: Setter<ReturnType<typeof createWebSearchNativeCodexFormState>>;
  setWebSearchNativeCodexError: Setter<string | null>;
}

export interface ApplyInstanceDetailManagedWebFetchSyncStateInput {
  config: InstanceWorkbenchSnapshot['managedWebFetchConfig'] | null | undefined;
  setWebFetchSharedDraft: Setter<ReturnType<typeof createOpenClawWebFetchDraftState>['sharedDraft']>;
  setWebFetchFallbackDraft: Setter<ReturnType<typeof createOpenClawWebFetchDraftState>['fallbackDraft']>;
  setWebFetchError: Setter<string | null>;
}

export function applyInstanceDetailManagedWebSearchSyncState({
  config,
  currentProviderId,
  setSelectedWebSearchProviderId,
  setWebSearchSharedDraft,
  setWebSearchProviderDrafts,
  setWebSearchError,
}: ApplyInstanceDetailManagedWebSearchSyncStateInput) {
  const webSearchDraftState = createOpenClawWebSearchDraftState({
    config,
    currentProviderId,
  });

  setSelectedWebSearchProviderId(webSearchDraftState.selectedProviderId);
  setWebSearchSharedDraft(webSearchDraftState.sharedDraft);
  setWebSearchProviderDrafts(webSearchDraftState.providerDrafts);
  setWebSearchError(null);
}

export function applyInstanceDetailManagedAuthCooldownsSyncState({
  config,
  setAuthCooldownsDraft,
  setAuthCooldownsError,
}: ApplyInstanceDetailManagedAuthCooldownsSyncStateInput) {
  setAuthCooldownsDraft(createAuthCooldownsFormState(config));
  setAuthCooldownsError(null);
}

export function applyInstanceDetailManagedDreamingSyncState({
  config,
  setDreamingDraft,
  setDreamingError,
}: ApplyInstanceDetailManagedDreamingSyncStateInput) {
  setDreamingDraft(createOpenClawDreamingFormState(config));
  setDreamingError(null);
}

export function applyInstanceDetailManagedXSearchSyncState({
  config,
  setXSearchDraft,
  setXSearchError,
}: ApplyInstanceDetailManagedXSearchSyncStateInput) {
  setXSearchDraft(createXSearchFormState(config));
  setXSearchError(null);
}

export function applyInstanceDetailManagedWebSearchNativeCodexSyncState({
  config,
  setWebSearchNativeCodexDraft,
  setWebSearchNativeCodexError,
}: ApplyInstanceDetailManagedWebSearchNativeCodexSyncStateInput) {
  setWebSearchNativeCodexDraft(createWebSearchNativeCodexFormState(config));
  setWebSearchNativeCodexError(null);
}

export function applyInstanceDetailManagedWebFetchSyncState({
  config,
  setWebFetchSharedDraft,
  setWebFetchFallbackDraft,
  setWebFetchError,
}: ApplyInstanceDetailManagedWebFetchSyncStateInput) {
  const webFetchDraftState = createOpenClawWebFetchDraftState(config);

  setWebFetchSharedDraft(webFetchDraftState.sharedDraft);
  setWebFetchFallbackDraft(webFetchDraftState.fallbackDraft);
  setWebFetchError(null);
}
