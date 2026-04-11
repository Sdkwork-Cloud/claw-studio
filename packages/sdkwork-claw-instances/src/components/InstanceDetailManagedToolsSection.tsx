import React from 'react';
import type {
  OpenClawAuthCooldownsDraftValue,
  OpenClawWebFetchFallbackDraftValue,
  OpenClawWebFetchSharedDraftValue,
  OpenClawWebSearchNativeCodexDraftValue,
  OpenClawWebSearchProviderDraftValue,
  OpenClawWebSearchSharedDraftValue,
  OpenClawXSearchDraftValue,
} from '../services/index.ts';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { InstanceDetailManagedAuthCooldownsPanel } from './InstanceDetailManagedAuthCooldownsPanel.tsx';
import { InstanceDetailManagedWebFetchPanel } from './InstanceDetailManagedWebFetchPanel.tsx';
import { InstanceDetailManagedWebSearchNativeCodexPanel } from './InstanceDetailManagedWebSearchNativeCodexPanel.tsx';
import { InstanceDetailManagedWebSearchPanel } from './InstanceDetailManagedWebSearchPanel.tsx';
import { InstanceDetailManagedXSearchPanel } from './InstanceDetailManagedXSearchPanel.tsx';
import {
  InstanceDetailToolsSection,
  type InstanceDetailToolsSectionProps,
} from './InstanceDetailToolsSection.tsx';

type ManagedWebSearchConfig = InstanceWorkbenchSnapshot['managedWebSearchConfig'];
type ManagedWebSearchProvider = NonNullable<ManagedWebSearchConfig>['providers'][number];

export interface InstanceDetailManagedToolsSectionProps {
  emptyState: React.ReactNode;
  workbench: Pick<InstanceWorkbenchSnapshot, 'tools'> | null;
  managedWebSearchConfig: ManagedWebSearchConfig;
  webSearchSharedDraft: OpenClawWebSearchSharedDraftValue | null;
  selectedWebSearchProvider: ManagedWebSearchProvider | null;
  selectedWebSearchProviderDraft: OpenClawWebSearchProviderDraftValue | null;
  webSearchError: string | null;
  isSavingWebSearch: boolean;
  canEditManagedWebSearch: boolean;
  onSaveWebSearchConfig: () => Promise<void> | void;
  onWebSearchSharedDraftChange: (
    key: keyof OpenClawWebSearchSharedDraftValue,
    value: string | boolean,
  ) => void;
  onWebSearchProviderDraftChange: (
    key: keyof OpenClawWebSearchProviderDraftValue,
    value: string,
  ) => void;
  onSelectedWebSearchProviderIdChange: (providerId: string) => void;
  managedWebFetchConfig: InstanceWorkbenchSnapshot['managedWebFetchConfig'];
  webFetchSharedDraft: OpenClawWebFetchSharedDraftValue | null;
  webFetchFallbackDraft: OpenClawWebFetchFallbackDraftValue;
  webFetchError: string | null;
  isSavingWebFetch: boolean;
  canEditManagedWebFetch: boolean;
  onSaveWebFetchConfig: () => Promise<void> | void;
  onWebFetchSharedDraftChange: (
    key: keyof OpenClawWebFetchSharedDraftValue,
    value: string | boolean,
  ) => void;
  onWebFetchFallbackDraftChange: (
    key: keyof OpenClawWebFetchFallbackDraftValue,
    value: string,
  ) => void;
  managedWebSearchNativeCodexConfig: InstanceWorkbenchSnapshot['managedWebSearchNativeCodexConfig'];
  webSearchNativeCodexDraft: OpenClawWebSearchNativeCodexDraftValue | null;
  webSearchNativeCodexError: string | null;
  isSavingWebSearchNativeCodex: boolean;
  canEditManagedWebSearchNativeCodex: boolean;
  onSaveWebSearchNativeCodexConfig: () => Promise<void> | void;
  onWebSearchNativeCodexDraftChange: (
    key: keyof OpenClawWebSearchNativeCodexDraftValue,
    value: string | boolean,
  ) => void;
  managedXSearchConfig: InstanceWorkbenchSnapshot['managedXSearchConfig'];
  xSearchDraft: OpenClawXSearchDraftValue | null;
  xSearchError: string | null;
  isSavingXSearch: boolean;
  canEditManagedXSearch: boolean;
  onSaveXSearchConfig: () => Promise<void> | void;
  onXSearchDraftChange: (
    key: keyof OpenClawXSearchDraftValue,
    value: string | boolean,
  ) => void;
  managedAuthCooldownsConfig: InstanceWorkbenchSnapshot['managedAuthCooldownsConfig'];
  authCooldownsDraft: OpenClawAuthCooldownsDraftValue | null;
  authCooldownsError: string | null;
  isSavingAuthCooldowns: boolean;
  canEditManagedAuthCooldowns: boolean;
  onSaveAuthCooldownsConfig: () => Promise<void> | void;
  onAuthCooldownsDraftChange: (
    key: keyof OpenClawAuthCooldownsDraftValue,
    value: string,
  ) => void;
  formatWorkbenchLabel: (value: string) => string;
  getDangerBadge: (status: string) => string;
  getStatusBadge: (status: string) => string;
  t: (key: string) => string;
}

