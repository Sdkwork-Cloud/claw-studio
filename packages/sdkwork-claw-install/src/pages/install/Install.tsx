import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  DownloadCloud,
  FileText,
  Github,
  Package,
  Play,
  Server,
  Sparkles,
  SquareTerminal,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type {
  HubInstallProgressEvent,
  HubInstallRequest,
  HubInstallResult,
  RuntimeEventUnsubscribe,
} from '@sdkwork/claw-infrastructure';
import { installerService } from '../../services';

type ProductId = 'openclaw' | 'zeroclaw' | 'ironclaw';
type InstallMethodId = 'recommended' | 'docker' | 'pnpm' | 'source';
type InstallStatus = 'idle' | 'running' | 'success' | 'error';
type InstallTagId =
  | 'docker'
  | 'git'
  | 'macos'
  | 'linux'
  | 'windows'
  | 'nodejs'
  | 'pnpm'
  | 'managed'
  | 'source'
  | 'recommended';

type InstallMethod = {
  id: InstallMethodId;
  titleKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
  tags: InstallTagId[];
  recommended?: boolean;
  request: HubInstallRequest;
  docsAnchor: string;
};

type ProductConfig = {
  id: ProductId;
  nameKey: string;
  descriptionKey: string;
  heroAccentClassName: string;
  methods: InstallMethod[];
};

function formatProgressEvent(
  t: (key: string, options?: Record<string, unknown>) => string,
  event: HubInstallProgressEvent,
) {
  switch (event.type) {
    case 'stageStarted':
    case 'stageCompleted':
    case 'artifactStarted':
      return '';
    case 'artifactCompleted':
      return event.success ? '' : t('install.page.modal.progress.downloadFailed');
    case 'stepStarted':
      return event.description;
    case 'stepCommandStarted':
      return '';
    case 'stepLogChunk':
      return event.chunk;
    case 'stepCompleted':
      if (event.skipped) {
        return t('install.page.modal.progress.stepSkipped');
      }

      return event.success ? '' : t('install.page.modal.progress.stepFailed');
    default:
      return '';
  }
}

