export interface InstallScriptRequest {
  command: string;
}

export type ApiRouterInstallerClientId =
  | 'codex'
  | 'claude-code'
  | 'opencode'
  | 'openclaw'
  | 'gemini';

export type ApiRouterInstallerCompatibility = 'openai' | 'anthropic' | 'gemini';
export type ApiRouterInstallerInstallMode = 'standard' | 'env' | 'both';
export type ApiRouterInstallerEnvScope = 'user' | 'system';
export type ApiRouterInstalledEnvironmentShell = 'powershell' | 'sh';

export interface ApiRouterInstallerModel {
  id: string;
  name: string;
}

export interface ApiRouterInstallerProvider {
  id: string;
  channelId: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  compatibility: ApiRouterInstallerCompatibility;
  models: ApiRouterInstallerModel[];
}

export interface ApiRouterInstallerOpenClawOptions {
  instanceIds: string[];
}

export interface ApiRouterClientInstallRequest {
  clientId: ApiRouterInstallerClientId;
  provider: ApiRouterInstallerProvider;
  installMode?: ApiRouterInstallerInstallMode;
  envScope?: ApiRouterInstallerEnvScope;
  openClaw?: ApiRouterInstallerOpenClawOptions;
}

export interface ApiRouterInstalledFile {
  path: string;
  action: 'created' | 'updated';
}

export interface ApiRouterInstalledEnvironment {
  scope: ApiRouterInstallerEnvScope;
  shell: ApiRouterInstalledEnvironmentShell;
  target: string;
  variables: string[];
}

export interface ApiRouterClientInstallResult {
  clientId: ApiRouterInstallerClientId;
  writtenFiles: ApiRouterInstalledFile[];
  updatedEnvironments: ApiRouterInstalledEnvironment[];
  updatedInstanceIds: string[];
}

export interface InstallerPlatformAPI {
  executeInstallScript(request: InstallScriptRequest): Promise<string>;
  installApiRouterClientSetup(
    request: ApiRouterClientInstallRequest,
  ): Promise<ApiRouterClientInstallResult>;
}
