import type {
  ApiRouterClientInstallRequest,
  ApiRouterClientInstallResult,
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
  RuntimeEventUnsubscribe,
} from '../platform/index.ts';
import { getInstallerPlatform } from '../platform/index.ts';

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
  subscribeHubInstallProgress: async (
    listener: (event: HubInstallProgressEvent) => void,
  ): Promise<RuntimeEventUnsubscribe> => {
    return getInstallerPlatform().subscribeHubInstallProgress(listener);
  },
  installApiRouterClientSetup: async (
    request: ApiRouterClientInstallRequest,
  ): Promise<ApiRouterClientInstallResult> => {
    return getInstallerPlatform().installApiRouterClientSetup(request);
  },
};
