import type { InstallProviderDraft } from './installBootstrapService.ts';

export function isExistingGuidedInstallProviderDraft(
  provider: InstallProviderDraft | null | undefined,
) {
  return Boolean(provider?.providerId?.trim());
}

export function isGuidedInstallProviderDraftReady(
  provider: InstallProviderDraft | null | undefined,
) {
  if (!provider?.modelId.trim()) {
    return false;
  }

  if (isExistingGuidedInstallProviderDraft(provider)) {
    return true;
  }

  return Boolean(provider.apiKey.trim() && provider.baseUrl.trim());
}