export function Install() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [selectedProductId, setSelectedProductId] = useState<ProductId>('openclaw');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<InstallMethod | null>(null);
  const [installStatus, setInstallStatus] = useState<InstallStatus>('idle');
  const [installOutput, setInstallOutput] = useState('');
  const [installResult, setInstallResult] = useState<HubInstallResult | null>(null);
  const progressUnsubscribeRef = useRef<RuntimeEventUnsubscribe | null>(null);

  const products = useMemo<ProductConfig[]>(
    () => [
      {
        id: 'openclaw',
        nameKey: 'install.page.products.openclaw.name',
        descriptionKey: 'install.page.products.openclaw.description',
        heroAccentClassName:
          'from-primary-500/15 via-primary-500/5 to-transparent dark:from-primary-500/20 dark:via-primary-500/5',
        methods: [
          {
            id: 'recommended',
            titleKey: 'install.page.methods.recommended.title',
            descriptionKey: 'install.page.products.openclaw.methods.recommended.description',
            icon: <Sparkles className="h-6 w-6 text-primary-500 dark:text-primary-400" />,
            tags: ['recommended', 'managed', 'macos', 'linux', 'windows'],
            recommended: true,
            request: { softwareName: 'openclaw', effectiveRuntimePlatform: 'wsl' },
            docsAnchor: 'openclaw-recommended',
          },
          {
            id: 'docker',
            titleKey: 'install.page.methods.docker.title',
            descriptionKey: 'install.page.products.openclaw.methods.docker.description',
            icon: <Server className="h-6 w-6 text-emerald-500 dark:text-emerald-400" />,
            tags: ['docker', 'managed', 'linux', 'windows'],
            request: { softwareName: 'openclaw-docker', effectiveRuntimePlatform: 'wsl' },
            docsAnchor: 'openclaw-docker',
          },
          {
            id: 'pnpm',
            titleKey: 'install.page.methods.pnpm.title',
            descriptionKey: 'install.page.products.openclaw.methods.pnpm.description',
            icon: <Package className="h-6 w-6 text-amber-500 dark:text-amber-400" />,
            tags: ['nodejs', 'pnpm', 'windows', 'macos', 'linux'],
            request: { softwareName: 'openclaw-pnpm' },
            docsAnchor: 'openclaw-pnpm',
          },
          {
            id: 'source',
            titleKey: 'install.page.methods.source.title',
            descriptionKey: 'install.page.products.openclaw.methods.source.description',
            icon: <Github className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />,
            tags: ['source', 'git', 'managed'],
            request: { softwareName: 'openclaw-source' },
            docsAnchor: 'openclaw-source',
          },
        ],
      },
      {
        id: 'zeroclaw',
        nameKey: 'install.page.products.zeroclaw.name',
        descriptionKey: 'install.page.products.zeroclaw.description',
        heroAccentClassName:
          'from-cyan-500/15 via-cyan-500/5 to-transparent dark:from-cyan-500/20 dark:via-cyan-500/5',
        methods: [
          {
            id: 'recommended',
            titleKey: 'install.page.methods.recommended.title',
            descriptionKey: 'install.page.products.zeroclaw.methods.recommended.description',
            icon: <Sparkles className="h-6 w-6 text-cyan-500 dark:text-cyan-400" />,
            tags: ['recommended', 'pnpm', 'windows', 'macos', 'linux'],
            recommended: true,
            request: { softwareName: 'zeroclaw' },
            docsAnchor: 'zeroclaw-recommended',
          },
          {
            id: 'pnpm',
            titleKey: 'install.page.methods.pnpm.title',
            descriptionKey: 'install.page.products.zeroclaw.methods.pnpm.description',
            icon: <Package className="h-6 w-6 text-cyan-500 dark:text-cyan-400" />,
            tags: ['nodejs', 'pnpm', 'windows', 'macos', 'linux'],
            request: { softwareName: 'zeroclaw-pnpm' },
            docsAnchor: 'zeroclaw-pnpm',
          },
          {
            id: 'source',
            titleKey: 'install.page.methods.source.title',
            descriptionKey: 'install.page.products.zeroclaw.methods.source.description',
            icon: <Github className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />,
            tags: ['source', 'git', 'managed'],
            request: { softwareName: 'zeroclaw-source' },
            docsAnchor: 'zeroclaw-source',
          },
        ],
      },
      {
        id: 'ironclaw',
        nameKey: 'install.page.products.ironclaw.name',
        descriptionKey: 'install.page.products.ironclaw.description',
        heroAccentClassName:
          'from-amber-500/20 via-amber-500/5 to-transparent dark:from-amber-500/25 dark:via-amber-500/5',
        methods: [
          {
            id: 'recommended',
            titleKey: 'install.page.methods.recommended.title',
            descriptionKey: 'install.page.products.ironclaw.methods.recommended.description',
            icon: <Sparkles className="h-6 w-6 text-amber-500 dark:text-amber-400" />,
            tags: ['recommended', 'pnpm', 'windows', 'macos', 'linux'],
            recommended: true,
            request: { softwareName: 'ironclaw' },
            docsAnchor: 'ironclaw-recommended',
          },
          {
            id: 'pnpm',
            titleKey: 'install.page.methods.pnpm.title',
            descriptionKey: 'install.page.products.ironclaw.methods.pnpm.description',
            icon: <Package className="h-6 w-6 text-amber-500 dark:text-amber-400" />,
            tags: ['nodejs', 'pnpm', 'windows', 'macos', 'linux'],
            request: { softwareName: 'ironclaw-pnpm' },
            docsAnchor: 'ironclaw-pnpm',
          },
          {
            id: 'source',
            titleKey: 'install.page.methods.source.title',
            descriptionKey: 'install.page.products.ironclaw.methods.source.description',
            icon: <Github className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />,
            tags: ['source', 'git', 'managed'],
            request: { softwareName: 'ironclaw-source' },
            docsAnchor: 'ironclaw-source',
          },
        ],
      },
    ],
    [],
  );

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0];

  const cleanupProgress = async () => {
    const unsubscribe = progressUnsubscribeRef.current;
    progressUnsubscribeRef.current = null;

    if (unsubscribe) {
      await unsubscribe();
    }
  };

  useEffect(() => {
    return () => {
      void cleanupProgress();
    };
  }, []);

  const closeModal = async () => {
    if (installStatus === 'running') {
      return;
    }

    await cleanupProgress();
    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedMethod(null);
      setInstallStatus('idle');
      setInstallOutput('');
      setInstallResult(null);
    }, 200);
  };

  const openInstallModal = (event: React.MouseEvent, method: InstallMethod) => {
    event.stopPropagation();
    setSelectedMethod(method);
    setInstallStatus('idle');
    setInstallOutput('');
    setInstallResult(null);
    setIsModalOpen(true);
  };

  const handleInstall = async () => {
    if (!selectedMethod) {
      return;
    }

    await cleanupProgress();
    setInstallStatus('running');
    setInstallResult(null);
    setInstallOutput(
      `${t('install.page.modal.output.preparing', {
        product: t(selectedProduct.nameKey),
        method: t(selectedMethod.titleKey),
      })}\n${t('install.page.modal.output.startingInstall')}\n`,
    );

    progressUnsubscribeRef.current = await installerService.subscribeHubInstallProgress((event) => {
      const line = formatProgressEvent(t, event).trim();
      if (!line) {
        return;
      }

      setInstallOutput((previous) => `${previous}${previous.endsWith('\n') ? '' : '\n'}${line}\n`);
    });

    try {
      const result = await installerService.runHubInstall(selectedMethod.request);
      setInstallResult(result);
      setInstallStatus(result.success ? 'success' : 'error');
      setInstallOutput((previous) => {
        const summaryLine = result.success
          ? t('install.page.modal.output.completed')
          : t('install.page.modal.output.failed');
        return `${previous}\n${summaryLine}\n`;
      });
    } catch (error: any) {
      setInstallStatus('error');
      setInstallOutput(
        (previous) =>
          `${previous}\n${t('install.page.modal.output.errorPrefix')}: ${
            error.message || String(error)
          }\n`,
      );
    } finally {
      await cleanupProgress();
    }
  };

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto bg-zinc-50 p-6 scrollbar-hide dark:bg-zinc-950 md:p-10">
      <div className="mx-auto mb-10 max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-primary-100/50 bg-primary-50 text-primary-600 shadow-inner dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-400"
        >
          <DownloadCloud className="h-10 w-10" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-4 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl"
        >
          {t('install.page.hero.title')}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mx-auto max-w-3xl text-lg leading-relaxed text-zinc-500 dark:text-zinc-400"
        >
          {t('install.page.hero.subtitle')}
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="mx-auto mb-8 grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-3"
      >
        {products.map((product) => {
          const isActive = product.id === selectedProduct.id;

          return (
            <button
              key={product.id}
              type="button"
              onClick={() => setSelectedProductId(product.id)}
              className={`rounded-3xl border p-5 text-left transition-all ${
                isActive
                  ? 'border-zinc-900 bg-zinc-900 text-white shadow-lg dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700'
              }`}
            >
              <div className="text-lg font-bold">{t(product.nameKey)}</div>
              <div
                className={`mt-2 text-sm leading-relaxed ${
                  isActive ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {t(product.descriptionKey)}
              </div>
            </button>
          );
        })}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className={`relative mx-auto mb-10 flex max-w-5xl flex-col items-center gap-6 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl dark:bg-zinc-900/80 md:flex-row md:p-8`}
      >
        <div className={`absolute inset-0 bg-gradient-to-r ${selectedProduct.heroAccentClassName}`} />
        <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 text-zinc-300">
          <Cpu className="h-7 w-7" />
        </div>
        <div className="relative z-10 flex-1 text-center md:text-left">
          <h3 className="mb-1 text-lg font-bold text-white">
            {t('install.page.systemRequirements.title')}
          </h3>
          <p className="text-sm leading-relaxed text-zinc-300">
            {t('install.page.systemRequirements.description', {
              product: t(selectedProduct.nameKey),
            })}
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {selectedProduct.methods.map((method, index) => (
          <motion.div
            key={`${selectedProduct.id}-${method.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 + index * 0.06 }}
            className={`group relative flex h-full flex-col rounded-3xl border bg-white p-6 transition-all dark:bg-zinc-900 ${
              method.recommended
                ? 'border-primary-500 ring-1 ring-primary-500/20 shadow-lg shadow-primary-500/10 dark:border-primary-500/50 dark:ring-primary-500/10 dark:shadow-primary-900/20'
                : 'border-zinc-200 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:shadow-zinc-900/50'
            }`}
          >
            {method.recommended && (
              <div className="absolute -top-3 left-6 rounded-full bg-primary-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm dark:bg-primary-500">
                {t('install.page.method.badge.recommended')}
              </div>
            )}

            <div className="mb-5 mt-2 flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm transition-transform group-hover:scale-105 dark:border-zinc-700 dark:bg-zinc-800">
                {method.icon}
              </div>
            </div>

            <h3 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {t(method.titleKey)}
            </h3>
            <p className="mb-6 flex-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t(method.descriptionKey)}
            </p>

            <div className="mb-8 flex flex-wrap gap-2">
              {method.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                >
                  {t(`install.page.tags.${tag}`)}
                </span>
              ))}
            </div>

            <div className="mt-auto flex flex-col gap-3">
              <button
                onClick={(event) => openInstallModal(event, method)}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all shadow-sm ${
                  method.recommended
                    ? 'bg-primary-600 text-white shadow-primary-900/20 hover:bg-primary-700'
                    : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
                }`}
              >
                <DownloadCloud className="h-4 w-4" />
                {t('install.page.method.actions.install')}
              </button>

              <button
                onClick={() => navigate(`/docs#${method.docsAnchor}`)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
              >
                <FileText className="h-4 w-4" />
                {t('install.page.method.actions.viewDocumentation')}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && selectedMethod && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
              onClick={() => {
                void closeModal();
              }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                    {selectedMethod.icon}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                      {t('install.page.modal.title', {
                        product: t(selectedProduct.nameKey),
                        method: t(selectedMethod.titleKey),
                      })}
                    </h2>
                    <p className="mt-0.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {t('install.page.modal.subtitle')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    void closeModal();
                  }}
                  disabled={installStatus === 'running'}
                  aria-label={t('install.page.modal.actions.close')}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6 dark:bg-zinc-950/50">
                {installStatus === 'idle' ? (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {t('install.page.modal.summaryLabel')}
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                        <div>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {t('install.page.modal.productLabel')}:
                          </span>{' '}
                          {t(selectedProduct.nameKey)}
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {t('install.page.modal.methodLabel')}:
                          </span>{' '}
                          {t(selectedMethod.titleKey)}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4 rounded-2xl border border-primary-100 bg-primary-50/50 p-5 dark:border-primary-500/20 dark:bg-primary-500/5">
                      <Sparkles className="h-6 w-6 shrink-0 text-primary-500 dark:text-primary-400" />
                      <p className="text-sm font-medium leading-relaxed text-primary-900 dark:text-primary-200">
                        {t('install.page.modal.info')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                      {installStatus === 'running' && (
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                      )}
                      {installStatus === 'success' && (
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      )}
                      {installStatus === 'error' && <AlertCircle className="h-6 w-6 text-red-500" />}
                      <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {installStatus === 'running' && t('install.page.modal.status.running')}
                        {installStatus === 'success' && t('install.page.modal.status.success')}
                        {installStatus === 'error' && t('install.page.modal.status.error')}
                      </span>
                    </div>

                    {installResult && (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            {t('install.page.modal.result.installRoot')}
                          </div>
                          <div className="mt-2 break-all text-sm text-zinc-700 dark:text-zinc-300">
                            {installResult.resolvedInstallRoot}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            {t('install.page.modal.result.dataRoot')}
                          </div>
                          <div className="mt-2 break-all text-sm text-zinc-700 dark:text-zinc-300">
                            {installResult.resolvedDataRoot}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex h-80 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-inner">
                      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
                        <SquareTerminal className="h-4 w-4 text-zinc-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                          {t('install.page.modal.terminalOutput')}
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-5 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                        <span
                          className={
                            installStatus === 'error' ? 'text-red-400' : 'text-emerald-400'
                          }
                        >
                          {installOutput}
                        </span>
                        {installStatus === 'running' && (
                          <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-zinc-400 align-middle" />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-100 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900">
                {installStatus === 'idle' ? (
                  <>
                    <button
                      onClick={() => {
                        void closeModal();
                      }}
                      className="rounded-xl px-6 py-3 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleInstall}
                      className="flex items-center gap-2 rounded-xl bg-primary-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-primary-900/20 transition-colors hover:bg-primary-700"
                    >
                      <Play className="h-4 w-4" />
                      {t('install.page.modal.actions.startDeployment')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      void closeModal();
                    }}
                    disabled={installStatus === 'running'}
                    className="rounded-xl bg-zinc-900 px-8 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {installStatus === 'success'
                      ? t('install.page.modal.actions.done')
                      : t('install.page.modal.actions.close')}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
