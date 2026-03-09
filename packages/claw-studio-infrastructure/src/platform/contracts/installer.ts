export interface InstallScriptRequest {
  command: string;
}

export interface InstallerPlatformAPI {
  executeInstallScript(request: InstallScriptRequest): Promise<string>;
}
