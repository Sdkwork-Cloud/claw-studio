import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  DownloadCloud,
  Package,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useInstanceStore } from '@sdkwork/claw-core';
import {
  type HubInstallAssessmentDependency,
  type HubInstallAssessmentResult,
  type HubInstallProgressEvent,
  type HubInstallRequest,
  type HubInstallResult,
  type RuntimeEventUnsubscribe,
} from '@sdkwork/claw-infrastructure';
import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Modal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sdkwork/claw-ui';
import type { ProxyProviderModel } from '@sdkwork/claw-types';
import {
  applyHubInstallResultToProgressState,
  createHubInstallProgressState,
  formatHubInstallProgressEvent,
  installBootstrapService,
  installGuidedWizardService,
  installerService,
  reduceHubInstallProgressEvent,
  type InstallBootstrapData,
  type InstallProviderDraft,
} from '../services';

type StepId = 'dependencies' | 'install' | 'configure' | 'initialize' | 'success';
type ActionStatus = 'idle' | 'running' | 'success' | 'error';
type AssessmentStatus = 'idle' | 'loading' | 'ready' | 'blocked' | 'error';
type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'error';
type SelectorTab = 'packs' | 'skills';
type Drafts = Record<string, Record<string, string>>;

interface Props {
  isOpen: boolean;
  productName: string;
  methodLabel: string;
  methodIcon: React.ReactNode;
  request: HubInstallRequest;
  onClose: () => void;
  onInstalled?: (input: { result: HubInstallResult | null; instanceId: string }) => void;
}

interface AssessmentState {
  status: AssessmentStatus;
  result?: HubInstallAssessmentResult;
  error?: string;
}

interface BootstrapState {
  status: BootstrapStatus;
  data?: InstallBootstrapData;
  error?: string;
}

interface ProviderDraftState extends InstallProviderDraft {
  models: ProxyProviderModel[];
}

function countBlockers(result?: HubInstallAssessmentResult) {
  return result?.issues.filter((item) => item.severity === 'error').length ?? 0;
}

function appendOutput(previous: string, line: string) {
  const text = line.trimEnd();
  if (!text.trim()) {
    return previous;
  }

  return `${previous}${previous.endsWith('\n') || !previous ? '' : '\n'}${text}\n`;
}

