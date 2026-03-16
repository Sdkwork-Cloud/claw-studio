import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Apple,
  Box,
  CheckCircle2,
  ChevronRight,
  Code,
  Cpu,
  Download,
  Layers,
  LayoutGrid,
  Loader2,
  Package,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Star,
  Terminal,
  Zap,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Fuse from 'fuse.js';
import { motion } from 'motion/react';
import { useInstanceStore } from '@sdkwork/claw-core';
import { Modal } from '@sdkwork/claw-ui';
import type { Skill, SkillPack } from '@sdkwork/claw-types';
import { instanceService, marketService, mySkillService, type Instance } from '../services';

export function Market() {
  const { activeInstanceId } = useInstanceStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeMarketTab, setActiveMarketTab] = useState<
    'skills' | 'packages' | 'myskills' | 'sdkwork'
  >('packages');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [installModalSkill, setInstallModalSkill] = useState<Skill | null>(null);
  const [installModalPack, setInstallModalPack] = useState<SkillPack | null>(null);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);

  const { data: skills = [], isLoading: isLoadingSkills } = useQuery<Skill[]>({
    queryKey: ['skills'],
    queryFn: marketService.getSkills,
  });

  const { data: packs = [], isLoading: isLoadingPacks } = useQuery<SkillPack[]>({
    queryKey: ['packs'],
    queryFn: marketService.getPacks,
  });

  const { data: mySkills = [] } = useQuery<Skill[]>({
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
    if (instances.length > 0 && selectedInstanceIds.length === 0) {
      setSelectedInstanceIds([instances[0].id]);
    }
  }, [instances, selectedInstanceIds.length]);

  const installSkillMutation = useMutation({
    mutationFn: async (skill: Skill) => {
      if (selectedInstanceIds.length === 0) {
        throw new Error('No instance selected');
      }

      return Promise.all(
        selectedInstanceIds.map((instanceId) => marketService.installSkill(instanceId, skill.id)),
      );
    },
    onSuccess: (_, skill) => {
      toast.success('Installation Started', {
        description: `Installing ${skill.name} to the selected instances.`,
      });
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      queryClient.invalidateQueries({ queryKey: ['mySkills', activeInstanceId] });
      setTimeout(() => {
        setInstallModalSkill(null);
      }, 1500);
    },
    onError: (error: Error) => {
      toast.error('Installation Failed', {
        description: error.message,
      });
    },
  });

  const installPackMutation = useMutation({
    mutationFn: async (pack: SkillPack) => {
      if (selectedInstanceIds.length === 0) {
        throw new Error('No instance selected');
      }

      return Promise.all(
        selectedInstanceIds.map((instanceId) => marketService.installPack(instanceId, pack.id)),
      );
    },
    onSuccess: (_, pack) => {
      toast.success('Pack Installation Started', {
        description: `Installing ${pack.name} bundle to the selected instances.`,
      });
      queryClient.invalidateQueries({ queryKey: ['mySkills', activeInstanceId] });
      setTimeout(() => {
        setInstallModalPack(null);
      }, 1500);
    },
    onError: (error: Error) => {
      toast.error('Installation Failed', {
        description: error.message,
      });
    },
  });

  const uninstallSkillMutation = useMutation({
    mutationFn: async (skillId: string) => {
      if (!activeInstanceId) {
        throw new Error('No active instance');
      }

      return mySkillService.uninstallSkill(activeInstanceId, skillId);
    },
    onSuccess: () => {
      toast.success('Skill Uninstalled');
      queryClient.invalidateQueries({ queryKey: ['mySkills', activeInstanceId] });
    },
    onError: (error: Error) => {
      toast.error('Uninstall Failed', {
        description: error.message,
      });
    },
  });

  const handleGetSkillClick = (event: React.MouseEvent, skill: Skill) => {
    event.stopPropagation();
    setInstallModalSkill(skill);
  };

  const handleGetPackClick = (event: React.MouseEvent, pack: SkillPack) => {
    event.stopPropagation();
    setInstallModalPack(pack);
  };

  const isLoading = isLoadingSkills || isLoadingPacks;

  const categories = [
    { name: 'All', icon: <LayoutGrid className="w-4 h-4" /> },
    { name: 'Productivity', icon: <Zap className="w-4 h-4" /> },
    { name: 'Development', icon: <Code className="w-4 h-4" /> },
    { name: 'System', icon: <Terminal className="w-4 h-4" /> },
    { name: 'AI Models', icon: <Cpu className="w-4 h-4" /> },
    { name: 'Utilities', icon: <Sparkles className="w-4 h-4" /> },
  ];

  const fuseSkills = useMemo(
    () =>
      new Fuse(skills, {
        keys: ['name', 'description', 'author', 'category'],
        threshold: 0.3,
      }),
    [skills],
  );

  const fusePacks = useMemo(
    () =>
      new Fuse(packs, {
        keys: ['name', 'description', 'author', 'category'],
        threshold: 0.3,
      }),
    [packs],
  );

  const fuseMySkills = useMemo(
    () =>
      new Fuse(mySkills, {
        keys: ['name', 'description', 'author', 'category'],
        threshold: 0.3,
      }),
    [mySkills],
  );

  const searchResults = useMemo(() => {
    if (!searchQuery) {
      return { skills, packs, mySkills };
    }

    return {
      skills: fuseSkills.search(searchQuery).map((result) => result.item),
      packs: fusePacks.search(searchQuery).map((result) => result.item),
      mySkills: fuseMySkills.search(searchQuery).map((result) => result.item),
    };
  }, [fuseMySkills, fusePacks, fuseSkills, mySkills, packs, searchQuery, skills]);

  const filteredSkills = searchResults.skills.filter(
    (skill) => activeCategory === 'All' || skill.category === activeCategory,
  );
  const filteredPacks = searchResults.packs.filter(
    (pack) => activeCategory === 'All' || pack.category === activeCategory,
  );
  const filteredMySkills = searchResults.mySkills.filter(
    (skill) => activeCategory === 'All' || skill.category === activeCategory,
  );

  const featuredSkill = skills.find((skill) => skill.rating >= 4.8) || skills[0];
  const isSearching = searchQuery.length > 0 || activeCategory !== 'All';

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 scrollbar-hide dark:bg-zinc-950">
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              ClawHub
            </h1>

            <div className="flex w-fit items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
              <button
                onClick={() => setActiveMarketTab('packages')}
                className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold transition-all ${
                  activeMarketTab === 'packages'
                    ? 'border border-zinc-200/50 bg-white text-primary-600 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-800 dark:text-primary-400'
                    : 'text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100'
                }`}
              >
                <Package className="w-4 h-4" />
                Starter Packs
              </button>
              <button
                onClick={() => setActiveMarketTab('skills')}
                className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold transition-all ${
                  activeMarketTab === 'skills'
                    ? 'border border-zinc-200/50 bg-white text-primary-600 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-800 dark:text-primary-400'
                    : 'text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100'
                }`}
              >
                <Layers className="w-4 h-4" />
                Individual Skills
              </button>
              <button
                onClick={() => setActiveMarketTab('myskills')}
                className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold transition-all ${
                  activeMarketTab === 'myskills'
                    ? 'border border-zinc-200/50 bg-white text-primary-600 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-800 dark:text-primary-400'
                    : 'text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100'
                }`}
              >
                <Box className="w-4 h-4" />
                My Skills
              </button>
              <button
                onClick={() => setActiveMarketTab('sdkwork')}
                className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold transition-all ${
                  activeMarketTab === 'sdkwork'
                    ? 'border border-zinc-200/50 bg-white text-primary-600 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-800 dark:text-primary-400'
                    : 'text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                SDKWork Skills
              </button>
            </div>
          </div>

          <div className="group relative w-full">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-primary-500" />
            <input
              type="text"
              placeholder={`Search ${
                activeMarketTab === 'packages'
                  ? 'Starter Packs, environments...'
                  : 'skills, authors, categories...'
              }`}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-100/50 py-3 pl-12 pr-4 text-base font-medium text-zinc-900 shadow-sm transition-all placeholder:text-zinc-500 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-primary-500 dark:focus:bg-zinc-900"
            />
            <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 items-center gap-1 md:flex">
              <kbd className="rounded-md border border-zinc-300 bg-zinc-200/50 px-2 py-1 text-xs font-mono text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                ⌘
              </kbd>
              <kbd className="rounded-md border border-zinc-300 bg-zinc-200/50 px-2 py-1 text-xs font-mono text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                K
              </kbd>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-12 p-6 md:p-8">
        <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-hide">
          {categories.map((category) => (
            <button
              key={category.name}
              onClick={() => setActiveCategory(category.name)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-300 ${
                activeCategory === category.name
                  ? 'scale-105 bg-zinc-900 text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border border-zinc-200/80 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800'
              }`}
            >
              {category.icon}
              {category.name}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-12 animate-pulse">
            <div className="h-64 w-full rounded-[2rem] bg-zinc-200/50 dark:bg-zinc-800/50" />
            <div>
              <div className="mb-6 h-8 w-48 rounded-lg bg-zinc-200/50 dark:bg-zinc-800/50" />
              <div className="flex gap-6 overflow-hidden">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="w-[300px] shrink-0">
                    <div className="mb-4 aspect-video w-full rounded-2xl bg-zinc-200/50 dark:bg-zinc-800/50" />
                    <div className="flex gap-3">
                      <div className="h-12 w-12 shrink-0 rounded-xl bg-zinc-200/50 dark:bg-zinc-800/50" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 rounded bg-zinc-200/50 dark:bg-zinc-800/50" />
                        <div className="h-3 w-1/2 rounded bg-zinc-200/50 dark:bg-zinc-800/50" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {activeMarketTab === 'packages' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-12"
              >
                {!isSearching && (
                  <div
                    className="group relative cursor-pointer overflow-hidden rounded-[2rem] bg-zinc-900"
                    onClick={() => navigate(`/market/packs/${packs[0]?.id}`)}
                  >
                    <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
                    <img
                      src="https://picsum.photos/seed/ai-store/1920/600"
                      alt="Featured Pack"
                      className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="relative z-20 flex h-full max-w-2xl flex-col justify-center p-10 md:p-16">
                      <div className="mb-6 flex items-center gap-3">
                        <span className="rounded-full bg-primary-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                          Featured Bundle
                        </span>
                        <span className="flex items-center gap-1 text-sm font-medium text-zinc-300">
                          <Zap className="h-4 w-4 text-amber-400" />
                          Essential Setup
                        </span>
                      </div>
                      <h2 className="mb-4 text-4xl font-black leading-tight tracking-tight text-white md:text-6xl">
                        {packs[0]?.name || 'Starter Pack'}
                      </h2>
                      <p className="mb-8 line-clamp-2 text-lg leading-relaxed text-zinc-300 md:text-xl">
                        {packs[0]?.description ||
                          'Download pre-configured bundles of essential skills to instantly initialize your OpenClaw environment.'}
                      </p>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            if (packs[0]) {
                              handleGetPackClick(event, packs[0]);
                            }
                          }}
                          className="rounded-full bg-white px-8 py-4 font-bold text-black shadow-xl transition-colors hover:bg-zinc-200"
                        >
                          Get Bundle
                        </button>
                        <span className="text-sm font-medium text-zinc-400">
                          Free • {packs[0]?.downloads.toLocaleString() || 0} installs
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                      Trending Bundles
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredPacks.map((pack) => (
                      <div
                        key={pack.id}
                        onClick={() => navigate(`/market/packs/${pack.id}`)}
                        className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-white p-6 transition-all duration-300 hover:border-primary-300 hover:shadow-xl hover:shadow-primary-500/5 dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:border-primary-500/50"
                      >
                        <div className="mb-5 flex items-start gap-4">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.25rem] border border-zinc-100 bg-zinc-50 text-zinc-600 shadow-sm transition-transform duration-300 group-hover:scale-105 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                            <Package className="h-8 w-8" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-lg font-bold tracking-tight text-zinc-900 transition-colors group-hover:text-primary-600 dark:text-zinc-100 dark:group-hover:text-primary-400">
                              {pack.name}
                            </h3>
                            <p className="mt-0.5 truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">
                              {pack.author}
                            </p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="flex items-center gap-1 text-xs font-bold text-amber-500">
                                <Star className="h-3.5 w-3.5 fill-amber-500" />
                                {pack.rating.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="mb-6 line-clamp-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                          {pack.description}
                        </p>
                        <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-5 dark:border-zinc-800">
                          <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-bold tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            {pack.downloads.toLocaleString()} installs
                          </span>
                          <button
                            onClick={(event) => handleGetPackClick(event, pack)}
                            className="rounded-xl bg-zinc-100 px-6 py-2 text-sm font-bold text-zinc-900 shadow-sm transition-colors hover:bg-primary-500 hover:text-white dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-primary-500 dark:hover:text-white"
                          >
                            Get
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredPacks.length === 0 && (
                      <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
                        <Package className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
                        <h3 className="mb-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                          No packages found
                        </h3>
                        <p className="text-zinc-500 dark:text-zinc-400">
                          Try adjusting your search terms or filters.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeMarketTab === 'skills' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-12"
              >
                {!isSearching && featuredSkill && (
                  <div
                    onClick={() => navigate(`/market/${featuredSkill.id}`)}
                    className="group relative w-full cursor-pointer overflow-hidden rounded-[2rem] bg-zinc-950 shadow-2xl"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-600/30 to-transparent mix-blend-overlay" />
                    <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-primary-500/10 to-transparent" />

                    <div className="relative flex flex-col items-center gap-8 p-8 md:flex-row md:gap-16 md:p-14">
                      <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-[2rem] border border-white/20 bg-white/10 text-5xl font-bold uppercase text-primary-400 shadow-2xl backdrop-blur-xl transition-transform duration-500 group-hover:scale-105 md:h-40 md:w-40 md:text-6xl">
                        {featuredSkill.name.substring(0, 2)}
                      </div>
                      <div className="flex-1 text-center md:text-left">
                        <div className="mb-4 flex items-center justify-center gap-3 md:justify-start">
                          <span className="rounded-full bg-primary-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                            Editor&apos;s Choice
                          </span>
                          <span className="flex items-center gap-1 text-sm font-medium text-zinc-300">
                            <ShieldCheck className="h-4 w-4 text-emerald-400" />
                            Official
                          </span>
                        </div>
                        <h2 className="mb-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
                          {featuredSkill.name}
                        </h2>
                        <p className="mb-8 max-w-2xl line-clamp-2 text-lg leading-relaxed text-zinc-400 md:text-xl">
                          {featuredSkill.description}
                        </p>
                        <div className="flex items-center justify-center gap-6 text-sm text-zinc-300 md:justify-start">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleGetSkillClick(event, featuredSkill);
                            }}
                            className="rounded-full bg-white px-8 py-3 font-bold text-black shadow-xl transition-colors hover:bg-zinc-200"
                          >
                            Get
                          </button>
                          <span className="flex items-center gap-1.5">
                            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                            {featuredSkill.rating.toFixed(1)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Download className="h-5 w-5 text-zinc-400" />
                            {featuredSkill.downloads.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                      Top Free Skills
                    </h2>
                    <button className="flex items-center gap-1 text-sm font-semibold text-primary-500 hover:text-primary-600">
                      See All <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredSkills.map((skill) => (
                      <div
                        key={skill.id}
                        onClick={() => navigate(`/market/${skill.id}`)}
                        className="group flex h-full cursor-pointer flex-col rounded-[1.5rem] border border-zinc-200/80 bg-white p-6 transition-all duration-300 hover:border-primary-500/30 hover:shadow-xl dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:border-primary-500/50"
                      >
                        <div className="mb-5 flex items-start gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] border border-zinc-100 bg-zinc-50 text-xl font-bold uppercase text-primary-500 shadow-sm transition-transform duration-300 group-hover:scale-105 dark:border-zinc-700 dark:bg-zinc-800 dark:text-primary-400">
                            {skill.name.substring(0, 2)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-base font-bold tracking-tight text-zinc-900 transition-colors group-hover:text-primary-600 dark:text-zinc-100 dark:group-hover:text-primary-400">
                              {skill.name}
                            </h3>
                            <p className="mt-0.5 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                              {skill.author}
                            </p>
                          </div>
                        </div>
                        <p className="mb-6 line-clamp-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                          {skill.description}
                        </p>
                        <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-5 dark:border-zinc-800">
                          <span className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-zinc-500 dark:text-zinc-400">
                            <Download className="h-4 w-4" />
                            {skill.downloads.toLocaleString()}
                          </span>
                          <button
                            onClick={(event) => handleGetSkillClick(event, skill)}
                            className="rounded-xl bg-zinc-100 px-6 py-2 text-xs font-bold text-zinc-900 shadow-sm transition-colors hover:bg-primary-500 hover:text-white dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-primary-500 dark:hover:text-white"
                          >
                            GET
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredSkills.length === 0 && (
                      <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
                        <Layers className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
                        <h3 className="mb-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                          No skills found
                        </h3>
                        <p className="text-zinc-500 dark:text-zinc-400">
                          Try adjusting your search terms or filters.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeMarketTab === 'myskills' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-12"
              >
                <div>
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                      My Installed Skills
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredMySkills.map((skill) => (
                      <div
                        key={skill.id}
                        onClick={() => navigate(`/market/${skill.id}`)}
                        className="group flex h-full cursor-pointer flex-col rounded-[1.5rem] border border-zinc-200/80 bg-white p-6 transition-all duration-300 hover:border-primary-500/30 hover:shadow-xl dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:border-primary-500/50"
                      >
                        <div className="mb-5 flex items-start gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] border border-zinc-100 bg-zinc-50 text-xl font-bold uppercase text-primary-500 shadow-sm transition-transform duration-300 group-hover:scale-105 dark:border-zinc-700 dark:bg-zinc-800 dark:text-primary-400">
                            {skill.name.substring(0, 2)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-base font-bold tracking-tight text-zinc-900 transition-colors group-hover:text-primary-600 dark:text-zinc-100 dark:group-hover:text-primary-400">
                              {skill.name}
                            </h3>
                            <p className="mt-0.5 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                              {skill.author}
                            </p>
                          </div>
                        </div>
                        <p className="mb-6 line-clamp-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                          {skill.description}
                        </p>
                        <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-5 dark:border-zinc-800">
                          <span className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-zinc-500 dark:text-zinc-400">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            Installed
                          </span>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              if (confirm('Are you sure you want to uninstall this skill?')) {
                                uninstallSkillMutation.mutate(skill.id);
                              }
                            }}
                            disabled={uninstallSkillMutation.isPending}
                            className="rounded-xl bg-red-50 px-6 py-2 text-xs font-bold text-red-600 shadow-sm transition-colors hover:bg-red-100 disabled:opacity-50 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                          >
                            Uninstall
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredMySkills.length === 0 && (
                      <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
                        <Box className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
                        <h3 className="mb-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                          No installed skills found
                        </h3>
                        <p className="text-zinc-500 dark:text-zinc-400">
                          You haven&apos;t installed any skills yet, or none match your search.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeMarketTab === 'sdkwork' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-12"
              >
                <div>
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                      <Sparkles className="h-6 w-6 text-primary-500" />
                      SDKWork Official Skills
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredSkills.map((skill) => (
                      <div
                        key={skill.id}
                        onClick={() => navigate(`/market/${skill.id}`)}
                        className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-white p-6 transition-all duration-300 hover:border-primary-500/30 hover:shadow-xl dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:border-primary-500/50"
                      >
                        <div className="absolute right-0 top-0 -z-10 h-24 w-24 rounded-bl-full bg-gradient-to-br from-primary-500/10 to-transparent" />
                        <div className="mb-5 flex items-start gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-primary-500 to-primary-700 text-xl font-bold uppercase text-white shadow-md transition-transform duration-300 group-hover:scale-105">
                            {skill.name.substring(0, 2)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-base font-bold tracking-tight text-zinc-900 transition-colors group-hover:text-primary-600 dark:text-zinc-100 dark:group-hover:text-primary-400">
                              {skill.name}
                            </h3>
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-primary-600 dark:text-primary-400">
                              <ShieldCheck className="h-3 w-3" /> SDKWork Official
                            </p>
                          </div>
                        </div>
                        <p className="mb-6 line-clamp-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                          {skill.description}
                        </p>
                        <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-5 dark:border-zinc-800">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-zinc-500 dark:text-zinc-400">
                              <Download className="h-4 w-4" />
                              {skill.downloads.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-amber-500">
                              <Star className="h-4 w-4 fill-current" />
                              {skill.rating}
                            </span>
                          </div>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setInstallModalSkill(skill);
                            }}
                            className="rounded-xl bg-zinc-900 px-6 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-primary-600 dark:bg-white dark:text-zinc-900 dark:hover:bg-primary-500"
                          >
                            Install
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>

      <Modal isOpen={!!installModalSkill} onClose={() => setInstallModalSkill(null)} title="Install Skill">
        {installModalSkill && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-xl font-bold uppercase text-primary-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-primary-400">
                {installModalSkill.name.substring(0, 2)}
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">
                  {installModalSkill.name}
                </h4>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  v{installModalSkill.version}
                </p>
              </div>
            </div>

            {instances.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-500">
                <AlertCircle className="mx-auto mb-2 h-6 w-6 opacity-80" />
                <p className="text-sm font-bold">No instances available</p>
                <p className="mt-1 text-xs opacity-80">Please create an instance first.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Select Target Instances
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
                              {instance.status === 'online' ? 'Online' : 'Offline'} • {instance.ip}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={() => installSkillMutation.mutate(installModalSkill)}
                  disabled={installSkillMutation.isPending || selectedInstanceIds.length === 0}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 py-3.5 font-bold text-white shadow-md shadow-primary-500/20 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {installSkillMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Installing...
                    </>
                  ) : (
                    'Confirm Installation'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!installModalPack}
        onClose={() => setInstallModalPack(null)}
        title="Install Skill Package"
      >
        {installModalPack && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 rounded-2xl border border-primary-100 bg-primary-50 p-4 dark:border-primary-500/20 dark:bg-primary-500/10">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary-200 bg-white text-primary-600 shadow-sm dark:border-primary-500/30 dark:bg-zinc-800 dark:text-primary-400">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">
                  {installModalPack.name}
                </h4>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  Bundle Installation
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Included Skills
              </h5>
              <div className="flex flex-wrap gap-2">
                {installModalPack.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>

            {instances.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-500">
                <AlertCircle className="mx-auto mb-2 h-6 w-6 opacity-80" />
                <p className="text-sm font-bold">No instances available</p>
                <p className="mt-1 text-xs opacity-80">Please create an instance first.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Select Target Instances
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
                              {instance.status === 'online' ? 'Online' : 'Offline'} • {instance.ip}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={() => installPackMutation.mutate(installModalPack)}
                  disabled={installPackMutation.isPending || selectedInstanceIds.length === 0}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3.5 font-bold text-white shadow-md shadow-primary-500/20 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {installPackMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Installing Package...
                    </>
                  ) : (
                    'Install Package Bundle'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
