import type { Agent, Skill } from '@sdkwork/claw-types';

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
  | 'channels'
  | 'cronTasks'
  | 'llmProviders'
  | 'agents'
  | 'skills'
  | 'files'
  | 'memory'
  | 'tools';

export interface InstanceWorkbenchChannel {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'not_configured';
  enabled: boolean;
  fieldCount: number;
  configuredFieldCount: number;
  setupSteps: string[];
}

export interface InstanceWorkbenchTask {
  id: string;
  name: string;
  schedule: string;
  actionType: 'message' | 'skill';
  status: 'active' | 'paused' | 'failed';
  lastRun?: string;
  nextRun?: string;
}

export interface InstanceWorkbenchAgent {
  agent: Agent;
  focusAreas: string[];
  automationFitScore: number;
}

export interface InstanceWorkbenchFile {
  id: string;
  name: string;
  path: string;
  category: 'config' | 'log' | 'prompt' | 'dataset' | 'memory' | 'artifact';
  language: string;
  size: string;
  updatedAt: string;
  status: 'synced' | 'modified' | 'generated' | 'missing';
  description: string;
  content: string;
  isReadonly: boolean;
}

export interface InstanceWorkbenchLLMProviderModel {
  id: string;
  name: string;
  role: 'primary' | 'reasoning' | 'embedding' | 'fallback';
  contextWindow: string;
}

export interface InstanceWorkbenchLLMProviderConfig {
  temperature: number;
  topP: number;
  maxTokens: number;
  timeoutMs: number;
  streaming: boolean;
}

export interface InstanceWorkbenchLLMProvider {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  apiKeySource: string;
  status: 'ready' | 'degraded' | 'configurationRequired';
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
  description: string;
  icon: string;
  lastCheckedAt: string;
  capabilities: string[];
  models: InstanceWorkbenchLLMProviderModel[];
  config: InstanceWorkbenchLLMProviderConfig;
}

export interface InstanceLLMProviderUpdate {
  endpoint: string;
  apiKeySource: string;
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
  config: InstanceWorkbenchLLMProviderConfig;
}

export interface InstanceWorkbenchMemoryEntry {
  id: string;
  title: string;
  type: 'runbook' | 'conversation' | 'fact' | 'artifact';
  summary: string;
  source: 'operator' | 'agent' | 'system' | 'task';
  updatedAt: string;
  retention: 'pinned' | 'rolling' | 'expiring';
  tokens: number;
}

export interface InstanceWorkbenchTool {
  id: string;
  name: string;
  description: string;
  category: 'filesystem' | 'automation' | 'observability' | 'integration' | 'reasoning';
  status: 'ready' | 'beta' | 'restricted';
  access: 'read' | 'write' | 'execute';
  command: string;
  lastUsedAt?: string;
}

export interface InstanceWorkbenchSnapshot {
  instance: Instance;
  config: InstanceConfig;
  token: string;
  logs: string;
  healthScore: number;
  runtimeStatus: 'healthy' | 'attention' | 'degraded';
  connectedChannelCount: number;
  activeTaskCount: number;
  installedSkillCount: number;
  readyToolCount: number;
  sectionCounts: Record<InstanceWorkbenchSectionId, number>;
  channels: InstanceWorkbenchChannel[];
  tasks: InstanceWorkbenchTask[];
  agents: InstanceWorkbenchAgent[];
  skills: Skill[];
  files: InstanceWorkbenchFile[];
  llmProviders: InstanceWorkbenchLLMProvider[];
  memories: InstanceWorkbenchMemoryEntry[];
  tools: InstanceWorkbenchTool[];
}
