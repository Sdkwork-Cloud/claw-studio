import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Apple,
  Box,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Cpu,
  DollarSign,
  FileSearch,
  FileText,
  HardDriveDownload,
  Link2,
  Loader2,
  MemoryStick,
  MoreVertical,
  Play,
  Plus,
  RefreshCw,
  Server,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  Waypoints,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useInstanceStore } from '@sdkwork/claw-core';
import { fileDialogService, platform } from '@sdkwork/claw-infrastructure';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
  Textarea,
} from '@sdkwork/claw-ui';
import {
  instanceOnboardingService,
  instanceService,
  type DiscoveredInstalledOpenClawInstall,
} from '../services';
import { Instance } from '../types';

type OnboardingDialogMode = 'associate' | 'remote' | null;

interface RemoteInstanceFormState {
  name: string;
  host: string;
  port: string;
  secure: boolean;
  authToken: string;
  description: string;
}

function createRemoteInstanceFormState(): RemoteInstanceFormState {
  return {
    name: '',
    host: '',
    port: '28789',
    secure: false,
    authToken: '',
    description: '',
  };
}

function formatMemoryLabel(memory: number) {
  return `${memory} MB`;
}

function formatVersionLabel(version: string) {
  return `v${version}`;
}

function getIcon(type: string) {
  switch (type) {
    case 'apple':
      return <Apple className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />;
    case 'box':
      return <Box className="h-5 w-5 text-primary-500" />;
    case 'server':
      return <Server className="h-5 w-5 text-primary-500" />;
    default:
      return <Server className="h-5 w-5 text-zinc-500" />;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'online':
      return 'bg-emerald-500 shadow-emerald-500/50';
    case 'offline':
      return 'bg-zinc-400';
    case 'starting':
      return 'bg-amber-500 animate-pulse shadow-amber-500/50';
    case 'error':
      return 'bg-red-500 shadow-red-500/50';
    default:
      return 'bg-zinc-400';
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'online':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400';
    case 'offline':
      return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
    case 'starting':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400';
    case 'error':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400';
    default:
      return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
  }
}

