import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InstanceDetailManagedToolsSection } from './InstanceDetailManagedToolsSection.tsx';

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
  'InstanceDetailManagedToolsSection composes managed tools panels from page-owned state instead of requiring prebuilt JSX nodes',
  () => {
    const markup = renderToStaticMarkup(
      <InstanceDetailManagedToolsSection
        emptyState={<div>empty-tools</div>}
        workbench={{
          tools: [],
        } as any}
        managedWebSearchConfig={{
          providers: [{ id: 'provider-1', label: 'Primary Provider' }],
        } as any}
        webSearchSharedDraft={{
          enabled: true,
          provider: 'provider-1',
          maxResults: '5',
          timeoutSeconds: '30',
          cacheTtlMinutes: '10',
        }}
        selectedWebSearchProvider={{
          id: 'provider-1',
          label: 'Primary Provider',
          apiKeySource: 'WEB_SEARCH_KEY',
          baseUrl: 'https://example.com',
          model: 'gpt-5.4',
          advancedConfig: '{}',
        } as any}
        selectedWebSearchProviderDraft={{
          apiKeySource: 'WEB_SEARCH_KEY',
          baseUrl: 'https://example.com',
          model: 'gpt-5.4',
          advancedConfig: '{}',
        }}
        webSearchError={null}
        isSavingWebSearch={false}
        canEditManagedWebSearch
        onSaveWebSearchConfig={() => undefined}
        onWebSearchSharedDraftChange={() => undefined}
        onWebSearchProviderDraftChange={() => undefined}
        onSelectedWebSearchProviderIdChange={() => undefined}
        managedWebFetchConfig={null}
        webFetchSharedDraft={null}
        webFetchFallbackDraft={{
          apiKeySource: '',
          baseUrl: '',
          advancedConfig: '',
        }}
        webFetchError={null}
        isSavingWebFetch={false}
        canEditManagedWebFetch={false}
        onSaveWebFetchConfig={() => undefined}
        onWebFetchSharedDraftChange={() => undefined}
        onWebFetchFallbackDraftChange={() => undefined}
        managedWebSearchNativeCodexConfig={null}
        webSearchNativeCodexDraft={null}
        webSearchNativeCodexError={null}
        isSavingWebSearchNativeCodex={false}
        canEditManagedWebSearchNativeCodex={false}
        onSaveWebSearchNativeCodexConfig={() => undefined}
        onWebSearchNativeCodexDraftChange={() => undefined}
        managedXSearchConfig={null}
        xSearchDraft={null}
        xSearchError={null}
        isSavingXSearch={false}
        canEditManagedXSearch={false}
        onSaveXSearchConfig={() => undefined}
        onXSearchDraftChange={() => undefined}
        managedAuthCooldownsConfig={{
          billingMaxHours: 24,
        } as any}
        authCooldownsDraft={{
          rateLimitedProfileRotations: '',
          overloadedProfileRotations: '',
          overloadedBackoffMs: '',
          billingBackoffHours: '',
          billingMaxHours: '24',
          failureWindowHours: '',
        }}
        authCooldownsError={null}
        isSavingAuthCooldowns={false}
        canEditManagedAuthCooldowns
        onSaveAuthCooldownsConfig={() => undefined}
        onAuthCooldownsDraftChange={() => undefined}
        formatWorkbenchLabel={(value) => `label:${value}`}
        getDangerBadge={(status) => `danger:${status}`}
        getStatusBadge={(status) => `status:${status}`}
        t={(key) => key}
      />,
    );

    assert.match(markup, /data-slot="instance-detail-managed-web-search"/);
    assert.match(markup, /data-slot="instance-detail-managed-auth-cooldowns"/);
    assert.match(markup, /empty-tools/);
  },
);

await runTest(
  'InstanceDetailManagedToolsSection still falls back to the supplied empty state when runtime and managed tool surfaces are both absent',
  () => {
    const markup = renderToStaticMarkup(
      <InstanceDetailManagedToolsSection
        emptyState={<div>empty-tools</div>}
        workbench={null}
        managedWebSearchConfig={null}
        webSearchSharedDraft={null}
        selectedWebSearchProvider={null}
        selectedWebSearchProviderDraft={null}
        webSearchError={null}
        isSavingWebSearch={false}
        canEditManagedWebSearch={false}
        onSaveWebSearchConfig={() => undefined}
        onWebSearchSharedDraftChange={() => undefined}
        onWebSearchProviderDraftChange={() => undefined}
        onSelectedWebSearchProviderIdChange={() => undefined}
        managedWebFetchConfig={null}
        webFetchSharedDraft={null}
        webFetchFallbackDraft={{
          apiKeySource: '',
          baseUrl: '',
          advancedConfig: '',
        }}
        webFetchError={null}
        isSavingWebFetch={false}
        canEditManagedWebFetch={false}
        onSaveWebFetchConfig={() => undefined}
        onWebFetchSharedDraftChange={() => undefined}
        onWebFetchFallbackDraftChange={() => undefined}
        managedWebSearchNativeCodexConfig={null}
        webSearchNativeCodexDraft={null}
        webSearchNativeCodexError={null}
        isSavingWebSearchNativeCodex={false}
        canEditManagedWebSearchNativeCodex={false}
        onSaveWebSearchNativeCodexConfig={() => undefined}
        onWebSearchNativeCodexDraftChange={() => undefined}
        managedXSearchConfig={null}
        xSearchDraft={null}
        xSearchError={null}
        isSavingXSearch={false}
        canEditManagedXSearch={false}
        onSaveXSearchConfig={() => undefined}
        onXSearchDraftChange={() => undefined}
        managedAuthCooldownsConfig={null}
        authCooldownsDraft={null}
        authCooldownsError={null}
        isSavingAuthCooldowns={false}
        canEditManagedAuthCooldowns={false}
        onSaveAuthCooldownsConfig={() => undefined}
        onAuthCooldownsDraftChange={() => undefined}
        formatWorkbenchLabel={(value) => `label:${value}`}
        getDangerBadge={(status) => `danger:${status}`}
        getStatusBadge={(status) => `status:${status}`}
        t={(key) => key}
      />,
    );

    assert.match(markup, /empty-tools/);
  },
);
