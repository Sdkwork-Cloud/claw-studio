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
} from '../platform/contracts/installer.ts';
import type { RuntimeEventUnsubscribe } from '../platform/contracts/runtime.ts';
import { installer } from '../platform/registry.ts';

export const installerService = {
  listHubInstallCatalog: async (
    query?: HubInstallCatalogQuery,
  ): Promise<HubInstallCatalogEntry[]> => {
    return installer.listHubInstallCatalog(query);
  },
  inspectHubInstall: async (
    request: HubInstallRequest,
  ): Promise<HubInstallAssessmentResult> => {
    return installer.inspectHubInstall(request);
  },
  runHubDependencyInstall: async (
    request: HubInstallDependencyRequest,
  ): Promise<HubInstallDependencyResult> => {
    return installer.runHubDependencyInstall(request);
  },
  runHubInstall: async (request: HubInstallRequest): Promise<HubInstallResult> => {
    return installer.runHubInstall(request);
  },
  runHubUninstall: async (request: HubUninstallRequest): Promise<HubUninstallResult> => {
    return installer.runHubUninstall(request);
  },
  subscribeHubInstallProgress: async (
    listener: (event: HubInstallProgressEvent) => void,
  ): Promise<RuntimeEventUnsubscribe> => {
    return installer.subscribeHubInstallProgress(listener);
  },
};
