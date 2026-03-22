import type {
  StudioConversationRecord,
  StudioInstanceDetailRecord,
  StudioInstanceConfig,
  StudioInstanceDeploymentMode,
  StudioInstanceRecord,
  StudioInstanceStatus,
  StudioInstanceTransportKind,
  StudioRuntimeKind,
  StudioStorageBinding,
  StudioWorkbenchLLMProviderConfigRecord,
  StudioWorkbenchTaskExecutionRecord,
} from '@sdkwork/claw-types';

export interface StudioCreateInstanceInput {
  name: string;
  description?: string;
  runtimeKind: StudioRuntimeKind;
  deploymentMode: StudioInstanceDeploymentMode;
  transportKind: StudioInstanceTransportKind;
  iconType?: 'apple' | 'box' | 'server';
  version?: string;
  typeLabel?: string;
  host?: string;
  port?: number | null;
  baseUrl?: string | null;
  websocketUrl?: string | null;
  storage?: Partial<StudioStorageBinding>;
  config?: Partial<StudioInstanceConfig>;
}

export interface StudioUpdateInstanceInput
  extends Partial<
    Omit<
      StudioCreateInstanceInput,
      'runtimeKind' | 'deploymentMode' | 'transportKind'
    >
  > {
  status?: StudioInstanceStatus;
  isDefault?: boolean;
}

export type StudioInstanceTaskMutationPayload = Record<string, unknown>;
export interface StudioUpdateInstanceLlmProviderConfigInput {
  endpoint: string;
  apiKeySource: string;
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
  config: StudioWorkbenchLLMProviderConfigRecord;
}

export interface StudioPlatformAPI {
  listInstances(): Promise<StudioInstanceRecord[]>;
  getInstance(id: string): Promise<StudioInstanceRecord | null>;
  getInstanceDetail(id: string): Promise<StudioInstanceDetailRecord | null>;
  createInstance(input: StudioCreateInstanceInput): Promise<StudioInstanceRecord>;
  updateInstance(id: string, input: StudioUpdateInstanceInput): Promise<StudioInstanceRecord>;
  deleteInstance(id: string): Promise<boolean>;
  startInstance(id: string): Promise<StudioInstanceRecord | null>;
  stopInstance(id: string): Promise<StudioInstanceRecord | null>;
  restartInstance(id: string): Promise<StudioInstanceRecord | null>;
  setInstanceStatus(
    id: string,
    status: StudioInstanceStatus,
  ): Promise<StudioInstanceRecord | null>;
  getInstanceConfig(id: string): Promise<StudioInstanceConfig | null>;
  updateInstanceConfig(
    id: string,
    config: StudioInstanceConfig,
  ): Promise<StudioInstanceConfig | null>;
  getInstanceLogs(id: string): Promise<string>;
  createInstanceTask(
    instanceId: string,
    payload: StudioInstanceTaskMutationPayload,
  ): Promise<void>;
  updateInstanceTask(
    instanceId: string,
    taskId: string,
    payload: StudioInstanceTaskMutationPayload,
  ): Promise<void>;
  updateInstanceFileContent(
    instanceId: string,
    fileId: string,
    content: string,
  ): Promise<boolean>;
  updateInstanceLlmProviderConfig(
    instanceId: string,
    providerId: string,
    update: StudioUpdateInstanceLlmProviderConfigInput,
  ): Promise<boolean>;
  cloneInstanceTask(instanceId: string, taskId: string, name?: string): Promise<void>;
  runInstanceTaskNow(
    instanceId: string,
    taskId: string,
  ): Promise<StudioWorkbenchTaskExecutionRecord>;
  listInstanceTaskExecutions(
    instanceId: string,
    taskId: string,
  ): Promise<StudioWorkbenchTaskExecutionRecord[]>;
  updateInstanceTaskStatus(
    instanceId: string,
    taskId: string,
    status: 'active' | 'paused',
  ): Promise<void>;
  deleteInstanceTask(instanceId: string, taskId: string): Promise<boolean>;
  listConversations(instanceId: string): Promise<StudioConversationRecord[]>;
  putConversation(record: StudioConversationRecord): Promise<StudioConversationRecord>;
  deleteConversation(id: string): Promise<boolean>;
}