export function InstanceDetailManagedToolsSection({
  emptyState,
  workbench,
  managedWebSearchConfig,
  webSearchSharedDraft,
  selectedWebSearchProvider,
  selectedWebSearchProviderDraft,
  webSearchError,
  isSavingWebSearch,
  canEditManagedWebSearch,
  onSaveWebSearchConfig,
  onWebSearchSharedDraftChange,
  onWebSearchProviderDraftChange,
  onSelectedWebSearchProviderIdChange,
  managedWebFetchConfig,
  webFetchSharedDraft,
  webFetchFallbackDraft,
  webFetchError,
  isSavingWebFetch,
  canEditManagedWebFetch,
  onSaveWebFetchConfig,
  onWebFetchSharedDraftChange,
  onWebFetchFallbackDraftChange,
  managedWebSearchNativeCodexConfig,
  webSearchNativeCodexDraft,
  webSearchNativeCodexError,
  isSavingWebSearchNativeCodex,
  canEditManagedWebSearchNativeCodex,
  onSaveWebSearchNativeCodexConfig,
  onWebSearchNativeCodexDraftChange,
  managedXSearchConfig,
  xSearchDraft,
  xSearchError,
  isSavingXSearch,
  canEditManagedXSearch,
  onSaveXSearchConfig,
  onXSearchDraftChange,
  managedAuthCooldownsConfig,
  authCooldownsDraft,
  authCooldownsError,
  isSavingAuthCooldowns,
  canEditManagedAuthCooldowns,
  onSaveAuthCooldownsConfig,
  onAuthCooldownsDraftChange,
  formatWorkbenchLabel,
  getDangerBadge,
  getStatusBadge,
  t,
}: InstanceDetailManagedToolsSectionProps) {
  const managedWebSearchPanel =
    managedWebSearchConfig &&
    webSearchSharedDraft &&
    selectedWebSearchProvider &&
    selectedWebSearchProviderDraft ? (
      <InstanceDetailManagedWebSearchPanel
        managedWebSearchConfig={managedWebSearchConfig}
        webSearchSharedDraft={webSearchSharedDraft}
        selectedWebSearchProvider={selectedWebSearchProvider}
        selectedWebSearchProviderDraft={selectedWebSearchProviderDraft}
        webSearchError={webSearchError}
        isSavingWebSearch={isSavingWebSearch}
        canEditManagedWebSearch={canEditManagedWebSearch}
        formatWorkbenchLabel={formatWorkbenchLabel}
        t={t}
        onSave={onSaveWebSearchConfig}
        onWebSearchSharedDraftChange={onWebSearchSharedDraftChange}
        onWebSearchProviderDraftChange={onWebSearchProviderDraftChange}
        onSelectedWebSearchProviderIdChange={onSelectedWebSearchProviderIdChange}
      />
    ) : null;

  const managedWebFetchPanel =
    managedWebFetchConfig && webFetchSharedDraft ? (
      <InstanceDetailManagedWebFetchPanel
        managedWebFetchConfig={managedWebFetchConfig}
        webFetchSharedDraft={webFetchSharedDraft}
        webFetchFallbackDraft={webFetchFallbackDraft}
        webFetchError={webFetchError}
        isSavingWebFetch={isSavingWebFetch}
        canEditManagedWebFetch={canEditManagedWebFetch}
        t={t}
        onSave={onSaveWebFetchConfig}
        onWebFetchSharedDraftChange={onWebFetchSharedDraftChange}
        onWebFetchFallbackDraftChange={onWebFetchFallbackDraftChange}
      />
    ) : null;

  const managedWebSearchNativeCodexPanel =
    managedWebSearchNativeCodexConfig && webSearchNativeCodexDraft ? (
      <InstanceDetailManagedWebSearchNativeCodexPanel
        webSearchNativeCodexDraft={webSearchNativeCodexDraft}
        webSearchNativeCodexError={webSearchNativeCodexError}
        isSavingWebSearchNativeCodex={isSavingWebSearchNativeCodex}
        canEditManagedWebSearchNativeCodex={canEditManagedWebSearchNativeCodex}
        formatWorkbenchLabel={formatWorkbenchLabel}
        t={t}
        onSave={onSaveWebSearchNativeCodexConfig}
        onDraftChange={onWebSearchNativeCodexDraftChange}
      />
    ) : null;

  const managedXSearchPanel =
    managedXSearchConfig && xSearchDraft ? (
      <InstanceDetailManagedXSearchPanel
        xSearchDraft={xSearchDraft}
        xSearchError={xSearchError}
        isSavingXSearch={isSavingXSearch}
        canEditManagedXSearch={canEditManagedXSearch}
        formatWorkbenchLabel={formatWorkbenchLabel}
        t={t}
        onSave={onSaveXSearchConfig}
        onDraftChange={onXSearchDraftChange}
      />
    ) : null;

  const managedAuthCooldownsPanel =
    managedAuthCooldownsConfig && authCooldownsDraft ? (
      <InstanceDetailManagedAuthCooldownsPanel
        authCooldownsDraft={authCooldownsDraft}
        authCooldownsError={authCooldownsError}
        isSavingAuthCooldowns={isSavingAuthCooldowns}
        canEditManagedAuthCooldowns={canEditManagedAuthCooldowns}
        formatWorkbenchLabel={formatWorkbenchLabel}
        t={t}
        onSave={onSaveAuthCooldownsConfig}
        onDraftChange={onAuthCooldownsDraftChange}
      />
    ) : null;

  const sectionProps: Omit<InstanceDetailToolsSectionProps, 'hasRuntimeTools' | 'emptyState'> = {
    managedAuthCooldownsPanel,
    managedWebSearchPanel,
    managedWebSearchNativeCodexPanel,
    managedXSearchPanel,
    managedWebFetchPanel,
    tools: workbench?.tools || [],
    getDangerBadge,
    getStatusBadge,
    t,
  };

  const hasRuntimeTools = sectionProps.tools.length > 0;
  const hasAnyToolsSurface = Boolean(
    hasRuntimeTools ||
      sectionProps.managedAuthCooldownsPanel ||
      sectionProps.managedWebSearchPanel ||
      sectionProps.managedWebSearchNativeCodexPanel ||
      sectionProps.managedXSearchPanel ||
      sectionProps.managedWebFetchPanel,
  );

  if (!hasAnyToolsSurface) {
    return <>{emptyState}</>;
  }

  return (
    <InstanceDetailToolsSection
      {...sectionProps}
      hasRuntimeTools={hasRuntimeTools}
      emptyState={emptyState}
    />
  );
}
