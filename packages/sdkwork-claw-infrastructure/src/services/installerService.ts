import type {
  HubInstallCatalogEntry,
  HubInstallCatalogQuery,
  HubInstallDependencyRequest,
  HubInstallDependencyResult,
  HubInstallAssessmentResult,
  HubInstallProgressEvent,
  HubInstallRequest,
  HubInstallResult,
  HubUninstallRequest,
  HubUninstallResult,
  ProviderClientSetupRequest,
  ProviderClientSetupResult,
} from '../platform/contracts/installer.ts';
import type { RuntimeEventUnsubscribe } from '../platform/contracts/runtime.ts';
import { getInstallerPlatform } from '../platform/registry.ts';

export const installerService = {
  listHubInstallCatalog: async (
    query?: HubInstallCatalogQuery,
  ): Promise<HubInstallCatalogEntry[]> => {
    return getInstallerPlatform().listHubInstallCatalog(query);
  },
  inspectHubInstall: async (
    request: HubInstallRequest,
  ): Promise<HubInstallAssessmentResult> => {
    return getInstallerPlatform().inspectHubInstall(request);
  },
  runHubDependencyInstall: async (
    request: HubInstallDependencyRequest,
  ): Promise<HubInstallDependencyResult> => {
    return getInstallerPlatform().runHubDependencyInstall(request);
  },
  runHubInstall: async (request: HubInstallRequest): Promise<HubInstallResult> => {
    return getInstallerPlatform().runHubInstall(request);
  },
  runHubUninstall: async (request: HubUninstallRequest): Promise<HubUninstallResult> => {
    return getInstallerPlatform().runHubUninstall(request);
  },
  applyProviderClientSetup: async (
    request: ProviderClientSetupRequest,
  ): Promise<ProviderClientSetupResult> => {
    return getInstallerPlatform().applyProviderClientSetup(request);
  },
  subscribeHubInstallProgress: async (
    listener: (event: HubInstallProgressEvent) => void,
  ): Promise<RuntimeEventUnsubscribe> => {
    return getInstallerPlatform().subscribeHubInstallProgress(listener);
  },
};
