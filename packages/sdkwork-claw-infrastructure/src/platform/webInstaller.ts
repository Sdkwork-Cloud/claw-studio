import type {
  ApiRouterClientInstallRequest,
  ApiRouterClientInstallResult,
  HubInstallAssessmentResult,
  HubInstallRequest,
  HubInstallResult,
  HubUninstallRequest,
  HubUninstallResult,
  InstallerPlatformAPI,
} from './contracts/installer.ts';
import type { RuntimeEventUnsubscribe } from './contracts/runtime.ts';

export class WebInstallerPlatform implements InstallerPlatformAPI {
  async inspectHubInstall(_request: HubInstallRequest): Promise<HubInstallAssessmentResult> {
    throw new Error(
      'Tauri API is not available in this web preview environment. In a real Tauri app, this would inspect the installation environment through the desktop runtime.',
    );
  }

  async runHubInstall(_request: HubInstallRequest): Promise<HubInstallResult> {
    throw new Error(
      'Tauri API is not available in this web preview environment. In a real Tauri app, this would run hub-installer through the desktop runtime.',
    );
  }

  async runHubUninstall(_request: HubUninstallRequest): Promise<HubUninstallResult> {
    throw new Error(
      'Tauri API is not available in this web preview environment. In a real Tauri app, this would run uninstall through the desktop runtime.',
    );
  }

  async subscribeHubInstallProgress(): Promise<RuntimeEventUnsubscribe> {
    return () => {};
  }

  async installApiRouterClientSetup(
    _request: ApiRouterClientInstallRequest,
  ): Promise<ApiRouterClientInstallResult> {
    throw new Error(
      'Tauri API is not available in this web preview environment. In a real Tauri app, this would install API Router client configuration through the desktop runtime.',
    );
  }
}
