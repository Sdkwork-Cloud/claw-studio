import type { ProxyProvider } from '@sdkwork/claw-types';

export type OpenClawWizardAssessmentStatus = 'idle' | 'loading' | 'ready' | 'blocked' | 'error';
export type OpenClawWizardActionStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'error'
  | 'skipped';
export type OpenClawWizardStepId =
  | 'dependencies'
  | 'install'
  | 'configure'
  | 'initialize'
  | 'verify';
export type OpenClawWizardStepStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'completed'
  | 'warning'
  | 'blocked';
export type OpenClawVerificationStatus = 'success' | 'warning' | 'blocked';

export interface OpenClawModelSelection {
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
}

export interface OpenClawWizardStep {
  id: OpenClawWizardStepId;
  status: OpenClawWizardStepStatus;
}

export interface BuildOpenClawWizardStepsInput {
  assessmentStatus: OpenClawWizardAssessmentStatus;
  dependenciesReviewed: boolean;
  installStatus: OpenClawWizardActionStatus;
  configurationStatus: OpenClawWizardActionStatus;
  initializationStatus: OpenClawWizardActionStatus;
  hasExistingInstall?: boolean;
}

export interface OpenClawVerificationItem {
  id: 'install' | 'provider' | 'channels' | 'skills';
  status: OpenClawVerificationStatus;
}

export interface OpenClawVerificationSummary {
  status: OpenClawVerificationStatus;
  isReadyToUse: boolean;
  items: OpenClawVerificationItem[];
}

const OPENCLAW_COMPATIBLE_CHANNELS = new Set([
  'openai',
  'anthropic',
  'xai',
  'deepseek',
  'qwen',
  'zhipu',
  'baidu',
  'tencent-hunyuan',
  'doubao',
  'moonshot',
  'stepfun',
  'iflytek-spark',
  'minimax',
]);

function isReasoningModel(model: ProxyProvider['models'][number]) {
  return /(reason|reasoner|thinking|r1|o1|o3|o4|t1|k1|opus)/i.test(`${model.id} ${model.name}`);
}

function isEmbeddingModel(model: ProxyProvider['models'][number]) {
  return /(embed|embedding|bge|vector)/i.test(`${model.id} ${model.name}`);
}

function createStep(id: OpenClawWizardStepId, status: OpenClawWizardStepStatus): OpenClawWizardStep {
  return { id, status };
}

export function filterOpenClawCompatibleProviders(providers: ProxyProvider[]) {
  return providers.filter((provider) => OPENCLAW_COMPATIBLE_CHANNELS.has(provider.channelId));
}

export function buildOpenClawModelSelection(provider: ProxyProvider): OpenClawModelSelection {
  const defaultModelId = provider.models[0]?.id || 'model-id';
  const reasoningModelId = provider.models.find(isReasoningModel)?.id;
  const embeddingModelId = provider.models.find(isEmbeddingModel)?.id;

  return {
    defaultModelId,
    reasoningModelId,
    embeddingModelId,
  };
}

export function buildOpenClawWizardSteps(
  input: BuildOpenClawWizardStepsInput,
): OpenClawWizardStep[] {
  const installCompleted = input.hasExistingInstall || input.installStatus === 'success';
  const dependenciesStatus: OpenClawWizardStepStatus =
    input.assessmentStatus === 'loading'
      ? 'running'
      : input.assessmentStatus === 'blocked' || input.assessmentStatus === 'error'
        ? 'blocked'
        : input.dependenciesReviewed
          ? 'completed'
          : 'ready';

  const installStatus: OpenClawWizardStepStatus =
    dependenciesStatus === 'blocked'
      ? 'pending'
      : input.installStatus === 'running'
        ? 'running'
        : installCompleted
          ? 'completed'
          : input.installStatus === 'error'
            ? 'warning'
            : dependenciesStatus === 'completed'
              ? 'ready'
              : 'pending';

  const configureStatus: OpenClawWizardStepStatus =
    !installCompleted
      ? 'pending'
      : input.configurationStatus === 'running'
        ? 'running'
        : input.configurationStatus === 'success'
          ? 'completed'
          : input.configurationStatus === 'error' || input.configurationStatus === 'skipped'
            ? 'warning'
            : 'ready';

  const initializeStatus: OpenClawWizardStepStatus =
    !installCompleted
      ? 'pending'
      : input.initializationStatus === 'running'
        ? 'running'
        : input.initializationStatus === 'success'
          ? 'completed'
          : input.initializationStatus === 'error' || input.initializationStatus === 'skipped'
            ? 'warning'
            : 'ready';

  const verifyStatus: OpenClawWizardStepStatus =
    !installCompleted
      ? 'pending'
      : configureStatus === 'completed' && initializeStatus === 'completed'
        ? 'completed'
        : configureStatus === 'warning' || initializeStatus === 'warning'
          ? 'warning'
          : 'ready';

  return [
    createStep('dependencies', dependenciesStatus),
    createStep('install', installStatus),
    createStep('configure', configureStatus),
    createStep('initialize', initializeStatus),
    createStep('verify', verifyStatus),
  ];
}

export function buildOpenClawVerificationSummary(input: {
  installSucceeded: boolean;
  hasReadyProvider: boolean;
  selectedChannelCount: number;
  configuredChannelCount: number;
  selectedSkillCount: number;
  initializedSkillCount: number;
}): OpenClawVerificationSummary {
  const installStatus: OpenClawVerificationStatus = input.installSucceeded ? 'success' : 'blocked';
  const providerStatus: OpenClawVerificationStatus = input.hasReadyProvider ? 'success' : 'warning';
  const channelsStatus: OpenClawVerificationStatus =
    input.selectedChannelCount === 0 || input.configuredChannelCount >= input.selectedChannelCount
      ? 'success'
      : 'warning';
  const skillsStatus: OpenClawVerificationStatus =
    input.selectedSkillCount === 0 || input.initializedSkillCount >= input.selectedSkillCount
      ? 'success'
      : 'warning';

  const items: OpenClawVerificationItem[] = [
    {
      id: 'install',
      status: installStatus,
    },
    {
      id: 'provider',
      status: providerStatus,
    },
    {
      id: 'channels',
      status: channelsStatus,
    },
    {
      id: 'skills',
      status: skillsStatus,
    },
  ];

  const isReadyToUse =
    installStatus === 'success' &&
    providerStatus === 'success' &&
    channelsStatus === 'success' &&
    skillsStatus === 'success';

  return {
    status: !input.installSucceeded ? 'blocked' : isReadyToUse ? 'success' : 'warning',
    isReadyToUse,
    items,
  };
}
