import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Apple,
  ArrowLeft,
  Box,
  Download,
  FileText,
  Github,
  Globe,
  HardDrive,
  Info,
  Loader2,
  MessageSquare,
  Server,
  Share,
  ShieldCheck,
  Star,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useInstanceStore, useTaskStore } from '@sdkwork/claw-core';
import { Modal } from '@sdkwork/claw-ui';
import type { Review, Skill } from '@sdkwork/claw-types';
import { instanceService, marketService, mySkillService, type Instance } from '../services';

export function SkillDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'readme' | 'reviews'>('readme');
  const [selectedRepo, setSelectedRepo] = useState<'official' | 'tencent' | 'custom'>(
    'official',
  );
  const { activeInstanceId } = useInstanceStore();

  const { data: skill, isLoading: isLoadingSkill } = useQuery<Skill>({
    queryKey: ['skill', id],
    queryFn: () => marketService.getSkill(id!),
  });

  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: ['reviews', id],
    queryFn: () => marketService.getSkillReviews(id!),
  });

  const { data: instances = [], isLoading: isLoadingInstances } = useQuery<Instance[]>({
    queryKey: ['instances'],
    queryFn: instanceService.getInstances,
  });

  const { data: mySkills = [] } = useQuery<Skill[]>({
    queryKey: ['mySkills', activeInstanceId],
    queryFn: () =>
      activeInstanceId ? mySkillService.getMySkills(activeInstanceId) : Promise.resolve([]),
    enabled: !!activeInstanceId,
  });

  const isInstalled = mySkills.some((item) => item.id === id);

  const { addTask, updateTask } = useTaskStore();
  const formatDateLabel = (value: string) =>
    new Intl.DateTimeFormat(i18n.language).format(new Date(value));
  const formatInstanceStatus = (status: Instance['status']) =>
    status === 'online' ? t('market.status.online') : t('market.status.offline');
  const formatCategory = (value: string) => {
    const translationKey = `market.categoryLabels.${value}`;
    const translatedValue = t(translationKey);
    return translatedValue === translationKey ? value : translatedValue;
  };

  const handleDownloadLocal = async () => {
    if (!skill) {
      return;
    }

    toast.success(t('market.download.started', { name: skill.name }));

    const taskId = addTask({
      title: t('market.download.taskTitle', { name: skill.name }),
      subtitle: t('market.download.skillSubtitle'),
      type: 'download',
    });

    try {
      await marketService.downloadSkillLocal(skill, (progress) => {
        updateTask(taskId, { progress });
      });
      updateTask(taskId, {
        progress: 100,
        status: 'success',
        subtitle: t('market.download.complete'),
      });
      toast.success(t('market.download.success', { name: skill.name }));
    } catch {
      updateTask(taskId, { status: 'error', subtitle: t('market.download.failed') });
      toast.error(t('market.download.failure', { name: skill.name }));
    }
  };

  const installMutation = useMutation({
    mutationFn: async () => {
      if (!skill || selectedInstanceIds.length === 0) {
        throw new Error(t('market.errors.invalidSelection'));
      }

      return Promise.all(
        selectedInstanceIds.map((instanceId) => marketService.installSkill(instanceId, skill.id)),
      );
    },
    onSuccess: () => {
      toast.success(t('market.toast.installationStarted'), {
        description: t('market.toast.installationStartedDescription', { name: skill?.name }),
      });
      queryClient.invalidateQueries({ queryKey: ['skill', id] });
      queryClient.invalidateQueries({ queryKey: ['mySkills', activeInstanceId] });
      setTimeout(() => {
        setIsInstallModalOpen(false);
      }, 1500);
    },
    onError: (error: Error) => {
      toast.error(t('market.toast.installationFailed'), {
        description: error.message,
      });
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: async () => {
      if (!skill || !activeInstanceId) {
        throw new Error(t('market.errors.invalidSelection'));
      }

      return mySkillService.uninstallSkill(activeInstanceId, skill.id);
    },
    onSuccess: () => {
      toast.success(t('market.toast.skillUninstalled'));
      queryClient.invalidateQueries({ queryKey: ['mySkills', activeInstanceId] });
    },
    onError: (error: Error) => {
      toast.error(t('market.toast.uninstallFailed'), {
        description: error.message,
      });
    },
  });

  React.useEffect(() => {
    if (instances.length > 0 && selectedInstanceIds.length === 0) {
      setSelectedInstanceIds([instances[0].id]);
    }
  }, [instances, selectedInstanceIds.length]);

  if (isLoadingSkill || isLoadingInstances) {
    return (
      <div className="mx-auto max-w-6xl space-y-8 p-8 animate-pulse">
        <div className="h-8 w-24 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex gap-6">
          <div className="h-32 w-32 rounded-3xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex-1 space-y-4 pt-4">
            <div className="h-10 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-6 w-1/4 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('market.skillDetail.notFoundTitle')}
        </h2>
        <button
          onClick={() => navigate('/market')}
          className="mt-4 text-primary-500 hover:underline"
        >
          {t('market.skillDetail.returnToMarket')}
        </button>
      </div>
    );
  }

  const isInstalling = installMutation.isPending;

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <button
        onClick={() => navigate('/market')}
        className="mb-8 flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('market.skillDetail.backToMarket')}
      </button>

      <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-start">
        <div className="flex items-start gap-6">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-zinc-200 bg-white text-4xl font-bold uppercase text-primary-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-primary-400 md:h-32 md:w-32 md:text-5xl">
            {skill.name.substring(0, 2)}
          </div>
          <div className="pt-2">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {formatCategory(skill.category)}
              </span>
              <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" /> {t('common.official')}
              </span>
            </div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-4xl">
              {skill.name}
            </h1>
            <p className="mb-4 text-lg font-medium text-zinc-500 dark:text-zinc-400">
              {skill.author}
            </p>
            <div className="flex items-center gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                <span className="text-zinc-900 dark:text-zinc-100">
                  {skill.rating.toFixed(1)}
                </span>
                <span className="font-normal text-zinc-400 dark:text-zinc-500">
                  {t('market.skillDetail.metrics.ratings', { count: reviews.length })}
                </span>
              </div>
              <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <div className="flex items-center gap-1.5">
                <Download className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                {t('market.skillDetail.metrics.installs', {
                  count: skill.downloads,
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-row items-center gap-3 pt-2 md:flex-col md:items-end">
          {isInstalled ? (
            <button
              onClick={() => {
                if (confirm(t('market.actions.confirmUninstallSkill'))) {
                  uninstallMutation.mutate();
                }
              }}
              disabled={uninstallMutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-50 px-8 py-3.5 text-base font-bold text-red-600 shadow-sm transition-all hover:bg-red-100 disabled:opacity-50 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 md:flex-none"
            >
              {uninstallMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              {t('market.actions.uninstall')}
            </button>
          ) : (
            <button
              onClick={() => setIsInstallModalOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary-500 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-primary-500/20 transition-all hover:bg-primary-600 active:scale-95 md:flex-none"
            >
              <Download className="h-5 w-5" />
              {t('market.skillDetail.actions.getSkill')}
            </button>
          )}
          <button
            onClick={handleDownloadLocal}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 md:w-auto md:px-4 md:py-2"
          >
            <HardDrive className="h-4 w-4" />
            <span className="hidden md:inline">{t('market.skillDetail.actions.downloadToLocal')}</span>
          </button>
          <button className="flex h-12 w-12 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 md:h-auto md:w-auto md:px-4 md:py-2">
            <Share className="h-4 w-4" />
            <span className="hidden md:inline">{t('market.skillDetail.actions.share')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-950 shadow-md dark:border-zinc-800">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 font-mono text-sm text-zinc-500">
                <Info className="h-4 w-4" /> {t('market.skillDetail.mediaPreviewUnavailable')}
              </div>
            </div>
          </div>

          <div className="border-b border-zinc-200 dark:border-zinc-800">
            <nav className="flex gap-8">
              <button
                onClick={() => setActiveTab('readme')}
                className={`relative pb-4 text-sm font-bold transition-colors ${
                  activeTab === 'readme'
                    ? 'text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                {t('market.skillDetail.tabs.overview')}
                {activeTab === 'readme' && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-zinc-900 dark:bg-zinc-100" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`relative pb-4 text-sm font-bold transition-colors ${
                  activeTab === 'reviews'
                    ? 'text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                {t('market.skillDetail.tabs.reviews')}
                {activeTab === 'reviews' && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-zinc-900 dark:bg-zinc-100" />
                )}
              </button>
            </nav>
          </div>

          <div className="min-h-[400px]">
            {activeTab === 'readme' && (
              <div className="prose prose-zinc prose-primary max-w-none prose-headings:font-bold prose-h2:text-2xl prose-h3:text-xl prose-p:leading-relaxed prose-p:text-zinc-600 dark:prose-invert dark:prose-p:text-zinc-400">
                <Markdown>{skill.readme || skill.description}</Markdown>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-6">
                {reviews.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/50 py-16 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                    <MessageSquare className="mx-auto mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {t('market.skillDetail.noReviewsTitle')}
                    </p>
                    <p className="mt-1 text-sm">{t('market.skillDetail.noReviewsDescription')}</p>
                  </div>
                ) : (
                  reviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {review.user_name.substring(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                              {review.user_name}
                            </p>
                            <p className="text-xs font-medium text-zinc-400">
                              {formatDateLabel(review.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, index) => (
                            <Star
                              key={index}
                              className={`h-4 w-4 ${
                                index < review.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'fill-zinc-100 text-zinc-200 dark:fill-zinc-800 dark:text-zinc-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {review.comment}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
                <Server className="h-4 w-4 text-primary-500" />
                {t('market.skillDetail.repository.title')}
              </h3>
              <span className="rounded-md bg-primary-50 px-2 py-1 text-xs font-medium text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                {t('market.skillDetail.repository.badge')}
              </span>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t('market.skillDetail.repository.description')}
            </p>
            <div className="space-y-3">
              <label
                onClick={() => setSelectedRepo('official')}
                className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-3 transition-all ${
                  selectedRepo === 'official'
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-500/5'
                    : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-4 w-4 rounded-full border-2 ${
                      selectedRepo === 'official'
                        ? 'border-[4px] border-primary-500 bg-white'
                        : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {t('market.skillDetail.repository.options.official.title')}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t('market.skillDetail.repository.options.official.description')}
                    </p>
                  </div>
                </div>
                {selectedRepo === 'official' && <ShieldCheck className="h-4 w-4 text-primary-500" />}
              </label>

              <label
                onClick={() => setSelectedRepo('tencent')}
                className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-3 transition-all ${
                  selectedRepo === 'tencent'
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-500/5'
                    : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-4 w-4 rounded-full border-2 ${
                      selectedRepo === 'tencent'
                        ? 'border-[4px] border-primary-500 bg-white'
                        : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {t('market.skillDetail.repository.options.tencent.title')}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t('market.skillDetail.repository.options.tencent.description')}
                    </p>
                  </div>
                </div>
                {selectedRepo === 'tencent' && <ShieldCheck className="h-4 w-4 text-primary-500" />}
              </label>

              <label
                onClick={() => setSelectedRepo('custom')}
                className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-3 transition-all ${
                  selectedRepo === 'custom'
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-500/5'
                    : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-4 w-4 rounded-full border-2 ${
                      selectedRepo === 'custom'
                        ? 'border-[4px] border-primary-500 bg-white'
                        : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {t('market.skillDetail.repository.options.custom.title')}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t('market.skillDetail.repository.options.custom.description')}
                    </p>
                  </div>
                </div>
                {selectedRepo === 'custom' && <ShieldCheck className="h-4 w-4 text-primary-500" />}
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-6 font-bold text-zinc-900 dark:text-zinc-100">
              {t('market.skillDetail.information.title')}
            </h3>

            <div className="space-y-5">
              <div className="flex items-start justify-between">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t('market.skillDetail.information.provider')}
                </span>
                <span className="text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {skill.author}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t('market.skillDetail.information.version')}
                </span>
                <span className="text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {skill.version}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t('market.skillDetail.information.size')}
                </span>
                <span className="text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {skill.size}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t('market.skillDetail.information.category')}
                </span>
                <span className="text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {formatCategory(skill.category)}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t('market.skillDetail.information.compatibility')}
                </span>
                <span className="text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t('market.skillDetail.information.compatibilityValue')}
                </span>
              </div>
            </div>

            <div className="mt-8 space-y-4 border-t border-zinc-100 pt-6 dark:border-zinc-800">
              <a
                href="#"
                className="flex items-center justify-between text-sm font-medium text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                <span className="flex items-center gap-2">
                  <Globe className="h-4 w-4" /> {t('market.skillDetail.links.developerWebsite')}
                </span>
                <ArrowLeft className="h-4 w-4 rotate-135" />
              </a>
              <a
                href="#"
                className="flex items-center justify-between text-sm font-medium text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                <span className="flex items-center gap-2">
                  <Github className="h-4 w-4" /> {t('market.skillDetail.links.sourceCode')}
                </span>
                <ArrowLeft className="h-4 w-4 rotate-135" />
              </a>
              <a
                href="#"
                className="flex items-center justify-between text-sm font-medium text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" /> {t('market.skillDetail.links.privacyPolicy')}
                </span>
                <ArrowLeft className="h-4 w-4 rotate-135" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        title={t('market.modals.installSkill.title')}
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-xl font-bold uppercase text-primary-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-primary-400">
              {skill.name.substring(0, 2)}
            </div>
            <div>
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100">{skill.name}</h4>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                {t('market.labels.version', { value: skill.version })}
              </p>
            </div>
          </div>

          {instances.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-500">
              <AlertCircle className="mx-auto mb-2 h-6 w-6 opacity-80" />
              <p className="text-sm font-bold">{t('market.modals.noInstances.title')}</p>
              <p className="mt-1 text-xs opacity-80">
                {t('market.modals.noInstances.description')}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {t('market.modals.selectTargetInstances')}
                </label>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                  {instances.map((instance) => {
                    const isSelected = selectedInstanceIds.includes(instance.id);
                    return (
                      <div
                        key={instance.id}
                        onClick={() => {
                          setSelectedInstanceIds((previous) =>
                            previous.includes(instance.id)
                              ? previous.filter((currentId) => currentId !== instance.id)
                              : [...previous, instance.id],
                          );
                        }}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500 dark:border-primary-500 dark:bg-primary-500/10'
                            : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-primary-500 text-white'
                              : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}
                        >
                          {instance.iconType === 'apple' ? (
                            <Apple className="h-5 w-5" />
                          ) : instance.iconType === 'server' ? (
                            <Server className="h-5 w-5" />
                          ) : (
                            <Box className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <h4
                            className={`text-sm font-bold ${
                              isSelected
                                ? 'text-primary-900 dark:text-primary-100'
                                : 'text-zinc-900 dark:text-zinc-100'
                            }`}
                          >
                            {instance.name}
                          </h4>
                          <p
                            className={`text-xs ${
                              isSelected
                                ? 'text-primary-600 dark:text-primary-400'
                                : 'text-zinc-500 dark:text-zinc-400'
                            }`}
                          >
                            {formatInstanceStatus(instance.status)} - {instance.ip}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => installMutation.mutate()}
                disabled={isInstalling || selectedInstanceIds.length === 0}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 py-3.5 font-bold text-white shadow-md shadow-primary-500/20 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />{' '}
                    {t('market.modals.installSkill.installing')}
                  </>
                ) : (
                  t('market.modals.installSkill.confirm')
                )}
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
