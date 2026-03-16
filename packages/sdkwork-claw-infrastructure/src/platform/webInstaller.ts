import type { InstallerPlatformAPI, InstallScriptRequest } from './contracts/installer.ts';

export class WebInstallerPlatform implements InstallerPlatformAPI {
  async executeInstallScript(_request: InstallScriptRequest): Promise<string> {
    throw new Error(
      'Tauri API is not available in this web preview environment. In a real Tauri app, this would execute the native installation script.',
    );
  }
}