function summarizeSelection(names: string[]) {
  if (!names.length) {
    return '';
  }
  if (names.length <= 2) {
    return names.join(', ');
  }
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

function mergeModels(data: InstallBootstrapData | undefined, channelId: string) {
  const seen = new Set<string>();
  return (
    data?.providers
      .filter((provider) => provider.channelId === channelId)
      .flatMap((provider) => provider.models)
      .filter((model) => {
        if (seen.has(model.id)) return false;
        seen.add(model.id);
        return true;
      }) ?? []
  );
}

function buildChannelDrafts(channels: InstallBootstrapData['communicationChannels'], previous: Drafts) {
  return channels.reduce<Drafts>((acc, channel) => {
    acc[channel.id] = channel.fields.reduce<Record<string, string>>((fieldAcc, field) => {
      fieldAcc[field.key] = previous[channel.id]?.[field.key] ?? field.value ?? '';
      return fieldAcc;
    }, {});
    return acc;
  }, {});
}

function buildSelectedChannels(
  channels: InstallBootstrapData['communicationChannels'],
  previous: string[],
) {
  const valid = previous.filter((id) => channels.some((channel) => channel.id === id));
  if (valid.length) return valid;
  return channels
    .filter((channel) => channel.enabled || channel.status === 'connected')
    .map((channel) => channel.id);
}

function buildProviderDraft(
  data: InstallBootstrapData,
  previous?: ProviderDraftState | null,
  channelId?: string,
  providerId?: string,
): ProviderDraftState {
  const nextChannelId =
    channelId ||
    previous?.channelId ||
    data.apiRouterChannels[0]?.id ||
    data.providers[0]?.channelId ||
    '';
  const providers = data.providers.filter((item) => item.channelId === nextChannelId);
  const provider =
    providers.find((item) => item.id === providerId) ||
    providers.find((item) => item.id === previous?.providerId);
  const models = mergeModels(data, nextChannelId);
  const fallbackModelId =
    models[0]?.id || provider?.models[0]?.id || previous?.modelId || '';

  return {
    providerId: provider?.id,
    channelId: nextChannelId,
    name:
      provider?.name ||
      previous?.name ||
      `${data.apiRouterChannels.find((item) => item.id === nextChannelId)?.name || nextChannelId} Guided`,
    apiKey: provider?.apiKey || previous?.apiKey || '',
    baseUrl: provider?.baseUrl || previous?.baseUrl || '',
    modelId:
      models.some((model) => model.id === previous?.modelId)
        ? previous?.modelId || fallbackModelId
        : fallbackModelId,
    models:
      models.length
        ? models
        : fallbackModelId
          ? [{ id: fallbackModelId, name: fallbackModelId }]
          : [],
  };
}

export function GuidedInstallWizard({
  isOpen,
  productName,
  methodLabel,
  methodIcon,
  request,
  onClose,
  onInstalled,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setActiveInstanceId = useInstanceStore((state) => state.setActiveInstanceId);
  const progressRef = useRef<RuntimeEventUnsubscribe | null>(null);

  const [currentStepId, setCurrentStepId] = useState<StepId>('dependencies');
  const [assessment, setAssessment] = useState<AssessmentState>({ status: 'idle' });
  const [dependencyStates, setDependencyStates] = useState<
    Record<string, { status: ActionStatus; output: string; error?: string }>
  >({});
  const [activeDependencyId, setActiveDependencyId] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<ActionStatus>('idle');
  const [installOutput, setInstallOutput] = useState('');
  const [installResult, setInstallResult] = useState<HubInstallResult | null>(null);
  const [installProgress, setInstallProgress] = useState(createHubInstallProgressState());
  const [bootstrap, setBootstrap] = useState<BootstrapState>({ status: 'idle' });
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [providerDraft, setProviderDraft] = useState<ProviderDraftState | null>(null);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [channelDrafts, setChannelDrafts] = useState<Drafts>({});
  const [configurationStatus, setConfigurationStatus] = useState<ActionStatus>('idle');
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [initializationStatus, setInitializationStatus] = useState<ActionStatus>('idle');
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorTab, setSelectorTab] = useState<SelectorTab>('packs');

  const canClose =
    !activeDependencyId &&
    installStatus !== 'running' &&
    configurationStatus !== 'running' &&
    initializationStatus !== 'running';
  const dependencyStatus: ActionStatus = activeDependencyId
    ? 'running'
    : assessment.status === 'ready'
      ? 'success'
      : assessment.status === 'blocked' || assessment.status === 'error'
        ? 'error'
        : 'idle';
  const steps = installGuidedWizardService.buildGuidedWizardSteps({
    assessmentStatus: assessment.status,
    dependenciesStatus: dependencyStatus,
    installStatus,
    configurationStatus,
    initializationStatus,
  });
  const stepIndex = steps.findIndex((step) => step.id === currentStepId);
  const data = bootstrap.data;
  const selectedChannelSet = useMemo(
    () => new Set(selectedChannelIds),
    [selectedChannelIds],
  );
  const includedSkillIds = useMemo(() => {
    if (!data) return new Set<string>();
    return data.packs.reduce<Set<string>>((acc, pack) => {
      if (!selectedPackIds.includes(pack.id)) return acc;
      pack.skills.forEach((skill) => acc.add(skill.id));
      return acc;
    }, new Set<string>());
  }, [data, selectedPackIds]);
  const selectedPackNames = useMemo(
    () =>
      selectedPackIds.map(
        (packId) => data?.packs.find((pack) => pack.id === packId)?.name || packId,
      ),
    [data, selectedPackIds],
  );
  const selectedSkillNames = useMemo(
    () =>
      selectedSkillIds.map(
        (skillId) => data?.skills.find((skill) => skill.id === skillId)?.name || skillId,
      ),
    [data, selectedSkillIds],
  );
  const validationMessage = useMemo(() => {
    if (
      !selectedInstanceId ||
      !providerDraft ||
      !providerDraft.apiKey.trim() ||
      !providerDraft.baseUrl.trim() ||
      !providerDraft.modelId.trim()
    ) {
      return t('install.page.guided.configure.validation.provider');
    }
    if (!data) {
      return t('install.page.guided.configure.validation.loading');
    }
    for (const channelId of selectedChannelIds) {
      const channel = data.communicationChannels.find((item) => item.id === channelId);
      if (!channel) continue;
      for (const field of channel.fields) {
        if (!(channelDrafts[channel.id]?.[field.key] || '').trim()) {
          return t('install.page.guided.configure.validation.channel', {
            channel: channel.name,
            field: field.label,
          });
        }
      }
    }
    return null;
  }, [
    channelDrafts,
    data,
    providerDraft,
    selectedChannelIds,
    selectedInstanceId,
    t,
  ]);

  async function cleanupProgress() {
    const unsubscribe = progressRef.current;
    progressRef.current = null;
    if (unsubscribe) {
      await unsubscribe();
    }
  }

  async function inspect() {
    setAssessment((previous) => ({ status: 'loading', result: previous.result }));
    try {
      const result = await installerService.inspectHubInstall(request);
      setAssessment({
        status: result.ready && countBlockers(result) === 0 ? 'ready' : 'blocked',
        result,
      });
    } catch (error: unknown) {
      setAssessment({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function loadBootstrap(preferredInstanceId?: string) {
    setBootstrap((previous) => ({ status: 'loading', data: previous.data }));
    try {
      const nextData = await installBootstrapService.loadBootstrapData(preferredInstanceId);
      setBootstrap({ status: 'ready', data: nextData });
      setSelectedInstanceId(nextData.selectedInstanceId);
      setProviderDraft((previous) => buildProviderDraft(nextData, previous));
      setChannelDrafts((previous) =>
        buildChannelDrafts(nextData.communicationChannels, previous),
      );
      setSelectedChannelIds((previous) =>
        buildSelectedChannels(nextData.communicationChannels, previous),
      );
      setSelectedPackIds((previous) =>
        previous.filter((id) => nextData.packs.some((pack) => pack.id === id)).length
          ? previous
          : nextData.packs[0]
            ? [nextData.packs[0].id]
            : [],
      );
      setSelectedSkillIds((previous) =>
        previous.filter((id) => nextData.skills.some((skill) => skill.id === id)),
      );
    } catch (error: unknown) {
      setBootstrap({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  useEffect(() => {
    if (!isOpen) {
      void cleanupProgress();
      return;
    }
    setCurrentStepId('dependencies');
    setAssessment({ status: 'idle' });
    setDependencyStates({});
    setActiveDependencyId(null);
    setInstallStatus('idle');
    setInstallOutput('');
    setInstallResult(null);
    setInstallProgress(createHubInstallProgressState());
    setBootstrap({ status: 'idle' });
    setSelectedInstanceId('');
    setProviderDraft(null);
    setSelectedChannelIds([]);
    setChannelDrafts({});
    setConfigurationStatus('idle');
    setConfigurationError(null);
    setSelectedPackIds([]);
    setSelectedSkillIds([]);
    setInitializationStatus('idle');
    setInitializationError(null);
    setSelectorOpen(false);
    setSelectorTab('packs');
    void inspect();
    return () => {
      void cleanupProgress();
    };
  }, [isOpen, request]);

  useEffect(() => {
    if (
      isOpen &&
      currentStepId === 'configure' &&
      installStatus === 'success' &&
      bootstrap.status === 'idle'
    ) {
      void loadBootstrap();
    }
  }, [bootstrap.status, currentStepId, installStatus, isOpen]);

  async function runDependencyInstall(dependency: HubInstallAssessmentDependency) {
    if (activeDependencyId) return;
    await cleanupProgress();
    setActiveDependencyId(dependency.id);
    setDependencyStates((previous) => ({
      ...previous,
      [dependency.id]: { status: 'running', output: '' },
    }));
    progressRef.current = await installerService.subscribeHubInstallProgress(
      (event: HubInstallProgressEvent) => {
        const line = formatHubInstallProgressEvent(t as (key: string) => string, event);
        if (!line.trim()) return;
        setDependencyStates((previous) => ({
          ...previous,
          [dependency.id]: {
            ...(previous[dependency.id] || { status: 'running', output: '' }),
            output: appendOutput(previous[dependency.id]?.output || '', line),
          },
        }));
      },
    );
    try {
      const result = await installerService.runHubDependencyInstall({
        ...request,
        dependencyIds: [dependency.id],
        continueOnError: false,
      });
      const report = result.dependencyReports.find(
        (item) => item.dependencyId === dependency.id,
      );
      setDependencyStates((previous) => ({
        ...previous,
        [dependency.id]: {
          ...(previous[dependency.id] || { output: '' }),
          status: report?.success ? 'success' : 'error',
          output: previous[dependency.id]?.output || '',
          error: report?.error || undefined,
        },
      }));
    } catch (error: unknown) {
      setDependencyStates((previous) => ({
        ...previous,
        [dependency.id]: {
          ...(previous[dependency.id] || { output: '' }),
          status: 'error',
          output: previous[dependency.id]?.output || '',
          error: error instanceof Error ? error.message : String(error),
        },
      }));
    } finally {
      await cleanupProgress();
      setActiveDependencyId(null);
      await inspect();
    }
  }

  async function runInstall() {
    if (assessment.result?.installStatus === 'installed') {
      setInstallStatus('success');
      setInstallOutput(
        `${t('install.page.guided.install.existingInstall', { product: productName })}\n`,
      );
      return;
    }
    await cleanupProgress();
    setInstallStatus('running');
    setInstallOutput('');
    setInstallResult(null);
    setInstallProgress(createHubInstallProgressState());
    progressRef.current = await installerService.subscribeHubInstallProgress((event) => {
      const line = formatHubInstallProgressEvent(t as (key: string) => string, event);
      if (line.trim()) {
        setInstallOutput((previous) => appendOutput(previous, line));
      }
      setInstallProgress((previous) => reduceHubInstallProgressEvent(previous, event));
    });
    try {
      const result = await installerService.runHubInstall(request);
      setInstallResult(result);
      setInstallProgress((previous) =>
        applyHubInstallResultToProgressState(previous, result),
      );
      setInstallStatus(result.success ? 'success' : 'error');
      setInstallOutput((previous) =>
        appendOutput(
          previous,
          result.success
            ? t('install.page.guided.install.completed')
            : t('install.page.guided.install.failed'),
        ),
      );
      await inspect();
    } catch (error: unknown) {
      setInstallStatus('error');
      setInstallOutput((previous) =>
        appendOutput(previous, error instanceof Error ? error.message : String(error)),
      );
    } finally {
      await cleanupProgress();
    }
  }

  async function applyConfiguration() {
    if (!providerDraft || validationMessage) return;
    setConfigurationStatus('running');
    setConfigurationError(null);
    try {
      await installBootstrapService.applyConfiguration({
        instanceId: selectedInstanceId,
        provider: providerDraft,
        communicationChannels: selectedChannelIds.map((channelId) => ({
          channelId,
          values: channelDrafts[channelId] || {},
        })),
      });
      setConfigurationStatus('success');
      if (selectedInstanceId) {
        await loadBootstrap(selectedInstanceId);
      }
    } catch (error: unknown) {
      setConfigurationStatus('error');
      setConfigurationError(error instanceof Error ? error.message : String(error));
    }
  }

  async function initialize() {
    setInitializationStatus('running');
    setInitializationError(null);
    try {
      await installBootstrapService.initializeInstance({
        instanceId: selectedInstanceId,
        packIds: selectedPackIds,
        skillIds: selectedSkillIds,
      });
      setInitializationStatus('success');
    } catch (error: unknown) {
      setInitializationStatus('error');
      setInitializationError(error instanceof Error ? error.message : String(error));
    }
  }

  async function confirmAndChat() {
    if (selectedInstanceId) {
      setActiveInstanceId(selectedInstanceId);
    }
    onInstalled?.({ result: installResult, instanceId: selectedInstanceId });
    onClose();
    navigate('/chat');
  }

  const actionLabel =
    currentStepId === 'dependencies'
      ? t('install.page.guided.actions.continue')
      : currentStepId === 'install'
        ? installStatus === 'success'
          ? t('install.page.guided.actions.continueToConfigure')
          : t('install.page.guided.actions.installNow')
        : currentStepId === 'configure'
          ? configurationStatus === 'success'
            ? t('install.page.guided.actions.continueToInitialize')
            : t('install.page.guided.actions.applyConfiguration')
        : currentStepId === 'initialize'
          ? initializationStatus === 'success'
            ? t('install.page.guided.actions.continueToSuccess')
            : t('install.page.guided.actions.initialize', { product: productName })
            : t('install.page.guided.actions.confirmAndChat');

  const actionDisabled =
    currentStepId === 'dependencies'
      ? assessment.status !== 'ready' || Boolean(activeDependencyId)
      : currentStepId === 'install'
        ? installStatus === 'running'
        : currentStepId === 'configure'
          ? configurationStatus === 'running' || Boolean(validationMessage)
          : currentStepId === 'initialize'
            ? initializationStatus === 'running'
            : false;

  async function execute() {
    if (currentStepId === 'dependencies') {
      setCurrentStepId('install');
      return;
    }
    if (currentStepId === 'install') {
      if (installStatus === 'success') {
        if (bootstrap.status === 'idle') {
          await loadBootstrap();
        }
        setCurrentStepId('configure');
        return;
      }
      await runInstall();
      return;
    }
    if (currentStepId === 'configure') {
      if (configurationStatus === 'success') {
        setCurrentStepId('initialize');
        return;
      }
      await applyConfiguration();
      return;
    }
    if (currentStepId === 'initialize') {
      if (initializationStatus === 'success') {
        setCurrentStepId('success');
        return;
      }
      await initialize();
      return;
    }
    await confirmAndChat();
  }

  const providersForChannel =
    data?.providers.filter((provider) => provider.channelId === providerDraft?.channelId) ?? [];
  const skillCount =
    includedSkillIds.size + selectedSkillIds.filter((id) => !includedSkillIds.has(id)).length;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && canClose) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-slot="guided-install-modal"
        className="max-h-[92vh] max-w-7xl overflow-hidden p-0"
      >
        <DialogHeader className="flex-row items-center justify-between border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
              {methodIcon}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('install.page.guided.heading')}
              </div>
              <DialogTitle className="mt-1 text-2xl">
                {t('install.page.guided.subtitle', {
                  product: productName,
                  method: methodLabel,
                })}
              </DialogTitle>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!canClose}
            className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="border-b border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/80 lg:border-b-0 lg:border-r">
            <div className="space-y-3">
              {steps.map((step, index) => {
                const isActive = step.id === currentStepId;
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
                    disabled={step.status === 'pending'}
                    onClick={() => setCurrentStepId(step.id)}
                    className={`flex w-full items-start gap-3 rounded-[1.5rem] border p-4 text-left ${
                      isActive
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                        : 'border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200'
                    } ${step.status === 'pending' ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-current/15 bg-current/5">
                      {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div className="mt-1 font-semibold">
                        {t(step.titleKey, { product: productName, method: methodLabel })}
                      </div>
                      <div className="mt-1 text-sm opacity-80">
                        {t(step.descriptionKey, { product: productName, method: methodLabel })}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
          <div className="flex min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50/40 p-6 dark:bg-zinc-950/40">
              {currentStepId === 'dependencies' && (
                <div data-slot="guided-install-dependencies" className="space-y-4">
                  <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {t('install.page.guided.dependencies.title')}
                        </div>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          {t('install.page.guided.dependencies.description')}
                        </p>
                      </div>
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                        {assessment.status === 'ready'
                          ? t('install.page.guided.dependencies.ready')
                          : assessment.status === 'loading'
                            ? t('common.loading')
                            : t('install.page.guided.dependencies.needsAttention')}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {t('install.page.guided.dependencies.labels.blockers')}
                        </div>
                        <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                          {countBlockers(assessment.result)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {t('install.page.guided.dependencies.labels.dependencies')}
                        </div>
                        <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                          {assessment.result?.dependencies.length || 0}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {t('install.page.guided.dependencies.labels.readiness')}
                        </div>
                        <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                          {assessment.result?.ready
                            ? t('install.page.guided.dependencies.readyShort')
                            : t('install.page.guided.dependencies.pendingShort')}
                        </div>
                      </div>
                    </div>
                    {assessment.error && (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                        {assessment.error}
                      </div>
                    )}
                  </div>
                  {(assessment.result?.dependencies || []).map((dependency) => {
                    const state = dependencyStates[dependency.id];
                    const ready =
                      dependency.status === 'available' || state?.status === 'success';
                    return (
                      <div
                        key={dependency.id}
                        className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-medium text-zinc-900 dark:text-zinc-100">
                              {dependency.description || dependency.target}
                            </div>
                            <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                              {dependency.target}
                            </div>
                          </div>
                          {ready ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <CheckCircle2 className="h-4 w-4" />
                              {t('install.page.guided.dependencies.done')}
                            </span>
                          ) : dependency.supportsAutoRemediation ? (
                            <button
                              type="button"
                              disabled={Boolean(activeDependencyId)}
                              onClick={() => void runDependencyInstall(dependency)}
                              className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
                            >
                              {state?.status === 'running'
                                ? t('install.page.guided.dependencies.installing')
                                : t('install.page.guided.dependencies.install')}
                            </button>
                          ) : (
                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                              {t('install.page.guided.dependencies.manual')}
                            </span>
                          )}
                        </div>
                        {state?.error && (
                          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                            {state.error}
                          </div>
                        )}
                        {state?.output && (
                          <pre className="mt-3 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs whitespace-pre-wrap text-zinc-300">
                            {state.output}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {currentStepId === 'install' && (
                <div data-slot="guided-install-install" className="space-y-4">
                  <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {t('install.page.guided.install.title', { product: productName })}
                    </div>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {t('install.page.guided.install.description', {
                        product: productName,
                        method: methodLabel,
                      })}
                    </p>
                    {installResult && (
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {t('install.page.guided.install.installRoot')}
                          </div>
                          <div className="mt-2 break-all text-sm text-zinc-700 dark:text-zinc-300">
                            {installResult.resolvedInstallRoot}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {t('install.page.guided.install.dataRoot')}
                          </div>
                          <div className="mt-2 break-all text-sm text-zinc-700 dark:text-zinc-300">
                            {installResult.resolvedDataRoot}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-[1.5rem] border border-zinc-800 bg-zinc-950">
                    <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                      <span>{t('install.page.guided.install.liveOutput')}</span>
                      <span className="text-zinc-500">
                        {installProgress.currentStage || t('install.page.guided.install.waiting')}
                      </span>
                    </div>
                    <pre className="min-h-[320px] overflow-auto p-4 text-xs whitespace-pre-wrap text-zinc-300">
                      {installOutput || t('install.page.guided.install.logPlaceholder')}
                    </pre>
                  </div>
                </div>
              )}
              {currentStepId === 'configure' && data && providerDraft && (
                <div data-slot="guided-install-configure" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {t('install.page.guided.configure.title')}
                    </div>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {t('install.page.guided.configure.description')}
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="space-y-2">
                        <Label>{t('install.page.guided.configure.instance')}</Label>
                        <Select
                          value={selectedInstanceId}
                          onValueChange={(value) => {
                            setSelectedInstanceId(value);
                            void loadBootstrap(value);
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {data.instances.map((instance) => (
                              <SelectItem key={instance.id} value={instance.id}>
                                {instance.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('install.page.guided.configure.modelChannel')}</Label>
                        <Select
                          value={providerDraft.channelId}
                          onValueChange={(value) =>
                            setProviderDraft(buildProviderDraft(data, providerDraft, value))
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {data.apiRouterChannels.map((channel) => (
                              <SelectItem key={channel.id} value={channel.id}>
                                {channel.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('install.page.guided.configure.providerTemplate')}</Label>
                        <Select
                          value={providerDraft.providerId || 'new'}
                          onValueChange={(value) =>
                            setProviderDraft(
                              value === 'new'
                                ? { ...buildProviderDraft(data, providerDraft, providerDraft.channelId), providerId: undefined }
                                : buildProviderDraft(data, providerDraft, providerDraft.channelId, value),
                            )
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">
                              {t('install.page.guided.configure.createNewProvider')}
                            </SelectItem>
                            {providersForChannel.map((provider) => (
                              <SelectItem key={provider.id} value={provider.id}>
                                {provider.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('install.page.guided.configure.providerName')}</Label>
                        <Input value={providerDraft.name} onChange={(event) => setProviderDraft({ ...providerDraft, name: event.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('install.page.guided.configure.apiKey')}</Label>
                        <Input type="password" value={providerDraft.apiKey} onChange={(event) => setProviderDraft({ ...providerDraft, apiKey: event.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('install.page.guided.configure.baseUrl')}</Label>
                        <Input value={providerDraft.baseUrl} onChange={(event) => setProviderDraft({ ...providerDraft, baseUrl: event.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('install.page.guided.configure.model')}</Label>
                        <Select value={providerDraft.modelId} onValueChange={(value) => setProviderDraft({ ...providerDraft, modelId: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {providerDraft.models.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {t('install.page.guided.configure.communicationTitle')}
                    </div>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {t('install.page.guided.configure.communicationDescription')}
                    </p>
                    <div className="mt-4 space-y-3">
                      {data.communicationChannels.map((channel) => (
                        <div key={channel.id} className="rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                          <label className="flex cursor-pointer items-start gap-3">
                            <Checkbox
                              checked={selectedChannelSet.has(channel.id)}
                              onCheckedChange={(checked) =>
                                setSelectedChannelIds((previous) =>
                                  checked === true ? [...previous, channel.id] : previous.filter((id) => id !== channel.id),
                                )
                              }
                            />
                            <div>
                              <div className="font-medium text-zinc-900 dark:text-zinc-100">{channel.name}</div>
                              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{channel.description}</p>
                            </div>
                          </label>
                          {selectedChannelSet.has(channel.id) && (
                            <div className="mt-4 space-y-3">
                              {channel.fields.map((field) => (
                                <div key={`${channel.id}-${field.key}`} className="space-y-2">
                                  <Label>{field.label}</Label>
                                  <Input
                                    type={field.type === 'password' ? 'password' : 'text'}
                                    placeholder={field.placeholder}
                                    value={channelDrafts[channel.id]?.[field.key] || ''}
                                    onChange={(event) =>
                                      setChannelDrafts((previous) => ({
                                        ...previous,
                                        [channel.id]: {
                                          ...(previous[channel.id] || {}),
                                          [field.key]: event.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {validationMessage && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                        {validationMessage}
                      </div>
                    )}
                    {configurationError && (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                        {configurationError}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {currentStepId === 'initialize' && (
                <div data-slot="guided-install-initialize" className="space-y-4">
                  <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {t('install.page.guided.initialize.title', {
                            product: productName,
                          })}
                        </div>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          {t('install.page.guided.initialize.description', {
                            product: productName,
                          })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectorOpen(true)}
                        className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        {t('install.page.guided.initialize.openSelector')}
                      </button>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {t('install.page.guided.initialize.packages')}
                        </div>
                        <div className="mt-2 text-sm text-zinc-900 dark:text-zinc-100">
                          {selectedPackNames.length
                            ? summarizeSelection(selectedPackNames)
                            : t('install.page.guided.initialize.noneSelected')}
                        </div>
                      </div>
                      <div className="rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {t('install.page.guided.initialize.skills')}
                        </div>
                        <div className="mt-2 text-sm text-zinc-900 dark:text-zinc-100">
                          {selectedSkillNames.length
                            ? summarizeSelection(selectedSkillNames)
                            : skillCount
                              ? t('install.page.guided.initialize.skillCount', {
                                  count: skillCount,
                                })
                              : t('install.page.guided.initialize.noneSelected')}
                        </div>
                      </div>
                    </div>
                    {initializationError && (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                        {initializationError}
                      </div>
                    )}
                  </div>
                  <Modal
                    isOpen={selectorOpen}
                    onClose={() => setSelectorOpen(false)}
                    title={t('install.page.guided.initialize.selectorTitle')}
                    className="max-w-3xl"
                  >
                    <div className="space-y-4">
                      <div className="flex gap-2 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">
                        <button
                          type="button"
                          onClick={() => setSelectorTab('packs')}
                          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold ${selectorTab === 'packs' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'}`}
                        >
                          {t('install.page.guided.initialize.packages')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectorTab('skills')}
                          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold ${selectorTab === 'skills' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'}`}
                        >
                          {t('install.page.guided.initialize.skills')}
                        </button>
                      </div>
                      {selectorTab === 'packs' ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          {data?.packs.map((pack) => (
                            <label key={pack.id} className="flex cursor-pointer items-start gap-3 rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                              <Checkbox checked={selectedPackIds.includes(pack.id)} onCheckedChange={(checked) => setSelectedPackIds((previous) => checked === true ? [...previous, pack.id] : previous.filter((id) => id !== pack.id))} />
                              <div>
                                <div className="font-medium text-zinc-900 dark:text-zinc-100">{pack.name}</div>
                                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{pack.description}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          {data?.skills.map((skill) => (
                            <label key={skill.id} className="flex cursor-pointer items-start gap-3 rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                              <Checkbox checked={includedSkillIds.has(skill.id) || selectedSkillIds.includes(skill.id)} disabled={includedSkillIds.has(skill.id)} onCheckedChange={(checked) => setSelectedSkillIds((previous) => checked === true ? [...previous, skill.id] : previous.filter((id) => id !== skill.id))} />
                              <div>
                                <div className="font-medium text-zinc-900 dark:text-zinc-100">{skill.name}</div>
                                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{skill.description}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectorOpen(false)}
                          className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                        >
                          {t('install.page.guided.initialize.selectorConfirm')}
                        </button>
                      </div>
                    </div>
                  </Modal>
                </div>
              )}
              {currentStepId === 'success' && (
                <div data-slot="guided-install-success" className="space-y-4">
                  <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                          {t('install.page.guided.success.eyebrow')}
                        </div>
                        <h3 className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                          {t('install.page.guided.success.title', { product: productName })}
                        </h3>
                        <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
                          {t('install.page.guided.success.description', {
                            product: productName,
                          })}
                        </p>
                      </div>
                      <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-700 dark:text-emerald-300" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{t('install.page.guided.success.instance')}</div>
                      <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {data?.instances.find((instance) => instance.id === selectedInstanceId)?.name || selectedInstanceId}
                      </div>
                    </div>
                    <div className="rounded-[1.25rem] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{t('install.page.guided.success.modelChannel')}</div>
                      <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {data?.apiRouterChannels.find((channel) => channel.id === providerDraft?.channelId)?.name || providerDraft?.channelId || '-'}
                      </div>
                    </div>
                    <div className="rounded-[1.25rem] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{t('install.page.guided.success.model')}</div>
                      <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {providerDraft?.models.find((model) => model.id === providerDraft.modelId)?.name || providerDraft?.modelId || '-'}
                      </div>
                    </div>
                    <div className="rounded-[1.25rem] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{t('install.page.guided.success.bindings')}</div>
                      <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {t('install.page.guided.success.bindingsValue', { count: selectedChannelIds.length })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-3">
                <button type="button" onClick={onClose} disabled={!canClose} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                  {t('common.close')}
                </button>
                {stepIndex > 0 && (
                  <button type="button" onClick={() => setCurrentStepId((steps[stepIndex - 1]?.id as StepId) || 'dependencies')} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                    {t('common.back')}
                  </button>
                )}
              </div>
              <button type="button" onClick={() => void execute()} disabled={actionDisabled} className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400">
                {actionLabel}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