function getAssociationStatusTone(status: DiscoveredInstalledOpenClawInstall['associationStatus']) {
  if (status === 'associated') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (status === 'readyToAssociate') {
    return 'border-primary-500/20 bg-primary-500/10 text-primary-700 dark:text-primary-300';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
}

function getControlLevelTone(controlLevel: DiscoveredInstalledOpenClawInstall['installControlLevel']) {
  if (controlLevel === 'managed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (controlLevel === 'partial') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
  }

  return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

export function Instances() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isDesktop = platform.getPlatform() === 'desktop';
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<OnboardingDialogMode>(null);
  const [discoveredInstalls, setDiscoveredInstalls] = useState<DiscoveredInstalledOpenClawInstall[]>([]);
  const [isLoadingInstalls, setIsLoadingInstalls] = useState(false);
  const [isManualAssociating, setIsManualAssociating] = useState(false);
  const [activeAssociationId, setActiveAssociationId] = useState<string | null>(null);
  const [isCreatingRemoteInstance, setIsCreatingRemoteInstance] = useState(false);
  const [remoteForm, setRemoteForm] = useState<RemoteInstanceFormState>(
    createRemoteInstanceFormState(),
  );
  const { activeInstanceId, setActiveInstanceId } = useInstanceStore();

  const remotePreviewHost = remoteForm.host.trim() || 'gateway.example.com';
  const remotePreviewPort = remoteForm.port.trim() || '28789';
  const remotePreviewBaseUrl = `${remoteForm.secure ? 'https' : 'http'}://${remotePreviewHost}:${remotePreviewPort}`;
  const remotePreviewWebsocketUrl = `${remoteForm.secure ? 'wss' : 'ws'}://${remotePreviewHost}:${remotePreviewPort}`;

  const getStatusLabel = (status: string) => t(`instances.shared.status.${status}`);
  const getActionLabel = (action: string) => t(`instances.list.actionNames.${action}`);

  const loadInstances = async () => {
    setIsLoading(true);
    try {
      const data = await instanceService.getInstances();
      setInstances(data);
    } catch (error: any) {
      console.error('Failed to fetch instances:', error);
      toast.error(t('instances.list.toasts.loadFailed'), {
        description: error?.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadInstances();
  }, []);

  useEffect(() => {
    const instance = instances.find((record) => record.id === activeInstanceId) || null;
    if (instance && activeInstanceId === instance.id && !instance.supportsAssist) {
      setActiveInstanceId(null);
    }
  }, [activeInstanceId, instances, setActiveInstanceId]);

  const loadInstalledOpenClawInstalls = async () => {
    setIsLoadingInstalls(true);
    try {
      const installs = await instanceOnboardingService.discoverInstalledOpenClawInstalls();
      setDiscoveredInstalls(installs);
    } catch (error: any) {
      console.error('Failed to discover installed OpenClaw installs:', error);
      toast.error(t('instances.list.toasts.discoveryFailed'), {
        description: error?.message,
      });
    } finally {
      setIsLoadingInstalls(false);
    }
  };

  const handleAction = async (event: React.MouseEvent, action: string, id: string) => {
    event.stopPropagation();
    setActiveDropdown(null);

    try {
      if (action === 'start') {
        await instanceService.startInstance(id);
        toast.success(t('instances.list.toasts.started'));
      } else if (action === 'stop') {
        await instanceService.stopInstance(id);
        toast.success(t('instances.list.toasts.stopped'));
      } else if (action === 'restart') {
        await instanceService.restartInstance(id);
        toast.success(t('instances.list.toasts.restarted'));
      } else if (action === 'delete') {
        if (!window.confirm(t('instances.list.confirmUninstall'))) {
          return;
        }

        await instanceService.deleteInstance(id);
        toast.success(t('instances.list.toasts.uninstalled'));
        if (activeInstanceId === id) {
          setActiveInstanceId(null);
        }
      }

      await loadInstances();
    } catch (error: any) {
      console.error(`Failed to ${action} instance:`, error);
      toast.error(t('instances.list.toasts.actionFailed', { action: getActionLabel(action) }), {
        description: error?.message,
      });
    }
  };

  const handleOpenBuiltInInstall = () => {
    navigate('/install?product=openclaw');
  };

  const handleOpenAssociationDialog = () => {
    setDialogMode('associate');
    void loadInstalledOpenClawInstalls();
  };

  const handleCloseDialog = () => {
    setDialogMode(null);
    setActiveAssociationId(null);
    setIsManualAssociating(false);
    setIsCreatingRemoteInstance(false);
    setRemoteForm(createRemoteInstanceFormState());
  };

  const handleAssociateDetectedInstall = async (install: DiscoveredInstalledOpenClawInstall) => {
    if (!install.configPath) {
      toast.error(t('instances.list.toasts.configMissing'));
      return;
    }

    setActiveAssociationId(install.id);
    try {
      const result = await instanceOnboardingService.associateOpenClawConfigPath({
        configPath: install.configPath,
        installationMethodId: install.methodId,
        installationMethodLabel: install.methodLabel,
        installRoot: install.installRoot,
        workRoot: install.workRoot,
        dataRoot: install.dataRoot,
      });

      toast.success(
        t(
          result.mode === 'created'
            ? 'instances.list.toasts.associationCreated'
            : 'instances.list.toasts.associationUpdated',
          { name: result.instance.name },
        ),
      );
      await Promise.all([loadInstances(), loadInstalledOpenClawInstalls()]);
    } catch (error: any) {
      console.error('Failed to associate installed OpenClaw:', error);
      toast.error(t('instances.list.toasts.associationFailed'), {
        description: error?.message,
      });
    } finally {
      setActiveAssociationId(null);
    }
  };

  const handleAssociateFromConfigFile = async () => {
    if (!isDesktop) {
      toast.error(t('instances.list.associateDialog.manualDesktopOnly'));
      return;
    }

    setIsManualAssociating(true);
    try {
      const configPath = await fileDialogService.selectFile({
        title: t('instances.list.associateDialog.filePickerTitle'),
        filters: [
          {
            name: 'JSON',
            extensions: ['json'],
          },
        ],
      });

      if (!configPath) {
        return;
      }

      const result = await instanceOnboardingService.associateOpenClawConfigPath({
        configPath,
      });

      toast.success(
        t(
          result.mode === 'created'
            ? 'instances.list.toasts.associationCreated'
            : 'instances.list.toasts.associationUpdated',
          { name: result.instance.name },
        ),
      );
      await Promise.all([loadInstances(), loadInstalledOpenClawInstalls()]);
    } catch (error: any) {
      console.error('Failed to associate OpenClaw from config file:', error);
      toast.error(t('instances.list.toasts.associationFailed'), {
        description: error?.message,
      });
    } finally {
      setIsManualAssociating(false);
    }
  };

  const handleCreateRemoteInstance = async () => {
    const parsedPort = Number.parseInt(remoteForm.port, 10);

    setIsCreatingRemoteInstance(true);
    try {
      const instance = await instanceOnboardingService.createRemoteOpenClawInstance({
        name: remoteForm.name,
        host: remoteForm.host,
        port: parsedPort,
        secure: remoteForm.secure,
        authToken: remoteForm.authToken,
        description: remoteForm.description,
      });

      toast.success(t('instances.list.toasts.instanceCreated', { name: instance.name }));
      handleCloseDialog();
      await loadInstances();
    } catch (error: any) {
      console.error('Failed to create remote OpenClaw instance:', error);
      toast.error(t('instances.list.toasts.remoteCreateFailed'), {
        description: error?.message,
      });
    } finally {
      setIsCreatingRemoteInstance(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex h-64 max-w-7xl items-center justify-center p-6 md:p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="scrollbar-hide mx-auto h-full max-w-7xl overflow-y-auto p-6 md:p-10">
      <div className="mb-8 flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t('instances.list.title')}
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
            {t('instances.list.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => setDialogMode('remote')}
            className="rounded-xl px-5 py-2.5"
          >
            <Plus className="h-4 w-4" />
            {t('instances.list.actions.newInstance')}
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenAssociationDialog}
            className="rounded-xl px-5 py-2.5"
          >
            <Link2 className="h-4 w-4" />
            {t('instances.list.actions.associateInstalled')}
          </Button>
          <Button
            variant="secondary"
            onClick={handleOpenBuiltInInstall}
            className="rounded-xl px-5 py-2.5"
          >
            <HardDriveDownload className="h-4 w-4" />
            {t('instances.list.actions.installBuiltIn')}
          </Button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <button
          onClick={handleOpenBuiltInInstall}
          className="group rounded-[1.75rem] border border-zinc-200/80 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-lg hover:shadow-primary-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-primary-500/40"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
              {t('instances.list.onboarding.builtInBadge')}
            </span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t('instances.list.onboarding.builtInTitle')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('instances.list.onboarding.builtInDescription')}
          </p>
          <div className="mt-5 flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-300">
            {t('instances.list.onboarding.builtInAction')}
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>

        <button
          onClick={handleOpenAssociationDialog}
          className="group rounded-[1.75rem] border border-zinc-200/80 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-200/20 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:shadow-none"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <FileSearch className="h-5 w-5" />
            </div>
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {t('instances.list.onboarding.associateBadge')}
            </span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t('instances.list.onboarding.associateTitle')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('instances.list.onboarding.associateDescription')}
          </p>
          <div className="mt-5 flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {t('instances.list.onboarding.associateAction')}
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>

        <button
          onClick={() => setDialogMode('remote')}
          className="group rounded-[1.75rem] border border-zinc-200/80 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-200/20 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:shadow-none"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <Cloud className="h-5 w-5" />
            </div>
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {t('instances.list.onboarding.remoteBadge')}
            </span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t('instances.list.onboarding.remoteTitle')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('instances.list.onboarding.remoteDescription')}
          </p>
          <div className="mt-5 flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {t('instances.list.onboarding.remoteAction')}
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>
      </div>

      {instances.length === 0 ? (
        <div className="mb-8 rounded-[1.75rem] border border-dashed border-zinc-300 bg-zinc-50/80 px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/60">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-200">
            <Waypoints className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t('instances.list.emptyTitle')}
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('instances.list.emptyDescription')}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={handleOpenBuiltInInstall} className="rounded-xl px-5 py-2.5">
              <HardDriveDownload className="h-4 w-4" />
              {t('instances.list.emptyPrimaryAction')}
            </Button>
            <Button
              variant="outline"
              onClick={handleOpenAssociationDialog}
              className="rounded-xl px-5 py-2.5"
            >
              <Link2 className="h-4 w-4" />
              {t('instances.list.emptySecondaryAction')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {instances.map((instance, index) => {
          const isActive = activeInstanceId === instance.id;

          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              key={instance.id}
              className={`group relative flex flex-col rounded-[1.5rem] border bg-white p-6 transition-all duration-300 dark:bg-zinc-900 ${
                isActive
                  ? 'border-primary-500 shadow-md shadow-primary-500/10 ring-1 ring-primary-500/50'
                  : 'border-zinc-200/80 hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-200/20 dark:border-zinc-800/80 dark:hover:border-zinc-700 dark:hover:shadow-none'
              }`}
            >
              {isActive && (
                <div className="absolute -right-3 -top-3 flex items-center gap-1.5 rounded-full bg-primary-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t('instances.list.activeBadge')}
                </div>
              )}

              <div className="mb-6 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] border shadow-sm transition-transform duration-300 group-hover:scale-105 ${
                      isActive
                        ? 'border-primary-200 bg-primary-50 dark:border-primary-500/20 dark:bg-primary-500/10'
                        : 'border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800'
                    }`}
                  >
                    {getIcon(instance.iconType)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3
                        onClick={() => navigate(`/instances/${instance.id}`)}
                        className="cursor-pointer text-lg font-bold tracking-tight text-zinc-900 transition-colors hover:text-primary-600 dark:text-zinc-100 dark:hover:text-primary-400"
                      >
                        {instance.name}
                      </h3>
                      <div
                        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${getStatusBadge(
                          instance.status,
                        )}`}
                      >
                        <div
                          className={`h-1.5 w-1.5 rounded-full shadow-sm ${getStatusColor(instance.status)}`}
                        />
                        {getStatusLabel(instance.status)}
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        {instance.type}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-mono text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {instance.ip}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="relative flex items-center gap-2">
                  {!isActive && instance.supportsAssist && instance.status === 'online' && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveInstanceId(instance.id);
                      }}
                      className="hidden items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 sm:flex dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                    >
                      {t('instances.list.actions.setActive')}
                    </button>
                  )}
                  <button
                    onClick={() =>
                      setActiveDropdown(activeDropdown === instance.id ? null : instance.id)
                    }
                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>

                  {activeDropdown === instance.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setActiveDropdown(null)} />
                      <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                        {instance.status === 'online' ? (
                          <>
                            {!isActive && instance.supportsAssist && (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setActiveInstanceId(instance.id);
                                  setActiveDropdown(null);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 sm:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
                              >
                                <CheckCircle2 className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                                {t('instances.list.actions.setAsActive')}
                              </button>
                            )}
                            <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800">
                              <Terminal className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                              {t('instances.list.actions.openTerminal')}
                            </button>
                            <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800">
                              <FileText className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                              {t('instances.list.actions.viewLogs')}
                            </button>
                            <button
                              onClick={(event) => void handleAction(event, 'restart', instance.id)}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              <RefreshCw className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                              {t('instances.list.actions.restart')}
                            </button>
                            <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                            <button
                              onClick={(event) => void handleAction(event, 'stop', instance.id)}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-500 dark:hover:bg-amber-500/10"
                            >
                              <Square className="h-4 w-4" />
                              {t('instances.list.actions.stopInstance')}
                            </button>
                            <button
                              onClick={(event) => void handleAction(event, 'delete', instance.id)}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                              {t('instances.list.actions.uninstall')}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={(event) => void handleAction(event, 'start', instance.id)}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-500 dark:hover:bg-emerald-500/10"
                            >
                              <Play className="h-4 w-4" />
                              {t('instances.list.actions.startInstance')}
                            </button>
                            <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                            <button
                              onClick={(event) => void handleAction(event, 'delete', instance.id)}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                              {t('instances.list.actions.uninstall')}
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <Cpu className="h-3.5 w-3.5" />
                      {t('instances.list.metrics.cpu')}
                    </div>
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      {instance.cpu}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${instance.cpu}%` }} />
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <MemoryStick className="h-3.5 w-3.5" />
                      {t('instances.list.metrics.memory')}
                    </div>
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      {formatMemoryLabel(instance.memory)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min((instance.memory / 1024) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                    {t('instances.list.metrics.totalMemory', { value: instance.totalMemory })}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <DollarSign className="h-3.5 w-3.5" />
                      {t('instances.list.metrics.estimatedCost')}
                    </div>
                    <span className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      {t('instances.list.metrics.monthlyCost', {
                        value: instance.status === 'online' ? '$14.40' : '$0.00',
                      })}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                    {t('instances.list.metrics.hourlyRate', { value: '$0.02' })}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <Sparkles className="h-3.5 w-3.5" />
                      {t('instances.list.metrics.apiTokens')}
                    </div>
                    <span className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      {instance.status === 'online' ? '1.2M' : '0'}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                    {t('instances.list.metrics.billingCycle')}
                  </div>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    {t('instances.list.metrics.uptime', {
                      value:
                        instance.status === 'online'
                          ? instance.uptime
                          : t('instances.shared.status.offline'),
                    })}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                  <span className="font-mono">{formatVersionLabel(instance.version)}</span>
                </div>

                <button
                  onClick={() => navigate(`/instances/${instance.id}`)}
                  className="flex items-center gap-1 text-sm font-medium text-zinc-900 transition-colors hover:text-primary-600 dark:text-zinc-100 dark:hover:text-primary-400"
                >
                  {t('instances.list.actions.details')}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && handleCloseDialog()}>
        {dialogMode === 'associate' ? (
          <DialogContent className="sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>{t('instances.list.associateDialog.title')}</DialogTitle>
              <DialogDescription>{t('instances.list.associateDialog.description')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                <div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t('instances.list.associateDialog.detectedTitle')}
                  </div>
                  <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {t('instances.list.associateDialog.detectedDescription')}
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => void loadInstalledOpenClawInstalls()}
                  disabled={isLoadingInstalls}
                  className="rounded-xl"
                >
                  {isLoadingInstalls ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {t('instances.list.actions.rescanInstalls')}
                </Button>
              </div>

              {isLoadingInstalls ? (
                <div className="flex h-48 items-center justify-center rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                </div>
              ) : discoveredInstalls.length > 0 ? (
                <div className="space-y-4">
                  {discoveredInstalls.map((install) => (
                    <div
                      key={install.id}
                      className="rounded-[1.5rem] border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                              {install.label}
                            </h3>
                            <span
                              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getAssociationStatusTone(
                                install.associationStatus,
                              )}`}
                            >
                              {t(`instances.list.associationStatus.${install.associationStatus}`)}
                            </span>
                            <span
                              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getControlLevelTone(
                                install.installControlLevel,
                              )}`}
                            >
                              {t(`instances.list.installControlLevel.${install.installControlLevel}`)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                            {install.summary}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {install.methodLabel}
                            </span>
                            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {t(`instances.list.runtimePlatform.${install.runtimePlatform}`)}
                            </span>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                                {t('instances.list.associateDialog.labels.configPath')}
                              </div>
                              <div className="mt-2 break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
                                {install.configPath || t('instances.list.associateDialog.configUnavailable')}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                                {t('instances.list.associateDialog.labels.endpoint')}
                              </div>
                              <div className="mt-2 break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
                                {install.baseUrl || 'http://127.0.0.1:28789'}
                              </div>
                            </div>
                            {install.workRoot ? (
                              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                                  {t('instances.list.associateDialog.labels.workRoot')}
                                </div>
                                <div className="mt-2 break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
                                  {install.workRoot}
                                </div>
                              </div>
                            ) : null}
                            {install.associatedInstanceId ? (
                              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                                  {t('instances.list.associateDialog.labels.linkedInstance')}
                                </div>
                                <div className="mt-2 break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
                                  {install.associatedInstanceId}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col gap-3 xl:w-52">
                          <Button
                            onClick={() => void handleAssociateDetectedInstall(install)}
                            disabled={!install.configPath || activeAssociationId === install.id}
                            className="rounded-xl"
                          >
                            {activeAssociationId === install.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Link2 className="h-4 w-4" />
                            )}
                            {install.associationStatus === 'associated'
                              ? t('instances.list.associateDialog.refreshAssociation')
                              : t('instances.list.associateDialog.associateAction')}
                          </Button>
                          {!install.configPath ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                              {t('instances.list.associateDialog.configMissingHint')}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/80 px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/60">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-200">
                    <FileSearch className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {t('instances.list.associateDialog.emptyTitle')}
                  </h3>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {t('instances.list.associateDialog.emptyDescription')}
                  </p>
                </div>
              )}

              <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {t('instances.list.associateDialog.manualTitle')}
                    </div>
                    <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {t('instances.list.associateDialog.manualDescription')}
                    </div>
                    {!isDesktop ? (
                      <div className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                        {t('instances.list.associateDialog.manualDesktopOnly')}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => void handleAssociateFromConfigFile()}
                    disabled={!isDesktop || isManualAssociating}
                    className="rounded-xl"
                  >
                    {isManualAssociating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
                    {t('instances.list.actions.associateConfigFile')}
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                {t('common.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
        {dialogMode === 'remote' ? (
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{t('instances.list.remoteDialog.title')}</DialogTitle>
              <DialogDescription>{t('instances.list.remoteDialog.description')}</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">{t('instances.list.remoteDialog.fields.name')}</Label>
                  <Input
                    value={remoteForm.name}
                    onChange={(event) =>
                      setRemoteForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder={t('instances.list.remoteDialog.placeholders.name')}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <div>
                    <Label className="mb-2 block">{t('instances.list.remoteDialog.fields.host')}</Label>
                    <Input
                      value={remoteForm.host}
                      onChange={(event) =>
                        setRemoteForm((current) => ({ ...current, host: event.target.value }))
                      }
                      placeholder={t('instances.list.remoteDialog.placeholders.host')}
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">{t('instances.list.remoteDialog.fields.port')}</Label>
                    <Input
                      type="number"
                      value={remoteForm.port}
                      onChange={(event) =>
                        setRemoteForm((current) => ({ ...current, port: event.target.value }))
                      }
                      placeholder="28789"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {t('instances.list.remoteDialog.fields.secure')}
                      </div>
                      <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        {t('instances.list.remoteDialog.fields.secureDescription')}
                      </div>
                    </div>
                    <Switch
                      checked={remoteForm.secure}
                      onCheckedChange={(checked) =>
                        setRemoteForm((current) => ({ ...current, secure: checked }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">{t('instances.list.remoteDialog.fields.authToken')}</Label>
                  <Input
                    value={remoteForm.authToken}
                    onChange={(event) =>
                      setRemoteForm((current) => ({ ...current, authToken: event.target.value }))
                    }
                    placeholder={t('instances.list.remoteDialog.placeholders.authToken')}
                  />
                </div>

                <div>
                  <Label className="mb-2 block">{t('instances.list.remoteDialog.fields.description')}</Label>
                  <Textarea
                    value={remoteForm.description}
                    onChange={(event) =>
                      setRemoteForm((current) => ({ ...current, description: event.target.value }))
                    }
                    placeholder={t('instances.list.remoteDialog.placeholders.description')}
                  />
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <Cloud className="h-4 w-4" />
                  {t('instances.list.remoteDialog.previewTitle')}
                </div>
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      {t('instances.list.remoteDialog.protocolHttp')}
                    </div>
                    <div className="mt-2 break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {remotePreviewBaseUrl}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      {t('instances.list.remoteDialog.protocolWebSocket')}
                    </div>
                    <div className="mt-2 break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {remotePreviewWebsocketUrl}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => void handleCreateRemoteInstance()}
                disabled={isCreatingRemoteInstance}
              >
                {isCreatingRemoteInstance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t('instances.list.actions.createRemote')}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
