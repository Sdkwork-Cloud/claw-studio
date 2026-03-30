import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  DownloadCloud,
  LoaderCircle,
  Package,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  platform,
  type HubInstallAssessmentDependency,
  type HubInstallAssessmentResult,
  type HubInstallDependencyReport,
  type HubInstallProgressEvent,
  type HubInstallRequest,
  type HubInstallResult,
  type RuntimeEventUnsubscribe,
} from '@sdkwork/claw-infrastructure';
import {
  Button,
  ChannelCatalog,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@sdkwork/claw-ui';
import type { ProxyProvider, SkillPack } from '@sdkwork/claw-types';
import { useTranslation } from 'react-i18next';
import { HubInstallDescriptorSummary } from './HubInstallDescriptorSummary';
import {
  applyHubInstallResultToProgressState,
  createHubInstallProgressBatcher,
  createHubInstallProgressState,
  formatHubInstallProgressEvent,
  humanizeHubInstallProgressLabel,
  installerService,
  openClawBootstrapService,
  openClawInstallWizardService,
  reduceHubInstallProgressEvent,
  type HubInstallProgressBatcher,
} from '../services';

type StepId = openClawInstallWizardService.OpenClawWizardStepId;
type ActionStatus = openClawInstallWizardService.OpenClawWizardActionStatus;
type BootstrapLoadStatus = 'idle' | 'loading' | 'ready' | 'error';
type VerificationLoadStatus = 'idle' | 'running' | 'success' | 'error';

interface OpenClawGuidedInstallWizardProps {
  isOpen: boolean;
  productName: string;
  methodLabel: string;
  methodIcon: React.ReactNode;
  request: HubInstallRequest;
  steps?: StepId[];
  onClose: () => void;
  onInstallSuccess?: (result: HubInstallResult) => void;
}

interface AssessmentState {
  status: openClawInstallWizardService.OpenClawWizardAssessmentStatus;
  result?: HubInstallAssessmentResult;
  error?: string;
}

interface BootstrapState {
  status: BootstrapLoadStatus;
  data?: Awaited<ReturnType<typeof openClawBootstrapService.loadBootstrapData>>;
  error?: string;
}

interface VerificationState {
  status: VerificationLoadStatus;
  error?: string;
  snapshot?: Awaited<ReturnType<typeof openClawBootstrapService.loadVerificationSnapshot>>;
  summary?: openClawInstallWizardService.OpenClawVerificationSummary;
}

interface DependencyInstallState {
  status: ActionStatus;
  output: string;
  error?: string;
  report?: HubInstallDependencyReport;
}

type ChannelDrafts = Record<string, Record<string, string>>;
type DependencyInstallStateMap = Record<string, DependencyInstallState>;

const STEP_ORDER: StepId[] = ['dependencies', 'install', 'configure', 'initialize', 'verify'];
const DEPENDENCY_RECHECK_INTERVAL_MS = 15000;
const VERIFICATION_RETRY_DELAY_MS = 2500;
const VERIFICATION_RETRY_LIMIT = 4;

function countAssessmentBlockers(assessment?: HubInstallAssessmentResult) {
  return assessment?.issues.filter((item) => item.severity === 'error').length ?? 0;
}

function sortProviders(providers: ProxyProvider[]) {
  const statusRank: Record<ProxyProvider['status'], number> = {
    active: 0,
    warning: 1,
    expired: 2,
    disabled: 3,
  };

  return [...providers].sort((left, right) => {
    const rank = statusRank[left.status] - statusRank[right.status];
    if (rank !== 0) {
      return rank;
    }

    return left.name.localeCompare(right.name);
  });
}

function buildChannelDrafts(
  channels: NonNullable<BootstrapState['data']>['channels'],
  previous: ChannelDrafts,
) {
  return channels.reduce<ChannelDrafts>((accumulator, channel) => {
    const previousDraft = previous[channel.id] || {};
    accumulator[channel.id] = channel.fields.reduce<Record<string, string>>((fieldAccumulator, field) => {
      fieldAccumulator[field.key] = previousDraft[field.key] ?? channel.values[field.key] ?? '';
      return fieldAccumulator;
    }, {});
    return accumulator;
  }, {});
}

function buildSelectedChannelIds(
  channels: NonNullable<BootstrapState['data']>['channels'],
  previousIds: string[],
) {
  const validPreviousIds = previousIds.filter((id) => channels.some((channel) => channel.id === id));
  if (validPreviousIds.length) {
    return validPreviousIds;
  }

  return channels
    .filter((channel) => channel.enabled || channel.status === 'connected')
    .map((channel) => channel.id);
}

function buildDefaultPackIds(packs: SkillPack[], previousIds: string[]) {
  const validPreviousIds = previousIds.filter((id) => packs.some((pack) => pack.id === id));
  if (validPreviousIds.length) {
    return validPreviousIds;
  }

  return packs[0] ? [packs[0].id] : [];
}

function countConfiguredChannelFields(
  values: Record<string, string>,
  fields: NonNullable<BootstrapState['data']>['channels'][number]['fields'],
) {
  return fields.filter((field) => Boolean((values[field.key] || '').trim())).length;
}

function mergeModelSelection(
  provider: ProxyProvider | undefined,
  previousProviderId: string,
  previousSelection: openClawInstallWizardService.OpenClawModelSelection,
) {
  if (!provider) {
    return { defaultModelId: '' };
  }

  const nextDefault = openClawBootstrapService.buildDefaultModelSelection(provider);
  if (provider.id !== previousProviderId) {
    return nextDefault;
  }

  const hasModel = (modelId?: string) => Boolean(modelId && provider.models.some((model) => model.id === modelId));

  return {
    defaultModelId: hasModel(previousSelection.defaultModelId)
      ? previousSelection.defaultModelId
      : nextDefault.defaultModelId,
    reasoningModelId: hasModel(previousSelection.reasoningModelId)
      ? previousSelection.reasoningModelId
      : nextDefault.reasoningModelId,
    embeddingModelId: hasModel(previousSelection.embeddingModelId)
      ? previousSelection.embeddingModelId
      : nextDefault.embeddingModelId,
  };
}

function getVerificationTone(status?: openClawInstallWizardService.OpenClawVerificationStatus) {
  if (status === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
  }

  if (status === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300';
  }

  return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300';
}

function formatClockTime(value: number | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(value);
}

function createDependencyInstallState(): DependencyInstallState {
  return {
    status: 'idle',
    output: '',
  };
}

function appendTerminalOutput(previous: string, line: string) {
  const normalized = line.trimEnd();
  if (!normalized.trim()) {
    return previous;
  }

  return `${previous}${previous.endsWith('\n') || !previous ? '' : '\n'}${normalized}\n`;
}

function humanizeVerificationItem(id: string) {
  return id
    .split(/[-_]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function OpenClawGuidedInstallWizard({
  isOpen,
  productName,
  methodLabel,
  methodIcon,
  request,
  steps: stepsProp,
  onClose,
  onInstallSuccess,
}: OpenClawGuidedInstallWizardProps) {
  const activeStepOrder = useMemo<StepId[]>(
    () => stepsProp ?? STEP_ORDER,
    [stepsProp],
  );
  const { t } = useTranslation();
  const progressUnsubscribeRef = useRef<RuntimeEventUnsubscribe | null>(null);
  const progressBatcherRef = useRef<HubInstallProgressBatcher<HubInstallProgressEvent> | null>(
    null,
  );
  const installSuccessReportedRef = useRef(false);
  const inspectionInFlightRef = useRef(false);
  const [currentStepId, setCurrentStepId] = useState<StepId>('dependencies');
  const [dependenciesReviewed, setDependenciesReviewed] = useState(false);
  const [assessmentState, setAssessmentState] = useState<AssessmentState>({ status: 'idle' });
  const [assessmentCheckedAt, setAssessmentCheckedAt] = useState<number | null>(null);
  const [installStatus, setInstallStatus] = useState<ActionStatus>('idle');
  const [installOutput, setInstallOutput] = useState('');
  const [installProgress, setInstallProgress] = useState(createHubInstallProgressState());
  const [installResult, setInstallResult] = useState<HubInstallResult | null>(null);
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>({ status: 'idle' });
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [modelSelection, setModelSelection] =
    useState<openClawInstallWizardService.OpenClawModelSelection>({
      defaultModelId: '',
    });
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [channelDrafts, setChannelDrafts] = useState<ChannelDrafts>({});
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [channelDialogDraft, setChannelDialogDraft] = useState<Record<string, string>>({});
  const [channelDialogError, setChannelDialogError] = useState<string | null>(null);
  const [configurationStatus, setConfigurationStatus] = useState<ActionStatus>('idle');
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [initializationStatus, setInitializationStatus] = useState<ActionStatus>('idle');
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [verificationState, setVerificationState] = useState<VerificationState>({
    status: 'idle',
  });
  const [dependencyInstallStates, setDependencyInstallStates] =
    useState<DependencyInstallStateMap>({});
  const [activeDependencyId, setActiveDependencyId] = useState<string | null>(null);
  const [verificationAttemptCount, setVerificationAttemptCount] = useState(0);
  const [verificationCheckedAt, setVerificationCheckedAt] = useState<number | null>(null);
  const [copiedCommandId, setCopiedCommandId] = useState<string | null>(null);

  const cleanupProgress = async () => {
    progressBatcherRef.current?.flush();
    progressBatcherRef.current?.cancel();
    progressBatcherRef.current = null;
    const unsubscribe = progressUnsubscribeRef.current;
    progressUnsubscribeRef.current = null;
    if (unsubscribe) {
      await unsubscribe();
    }
  };

  const resetVerification = () => {
    setVerificationState({ status: 'idle' });
    setVerificationAttemptCount(0);
    setVerificationCheckedAt(null);
  };

  const updateDependencyInstallState = (
    dependencyId: string,
    updater:
      | Partial<DependencyInstallState>
      | ((previous: DependencyInstallState) => DependencyInstallState),
  ) => {
    setDependencyInstallStates((previous) => {
      const previousState = previous[dependencyId] ?? createDependencyInstallState();
      const nextState =
        typeof updater === 'function'
          ? updater(previousState)
          : {
              ...previousState,
              ...updater,
            };

      return {
        ...previous,
        [dependencyId]: nextState,
      };
    });
  };

  const inspectDependencies = async () => {
    if (inspectionInFlightRef.current) {
      return;
    }

    inspectionInFlightRef.current = true;
    setAssessmentState((previous) => ({
      status: 'loading',
      result: previous.result,
    }));

    try {
      const result = await installerService.inspectHubInstall(request);
      const status =
        !result.ready || countAssessmentBlockers(result) > 0 ? 'blocked' : 'ready';
      setAssessmentState({ status, result });
      if (result.installStatus === 'installed') {
        setInstallStatus('success');
        setInstallOutput(
          `${t('install.page.guided.install.existingInstall', { product: 'OpenClaw' })}\n`,
        );
      }
      setAssessmentCheckedAt(Date.now());
    } catch (error: unknown) {
      setAssessmentState({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      setAssessmentCheckedAt(Date.now());
    } finally {
      inspectionInFlightRef.current = false;
    }
  };

  const loadBootstrap = async (nextInstallResult: HubInstallResult | null = installResult) => {
    setBootstrapState((previous) => ({
      status: 'loading',
      data: previous.data,
    }));

    try {
      const data = await openClawBootstrapService.loadBootstrapData({
        assessment: assessmentState.result,
        installResult: nextInstallResult,
      });
      const providers = sortProviders(data.providers);
      const nextData = {
        ...data,
        providers,
      };
      const nextProvider =
        providers.find((provider) => provider.id === selectedProviderId) ?? providers[0];

      setBootstrapState({
        status: 'ready',
        data: nextData,
      });
      setSelectedProviderId(nextProvider?.id ?? '');
      setModelSelection((previousSelection) =>
        mergeModelSelection(nextProvider, selectedProviderId, previousSelection),
      );
      setChannelDrafts((previous) => buildChannelDrafts(nextData.channels, previous));
      setSelectedChannelIds((previous) => buildSelectedChannelIds(nextData.channels, previous));
      setSelectedPackIds((previous) => buildDefaultPackIds(nextData.packs, previous));
      setSelectedSkillIds((previous) =>
        previous.filter((skillId) => nextData.skills.some((skill) => skill.id === skillId)),
      );
    } catch (error: unknown) {
      setBootstrapState({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  useEffect(() => {
    if (!isOpen) {
      void cleanupProgress();
      return;
    }

    installSuccessReportedRef.current = false;
    setCurrentStepId('dependencies');
    setDependenciesReviewed(false);
    setInstallStatus('idle');
    setInstallOutput('');
    setInstallProgress(createHubInstallProgressState());
    setInstallResult(null);
    setBootstrapState({ status: 'idle' });
    setSelectedProviderId('');
    setModelSelection({ defaultModelId: '' });
    setSelectedChannelIds([]);
    setChannelDrafts({});
    setSelectedChannelId(null);
    setChannelDialogDraft({});
    setChannelDialogError(null);
    setConfigurationStatus('idle');
    setConfigurationError(null);
    setSelectedPackIds([]);
    setSelectedSkillIds([]);
    setInitializationStatus('idle');
    setInitializationError(null);
    setDependencyInstallStates({});
    setActiveDependencyId(null);
    setAssessmentCheckedAt(null);
    resetVerification();
    setCopiedCommandId(null);
    void inspectDependencies();

    return () => {
      void cleanupProgress();
    };
  }, [
    isOpen,
    request.softwareName,
    request.effectiveRuntimePlatform,
    request.containerRuntimePreference,
    request.wslDistribution,
  ]);

  useEffect(() => {
    if (!installResult?.success || installSuccessReportedRef.current) {
      return;
    }

    installSuccessReportedRef.current = true;
    onInstallSuccess?.(installResult);
  }, [installResult, onInstallSuccess]);

  useEffect(() => {
    if (
      !isOpen ||
      currentStepId !== 'dependencies' ||
      dependenciesReviewed ||
      assessmentState.status === 'loading' ||
      Boolean(activeDependencyId)
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      void inspectDependencies();
    }, DEPENDENCY_RECHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeDependencyId, assessmentState.status, currentStepId, dependenciesReviewed, isOpen, request]);

  const bootstrapData = bootstrapState.data;
  const selectedProvider = bootstrapData?.providers.find((provider) => provider.id === selectedProviderId);
  const selectedChannel = bootstrapData?.channels.find((channel) => channel.id === selectedChannelId) ?? null;
  const selectedChannelSet = useMemo(() => new Set(selectedChannelIds), [selectedChannelIds]);
  const selectedPackSet = useMemo(() => new Set(selectedPackIds), [selectedPackIds]);

  const includedSkillIds = useMemo(() => {
    if (!bootstrapData) {
      return new Set<string>();
    }

    return bootstrapData.packs.reduce<Set<string>>((accumulator, pack) => {
      if (!selectedPackSet.has(pack.id)) {
        return accumulator;
      }

      pack.skills.forEach((skill) => accumulator.add(skill.id));
      return accumulator;
    }, new Set<string>());
  }, [bootstrapData, selectedPackSet]);

  const selectedSkillCount =
    includedSkillIds.size + selectedSkillIds.filter((id) => !includedSkillIds.has(id)).length;
  const currentStepIndex = activeStepOrder.indexOf(currentStepId);
  const isLastStep = currentStepIndex === activeStepOrder.length - 1;
  const blockers = countAssessmentBlockers(assessmentState.result);
  const formattedAssessmentCheckedAt = formatClockTime(assessmentCheckedAt);
  const formattedVerificationCheckedAt = formatClockTime(verificationCheckedAt);
  const hasExistingInstall =
    assessmentState.result?.installStatus === 'installed';
  const installStageLabel =
    humanizeHubInstallProgressLabel(installProgress.currentStage) || t('common.none');
  const installStepLabel = installProgress.activeStepDescription || t('common.none');
  const installLastCommand = installProgress.lastCommand || t('common.none');

  const wizardSteps = openClawInstallWizardService.buildOpenClawWizardSteps({
    assessmentStatus: assessmentState.status,
    dependenciesReviewed,
    installStatus,
    configurationStatus,
    initializationStatus,
    hasExistingInstall,
  }).filter((step) => activeStepOrder.includes(step.id));

  const canClose =
    !activeDependencyId &&
    installStatus !== 'running' &&
    configurationStatus !== 'running' &&
    initializationStatus !== 'running' &&
    verificationState.status !== 'running';

  const configurationValidationMessage = useMemo(() => {
    if (!selectedProvider || !modelSelection.defaultModelId) {
      return t('install.page.guided.config.validation.provider');
    }

    if (!bootstrapData) {
      return t('install.page.guided.config.validation.loading');
    }

    for (const channelId of selectedChannelIds) {
      const channel = bootstrapData.channels.find((item) => item.id === channelId);
      if (!channel) {
        continue;
      }

      for (const field of channel.fields) {
        const value = channelDrafts[channel.id]?.[field.key] ?? '';
        if (!value.trim()) {
          return t('install.page.guided.config.validation.channel', {
            channel: channel.name,
            field: field.label,
          });
        }
      }
    }

    return null;
  }, [
    bootstrapData,
    channelDrafts,
    modelSelection.defaultModelId,
    selectedChannelIds,
    selectedProvider,
    t,
  ]);

  const runDependencyInstall = async (dependency: HubInstallAssessmentDependency) => {
    if (activeDependencyId) {
      return;
    }

    await cleanupProgress();
    setActiveDependencyId(dependency.id);
    updateDependencyInstallState(dependency.id, {
      status: 'running',
      output: '',
      error: undefined,
      report: undefined,
    });

    progressBatcherRef.current = createHubInstallProgressBatcher<HubInstallProgressEvent>((events) => {
      updateDependencyInstallState(dependency.id, (previous) => {
        let output = previous.output;

        for (const event of events) {
          const line = formatHubInstallProgressEvent(t as (key: string) => string, event);
          if (!line.trim()) {
            continue;
          }

          output = appendTerminalOutput(output, line);
        }

        return output !== previous.output
          ? {
              ...previous,
              output,
            }
          : previous;
      });
    });
    progressUnsubscribeRef.current = await installerService.subscribeHubInstallProgress((event) => {
      progressBatcherRef.current?.push(event);
    });

    try {
      const result = await installerService.runHubDependencyInstall({
        ...request,
        dependencyIds: [dependency.id],
        continueOnError: false,
      });
      const report = result.dependencyReports.find(
        (item) => item.dependencyId === dependency.id,
      );

      updateDependencyInstallState(dependency.id, (previous) => ({
        ...previous,
        status: report?.success ? 'success' : 'error',
        error: report?.error ?? previous.error,
        report,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      updateDependencyInstallState(dependency.id, (previous) => ({
        ...previous,
        status: 'error',
        error: message,
        output: appendTerminalOutput(previous.output, message),
      }));
    } finally {
      await cleanupProgress();
      setActiveDependencyId(null);
      await inspectDependencies();
    }
  };

  const runInstall = async () => {
    if (assessmentState.result?.installStatus === 'installed') {
      setInstallStatus('success');
      setInstallOutput(
        `${t('install.page.guided.install.existingInstall', { product: 'OpenClaw' })}\n`,
      );
      return;
    }

    await cleanupProgress();
    setInstallStatus('running');
    setInstallResult(null);
    setInstallProgress(createHubInstallProgressState());
    setInstallOutput(
      `${t('install.page.modal.output.preparingInstall', {
        product: productName,
        method: methodLabel,
      })}\n${t('install.page.modal.output.starting')}\n`,
    );

    progressBatcherRef.current = createHubInstallProgressBatcher<HubInstallProgressEvent>((events) => {
      setInstallProgress((previous) =>
        events.reduce(reduceHubInstallProgressEvent, previous),
      );
      setInstallOutput((previous) => {
        let nextOutput = previous;

        for (const event of events) {
          const line = formatHubInstallProgressEvent(t as (key: string) => string, event).trim();
          if (!line) {
            continue;
          }

          nextOutput = `${nextOutput}${nextOutput.endsWith('\n') ? '' : '\n'}${line}\n`;
        }

        return nextOutput;
      });
    });
    progressUnsubscribeRef.current = await installerService.subscribeHubInstallProgress((event) => {
      progressBatcherRef.current?.push(event);
    });

    try {
      const result = await installerService.runHubInstall(request);
      setInstallResult(result);
      setInstallStatus(result.success ? 'success' : 'error');
      setInstallProgress((previous) => applyHubInstallResultToProgressState(previous, result));
      setInstallOutput((previous) =>
        `${previous}\n${t(
          result.success
            ? 'install.page.modal.output.completedInstall'
            : 'install.page.modal.output.failedInstall',
        )}\n`,
      );

      if (result.success && activeStepOrder.includes('configure')) {
        await loadBootstrap(result);
        setCurrentStepId('configure');
      }
    } catch (error: unknown) {
      setInstallStatus('error');
      setInstallOutput((previous) =>
        `${previous}\n${t('install.page.modal.output.errorPrefix')}: ${
          error instanceof Error ? error.message : String(error)
        }\n`,
      );
    } finally {
      await cleanupProgress();
    }
  };

  const applyConfiguration = async () => {
    if (configurationValidationMessage || !bootstrapData || !selectedProvider) {
      setConfigurationError(configurationValidationMessage);
      return;
    }

    setConfigurationError(null);
    setConfigurationStatus('running');

    try {
      await openClawBootstrapService.applyConfiguration({
        configPath: bootstrapData.configPath,
        syncedInstanceId: bootstrapData.syncedInstanceId,
        providerId: selectedProvider.id,
        modelSelection,
        channels: selectedChannelIds.map((channelId) => ({
          channelId,
          values: channelDrafts[channelId] || {},
        })),
        disabledChannelIds: bootstrapData.channels
          .map((channel) => channel.id)
          .filter((channelId) => !selectedChannelSet.has(channelId)),
        assessment: assessmentState.result,
        installResult,
      });
      setConfigurationStatus('success');
      closeChannelDialog();
      setCurrentStepId('initialize');
    } catch (error: unknown) {
      setConfigurationStatus('error');
      setConfigurationError(error instanceof Error ? error.message : String(error));
    }
  };

  const initializeInstance = async () => {
    if (!bootstrapData?.syncedInstanceId) {
      setInitializationError(t('install.page.guided.initialize.validation.target'));
      return;
    }

    setInitializationError(null);
    setInitializationStatus('running');

    try {
      await openClawBootstrapService.initializeOpenClawInstance({
        instanceId: bootstrapData.syncedInstanceId,
        packIds: selectedPackIds,
        skillIds: selectedSkillIds,
      });
      setInitializationStatus('success');
      setCurrentStepId('verify');
    } catch (error: unknown) {
      setInitializationStatus('error');
      setInitializationError(error instanceof Error ? error.message : String(error));
    }
  };

  const runVerification = async () => {
    if (!bootstrapData?.syncedInstanceId || !bootstrapData.configPath) {
      return;
    }

    setVerificationAttemptCount((previous) => previous + 1);
    setVerificationState({ status: 'running' });

    try {
      const snapshot = await openClawBootstrapService.loadVerificationSnapshot({
        instanceId: bootstrapData.syncedInstanceId,
        configPath: bootstrapData.configPath,
        selectedChannelIds,
        packIds: selectedPackIds,
        skillIds: selectedSkillIds,
      });
      const summary = openClawInstallWizardService.buildOpenClawVerificationSummary(snapshot);
      setVerificationState({
        status: 'success',
        snapshot,
        summary,
      });
      setVerificationCheckedAt(Date.now());
    } catch (error: unknown) {
      setVerificationState({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      setVerificationCheckedAt(Date.now());
    }
  };

  useEffect(() => {
    if (!isOpen || currentStepId !== 'verify' || verificationState.status === 'running') {
      return;
    }

    if (verificationState.status === 'idle') {
      void runVerification();
      return;
    }

    const shouldRetry =
      verificationAttemptCount < VERIFICATION_RETRY_LIMIT &&
      (verificationState.status === 'error' ||
        (verificationState.status === 'success' &&
          verificationState.summary?.status !== 'success'));

    if (!shouldRetry) {
      return;
    }

    const timer = window.setTimeout(() => {
      void runVerification();
    }, VERIFICATION_RETRY_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    currentStepId,
    isOpen,
    verificationAttemptCount,
    verificationState.status,
    verificationState.summary?.status,
    bootstrapData?.configPath,
    bootstrapData?.syncedInstanceId,
  ]);

  const handleProviderChange = (nextProviderId: string) => {
    const provider = bootstrapData?.providers.find((item) => item.id === nextProviderId);
    setSelectedProviderId(nextProviderId);
    setConfigurationStatus('idle');
    resetVerification();
    setModelSelection(
      mergeModelSelection(provider, selectedProviderId, modelSelection),
    );
  };

  const handleChannelToggle = (channelId: string, checked: boolean) => {
    setConfigurationStatus('idle');
    setConfigurationError(null);
    resetVerification();
    setSelectedChannelIds((previous) =>
      checked ? [...previous, channelId] : previous.filter((id) => id !== channelId),
    );
  };

  const openChannelDialog = (channelId: string) => {
    const channel = bootstrapData?.channels.find((item) => item.id === channelId);
    if (!channel) {
      return;
    }

    setSelectedChannelId(channelId);
    setChannelDialogDraft(channelDrafts[channelId] || channel.values);
    setChannelDialogError(null);
  };

  const closeChannelDialog = () => {
    setSelectedChannelId(null);
    setChannelDialogDraft({});
    setChannelDialogError(null);
  };

  const handleChannelDialogFieldChange = (key: string, value: string) => {
    setChannelDialogError(null);
    setChannelDialogDraft((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleSaveChannelDraft = () => {
    if (!selectedChannel) {
      return;
    }

    for (const field of selectedChannel.fields) {
      if (field.required && !(channelDialogDraft[field.key] || '').trim()) {
        setChannelDialogError(
          t('install.page.guided.config.validation.channel', {
            channel: selectedChannel.name,
            field: field.label,
          }),
        );
        return;
      }
    }

    setConfigurationStatus('idle');
    setConfigurationError(null);
    resetVerification();
    setChannelDrafts((previous) => ({
      ...previous,
      [selectedChannel.id]: {
        ...(previous[selectedChannel.id] || selectedChannel.values),
        ...channelDialogDraft,
      },
    }));
    setSelectedChannelIds((previous) =>
      previous.includes(selectedChannel.id) ? previous : [...previous, selectedChannel.id],
    );
    closeChannelDialog();
  };

  const handleSkipConfiguration = () => {
    setConfigurationError(null);
    setChannelDialogError(null);
    setConfigurationStatus('skipped');
    setCurrentStepId('initialize');
  };

  const handlePackToggle = (packId: string, checked: boolean) => {
    setInitializationStatus('idle');
    resetVerification();
    setSelectedPackIds((previous) =>
      checked ? [...previous, packId] : previous.filter((id) => id !== packId),
    );
  };

  const handleSkillToggle = (skillId: string, checked: boolean) => {
    setInitializationStatus('idle');
    resetVerification();
    setSelectedSkillIds((previous) =>
      checked ? [...previous, skillId] : previous.filter((id) => id !== skillId),
    );
  };

  const copyCommand = async (commandLine: string, commandId: string) => {
    await platform.copy(commandLine);
    setCopiedCommandId(commandId);
    window.setTimeout(() => {
      setCopiedCommandId((previous) => (previous === commandId ? null : previous));
    }, 1500);
  };

  const renderDependenciesStep = () => {
    if (assessmentState.status === 'loading' && !assessmentState.result) {
      return (
        <div className="flex min-h-[360px] items-center justify-center rounded-[2rem] border border-zinc-200 bg-zinc-50/80 p-10 dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-300">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            <span>{t('install.page.assessment.status.inspecting')}</span>
          </div>
        </div>
      );
    }

    if (assessmentState.status === 'error' || !assessmentState.result) {
      return (
        <div className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-semibold">{t('install.page.assessment.status.failed')}</div>
              <p className="mt-2 text-sm leading-relaxed">{assessmentState.error}</p>
            </div>
          </div>
        </div>
      );
    }

    const assessment = assessmentState.result;
    const runtimeItems = [
      ['install.page.assessment.labels.runtime', assessment.runtime.effectiveRuntimePlatform],
      ['install.page.assessment.labels.controlLevel', assessment.installControlLevel],
      ['install.page.assessment.labels.installRoot', assessment.resolvedInstallRoot],
      ['install.page.assessment.labels.dataRoot', assessment.resolvedDataRoot],
    ];

    return (
      <div className="space-y-6">
        <div
          className={`rounded-[2rem] border p-5 ${blockers > 0 ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                {t('install.page.guided.steps.dependencies.title')}
              </div>
              <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {blockers > 0
                  ? t('install.page.assessment.blockedDescription')
                  : t('install.page.guided.dependencies.ready')}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {t('install.page.guided.dependencies.autoRefresh')}
                {formattedAssessmentCheckedAt
                  ? ` ${t('install.page.guided.dependencies.lastChecked', {
                      time: formattedAssessmentCheckedAt,
                    })}`
                  : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void inspectDependencies()}
              disabled={Boolean(activeDependencyId)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <RefreshCw
                className={`h-4 w-4 ${assessmentState.status === 'loading' ? 'animate-spin' : ''}`}
              />
              {t('install.page.assessment.actions.refresh')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {runtimeItems.map(([labelKey, value]) => (
            <div
              key={labelKey}
              className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t(labelKey)}
              </div>
              <div className="mt-2 break-all text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {value}
              </div>
            </div>
          ))}
        </div>

        <HubInstallDescriptorSummary assessment={assessment} variant="compact" />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t('install.page.assessment.sections.dependencies')}
            </div>
            <div className="mt-4 space-y-4">
              {assessment.dependencies.map((dependency) => {
                const dependencyInstallState =
                  dependencyInstallStates[dependency.id] ?? createDependencyInstallState();
                const dependencyFixStatus =
                  dependencyInstallState.report?.statusAfter || dependency.status;
                const isDependencyRunning = activeDependencyId === dependency.id;
                const canRunAutoFix =
                  dependency.supportsAutoRemediation && dependency.status !== 'available';

                return (
                  <div
                    key={dependency.id}
                    className="rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {dependency.target}
                        </div>
                        {dependency.description && (
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            {dependency.description}
                          </p>
                        )}
                      </div>
                      <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                        {t(`install.page.assessment.dependencyStatus.${dependency.status}`)}
                      </span>
                    </div>

                    {canRunAutoFix && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          disabled={Boolean(activeDependencyId)}
                          onClick={() => void runDependencyInstall(dependency)}
                          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          {isDependencyRunning ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-4 w-4" />
                          )}
                          {t('install.page.assessment.actions.autoRun')}
                        </button>

                        {dependencyInstallState.status !== 'idle' && (
                          <span className="rounded-full border border-current/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                            {dependencyInstallState.status === 'running'
                              ? t('install.page.modal.status.install.running')
                              : dependencyInstallState.status === 'error' &&
                                  !dependencyInstallState.report
                                ? t('install.page.modal.status.install.error')
                              : t(`install.page.assessment.dependencyStatus.${dependencyFixStatus}`)}
                          </span>
                        )}
                      </div>
                    )}

                    {dependency.remediationCommands.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {dependency.remediationCommands.map((command, index) => {
                          const commandId = `${dependency.id}-${index}`;
                          return (
                            <div
                              key={commandId}
                              className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
                            >
                              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                {command.description}
                              </div>
                              <code className="mt-2 block break-all text-xs text-zinc-700 dark:text-zinc-200">
                                {command.commandLine}
                              </code>
                              <button
                                type="button"
                                onClick={() => void copyCommand(command.commandLine, commandId)}
                                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                              >
                                {copiedCommandId === commandId ? t('common.copied') : t('common.copy')}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(dependencyInstallState.output || dependencyInstallState.error) && (
                      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-zinc-100">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            {t('install.page.modal.terminalOutput')}
                          </div>
                          {dependencyInstallState.report && (
                            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                              {t(`install.page.assessment.dependencyStatus.${dependencyFixStatus}`)}
                            </span>
                          )}
                        </div>
                        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-800 bg-black/30 p-3 text-xs leading-6 text-zinc-200">
                          {dependencyInstallState.output}
                        </pre>
                        {dependencyInstallState.error && (
                          <p className="mt-3 text-xs leading-5 text-red-300">
                            {dependencyInstallState.error}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {t('install.page.assessment.sections.issues')}
              </div>
              <div className="mt-4 space-y-3">
                {assessment.issues.length ? (
                  assessment.issues.map((issue) => (
                    <div
                      key={`${issue.code}-${issue.message}`}
                      className="rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                          {t(`install.page.assessment.issueSeverity.${issue.severity}`)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                        {issue.message}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                    {t('install.page.guided.dependencies.noIssues')}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {t('install.page.assessment.sections.recommendations')}
              </div>
              <div className="mt-4 space-y-3">
                {assessment.recommendations.length ? (
                  assessment.recommendations.map((recommendation, index) => (
                    <div
                      key={`${recommendation}-${index}`}
                      className="rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 p-4 text-sm leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-200"
                    >
                      {recommendation}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
                    {t('install.page.assessment.emptyRecommendations')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInstallStep = () => (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              {t('install.page.guided.steps.install.title')}
            </div>
            <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {t('install.page.guided.install.description')}
            </h3>
          </div>
          <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            {methodLabel}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {t('install.page.modal.result.installRoot')}
            </div>
            <div className="mt-2 break-all text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {assessmentState.result?.resolvedInstallRoot || '-'}
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {t('install.page.modal.result.dataRoot')}
            </div>
            <div className="mt-2 break-all text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {assessmentState.result?.resolvedDataRoot || '-'}
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {t('install.page.assessment.labels.runtime')}
            </div>
            <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {assessmentState.result?.runtime.effectiveRuntimePlatform || '-'}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-zinc-200 bg-zinc-950 p-5 text-zinc-100 shadow-2xl dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">{t('install.page.modal.terminalOutput')}</div>
          {installStatus === 'running' && (
            <span className="inline-flex items-center gap-2 text-xs font-medium text-zinc-300">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              {t('install.page.modal.status.install.running')}
            </span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="rounded-[1.25rem] border border-zinc-800 bg-black/30 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {t('install.page.modal.progressSummary.currentStage')}
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-100">{installStageLabel}</div>
          </div>
          <div className="rounded-[1.25rem] border border-zinc-800 bg-black/30 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {t('install.page.modal.progressSummary.currentStep')}
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-100">{installStepLabel}</div>
          </div>
          <div className="rounded-[1.25rem] border border-zinc-800 bg-black/30 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {t('install.page.modal.progressSummary.stages')}
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-100">
              {installProgress.totalStageCount
                ? `${installProgress.completedStageCount}/${installProgress.totalStageCount}`
                : t('common.none')}
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-zinc-800 bg-black/30 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {t('install.page.modal.progressSummary.artifacts')}
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-100">
              {installProgress.totalArtifactCount
                ? `${installProgress.completedArtifactCount}/${installProgress.totalArtifactCount}`
                : t('common.none')}
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-[1.25rem] border border-zinc-800 bg-black/30 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {t('install.page.modal.progressSummary.lastCommand')}
          </div>
          <div className="mt-2 break-all font-mono text-xs leading-6 text-zinc-300">
            {installLastCommand}
          </div>
        </div>
        <pre className="mt-4 max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-[1.25rem] border border-zinc-800 bg-black/40 p-4 text-xs leading-6 text-zinc-200">
          {installOutput || t('install.page.guided.install.logPlaceholder')}
        </pre>
      </div>
    </div>
  );
  const renderConfigureStep = () => (
    <div data-slot="guided-install-config" className="space-y-6">
      {bootstrapState.status === 'loading' && (
        <div className="flex min-h-[320px] items-center justify-center rounded-[2rem] border border-zinc-200 bg-zinc-50/80 p-10 dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-300">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            <span>{t('install.page.guided.config.loading')}</span>
          </div>
        </div>
      )}

      {bootstrapState.status === 'error' && (
        <div className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {bootstrapState.error}
        </div>
      )}

      {bootstrapData && (
        <>
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {t('install.page.guided.config.provider')}
                </div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {t('install.page.guided.config.editLater')}
                </p>
              </div>
              <div className="grid w-full gap-4 xl:max-w-2xl xl:grid-cols-2">
                <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    {t('install.page.guided.config.instance')}
                  </div>
                  <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {bootstrapData.syncedInstanceId}
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    {t('install.page.guided.config.configPath')}
                  </div>
                  <div className="mt-2 break-all font-mono text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                    {bootstrapData.configPath}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <Label className="text-sm font-semibold">
              {t('install.page.guided.config.provider')}
            </Label>
            <Select value={selectedProviderId} onValueChange={handleProviderChange}>
              <SelectTrigger className="mt-3 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bootstrapData.providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProvider && (
            <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {selectedProvider.name}
                  </div>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {selectedProvider.baseUrl}
                  </p>
                </div>
                <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                  {t(`install.page.guided.providerStatus.${selectedProvider.status}`)}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                    {t('install.page.guided.config.defaultModel')}
                  </Label>
                  <Select
                    value={modelSelection.defaultModelId}
                    onValueChange={(value) =>
                      setModelSelection((previous) => ({
                        ...previous,
                        defaultModelId: value,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-2 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProvider.models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                    {t('install.page.guided.config.reasoningModel')}
                  </Label>
                  <Select
                    value={modelSelection.reasoningModelId || 'none'}
                    onValueChange={(value) =>
                      setModelSelection((previous) => ({
                        ...previous,
                        reasoningModelId: value === 'none' ? undefined : value,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-2 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('common.none')}</SelectItem>
                      {selectedProvider.models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                    {t('install.page.guided.config.embeddingModel')}
                  </Label>
                  <Select
                    value={modelSelection.embeddingModelId || 'none'}
                    onValueChange={(value) =>
                      setModelSelection((previous) => ({
                        ...previous,
                        embeddingModelId: value === 'none' ? undefined : value,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-2 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('common.none')}</SelectItem>
                      {selectedProvider.models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {t('install.page.guided.config.channels')}
              </div>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t('install.page.guided.config.channelsDescription')}
              </p>
            </div>

            <ChannelCatalog
              items={bootstrapData.channels.map((channel) => {
                const values = channelDrafts[channel.id] || channel.values;
                const configuredFieldCount = countConfiguredChannelFields(values, channel.fields);

                return {
                  id: channel.id,
                  name: channel.name,
                  description: channel.description,
                  status:
                    channel.configurationMode === 'none'
                      ? selectedChannelSet.has(channel.id)
                        ? 'connected'
                        : 'disconnected'
                      : configuredFieldCount === 0
                        ? 'not_configured'
                        : selectedChannelSet.has(channel.id)
                          ? 'connected'
                          : 'disconnected',
                  enabled: selectedChannelSet.has(channel.id),
                  configurationMode: channel.configurationMode,
                  fieldCount: channel.fieldCount,
                  configuredFieldCount,
                  setupSteps: channel.setupSteps,
                };
              })}
              variant="management"
              texts={{
                statusActive: t('channels.page.status.active'),
                statusConnected: t('dashboard.status.connected'),
                statusDisconnected: t('dashboard.status.disconnected'),
                statusNotConfigured: t('dashboard.status.not_configured'),
                actionConnect: t('channels.page.actions.connect'),
                actionConfigure: t('channels.page.actions.configure'),
                actionDownloadApp: t('channels.page.actions.downloadApp'),
                actionOpenOfficialSite: t('channels.page.actions.openOfficialSite'),
                actionEnableChannel: (name: string) =>
                  t('channels.page.actions.enableChannel', { name }),
                metricConfiguredFields: t('instances.detail.instanceWorkbench.metrics.configuredFields'),
                metricSetupSteps: t('instances.detail.instanceWorkbench.metrics.setupSteps'),
                metricDeliveryState: t('instances.detail.instanceWorkbench.metrics.deliveryState'),
                stateEnabled: t('instances.detail.instanceWorkbench.state.enabled'),
                statePending: t('instances.detail.instanceWorkbench.state.pending'),
                summaryFallback: t('install.page.guided.config.channelsDescription'),
              }}
              onOpenOfficialLink={(_channel, link) => void platform.openExternal(link.href)}
              onConfigure={(channel) => openChannelDialog(channel.id)}
              onToggleEnabled={(channel, nextEnabled) => handleChannelToggle(channel.id, nextEnabled)}
            />
          </div>

          {configurationStatus === 'skipped' && (
            <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              {t('install.page.guided.config.skippedNotice')}
            </div>
          )}

          {configurationError && (
            <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {configurationError}
            </div>
          )}

          <Dialog open={Boolean(selectedChannel)} onOpenChange={(open) => !open && closeChannelDialog()}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{selectedChannel?.name || t('install.page.guided.config.channels')}</DialogTitle>
                <DialogDescription>{selectedChannel?.description || ''}</DialogDescription>
              </DialogHeader>

              {selectedChannel ? (
                <div className="space-y-4">
                  {selectedChannel.fields.map((field) =>
                    field.multiline ? (
                      <label key={field.key} className="block">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                          {field.label}
                          {field.required ? ' *' : ''}
                        </div>
                        <Textarea
                          value={channelDialogDraft[field.key] || ''}
                          onChange={(event) =>
                            handleChannelDialogFieldChange(field.key, event.target.value)
                          }
                          placeholder={field.placeholder}
                          rows={5}
                          className="min-h-[7rem] w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-colors focus:border-primary-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                        {field.helpText ? (
                          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                            {field.helpText}
                          </p>
                        ) : null}
                      </label>
                    ) : (
                      <label key={field.key} className="block">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                          {field.label}
                          {field.required ? ' *' : ''}
                        </div>
                        <Input
                          type={
                            field.sensitive
                              ? 'password'
                              : field.inputMode === 'numeric'
                                ? 'number'
                                : field.inputMode === 'url'
                                  ? 'url'
                                  : 'text'
                          }
                          value={channelDialogDraft[field.key] || ''}
                          onChange={(event) =>
                            handleChannelDialogFieldChange(field.key, event.target.value)
                          }
                          placeholder={field.placeholder}
                          className="h-12 rounded-xl bg-white dark:bg-zinc-900"
                        />
                        {field.helpText ? (
                          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                            {field.helpText}
                          </p>
                        ) : null}
                      </label>
                    ),
                  )}

                  {channelDialogError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                      {channelDialogError}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <DialogFooter>
                <Button variant="outline" onClick={closeChannelDialog}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleSaveChannelDraft}>{t('common.save')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );

  const renderInitializeStep = () => (
    <div data-slot="guided-install-initialize" className="space-y-6">
      <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t('install.page.guided.initialize.defaultPack')}
            </div>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {t('install.page.guided.initialize.defaultPackDescription')}
            </p>
          </div>
          <span className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300">
            {t('install.page.guided.initialize.recommended')}
          </span>
        </div>

        <div className="mt-5 space-y-4">
          {bootstrapData?.packs.map((pack) => (
            <label
              key={pack.id}
              className="flex cursor-pointer items-start gap-3 rounded-[1.5rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
            >
              <Checkbox
                checked={selectedPackSet.has(pack.id)}
                onCheckedChange={(value) => handlePackToggle(pack.id, value === true)}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">{pack.name}</div>
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {t('install.page.guided.initialize.skillCount', { count: pack.skills.length })}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{pack.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t('install.page.guided.initialize.additionalSkills')}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {bootstrapData?.skills.map((skill) => {
            const includedByPack = includedSkillIds.has(skill.id);
            return (
              <label
                key={skill.id}
                className="flex cursor-pointer items-start gap-3 rounded-[1.5rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
              >
                <Checkbox
                  checked={includedByPack || selectedSkillIds.includes(skill.id)}
                  disabled={includedByPack}
                  onCheckedChange={(value) => handleSkillToggle(skill.id, value === true)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{skill.name}</div>
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {includedByPack
                        ? t('install.page.guided.initialize.includedByPack')
                        : skill.category}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {skill.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t('install.page.guided.initialize.summary')}
        </div>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {t('install.page.guided.initialize.summaryValue', {
            packs: selectedPackIds.length,
            skills: selectedSkillCount,
          })}
        </p>
      </div>

      {initializationError && (
        <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {initializationError}
        </div>
      )}
    </div>
  );
  const renderVerifyStep = () => {
    const summary = verificationState.summary;
    const snapshot = verificationState.snapshot;

    return (
      <div data-slot="guided-install-verify" className="space-y-6">
        {verificationState.status === 'running' && (
          <div className="flex min-h-[240px] items-center justify-center rounded-[2rem] border border-zinc-200 bg-zinc-50/80 p-10 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-300">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>{t('install.page.guided.verify.running')}</span>
            </div>
          </div>
        )}

        {verificationState.status === 'error' && (
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {verificationState.error}
          </div>
        )}

        {summary && snapshot && (
          <>
            <div className={`rounded-[2rem] border p-6 ${getVerificationTone(summary.status)}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em]">
                    {t('install.page.guided.steps.verify.title')}
                  </div>
                  <h3 className="mt-2 text-2xl font-bold">
                    {summary.isReadyToUse
                      ? t('install.page.guided.verify.ready')
                      : t('install.page.guided.verify.followUp')}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed">
                    {t('install.page.guided.verify.description', { product: 'OpenClaw' })}
                  </p>
                </div>
                <CheckCircle2 className="h-7 w-7 shrink-0" />
              </div>
            </div>

            {summary.status !== 'success' && (
              <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {t('install.page.guided.verify.retryStatus', {
                    attempt: verificationAttemptCount,
                    max: VERIFICATION_RETRY_LIMIT,
                  })}
                </div>
                {formattedVerificationCheckedAt && (
                  <p className="mt-1">
                    {t('install.page.guided.verify.lastChecked', {
                      time: formattedVerificationCheckedAt,
                    })}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {summary.items.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-[1.5rem] border p-4 ${getVerificationTone(item.status)}`}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.14em]">
                    {(() => {
                      const key = `install.page.guided.verify.items.${item.id}`;
                      const label = t(key);
                      return label === key ? humanizeVerificationItem(item.id) : label;
                    })()}
                  </div>
                  <div className="mt-2 text-sm font-medium">
                    {t(`install.page.guided.verify.status.${item.status}`)}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  {t('install.page.guided.config.configPath')}
                </div>
                <div className="mt-2 break-all font-mono text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                  {bootstrapData?.configPath || '-'}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  {t('install.page.guided.config.instance')}
                </div>
                <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {bootstrapData?.syncedInstanceId || '-'}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  {t('install.page.guided.config.provider')}
                </div>
                <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {selectedProvider?.name || '-'}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const currentStepActionLabel =
    currentStepId === 'dependencies'
      ? t('install.page.guided.actions.continue')
      : currentStepId === 'install'
        ? installStatus === 'success'
          ? isLastStep
            ? t('install.page.modal.actions.done')
            : t('install.page.guided.actions.continueToConfig')
          : t('install.page.guided.actions.install')
        : currentStepId === 'configure'
          ? configurationStatus === 'success' || configurationStatus === 'skipped'
            ? t('install.page.guided.actions.continueToInitialize')
            : t('install.page.guided.actions.applyConfig')
          : currentStepId === 'initialize'
            ? initializationStatus === 'success'
              ? t('install.page.guided.actions.continueToVerify')
              : t('install.page.guided.actions.initialize', { product: 'OpenClaw' })
            : verificationState.status === 'success'
              ? t('install.page.modal.actions.done')
              : t('install.page.guided.actions.verify');

  const currentStepActionDisabled =
    currentStepId === 'dependencies'
      ? assessmentState.status !== 'ready' || Boolean(activeDependencyId)
      : currentStepId === 'install'
        ? installStatus === 'running'
        : currentStepId === 'configure'
          ? configurationStatus === 'running' ||
            ((configurationStatus !== 'success' && configurationStatus !== 'skipped') &&
              Boolean(configurationValidationMessage))
          : currentStepId === 'initialize'
            ? initializationStatus === 'running'
            : verificationState.status === 'running';

  const executeCurrentStep = async () => {
    if (currentStepId === 'dependencies') {
      setDependenciesReviewed(true);
      setCurrentStepId(activeStepOrder[currentStepIndex + 1] ?? 'install');
      return;
    }

    if (currentStepId === 'install') {
      if (installStatus === 'success') {
        if (isLastStep) {
          onClose();
        } else {
          const nextStepId = activeStepOrder[currentStepIndex + 1] ?? 'configure';
          if (nextStepId === 'configure' && bootstrapState.status !== 'ready') {
            await loadBootstrap();
          }
          setCurrentStepId(nextStepId);
        }
        return;
      }

      await runInstall();
      return;
    }

    if (currentStepId === 'configure') {
      if (configurationStatus === 'success' || configurationStatus === 'skipped') {
        setCurrentStepId('initialize');
        return;
      }

      await applyConfiguration();
      return;
    }

    if (currentStepId === 'initialize') {
      if (initializationStatus === 'success') {
        setCurrentStepId('verify');
        return;
      }

      await initializeInstance();
      return;
    }

    if (verificationState.status === 'success') {
      onClose();
      return;
    }

    await runVerification();
  };

  const renderCurrentStep = () => {
    if (currentStepId === 'dependencies') {
      return renderDependenciesStep();
    }

    if (currentStepId === 'install') {
      return renderInstallStep();
    }

    if (currentStepId === 'configure') {
      return renderConfigureStep();
    }

    if (currentStepId === 'initialize') {
      return renderInitializeStep();
    }

    return renderVerifyStep();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm"
            onClick={() => {
              if (canClose) {
                onClose();
              }
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            data-slot="guided-install-shell"
            className="relative flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                  {methodIcon}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                    {t('install.page.guided.title')}
                  </div>
                  <h2 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {t('install.page.guided.heading', {
                      product: productName,
                    })}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {t('install.page.guided.subtitle', {
                      method: methodLabel,
                    })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (canClose) {
                    onClose();
                  }
                }}
                disabled={!canClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
              <aside className="border-b border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/80 lg:border-b-0 lg:border-r">
                <div className="space-y-3">
                  {wizardSteps.map((step, index) => {
                    const isActive = step.id === currentStepId;
                    const isAccessible = step.status !== 'pending';
                    const icon =
                      step.id === 'dependencies' ? (
                        <ShieldCheck className="h-4 w-4" />
                      ) : step.id === 'install' ? (
                        <DownloadCloud className="h-4 w-4" />
                      ) : step.id === 'configure' ? (
                        <Settings2 className="h-4 w-4" />
                      ) : step.id === 'initialize' ? (
                        <Package className="h-4 w-4" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      );

                    return (
                      <button
                        key={step.id}
                        type="button"
                        data-slot="guided-install-step"
                        disabled={!isAccessible}
                        onClick={() => {
                          if (isAccessible) {
                            setCurrentStepId(step.id);
                          }
                        }}
                        className={`flex w-full items-start gap-3 rounded-[1.5rem] border p-4 text-left transition-all ${
                          isActive
                            ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-700'
                        } ${!isAccessible ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-current/15 bg-current/5">
                          {icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                              {String(index + 1).padStart(2, '0')}
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
                          </div>
                          <div className="mt-1 font-semibold">
                            {t(`install.page.guided.steps.${step.id}.title`)}
                          </div>
                          <p className="mt-1 text-sm opacity-80">
                            {t(`install.page.guided.steps.${step.id}.description`)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="flex min-h-0 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50/40 p-6 dark:bg-zinc-950/40">
                  {renderCurrentStep()}
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950">
                  {currentStepId === 'configure' &&
                  configurationStatus !== 'success' &&
                  configurationStatus !== 'skipped' ? (
                    <button
                      type="button"
                      onClick={handleSkipConfiguration}
                      disabled={configurationStatus === 'running'}
                      className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      {t('install.page.guided.actions.skipConfig')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void executeCurrentStep()}
                    disabled={currentStepActionDisabled}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
                  >
                    {currentStepActionLabel}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
