import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Apple,
  ArrowLeft,
  Box,
  CheckCircle2,
  Circle,
  Download,
  HardDrive,
  LayoutGrid,
  Loader2,
  Package,
  Server,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuthStore, useInstanceStore, useTaskStore } from '@sdkwork/claw-core';
import type { Skill, SkillPack } from '@sdkwork/claw-types';
import { instanceService, marketService, mySkillService, type Instance } from '../services';

export function SkillPackDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const { activeInstanceId } = useInstanceStore();

  const { data: pack, isLoading: isLoadingPack } = useQuery<SkillPack>({
    queryKey: ['pack', id, isAuthenticated],
    queryFn: () => marketService.getPack(id!),
    enabled: isAuthenticated && Boolean(id),
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

  const { addTask, updateTask } = useTaskStore();
  const formatInstanceStatus = (status: Instance['status']) =>
    status === 'online' ? t('market.status.online') : t('market.status.offline');
  const formatCategory = (value: string) => {
    const translationKey = `market.categoryLabels.${value}`;
    const translatedValue = t(translationKey);
    return translatedValue === translationKey ? value : translatedValue;
  };

  const handleDownloadLocal = async () => {
    if (!pack) {
      return;
    }

    toast.success(t('market.download.started', { name: pack.name }));

    const taskId = addTask({
      title: t('market.download.taskTitle', { name: pack.name }),
      subtitle: t('market.download.packSubtitle'),
      type: 'download',
    });

    try {
      await marketService.downloadPackLocal(pack, (progress) => {
        updateTask(taskId, { progress });
      });
      updateTask(taskId, {
        progress: 100,
        status: 'success',
        subtitle: t('market.download.complete'),
      });
      toast.success(t('market.download.success', { name: pack.name }));
    } catch {
      updateTask(taskId, { status: 'error', subtitle: t('market.download.failed') });
      toast.error(t('market.download.failure', { name: pack.name }));
    }
  };

  const installMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInstance || selectedSkills.size === 0) {
        throw new Error(t('market.errors.invalidSelection'));
      }

      return marketService.installPackWithSkills(selectedInstance, id!, Array.from(selectedSkills));
    },
    onSuccess: () => {
      toast.success(t('market.toast.installationStarted'), {
        description: t('market.toast.packInstallationCountDescription', {
          count: selectedSkills.size,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['mySkills', activeInstanceId] });
      setTimeout(() => navigate('/instances'), 1500);
    },
    onError: (error: Error) => {
      toast.error(t('market.toast.installationFailed'), {
        description: error.message,
      });
    },
  });

  React.useEffect(() => {
    if (pack && selectedSkills.size === 0) {
      const uninstalledSkills = pack.skills.filter(
        (skill) => !mySkills.some((installedSkill) => installedSkill.id === skill.id),
      );
      setSelectedSkills(new Set(uninstalledSkills.map((skill) => skill.id)));
    }
  }, [mySkills, pack, selectedSkills.size]);

  React.useEffect(() => {
    if (instances.length > 0 && !selectedInstance) {
      setSelectedInstance(instances[0].id);
    }
  }, [instances, selectedInstance]);

  const toggleSkill = (skillId: string) => {
    const nextSelectedSkills = new Set(selectedSkills);
    if (nextSelectedSkills.has(skillId)) {
      nextSelectedSkills.delete(skillId);
    } else {
      nextSelectedSkills.add(skillId);
    }

    setSelectedSkills(nextSelectedSkills);
  };

  const toggleAll = () => {
    if (!pack) {
      return;
    }

    const uninstalledSkills = pack.skills.filter(
      (skill) => !mySkills.some((installedSkill) => installedSkill.id === skill.id),
    );

    if (selectedSkills.size === uninstalledSkills.length) {
      setSelectedSkills(new Set());
      return;
    }

    setSelectedSkills(new Set(uninstalledSkills.map((skill) => skill.id)));
  };

  if (isLoadingPack || isLoadingInstances) {
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

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <button
          onClick={() => navigate('/market')}
          className="mb-8 flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('market.skillPackDetail.backToMarket')}
        </button>
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {t('market.empty.signInRequiredTitle')}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {t('market.empty.signInRequiredDescription')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('market.skillPackDetail.notFoundTitle')}
        </h2>
        <button
          onClick={() => navigate('/market')}
          className="mt-4 text-primary-500 hover:underline"
        >
          {t('market.skillPackDetail.returnToMarket')}
        </button>
      </div>
    );
  }

  const isInstalling = installMutation.isPending;
  const uninstalledSkillCount = pack.skills.filter(
    (skill) => !mySkills.some((installedSkill) => installedSkill.id === skill.id),
  ).length;

  return (
    <div className="min-h-full bg-zinc-50/50 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <button
          onClick={() => navigate('/market')}
          className="mb-8 flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('market.skillPackDetail.backToMarket')}
        </button>

        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div className="flex items-start gap-6">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-primary-100 bg-primary-50 text-primary-600 shadow-sm dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-400 md:h-32 md:w-32">
              <Package className="h-12 w-12 md:h-16 md:w-16" />
            </div>
            <div className="pt-2">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-md bg-primary-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-primary-700 dark:bg-primary-500/20 dark:text-primary-300">
                  {t('market.skillPackDetail.badge')}
                </span>
                <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> {t('common.official')}
                </span>
              </div>
              <h1 className="mb-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-4xl">
                {pack.name}
              </h1>
              <p className="mb-4 text-lg font-medium text-zinc-500 dark:text-zinc-400">
                {pack.author}
              </p>
              <div className="flex items-center gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {pack.rating.toFixed(1)}
                  </span>
                </div>
                <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <div className="flex items-center gap-1.5">
                  <Download className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                  {t('market.skillPackDetail.metrics.installs', {
                    count: pack.downloads,
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
              <h2 className="mb-4 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {t('market.skillPackDetail.aboutTitle')}
              </h2>
              <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
                {pack.description}
              </p>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  <LayoutGrid className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  {t('market.skillPackDetail.selectSkillsTitle')}
                </h2>
                <button
                  onClick={toggleAll}
                  className="text-sm font-medium text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  {selectedSkills.size === uninstalledSkillCount
                    ? t('market.skillPackDetail.actions.deselectAll')
                    : t('market.skillPackDetail.actions.selectAll')}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {pack.skills.map((skill) => {
                  const isSelected = selectedSkills.has(skill.id);
                  const isInstalled = mySkills.some(
                    (installedSkill) => installedSkill.id === skill.id,
                  );

                  return (
                    <div
                      key={skill.id}
                      onClick={() => !isInstalled && toggleSkill(skill.id)}
                      className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
                        isInstalled
                          ? 'cursor-default border-zinc-100 bg-zinc-50 opacity-70 dark:border-zinc-800 dark:bg-zinc-900'
                          : isSelected
                            ? 'cursor-pointer border-primary-200 bg-primary-50/30 dark:border-primary-500/30 dark:bg-primary-500/10'
                            : 'cursor-pointer border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div
                        className={`shrink-0 transition-colors ${
                          isInstalled
                            ? 'text-emerald-500'
                            : isSelected
                              ? 'text-primary-600 dark:text-primary-400'
                              : 'text-zinc-300 dark:text-zinc-600'
                        }`}
                      >
                        {isInstalled ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : isSelected ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : (
                          <Circle className="h-6 w-6" />
                        )}
                      </div>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-lg font-bold uppercase text-primary-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-primary-400">
                        {skill.name.substring(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3
                            className={`truncate text-sm font-bold ${
                              isSelected || isInstalled
                                ? 'text-zinc-900 dark:text-zinc-100'
                                : 'text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            {skill.name}
                          </h3>
                          {isInstalled && (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                              {t('market.labels.installed')}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {formatCategory(skill.category)}
                        </p>
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/market/${skill.id}`);
                        }}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                      >
                        {t('market.skillPackDetail.actions.viewSkill')}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-8 lg:col-span-1">
            <div className="sticky top-24 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-white shadow-xl dark:bg-zinc-950">
              <h3 className="mb-6 font-bold text-white">
                {t('market.skillPackDetail.installationTitle')}
              </h3>

              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-400">
                    {t('market.skillPackDetail.targetInstance')}
                  </label>
                  <div className="space-y-2">
                    {instances.map((instance) => (
                      <div
                        key={instance.id}
                        onClick={() => setSelectedInstance(instance.id)}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-all ${
                          selectedInstance === instance.id
                            ? 'bg-primary-500/20 ring-1 ring-primary-500'
                            : 'border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 dark:border-zinc-800 dark:bg-zinc-900'
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                            selectedInstance === instance.id
                              ? 'bg-primary-500 text-white'
                              : 'bg-zinc-800 text-zinc-400 dark:bg-zinc-900'
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
                              selectedInstance === instance.id ? 'text-white' : 'text-zinc-300'
                            }`}
                          >
                            {instance.name}
                          </h4>
                          <p
                            className={`text-xs ${
                              selectedInstance === instance.id
                                ? 'text-primary-300'
                                : 'text-zinc-500'
                            }`}
                          >
                            {formatInstanceStatus(instance.status)} - {instance.ip}
                          </p>
                        </div>
                      </div>
                    ))}
                    {instances.length === 0 && (
                      <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                        <AlertCircle className="h-6 w-6 text-amber-500" />
                        {t('market.modals.noInstances.title')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-4 dark:border-zinc-800/50">
                  <div className="mb-6 flex items-end justify-between">
                    <div>
                      <p className="mb-1 text-sm text-zinc-400">
                        {t('market.skillPackDetail.selectedSkills')}
                      </p>
                      <p className="text-3xl font-bold">
                        {selectedSkills.size}{' '}
                        <span className="text-lg font-normal text-zinc-500">
                          / {uninstalledSkillCount}
                        </span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => installMutation.mutate()}
                    disabled={!selectedInstance || selectedSkills.size === 0 || isInstalling}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-bold transition-all ${
                      !selectedInstance || selectedSkills.size === 0 || isInstalling
                        ? 'cursor-not-allowed bg-zinc-800 text-zinc-500 dark:bg-zinc-900'
                        : 'bg-primary-600 text-white shadow-lg shadow-primary-600/20 hover:bg-primary-500'
                    }`}
                  >
                    {isInstalling ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />{' '}
                        {t('market.modals.installPack.installing')}
                      </>
                    ) : (
                      <>
                        <Download className="h-5 w-5" /> {t('market.skillPackDetail.actions.installPack')}
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownloadLocal}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 py-3.5 font-bold text-zinc-300 transition-all hover:bg-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    <HardDrive className="h-5 w-5" /> {t('market.skillDetail.actions.downloadToLocal')}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-6 font-bold text-zinc-900 dark:text-zinc-100">
                {t('market.skillPackDetail.information.title')}
              </h3>

              <div className="space-y-5">
                <div className="flex items-start justify-between">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t('market.skillPackDetail.information.provider')}
                  </span>
                  <span className="text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {pack.author}
                  </span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t('market.skillPackDetail.information.category')}
                  </span>
                  <span className="text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {formatCategory(pack.category)}
                  </span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t('market.skillPackDetail.information.totalSkills')}
                  </span>
                  <span className="text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {pack.skills.length}
                  </span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t('market.skillPackDetail.information.compatibility')}
                  </span>
                  <span className="text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {t('market.skillPackDetail.information.compatibilityValue')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
