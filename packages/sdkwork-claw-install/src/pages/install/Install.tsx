import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Cpu,
  DownloadCloud,
  FileText,
  Github,
  Info,
  Monitor,
  Package,
  Play,
  Server,
  SquareTerminal,
  Terminal,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MobileAppDownloadSection } from '../../components';
import { installerService } from '../../services';

type InstallMethodId = 'script' | 'docker' | 'npm' | 'cloud' | 'source';
type OsOptionId = 'macos' | 'linux' | 'windows' | 'cross';
type InstallStatus = 'idle' | 'running' | 'success' | 'error';
type InstallTagId =
  | 'cloud'
  | 'development'
  | 'docker'
  | 'git'
  | 'homeServer'
  | 'linux'
  | 'macos'
  | 'nas'
  | 'nodejs'
  | 'npm'
  | 'pnpm'
  | 'ubuntu'
  | 'vps'
  | 'windows'
  | 'wsl2';

type InstallMethod = {
  id: InstallMethodId;
  titleKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
  tags: InstallTagId[];
  recommended?: boolean;
  canInstall: boolean;
  osOptions?: Array<{
    id: OsOptionId;
    labelKey: string;
    command: string;
  }>;
};

export function Install() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<InstallMethod | null>(null);
  const [selectedOS, setSelectedOS] = useState<OsOptionId | ''>('');
  const [installStatus, setInstallStatus] = useState<InstallStatus>('idle');
  const [installOutput, setInstallOutput] = useState('');

  const methods = useMemo<InstallMethod[]>(
    () => [
      {
        id: 'script',
        titleKey: 'install.page.methods.script.title',
        descriptionKey: 'install.page.methods.script.description',
        icon: <Terminal className="h-6 w-6 text-primary-500 dark:text-primary-400" />,
        tags: ['macos', 'linux', 'wsl2', 'windows'],
        recommended: true,
        canInstall: true,
        osOptions: [
          {
            id: 'macos',
            labelKey: 'install.page.os.macos',
            command: 'curl -fsSL https://openclaw.ai/install.sh | bash',
          },
          {
            id: 'linux',
            labelKey: 'install.page.os.linux',
            command: 'curl -fsSL https://openclaw.ai/install.sh | bash',
          },
          {
            id: 'windows',
            labelKey: 'install.page.os.windowsPowerShell',
            command: 'iwr -useb https://openclaw.ai/install.ps1 | iex',
          },
        ],
      },
      {
        id: 'docker',
        titleKey: 'install.page.methods.docker.title',
        descriptionKey: 'install.page.methods.docker.description',
        icon: <Server className="h-6 w-6 text-emerald-500 dark:text-emerald-400" />,
        tags: ['docker', 'nas', 'homeServer'],
        canInstall: true,
        osOptions: [
          {
            id: 'macos',
            labelKey: 'install.page.os.macos',
            command: './docker-setup.sh',
          },
          {
            id: 'linux',
            labelKey: 'install.page.os.linux',
            command: './docker-setup.sh',
          },
          {
            id: 'windows',
            labelKey: 'install.page.os.windowsWsl',
            command: './docker-setup.sh',
          },
        ],
      },
      {
        id: 'npm',
        titleKey: 'install.page.methods.npm.title',
        descriptionKey: 'install.page.methods.npm.description',
        icon: <Package className="h-6 w-6 text-amber-500 dark:text-amber-400" />,
        tags: ['nodejs', 'npm', 'pnpm'],
        canInstall: true,
        osOptions: [
          {
            id: 'cross',
            labelKey: 'install.page.os.crossPlatformNode',
            command: 'npm install -g openclaw@latest && openclaw onboard --install-daemon',
          },
        ],
      },
      {
        id: 'cloud',
        titleKey: 'install.page.methods.cloud.title',
        descriptionKey: 'install.page.methods.cloud.description',
        icon: <Cloud className="h-6 w-6 text-purple-500 dark:text-purple-400" />,
        tags: ['vps', 'cloud', 'ubuntu'],
        canInstall: false,
      },
      {
        id: 'source',
        titleKey: 'install.page.methods.source.title',
        descriptionKey: 'install.page.methods.source.description',
        icon: <Github className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />,
        tags: ['git', 'development'],
        canInstall: true,
        osOptions: [
          {
            id: 'cross',
            labelKey: 'install.page.os.crossPlatformGit',
            command:
              'git clone https://github.com/openclaw/openclaw.git && cd openclaw && pnpm install && pnpm build',
          },
        ],
      },
    ],
    [],
  );

  const translateMethodText = (method: InstallMethod, field: 'title' | 'description') =>
    t(field === 'title' ? method.titleKey : method.descriptionKey);

  const closeModal = () => {
    if (installStatus === 'running') {
      return;
    }

    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedMethod(null);
      setSelectedOS('');
      setInstallStatus('idle');
      setInstallOutput('');
    }, 200);
  };

  const openInstallModal = (event: React.MouseEvent, method: InstallMethod) => {
    event.stopPropagation();
    setSelectedMethod(method);
    setSelectedOS(method.osOptions?.[0]?.id ?? '');
    setInstallStatus('idle');
    setInstallOutput('');
    setIsModalOpen(true);
  };

  const handleInstall = async () => {
    if (!selectedMethod || !selectedOS) {
      return;
    }

    const osOption = selectedMethod.osOptions?.find((option) => option.id === selectedOS);
    const command = osOption?.command ?? '';
    const osLabel = osOption ? t(osOption.labelKey) : '';

    setInstallStatus('running');
    setInstallOutput(
      `${t('install.page.modal.output.preparing', { os: osLabel })}\n\n${t(
        'install.page.modal.output.executingViaTauri',
      )}\n`,
    );

    try {
      const result = await installerService.executeInstallScript(command);
      setInstallOutput((previous) => `${previous}\n${result}`);
      setInstallStatus('success');
    } catch (error: any) {
      setInstallStatus('error');
      setInstallOutput(
        (previous) =>
          `${previous}\n${t('install.page.modal.output.errorPrefix')}: ${
            error.message || String(error)
          }`,
      );
    }
  };

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto bg-zinc-50 p-6 scrollbar-hide dark:bg-zinc-950 md:p-10">
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
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
          className="mx-auto max-w-2xl text-lg leading-relaxed text-zinc-500 dark:text-zinc-400"
        >
          {t('install.page.hero.subtitle')}
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="relative mx-auto mb-12 flex max-w-4xl flex-col items-center gap-6 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl dark:bg-zinc-900/80 md:flex-row md:p-8"
      >
        <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/2 rounded-full bg-primary-500/10 blur-3xl" />
        <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 text-zinc-300">
          <Cpu className="h-7 w-7" />
        </div>
        <div className="relative z-10 flex-1 text-center md:text-left">
          <h3 className="mb-1 text-lg font-bold text-white">
            {t('install.page.systemRequirements.title')}
          </h3>
          <p className="text-sm leading-relaxed text-zinc-400">
            {t('install.page.systemRequirements.description')}
          </p>
        </div>
      </motion.div>

      <MobileAppDownloadSection />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {methods.map((method, index) => (
          <motion.div
            key={method.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
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
              {translateMethodText(method, 'title')}
            </h3>
            <p className="mb-6 flex-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {translateMethodText(method, 'description')}
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
              {method.canInstall ? (
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
              ) : (
                <div className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-100 px-4 py-3 text-sm font-bold text-zinc-400 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-500">
                  {t('install.page.method.labels.unavailable')}
                </div>
              )}

              <button
                onClick={() => navigate(`/docs#${method.id}`)}
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
              onClick={closeModal}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                    {selectedMethod.icon}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                      {t('install.page.modal.title', {
                        method: translateMethodText(selectedMethod, 'title'),
                      })}
                    </h2>
                    <p className="mt-0.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {t('install.page.modal.subtitle')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  disabled={installStatus === 'running'}
                  aria-label={t('install.page.modal.actions.close')}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6 dark:bg-zinc-950/50">
                {installStatus === 'idle' ? (
                  <div className="space-y-8">
                    <div>
                      <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                        {t('install.page.modal.selectTargetOs')}
                      </h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {selectedMethod.osOptions?.map((os) => (
                          <button
                            key={os.id}
                            onClick={() => setSelectedOS(os.id)}
                            className={`flex flex-col items-center justify-center rounded-2xl border-2 p-5 transition-all ${
                              selectedOS === os.id
                                ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-md shadow-primary-500/10 dark:bg-primary-500/10 dark:text-primary-400'
                                : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700'
                            }`}
                          >
                            <Monitor
                              className={`mb-3 h-8 w-8 ${
                                selectedOS === os.id
                                  ? 'text-primary-600 dark:text-primary-400'
                                  : 'text-zinc-400 dark:text-zinc-500'
                              }`}
                            />
                            <span className="text-center text-sm font-bold">
                              {t(os.labelKey)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-4 rounded-2xl border border-primary-100 bg-primary-50/50 p-5 dark:border-primary-500/20 dark:bg-primary-500/5">
                      <Info className="h-6 w-6 shrink-0 text-primary-500 dark:text-primary-400" />
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

                    <div className="flex h-72 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-inner">
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
                      onClick={closeModal}
                      className="rounded-xl px-6 py-3 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleInstall}
                      disabled={!selectedOS}
                      className="flex items-center gap-2 rounded-xl bg-primary-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-primary-900/20 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Play className="h-4 w-4" />
                      {t('install.page.modal.actions.startDeployment')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={closeModal}
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
