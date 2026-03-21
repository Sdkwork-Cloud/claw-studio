import type {
  StudioInstanceCapabilityStatus,
  StudioInstanceDetailRecord,
  StudioInstanceHealthStatus,
  StudioWorkbenchAgentRecord,
  StudioWorkbenchChannelRecord,
  StudioWorkbenchFileRecord,
  StudioWorkbenchLLMProviderConfigRecord,
  StudioWorkbenchLLMProviderRecord,
  StudioWorkbenchMemoryEntryRecord,
  StudioWorkbenchSkillRecord,
  StudioWorkbenchTaskExecutionRecord,
  StudioWorkbenchTaskRecord,
  StudioWorkbenchToolRecord,
} from '@sdkwork/claw-types';
import type { OpenClawChannelSnapshot } from '@sdkwork/claw-core';

export interface Instance {
  id: string;
  name: string;
  type: string;
  iconType: 'apple' | 'box' | 'server';
  status: 'online' | 'offline' | 'starting' | 'error';
  version: string;
  uptime: string;
  ip: string;
  cpu: number;
  memory: number;
  totalMemory: string;
}

export interface InstanceConfig {
  port: string;
  sandbox: boolean;
  autoUpdate: boolean;
  logLevel: string;
  corsOrigins: string;
}

export type InstanceWorkbenchSectionId =
  | 'overview'
  | 'channels'
  | 'cronTasks'
  | 'llmProviders'
  | 'agents'
  | 'skills'
  | 'files'
  | 'memory'
  | 'tools';

export type InstanceWorkbenchChannel = StudioWorkbenchChannelRecord;
export type InstanceWorkbenchTask = StudioWorkbenchTaskRecord;
export type InstanceWorkbenchTaskExecution = StudioWorkbenchTaskExecutionRecord;
export type InstanceWorkbenchAgent = StudioWorkbenchAgentRecord;
export type InstanceWorkbenchFile = StudioWorkbenchFileRecord;
export type InstanceWorkbenchLLMProviderConfig = StudioWorkbenchLLMProviderConfigRecord;
export type InstanceWorkbenchLLMProvider = StudioWorkbenchLLMProviderRecord;

export interface InstanceLLMProviderUpdate {
  endpoint: string;
  apiKeySource: string;
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
  config: InstanceWorkbenchLLMProviderConfig;
}

export type InstanceWorkbenchMemoryEntry = StudioWorkbenchMemoryEntryRecord;
export type InstanceWorkbenchTool = StudioWorkbenchToolRecord;

export interface InstanceWorkbenchSectionAvailability {
  status: StudioInstanceCapabilityStatus;
  detail: string;
}

export interface InstanceWorkbenchSnapshot {
  instance: Instance;
  config: InstanceConfig;
  token: string;
  logs: string;
  detail: StudioInstanceDetailRecord;
  managedConfigPath?: string | null;
  managedChannels?: OpenClawChannelSnapshot[];
  healthScore: number;
  runtimeStatus: StudioInstanceHealthStatus;
  connectedChannelCount: number;
  activeTaskCount: number;
  installedSkillCount: number;
  readyToolCount: number;
  sectionCounts: Record<InstanceWorkbenchSectionId, number>;
  sectionAvailability: Record<InstanceWorkbenchSectionId, InstanceWorkbenchSectionAvailability>;
  channels: InstanceWorkbenchChannel[];
  tasks: InstanceWorkbenchTask[];
  agents: InstanceWorkbenchAgent[];
  skills: StudioWorkbenchSkillRecord[];
  files: InstanceWorkbenchFile[];
  llmProviders: InstanceWorkbenchLLMProvider[];
  memories: InstanceWorkbenchMemoryEntry[];
  tools: InstanceWorkbenchTool[];
}
