import type {
  StudioConversationRecord,
  StudioCreateInstanceInput,
  StudioInstanceConfig,
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
  StudioInstanceTaskMutationPayload,
  StudioOpenClawGatewayInvokeOptions,
  StudioOpenClawGatewayInvokeRequest,
  StudioUpdateInstanceInput,
  StudioUpdateInstanceLlmProviderConfigInput,
  StudioWorkbenchTaskExecutionRecord,
} from '@sdkwork/claw-infrastructure';
import { DESKTOP_COMMANDS, type DesktopCommandName } from './catalog';
import { invokeDesktopCommand, runDesktopOnly } from './runtime';

// Compatibility-only direct Tauri studio command surface.
// Canonical browser-facing studio flows must continue to go through the
// hosted HTTP platform configured in tauriBridge.ts.
export interface DesktopLegacyStudioCompatApi {
  listInstances(): Promise<StudioInstanceRecord[]>;
  getInstance(id: string): Promise<StudioInstanceRecord | null>;
  getInstanceDetail(id: string): Promise<StudioInstanceDetailRecord | null>;
  invokeOpenClawGateway(
    instanceId: string,
    request: StudioOpenClawGatewayInvokeRequest,
    options?: StudioOpenClawGatewayInvokeOptions,
  ): Promise<unknown>;
  createInstance(input: StudioCreateInstanceInput): Promise<StudioInstanceRecord>;
  updateInstance(
    id: string,
    input: StudioUpdateInstanceInput,
  ): Promise<StudioInstanceRecord>;
  deleteInstance(id: string): Promise<boolean>;
  startInstance(id: string): Promise<StudioInstanceRecord | null>;
  stopInstance(id: string): Promise<StudioInstanceRecord | null>;
  restartInstance(id: string): Promise<StudioInstanceRecord | null>;
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

function runStudioCompatCommand<T>(
  operation: string,
  command: DesktopCommandName,
  payload?: Record<string, unknown>,
): Promise<T> {
  return runDesktopOnly(operation, () =>
    invokeDesktopCommand<T>(command, payload, { operation }),
  );
}

async function runStudioCompatVoidCommand(
  operation: string,
  command: DesktopCommandName,
  payload?: Record<string, unknown>,
): Promise<void> {
  await runDesktopOnly(operation, () =>
    invokeDesktopCommand<void>(command, payload, { operation }),
  );
}

export const desktopLegacyStudioCompatApi: DesktopLegacyStudioCompatApi = {
  listInstances: () =>
    runStudioCompatCommand<StudioInstanceRecord[]>(
      'studio.listInstances',
      DESKTOP_COMMANDS.studioListInstances,
    ),
  getInstance: (id) =>
    runStudioCompatCommand<StudioInstanceRecord | null>(
      'studio.getInstance',
      DESKTOP_COMMANDS.studioGetInstance,
      { id },
    ),
  getInstanceDetail: (id) =>
    runStudioCompatCommand<StudioInstanceDetailRecord | null>(
      'studio.getInstanceDetail',
      DESKTOP_COMMANDS.studioGetInstanceDetail,
      { id },
    ),
  invokeOpenClawGateway: (
    instanceId,
    request,
    options: StudioOpenClawGatewayInvokeOptions = {},
  ) =>
    invokeDesktopCommand<unknown>(
      DESKTOP_COMMANDS.studioInvokeOpenClawGateway,
      { instanceId, request, options },
      { operation: 'studio.invokeOpenClawGateway' },
    ),
  createInstance: (input) =>
    runStudioCompatCommand<StudioInstanceRecord>(
      'studio.createInstance',
      DESKTOP_COMMANDS.studioCreateInstance,
      { input },
    ),
  updateInstance: (id, input) =>
    runStudioCompatCommand<StudioInstanceRecord>(
      'studio.updateInstance',
      DESKTOP_COMMANDS.studioUpdateInstance,
      { id, input },
    ),
  deleteInstance: (id) =>
    runStudioCompatCommand<boolean>(
      'studio.deleteInstance',
      DESKTOP_COMMANDS.studioDeleteInstance,
      { id },
    ),
  startInstance: (id) =>
    runStudioCompatCommand<StudioInstanceRecord | null>(
      'studio.startInstance',
      DESKTOP_COMMANDS.studioStartInstance,
      { id },
    ),
  stopInstance: (id) =>
    runStudioCompatCommand<StudioInstanceRecord | null>(
      'studio.stopInstance',
      DESKTOP_COMMANDS.studioStopInstance,
      { id },
    ),
  restartInstance: (id) =>
    runStudioCompatCommand<StudioInstanceRecord | null>(
      'studio.restartInstance',
      DESKTOP_COMMANDS.studioRestartInstance,
      { id },
    ),
  getInstanceConfig: (id) =>
    runStudioCompatCommand<StudioInstanceConfig | null>(
      'studio.getInstanceConfig',
      DESKTOP_COMMANDS.studioGetInstanceConfig,
      { id },
    ),
  updateInstanceConfig: (id, config) =>
    runStudioCompatCommand<StudioInstanceConfig | null>(
      'studio.updateInstanceConfig',
      DESKTOP_COMMANDS.studioUpdateInstanceConfig,
      { id, config },
    ),
  getInstanceLogs: (id) =>
    runStudioCompatCommand<string>(
      'studio.getInstanceLogs',
      DESKTOP_COMMANDS.studioGetInstanceLogs,
      { id },
    ),
  createInstanceTask: (instanceId, payload) =>
    runStudioCompatVoidCommand(
      'studio.createInstanceTask',
      DESKTOP_COMMANDS.studioCreateInstanceTask,
      { instanceId, payload },
    ),
  updateInstanceTask: (instanceId, taskId, payload) =>
    runStudioCompatVoidCommand(
      'studio.updateInstanceTask',
      DESKTOP_COMMANDS.studioUpdateInstanceTask,
      { instanceId, taskId, payload },
    ),
  updateInstanceFileContent: (instanceId, fileId, content) =>
    runStudioCompatCommand<boolean>(
      'studio.updateInstanceFileContent',
      DESKTOP_COMMANDS.studioUpdateInstanceFileContent,
      { instanceId, fileId, content },
    ),
  updateInstanceLlmProviderConfig: (instanceId, providerId, update) =>
    runStudioCompatCommand<boolean>(
      'studio.updateInstanceLlmProviderConfig',
      DESKTOP_COMMANDS.studioUpdateInstanceLlmProviderConfig,
      { instanceId, providerId, update },
    ),
  cloneInstanceTask: (instanceId, taskId, name) =>
    runStudioCompatVoidCommand(
      'studio.cloneInstanceTask',
      DESKTOP_COMMANDS.studioCloneInstanceTask,
      { instanceId, taskId, name },
    ),
  runInstanceTaskNow: (instanceId, taskId) =>
    runStudioCompatCommand<StudioWorkbenchTaskExecutionRecord>(
      'studio.runInstanceTaskNow',
      DESKTOP_COMMANDS.studioRunInstanceTaskNow,
      { instanceId, taskId },
    ),
  listInstanceTaskExecutions: (instanceId, taskId) =>
    runStudioCompatCommand<StudioWorkbenchTaskExecutionRecord[]>(
      'studio.listInstanceTaskExecutions',
      DESKTOP_COMMANDS.studioListInstanceTaskExecutions,
      { instanceId, taskId },
    ),
  updateInstanceTaskStatus: (instanceId, taskId, status) =>
    runStudioCompatVoidCommand(
      'studio.updateInstanceTaskStatus',
      DESKTOP_COMMANDS.studioUpdateInstanceTaskStatus,
      { instanceId, taskId, status },
    ),
  deleteInstanceTask: (instanceId, taskId) =>
    runStudioCompatCommand<boolean>(
      'studio.deleteInstanceTask',
      DESKTOP_COMMANDS.studioDeleteInstanceTask,
      { instanceId, taskId },
    ),
  listConversations: (instanceId) =>
    runStudioCompatCommand<StudioConversationRecord[]>(
      'studio.listConversations',
      DESKTOP_COMMANDS.studioListConversations,
      { instanceId },
    ),
  putConversation: (record) =>
    runStudioCompatCommand<StudioConversationRecord>(
      'studio.putConversation',
      DESKTOP_COMMANDS.studioPutConversation,
      { record },
    ),
  deleteConversation: (id) =>
    runStudioCompatCommand<boolean>(
      'studio.deleteConversation',
      DESKTOP_COMMANDS.studioDeleteConversation,
      { id },
    ),
};

export const studioListInstances = () => desktopLegacyStudioCompatApi.listInstances();
export const studioGetInstance = (id: string) => desktopLegacyStudioCompatApi.getInstance(id);
export const studioGetInstanceDetail = (id: string) =>
  desktopLegacyStudioCompatApi.getInstanceDetail(id);
export const invokeOpenClawGateway = (
  instanceId: string,
  request: StudioOpenClawGatewayInvokeRequest,
  options: StudioOpenClawGatewayInvokeOptions = {},
) => desktopLegacyStudioCompatApi.invokeOpenClawGateway(instanceId, request, options);
export const studioCreateInstance = (input: StudioCreateInstanceInput) =>
  desktopLegacyStudioCompatApi.createInstance(input);
export const studioUpdateInstance = (
  id: string,
  input: StudioUpdateInstanceInput,
) => desktopLegacyStudioCompatApi.updateInstance(id, input);
export const studioDeleteInstance = (id: string) =>
  desktopLegacyStudioCompatApi.deleteInstance(id);
export const studioStartInstance = (id: string) =>
  desktopLegacyStudioCompatApi.startInstance(id);
export const studioStopInstance = (id: string) =>
  desktopLegacyStudioCompatApi.stopInstance(id);
export const studioRestartInstance = (id: string) =>
  desktopLegacyStudioCompatApi.restartInstance(id);
export const studioGetInstanceConfig = (id: string) =>
  desktopLegacyStudioCompatApi.getInstanceConfig(id);
export const studioUpdateInstanceConfig = (
  id: string,
  config: StudioInstanceConfig,
) => desktopLegacyStudioCompatApi.updateInstanceConfig(id, config);
export const studioGetInstanceLogs = (id: string) =>
  desktopLegacyStudioCompatApi.getInstanceLogs(id);
export const studioCreateInstanceTask = (
  instanceId: string,
  payload: StudioInstanceTaskMutationPayload,
) => desktopLegacyStudioCompatApi.createInstanceTask(instanceId, payload);
export const studioUpdateInstanceTask = (
  instanceId: string,
  taskId: string,
  payload: StudioInstanceTaskMutationPayload,
) => desktopLegacyStudioCompatApi.updateInstanceTask(instanceId, taskId, payload);
export const studioUpdateInstanceFileContent = (
  instanceId: string,
  fileId: string,
  content: string,
) => desktopLegacyStudioCompatApi.updateInstanceFileContent(instanceId, fileId, content);
export const studioUpdateInstanceLlmProviderConfig = (
  instanceId: string,
  providerId: string,
  update: StudioUpdateInstanceLlmProviderConfigInput,
) =>
  desktopLegacyStudioCompatApi.updateInstanceLlmProviderConfig(
    instanceId,
    providerId,
    update,
  );
export const studioCloneInstanceTask = (
  instanceId: string,
  taskId: string,
  name?: string,
) => desktopLegacyStudioCompatApi.cloneInstanceTask(instanceId, taskId, name);
export const studioRunInstanceTaskNow = (instanceId: string, taskId: string) =>
  desktopLegacyStudioCompatApi.runInstanceTaskNow(instanceId, taskId);
export const studioListInstanceTaskExecutions = (
  instanceId: string,
  taskId: string,
) => desktopLegacyStudioCompatApi.listInstanceTaskExecutions(instanceId, taskId);
export const studioUpdateInstanceTaskStatus = (
  instanceId: string,
  taskId: string,
  status: 'active' | 'paused',
) => desktopLegacyStudioCompatApi.updateInstanceTaskStatus(instanceId, taskId, status);
export const studioDeleteInstanceTask = (instanceId: string, taskId: string) =>
  desktopLegacyStudioCompatApi.deleteInstanceTask(instanceId, taskId);
export const studioListConversations = (instanceId: string) =>
  desktopLegacyStudioCompatApi.listConversations(instanceId);
export const studioPutConversation = (record: StudioConversationRecord) =>
  desktopLegacyStudioCompatApi.putConversation(record);
export const studioDeleteConversation = (id: string) =>
  desktopLegacyStudioCompatApi.deleteConversation(id);
