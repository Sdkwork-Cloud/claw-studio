import { inferLocalAiProxyClientProtocol } from '@sdkwork/claw-core';
import type { LocalAiProxyClientProtocol, ProxyProvider } from '@sdkwork/claw-types';

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
  id: 'install' | 'gateway' | 'provider' | 'channels' | 'skills';
  status: OpenClawVerificationStatus;
}

export interface OpenClawVerificationSummary {
  status: OpenClawVerificationStatus;
  isReadyToUse: boolean;
  items: OpenClawVerificationItem[];
}

const OPENCLAW_COMPATIBLE_CLIENT_PROTOCOLS = new Set(['openai-compatible', 'anthropic', 'gemini']);

function resolveOpenClawCompatibleClientProtocol(
  provider: ProxyProvider,
): LocalAiProxyClientProtocol {
  if (provider.clientProtocol) {
    return provider.clientProtocol;
  }

  return inferLocalAiProxyClientProtocol(provider.channelId);
}

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
  return providers.filter(
    (provider) =>
      OPENCLAW_COMPATIBLE_CLIENT_PROTOCOLS.has(resolveOpenClawCompatibleClientProtocol(provider)),
  );
}

export function sortOpenClawBootstrapProviders(providers: ProxyProvider[]) {
  const statusRank: Record<ProxyProvider['status'], number> = {
    active: 0,
    warning: 1,
    expired: 2,
    disabled: 3,
  };
  const protocolRank: Record<string, number> = {
    'openai-compatible': 0,
    anthropic: 1,
    gemini: 2,
  };

  return [...providers].sort((left, right) => {
    const statusDelta = statusRank[left.status] - statusRank[right.status];
    if (statusDelta !== 0) {
      return statusDelta;
    }

    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    if (left.managedBy !== right.managedBy) {
      return left.managedBy === 'user' ? -1 : 1;
    }

    const leftProtocolRank = protocolRank[left.clientProtocol || ''] ?? 99;
    const rightProtocolRank = protocolRank[right.clientProtocol || ''] ?? 99;
    if (leftProtocolRank !== rightProtocolRank) {
      return leftProtocolRank - rightProtocolRank;
    }

    return left.name.localeCompare(right.name);
  });
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
  gatewayReachable: boolean;
  hasReadyProvider: boolean;
  selectedChannelCount: number;
  configuredChannelCount: number;
  selectedSkillCount: number;
  initializedSkillCount: number;
}): OpenClawVerificationSummary {
  const installStatus: OpenClawVerificationStatus = input.installSucceeded ? 'success' : 'blocked';
  const gatewayStatus: OpenClawVerificationStatus = input.gatewayReachable ? 'success' : 'warning';
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
      id: 'gateway',
      status: gatewayStatus,
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
    gatewayStatus === 'success' &&
    providerStatus === 'success' &&
    channelsStatus === 'success' &&
    skillsStatus === 'success';

  return {
    status: !input.installSucceeded ? 'blocked' : isReadyToUse ? 'success' : 'warning',
    isReadyToUse,
    items,
  };
}
