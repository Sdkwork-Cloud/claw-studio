import React, { startTransition, useDeferredValue, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  MessageCircle,
  Package2,
  Plus,
  Search,
  Upload,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuthStore, useInstanceStore } from '@sdkwork/claw-core';
import { Input, Modal } from '@sdkwork/claw-ui';
import type { Skill, SkillPack } from '@sdkwork/claw-types';
import {
  createMySkillsCatalog,
  createPackCatalog,
  createSkillCatalog,
} from './marketPresentation';
import {
  createMySkillsCatalogGridStyle,
  createPackCatalogGridStyle,
  createSkillCatalogGridStyle,
} from './marketLayout';
import {
  EmptyState,
  InstanceSelectionList,
  LoadingSkeleton,
  PackCard,
  PendingButtonLabel,
  SearchEmptyState,
  SectionHeader,
  SkillAvatar,
  SkillCard,
} from './marketViewComponents';
import {
  instanceService,
  marketService,
  mySkillService,
  type Instance,
  type MarketCategory,
} from '../services';

type MarketTab = 'skills' | 'packages' | 'mySkills';

const MARKET_TABS: ReadonlyArray<{ id: MarketTab; labelKey: string }> = [
  { id: 'skills', labelKey: 'market.tabs.skills' },
  { id: 'packages', labelKey: 'market.tabs.packages' },
  { id: 'mySkills', labelKey: 'market.tabs.mySkills' },
];

function areIdListsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export function Market() {
  const { t, i18n } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { activeInstanceId } = useInstanceStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createSkillTriggerRef = useRef<HTMLButtonElement | null>(null);
  const createSkillMenuRef = useRef<HTMLDivElement | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeTab, setActiveTab] = useState<MarketTab>('skills');
  const [isCreateSkillMenuOpen, setIsCreateSkillMenuOpen] = useState(false);
  const [createSkillMenuStyle, setCreateSkillMenuStyle] = useState<React.CSSProperties | null>(
    null,
  );
  const [installModalSkill, setInstallModalSkill] = useState<Skill | null>(null);
  const [installModalPack, setInstallModalPack] = useState<SkillPack | null>(null);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const formatDownloadCount = (value: number) => new Intl.NumberFormat(i18n.language).format(value);
  const formatInstanceStatus = (status: Instance['status']) =>
    status === 'online' ? t('market.status.online') : t('market.status.offline');

  const { data: marketCategories = [] } = useQuery<MarketCategory[]>({
    queryKey: ['skillCategories', isAuthenticated],
    queryFn: marketService.getCategories,
    enabled: isAuthenticated,
  });
  const selectedCategory = React.useMemo(
    () => marketCategories.find((category) => category.name === activeCategory),
    [activeCategory, marketCategories],
  );

  const { data: skills = [], isLoading: isLoadingSkills } = useQuery<Skill[]>({
    queryKey: ['skills', isAuthenticated, activeTab, deferredSearchQuery, selectedCategory?.id],
    queryFn: () =>
      marketService.getSkills({
        keyword: deferredSearchQuery || undefined,
        categoryId: selectedCategory?.id,
      }),
    enabled: isAuthenticated && activeTab === 'skills',
  });

  const { data: packs = [], isLoading: isLoadingPacks } = useQuery<SkillPack[]>({
    queryKey: ['packs', isAuthenticated, activeTab, deferredSearchQuery, selectedCategory?.id],
    queryFn: () =>
      marketService.getPacks({
        keyword: deferredSearchQuery || undefined,
        categoryId: selectedCategory?.id,
      }),
    enabled: isAuthenticated && activeTab === 'packages',
  });

  const { data: mySkills = [], isLoading: isLoadingMySkills } = useQuery<Skill[]>({
    queryKey: ['mySkills', activeInstanceId],
    queryFn: () =>
      activeInstanceId ? mySkillService.getMySkills(activeInstanceId) : Promise.resolve([]),
    enabled: !!activeInstanceId,
  });

  const { data: instances = [] } = useQuery<Instance[]>({
    queryKey: ['instances'],
    queryFn: instanceService.getInstances,
  });

  React.useEffect(() => {
    const availableIds = new Set(instances.map((instance) => instance.id));
    const preferredId =
      activeInstanceId && availableIds.has(activeInstanceId) ? activeInstanceId : instances[0]?.id;

    if (!preferredId) {
      if (selectedInstanceIds.length > 0) {
        setSelectedInstanceIds([]);
      }
      return;
    }

    const nextSelected = selectedInstanceIds.filter((id) => availableIds.has(id));
    const normalizedSelected = nextSelected.length > 0 ? nextSelected : [preferredId];

    if (!areIdListsEqual(selectedInstanceIds, normalizedSelected)) {
      setSelectedInstanceIds(normalizedSelected);
    }
  }, [activeInstanceId, instances, selectedInstanceIds]);

  const updateCreateSkillMenuPosition = React.useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const trigger = createSkillTriggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = window.innerWidth < 640 ? 12 : 16;
    const menuWidth = Math.min(
      280,
      Math.max(220, window.innerWidth - viewportPadding * 2),
    );
    const left = Math.min(
      Math.max(viewportPadding, rect.right - menuWidth),
      Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding),
    );
    const availableAbove = rect.top - viewportPadding - 12;
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding - 12;
    const placeAbove = availableBelow < 164 && availableAbove > availableBelow;
    const maxHeight = Math.max(
      132,
      Math.min(280, placeAbove ? availableAbove : availableBelow),
    );

    setCreateSkillMenuStyle({
      left: `${left}px`,
      width: `${menuWidth}px`,
      maxHeight: `${maxHeight}px`,
      ...(placeAbove
        ? { bottom: `${window.innerHeight - rect.top + 12}px` }
        : { top: `${rect.bottom + 12}px` }),
    });
  }, []);

  React.useEffect(() => {
    if (!isCreateSkillMenuOpen) {
      setCreateSkillMenuStyle(null);
      return;
    }

    updateCreateSkillMenuPosition();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (createSkillTriggerRef.current?.contains(target)) {
        return;
      }

      if (createSkillMenuRef.current?.contains(target)) {
        return;
      }

      setIsCreateSkillMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCreateSkillMenuOpen(false);
      }
    };

    window.addEventListener('resize', updateCreateSkillMenuPosition);
    window.addEventListener('scroll', updateCreateSkillMenuPosition, true);
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', updateCreateSkillMenuPosition);
      window.removeEventListener('scroll', updateCreateSkillMenuPosition, true);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCreateSkillMenuOpen, updateCreateSkillMenuPosition]);

  const installSkillMutation = useMutation({
    mutationFn: async (skill: Skill) => {
      if (selectedInstanceIds.length === 0) {
        throw new Error(t('market.errors.noInstanceSelected'));
      }

      return Promise.all(
        selectedInstanceIds.map((instanceId) => marketService.installSkill(instanceId, skill.id)),
      );
    },
    onSuccess: (_, skill) => {
      toast.success(t('market.toast.installationStarted'), {
        description: t('market.toast.installationStartedDescription', { name: skill.name }),
      });
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      queryClient.invalidateQueries({ queryKey: ['mySkills', activeInstanceId] });
      setTimeout(() => {
        setInstallModalSkill(null);
      }, 1200);
    },
    onError: (error: Error) => {
      toast.error(t('market.toast.installationFailed'), {
        description: error.message,
      });
    },
  });

  const installPackMutation = useMutation({
    mutationFn: async (pack: SkillPack) => {
      if (selectedInstanceIds.length === 0) {
        throw new Error(t('market.errors.noInstanceSelected'));
      }

      return Promise.all(
        selectedInstanceIds.map((instanceId) => marketService.installPack(instanceId, pack.id)),
      );
    },
    onSuccess: (_, pack) => {
      toast.success(t('market.toast.packInstallationStarted'), {
        description: t('market.toast.packInstallationStartedDescription', { name: pack.name }),
      });
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      queryClient.invalidateQueries({ queryKey: ['mySkills', activeInstanceId] });
      setTimeout(() => {
        setInstallModalPack(null);
      }, 1200);
    },
    onError: (error: Error) => {
      toast.error(t('market.toast.installationFailed'), {
        description: error.message,
      });
    },
  });

  const uninstallSkillMutation = useMutation({
    mutationFn: async (skillId: string) => {
      if (!activeInstanceId) {
        throw new Error(t('market.errors.noActiveInstance'));
      }

      return mySkillService.uninstallSkill(activeInstanceId, skillId);
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

  const skillCatalog = createSkillCatalog({
    skills,
    keyword: '',
    activeCategory: 'All',
  });
  const packCatalog = createPackCatalog({
    packs,
    keyword: '',
    activeCategory: 'All',
  });
  const mySkillsCatalog = createMySkillsCatalog({
    skills: mySkills,
    keyword: deferredSearchQuery,
    activeCategory,
  });
  const skillGridStyle = createSkillCatalogGridStyle(skillCatalog.skills.length);
  const packGridStyle = createPackCatalogGridStyle(packCatalog.packs.length);
  const mySkillsGridStyle = createMySkillsCatalogGridStyle(mySkillsCatalog.skills.length);
  const marketCategoryOptions = React.useMemo(() => {
    const normalized = Array.from(
      new Set(
        marketCategories
          .map((category) => category.name.trim())
          .filter((category) => Boolean(category) && category !== 'All'),
      ),
    );
    return normalized.length > 0 ? ['All', ...normalized] : [];
  }, [marketCategories]);

  const activeCategories =
    activeTab === 'packages'
      ? marketCategoryOptions.length > 0
        ? marketCategoryOptions
        : packCatalog.categories
      : activeTab === 'mySkills'
        ? mySkillsCatalog.categories
        : marketCategoryOptions.length > 0
          ? marketCategoryOptions
          : skillCatalog.categories;

  React.useEffect(() => {
    if (!activeCategories.includes(activeCategory)) {
      setActiveCategory('All');
    }
  }, [activeCategories, activeCategory]);

  const activeInstance = instances.find((instance) => instance.id === activeInstanceId) ?? null;
  const isLoading =
    (activeTab === 'skills' && isLoadingSkills) ||
    (activeTab === 'packages' && isLoadingPacks) ||
    (activeTab === 'mySkills' && !!activeInstanceId && isLoadingMySkills);
  const showCatalogAuthState =
    !isAuthenticated && (activeTab === 'skills' || activeTab === 'packages');
  const searchPlaceholder =
    activeTab === 'packages'
      ? t('market.search.placeholders.packages')
      : activeTab === 'mySkills'
        ? t('market.search.placeholders.mySkills')
        : t('market.search.placeholders.skills');

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <div className="flex w-full flex-col gap-6 px-4 pb-14 pt-4 sm:px-5 md:pb-16 lg:px-6 lg:pt-6 xl:px-8 2xl:px-10">
        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:px-5 xl:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {MARKET_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    startTransition(() => {
                      setActiveTab(tab.id);
                    });
                  }}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${
                    activeTab === tab.id
                      ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-200'
                      : 'border-transparent bg-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900'
                  }`}
                >
                  {t(tab.labelKey)}
                </button>
              ))}
            </div>

            <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row xl:items-center xl:justify-end">
              <div
                className="relative w-full xl:flex-none"
                style={{ maxWidth: 'clamp(18rem, 26vw, 32rem)' }}
              >
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  type="text"
                  value={searchQuery}
                  placeholder={searchPlaceholder}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-11 rounded-xl border-zinc-200 bg-zinc-50 pl-11 pr-4 text-sm shadow-none focus-visible:border-primary-300 focus-visible:bg-white focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-visible:border-primary-500/30"
                />
              </div>

              <button
                ref={createSkillTriggerRef}
                type="button"
                onClick={() => setIsCreateSkillMenuOpen((open) => !open)}
                className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-primary-600 bg-primary-600 px-4 text-sm font-medium text-white dark:border-primary-500 dark:bg-primary-500 xl:w-auto"
              >
                <Plus className="h-4 w-4" />
                {t('market.actions.publishSkill')}
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            {activeCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setActiveCategory(category);
                  });
                }}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${
                  activeCategory === category
                    ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-200'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900'
                }`}
              >
                {t(`market.categoryLabels.${category}`, { defaultValue: category })}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5 xl:p-6 2xl:p-7">
          {isLoading ? (
            <LoadingSkeleton />
          ) : activeTab === 'skills' ? (
            <section className="space-y-5">
              <SectionHeader
                title={t('market.tabs.skills')}
                description={t('market.sections.allSkillsDescription')}
                count={skillCatalog.skills.length}
              />

              {showCatalogAuthState ? (
                <EmptyState
                  icon={<AlertCircle className="h-6 w-6" />}
                  title={t('market.empty.signInRequiredTitle')}
                  description={t('market.empty.signInRequiredDescription')}
                />
              ) : skillCatalog.skills.length > 0 ? (
                <div className="grid items-stretch gap-4" style={skillGridStyle}>
                  {skillCatalog.skills.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      actionLabel={t('common.add')}
                      actionTone="primary"
                      officialLabel={t('market.labels.sdkworkOfficial')}
                      versionLabel={t('market.labels.version', {
                        value: skill.version || '1.0.0',
                      })}
                      formatDownloadCount={formatDownloadCount}
                      onOpen={() => navigate(`/market/${skill.id}`)}
                      onAction={() => setInstallModalSkill(skill)}
                    />
                  ))}
                </div>
              ) : (
                <SearchEmptyState
                  title={t('market.empty.skillsTitle')}
                  description={t('market.empty.skillsDescription')}
                />
              )}
            </section>
          ) : activeTab === 'packages' ? (
            <section className="space-y-5">
              <SectionHeader
                title={t('market.tabs.packages')}
                description={t('market.sections.skillPacksDescription')}
                count={packCatalog.packs.length}
              />

              {showCatalogAuthState ? (
                <EmptyState
                  icon={<AlertCircle className="h-6 w-6" />}
                  title={t('market.empty.signInRequiredTitle')}
                  description={t('market.empty.signInRequiredDescription')}
                />
              ) : packCatalog.packs.length > 0 ? (
                <div className="grid items-stretch gap-4" style={packGridStyle}>
                  {packCatalog.packs.map((pack) => (
                    <PackCard
                      key={pack.id}
                      pack={pack}
                      badge={t('market.skillPackDetail.badge')}
                      actionLabel={t('market.actions.installPack')}
                      skillsLabel={t('market.labels.packSkillCount', { count: pack.skills.length })}
                      formatDownloadCount={formatDownloadCount}
                      onOpen={() => navigate(`/market/packs/${pack.id}`)}
                      onAction={() => setInstallModalPack(pack)}
                    />
                  ))}
                </div>
              ) : (
                <SearchEmptyState
                  title={t('market.empty.packagesTitle')}
                  description={t('market.empty.packagesDescription')}
                />
              )}
            </section>
          ) : (
            <section className="space-y-5">
              <SectionHeader
                title={t('market.tabs.mySkills')}
                description={
                  activeInstance
                    ? t('market.sections.installedSkillsDescription', { name: activeInstance.name })
                    : t('market.empty.noActiveInstanceDescription')
                }
                count={mySkillsCatalog.skills.length}
              />

              {activeInstance ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-200">
                  <CheckCircle2 className="h-4 w-4 text-primary-600 dark:text-primary-300" />
                  {t('market.labels.activeInstance', { name: activeInstance.name })}
                </div>
              ) : null}

              {!activeInstance ? (
                <EmptyState
                  icon={<AlertCircle className="h-6 w-6" />}
                  title={t('market.empty.noActiveInstanceTitle')}
                  description={t('market.empty.noActiveInstanceDescription')}
                />
              ) : mySkillsCatalog.skills.length > 0 ? (
                <div className="grid items-stretch gap-4" style={mySkillsGridStyle}>
                  {mySkillsCatalog.skills.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      statusLabel={t('market.labels.installed')}
                      actionLabel={t('market.actions.uninstall')}
                      actionTone="danger"
                      officialLabel={t('market.labels.sdkworkOfficial')}
                      versionLabel={t('market.labels.version', {
                        value: skill.version || '1.0.0',
                      })}
                      formatDownloadCount={formatDownloadCount}
                      onOpen={() => navigate(`/market/${skill.id}`)}
                      onAction={() => {
                        if (confirm(t('market.actions.confirmUninstallSkill'))) {
                          uninstallSkillMutation.mutate(skill.id);
                        }
                      }}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Package2 className="h-6 w-6" />}
                  title={t('market.empty.installedTitle')}
                  description={t('market.empty.installedDescription')}
                />
              )}
            </section>
          )}
        </div>
      </div>

      {isCreateSkillMenuOpen && createSkillMenuStyle && typeof document !== 'undefined'
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[90]" />
              <div
                ref={createSkillMenuRef}
                style={createSkillMenuStyle}
                className="fixed z-[100] overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex max-h-[inherit] flex-col gap-1 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateSkillMenuOpen(false);
                      navigate('/chat');
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    <MessageCircle className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                    {t('market.actions.createSkillWithChat')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateSkillMenuOpen(false);
                      navigate('/claw-upload');
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    <Upload className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                    {t('market.actions.uploadLocalSkill')}
                  </button>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}

      <Modal
        isOpen={!!installModalSkill}
        onClose={() => setInstallModalSkill(null)}
        title={t('market.modals.installSkill.title')}
      >
        {installModalSkill ? (
          <div className="space-y-6">
            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-4">
                <SkillAvatar skill={installModalSkill} />
                <div>
                  <h4 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                    {installModalSkill.name}
                  </h4>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {installModalSkill.description}
                  </p>
                </div>
              </div>
            </div>

            {instances.length === 0 ? (
              <EmptyState
                icon={<AlertCircle className="h-6 w-6" />}
                title={t('market.modals.noInstances.title')}
                description={t('market.modals.noInstances.description')}
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {t('market.modals.selectTargetInstances')}
                  </label>
                  <InstanceSelectionList
                    instances={instances}
                    selectedInstanceIds={selectedInstanceIds}
                    setSelectedInstanceIds={setSelectedInstanceIds}
                    formatInstanceStatus={formatInstanceStatus}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => installSkillMutation.mutate(installModalSkill)}
                  disabled={installSkillMutation.isPending || selectedInstanceIds.length === 0}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary-600 bg-primary-600 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-primary-500 dark:bg-primary-500"
                >
                  <PendingButtonLabel
                    pending={installSkillMutation.isPending}
                    label={
                      installSkillMutation.isPending
                        ? t('market.modals.installSkill.installing')
                        : t('market.modals.installSkill.confirm')
                    }
                  />
                </button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={!!installModalPack}
        onClose={() => setInstallModalPack(null)}
        title={t('market.modals.installPack.title')}
      >
        {installModalPack ? (
          <div className="space-y-6">
            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
                  <Package2 className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                    {installModalPack.name}
                  </h4>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {installModalPack.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h5 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t('market.modals.installPack.includedSkills')}
              </h5>
              <div className="flex flex-wrap gap-2">
                {installModalPack.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>

            {instances.length === 0 ? (
              <EmptyState
                icon={<AlertCircle className="h-6 w-6" />}
                title={t('market.modals.noInstances.title')}
                description={t('market.modals.noInstances.description')}
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {t('market.modals.selectTargetInstances')}
                  </label>
                  <InstanceSelectionList
                    instances={instances}
                    selectedInstanceIds={selectedInstanceIds}
                    setSelectedInstanceIds={setSelectedInstanceIds}
                    formatInstanceStatus={formatInstanceStatus}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => installPackMutation.mutate(installModalPack)}
                  disabled={installPackMutation.isPending || selectedInstanceIds.length === 0}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary-600 bg-primary-600 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-primary-500 dark:bg-primary-500"
                >
                  <PendingButtonLabel
                    pending={installPackMutation.isPending}
                    label={
                      installPackMutation.isPending
                        ? t('market.modals.installPack.installing')
                        : t('market.modals.installPack.confirm')
                    }
                  />
                </button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
