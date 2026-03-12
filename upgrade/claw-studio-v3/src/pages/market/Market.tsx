import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Search, Star, ShieldCheck, Zap, Code, LayoutGrid, Terminal, Cpu, Sparkles, Package, ChevronRight, Loader2, AlertCircle, CheckCircle2, Layers, Server, Apple, Box } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Fuse from 'fuse.js';
import { motion } from 'motion/react';
import { Modal } from '../../components/Modal';
import type { Skill, SkillPack } from '../../types';
import { marketService } from '../../services/marketService';
import { instanceService, Instance } from '../../services/instanceService';
import { mySkillService } from '../../services/mySkillService';
import { useInstanceStore } from '../../store/useInstanceStore';

export function Market() {
  const { activeInstanceId } = useInstanceStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeMarketTab, setActiveMarketTab] = useState<'skills' | 'packages' | 'myskills'>('packages');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [installModalSkill, setInstallModalSkill] = useState<Skill | null>(null);
  const [installModalPack, setInstallModalPack] = useState<SkillPack | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');

  const { data: skills = [], isLoading: isLoadingSkills } = useQuery<Skill[]>({
    queryKey: ['skills'],
    queryFn: marketService.getSkills
  });

  const { data: packs = [], isLoading: isLoadingPacks } = useQuery<SkillPack[]>({
    queryKey: ['packs'],
    queryFn: marketService.getPacks
  });

  const { data: mySkills = [], isLoading: isLoadingMySkills } = useQuery<Skill[]>({
    queryKey: ['mySkills', activeInstanceId],
    queryFn: () => activeInstanceId ? mySkillService.getMySkills(activeInstanceId) : Promise.resolve([]),
    enabled: !!activeInstanceId
  });

  const { data: instances = [] } = useQuery<Instance[]>({
    queryKey: ['instances'],
    queryFn: instanceService.getInstances
  });

  React.useEffect(() => {
    if (instances.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(instances[0].id);
    }
  }, [instances]);

  const installSkillMutation = useMutation({
    mutationFn: async (skill: Skill) => {
      if (!selectedInstanceId) throw new Error('No instance selected');
      return marketService.installSkill(selectedInstanceId, skill.id);
    },
    onSuccess: (_, skill) => {
      toast.success('Installation Started', {
        description: `Installing ${skill.name} to the selected instance.`
      });
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      queryClient.invalidateQueries({ queryKey: ['mySkills', activeInstanceId] });
      setTimeout(() => {
        setInstallModalSkill(null);
      }, 1500);
    },
    onError: (error: Error) => {
      toast.error('Installation Failed', {
        description: error.message
      });
    }
  });

  const installPackMutation = useMutation({
    mutationFn: async (pack: SkillPack) => {
      if (!selectedInstanceId) throw new Error('No instance selected');
      return marketService.installPack(selectedInstanceId, pack.id);
    },
    onSuccess: (_, pack) => {
      toast.success('Pack Installation Started', {
        description: `Installing ${pack.name} bundle to the selected instance.`
      });
      queryClient.invalidateQueries({ queryKey: ['mySkills', activeInstanceId] });
      setTimeout(() => {
        setInstallModalPack(null);
      }, 1500);
    },
    onError: (error: Error) => {
      toast.error('Installation Failed', {
        description: error.message
      });
    }
  });

  const uninstallSkillMutation = useMutation({
    mutationFn: async (skillId: string) => {
      if (!activeInstanceId) throw new Error('No active instance');
      return mySkillService.uninstallSkill(activeInstanceId, skillId);
    },
    onSuccess: () => {
      toast.success('Skill Uninstalled');
      queryClient.invalidateQueries({ queryKey: ['mySkills', activeInstanceId] });
    },
    onError: (error: Error) => {
      toast.error('Uninstall Failed', {
        description: error.message
      });
    }
  });

  const handleGetSkillClick = (e: React.MouseEvent, skill: Skill) => {
    e.stopPropagation();
    setInstallModalSkill(skill);
  };

  const handleGetPackClick = (e: React.MouseEvent, pack: SkillPack) => {
    e.stopPropagation();
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

  // Advanced Fuzzy Search using Fuse.js
  const fuseSkills = useMemo(() => new Fuse(skills, {
    keys: ['name', 'description', 'author', 'category'],
    threshold: 0.3,
  }), [skills]);

  const fusePacks = useMemo(() => new Fuse(packs, {
    keys: ['name', 'description', 'author', 'category'],
    threshold: 0.3,
  }), [packs]);

  const fuseMySkills = useMemo(() => new Fuse(mySkills, {
    keys: ['name', 'description', 'author', 'category'],
    threshold: 0.3,
  }), [mySkills]);

  const searchResults = useMemo(() => {
    if (!searchQuery) return { skills, packs, mySkills };
    return {
      skills: fuseSkills.search(searchQuery).map(r => r.item),
      packs: fusePacks.search(searchQuery).map(r => r.item),
      mySkills: fuseMySkills.search(searchQuery).map(r => r.item)
    };
  }, [searchQuery, skills, packs, mySkills, fuseSkills, fusePacks, fuseMySkills]);

  const filteredSkills = searchResults.skills.filter(s => activeCategory === 'All' || s.category === activeCategory);
  const filteredPacks = searchResults.packs.filter(p => activeCategory === 'All' || p.category === activeCategory);
  const filteredMySkills = searchResults.mySkills.filter(s => activeCategory === 'All' || s.category === activeCategory);

  const featuredSkill = skills.find(s => s.rating >= 4.8) || skills[0];
  const topSkills = [...skills].sort((a, b) => b.downloads - a.downloads).slice(0, 6);
  const isSearching = searchQuery.length > 0 || activeCategory !== 'All';

  return (
    <div className="h-full bg-zinc-50 dark:bg-zinc-950 overflow-y-auto scrollbar-hide">
      {/* Sticky Header with Search and Tabs */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">ClawHub</h1>
            
            {/* Market Tabs */}
            <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl w-fit border border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setActiveMarketTab('packages')}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeMarketTab === 'packages'
                    ? 'bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-400 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Package className="w-4 h-4" />
                Starter Packs
              </button>
              <button
                onClick={() => setActiveMarketTab('skills')}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeMarketTab === 'skills'
                    ? 'bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-400 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Layers className="w-4 h-4" />
                Individual Skills
              </button>
              <button
                onClick={() => setActiveMarketTab('myskills')}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeMarketTab === 'myskills'
                    ? 'bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-400 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Box className="w-4 h-4" />
                My Skills
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-primary-500 transition-colors" />
            <input 
              type="text" 
              placeholder={`Search ${activeMarketTab === 'packages' ? 'Starter Packs, environments...' : 'skills, authors, categories...'}`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-zinc-100/50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 dark:focus:border-primary-500 focus:bg-white dark:focus:bg-zinc-900 transition-all text-base font-medium placeholder:text-zinc-500 shadow-sm text-zinc-900 dark:text-zinc-100"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1">
              <kbd className="px-2 py-1 bg-zinc-200/50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md text-xs font-mono text-zinc-500 dark:text-zinc-400">⌘</kbd>
              <kbd className="px-2 py-1 bg-zinc-200/50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md text-xs font-mono text-zinc-500 dark:text-zinc-400">K</kbd>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-12">
        
        {/* Categories */}
        <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-300 ${
                activeCategory === cat.name 
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-md scale-105' 
                  : 'bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:shadow-sm'
              }`}
            >
              {cat.icon}
              {cat.name}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-12 animate-pulse">
            <div className="w-full h-64 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-[2rem]"></div>
            <div>
              <div className="h-8 w-48 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-lg mb-6"></div>
              <div className="flex gap-6 overflow-hidden">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="shrink-0 w-[300px]">
                    <div className="w-full aspect-video bg-zinc-200/50 dark:bg-zinc-800/50 rounded-2xl mb-4"></div>
                    <div className="flex gap-3">
                      <div className="w-12 h-12 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-xl shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-zinc-200/50 dark:bg-zinc-800/50 rounded w-3/4"></div>
                        <div className="h-3 bg-zinc-200/50 dark:bg-zinc-800/50 rounded w-1/2"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Packages Market */}
            {activeMarketTab === 'packages' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
                {!isSearching && (
                  <div className="relative rounded-[2rem] overflow-hidden bg-zinc-900 group cursor-pointer" onClick={() => navigate(`/market/packs/${packs[0]?.id}`)}>
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent z-10"></div>
                    <img src="https://picsum.photos/seed/ai-store/1920/600" alt="Featured Pack" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" referrerPolicy="no-referrer" />
                    <div className="relative z-20 p-10 md:p-16 h-full flex flex-col justify-center max-w-2xl">
                      <div className="flex items-center gap-3 mb-6">
                        <span className="px-3 py-1 bg-primary-500 text-white text-xs font-bold uppercase tracking-wider rounded-full">Featured Bundle</span>
                        <span className="flex items-center gap-1 text-zinc-300 text-sm font-medium">
                          <Zap className="w-4 h-4 text-amber-400" />
                          Essential Setup
                        </span>
                      </div>
                      <h2 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight leading-tight">
                        {packs[0]?.name || 'Starter Pack'}
                      </h2>
                      <p className="text-zinc-300 text-lg md:text-xl leading-relaxed mb-8 line-clamp-2">
                        {packs[0]?.description || 'Download pre-configured bundles of essential skills to instantly initialize your OpenClaw environment.'}
                      </p>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={(e) => { e.stopPropagation(); if(packs[0]) handleGetPackClick(e, packs[0]); }}
                          className="bg-white text-black px-8 py-4 rounded-full font-bold hover:bg-zinc-200 transition-colors shadow-xl"
                        >
                          Get Bundle
                        </button>
                        <span className="text-zinc-400 text-sm font-medium">Free • {packs[0]?.downloads.toLocaleString() || 0} installs</span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Trending Bundles</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPacks.map(pack => (
                      <div 
                        key={pack.id} 
                        onClick={() => navigate(`/market/packs/${pack.id}`)}
                        className="group bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-[1.5rem] p-6 hover:shadow-xl hover:shadow-primary-500/5 hover:border-primary-300 dark:hover:border-primary-500/50 transition-all duration-300 cursor-pointer flex flex-col h-full relative overflow-hidden"
                      >
                        <div className="flex items-start gap-4 mb-5">
                          <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-[1.25rem] flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform duration-300">
                            <Package className="w-8 h-8" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors tracking-tight">{pack.name}</h3>
                            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{pack.author}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="flex items-center gap-1 text-xs text-amber-500 font-bold"><Star className="w-3.5 h-3.5 fill-amber-500" />{pack.rating.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 flex-1 line-clamp-2 leading-relaxed">{pack.description}</p>
                        <div className="flex items-center justify-between pt-5 border-t border-zinc-100 dark:border-zinc-800 mt-auto">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md tracking-wide">{pack.downloads.toLocaleString()} installs</span>
                          <button 
                            onClick={(e) => handleGetPackClick(e, pack)}
                            className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-primary-500 hover:text-white dark:hover:bg-primary-500 dark:hover:text-white px-6 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm"
                          >
                            Get
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredPacks.length === 0 && (
                      <div className="col-span-full py-24 flex flex-col items-center justify-center text-center">
                        <Package className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">No packages found</h3>
                        <p className="text-zinc-500 dark:text-zinc-400">Try adjusting your search terms or filters.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Individual Skills Market */}
            {activeMarketTab === 'skills' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
                {!isSearching && featuredSkill && (
                  <div 
                    onClick={() => navigate(`/market/${featuredSkill.id}`)}
                    className="relative w-full bg-zinc-950 rounded-[2rem] overflow-hidden cursor-pointer group shadow-2xl"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-600/30 to-transparent mix-blend-overlay"></div>
                    <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary-500/10 to-transparent"></div>
                    
                    <div className="relative p-8 md:p-14 flex flex-col md:flex-row items-center gap-8 md:gap-16">
                      <div className="w-32 h-32 md:w-40 md:h-40 bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] flex items-center justify-center text-primary-400 text-5xl md:text-6xl font-bold uppercase shadow-2xl shrink-0 group-hover:scale-105 transition-transform duration-500">
                        {featuredSkill.name.substring(0, 2)}
                      </div>
                      <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                          <span className="px-3 py-1 bg-primary-500 text-white text-xs font-bold uppercase tracking-wider rounded-full">Editor's Choice</span>
                          <span className="flex items-center gap-1 text-zinc-300 text-sm font-medium">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            Official
                          </span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">{featuredSkill.name}</h2>
                        <p className="text-zinc-400 text-lg md:text-xl max-w-2xl leading-relaxed mb-8 line-clamp-2">
                          {featuredSkill.description}
                        </p>
                        <div className="flex items-center justify-center md:justify-start gap-6 text-sm text-zinc-300">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleGetSkillClick(e, featuredSkill); }}
                            className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-zinc-200 transition-colors shadow-xl"
                          >
                            Get
                          </button>
                          <span className="flex items-center gap-1.5"><Star className="w-5 h-5 text-amber-400 fill-amber-400" /> {featuredSkill.rating.toFixed(1)}</span>
                          <span className="flex items-center gap-1.5"><Download className="w-5 h-5 text-zinc-400" /> {featuredSkill.downloads.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Top Free Skills</h2>
                    <button className="text-primary-500 font-semibold text-sm hover:text-primary-600 flex items-center gap-1">
                      See All <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredSkills.map(skill => (
                      <div key={skill.id} onClick={() => navigate(`/market/${skill.id}`)} className="group bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-[1.5rem] p-6 hover:shadow-xl hover:border-primary-500/30 dark:hover:border-primary-500/50 transition-all duration-300 cursor-pointer flex flex-col h-full">
                        <div className="flex items-start gap-4 mb-5">
                          <div className="w-14 h-14 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-primary-500 dark:text-primary-400 rounded-[1.25rem] flex items-center justify-center font-bold text-xl uppercase shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300">{skill.name.substring(0, 2)}</div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors tracking-tight">{skill.name}</h3>
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{skill.author}</p>
                          </div>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 flex-1 line-clamp-2 leading-relaxed">{skill.description}</p>
                        <div className="flex items-center justify-between pt-5 border-t border-zinc-100 dark:border-zinc-800 mt-auto">
                          <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-bold tracking-wide"><Download className="w-4 h-4" />{skill.downloads.toLocaleString()}</span>
                          <button 
                            onClick={(e) => handleGetSkillClick(e, skill)}
                            className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-primary-500 hover:text-white dark:hover:bg-primary-500 dark:hover:text-white px-6 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
                          >
                            GET
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredSkills.length === 0 && (
                      <div className="col-span-full py-24 flex flex-col items-center justify-center text-center">
                        <Layers className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">No skills found</h3>
                        <p className="text-zinc-500 dark:text-zinc-400">Try adjusting your search terms or filters.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* My Skills Market */}
            {activeMarketTab === 'myskills' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">My Installed Skills</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredMySkills.map(skill => (
                      <div key={skill.id} onClick={() => navigate(`/market/${skill.id}`)} className="group bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-[1.5rem] p-6 hover:shadow-xl hover:border-primary-500/30 dark:hover:border-primary-500/50 transition-all duration-300 cursor-pointer flex flex-col h-full">
                        <div className="flex items-start gap-4 mb-5">
                          <div className="w-14 h-14 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-primary-500 dark:text-primary-400 rounded-[1.25rem] flex items-center justify-center font-bold text-xl uppercase shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300">{skill.name.substring(0, 2)}</div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors tracking-tight">{skill.name}</h3>
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{skill.author}</p>
                          </div>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 flex-1 line-clamp-2 leading-relaxed">{skill.description}</p>
                        <div className="flex items-center justify-between pt-5 border-t border-zinc-100 dark:border-zinc-800 mt-auto">
                          <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-bold tracking-wide"><CheckCircle2 className="w-4 h-4 text-emerald-500" />Installed</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Are you sure you want to uninstall this skill?')) {
                                uninstallSkillMutation.mutate(skill.id);
                              }
                            }}
                            disabled={uninstallSkillMutation.isPending}
                            className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 px-6 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-sm"
                          >
                            Uninstall
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredMySkills.length === 0 && (
                      <div className="col-span-full py-24 flex flex-col items-center justify-center text-center">
                        <Box className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">No installed skills found</h3>
                        <p className="text-zinc-500 dark:text-zinc-400">You haven't installed any skills yet, or none match your search.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}

      </div>

      {/* Install Skill Modal */}
      <Modal 
        isOpen={!!installModalSkill} 
        onClose={() => setInstallModalSkill(null)}
        title="Install Skill"
      >
        {installModalSkill && (
          <div className="space-y-6">
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 flex gap-4 items-center">
              <div className="w-12 h-12 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-primary-500 dark:text-primary-400 rounded-xl flex items-center justify-center font-bold text-xl uppercase shrink-0 shadow-sm">
                {installModalSkill.name.substring(0, 2)}
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">{installModalSkill.name}</h4>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">v{installModalSkill.version}</p>
              </div>
            </div>

            {instances.length === 0 ? (
              <div className="text-center p-5 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-500 rounded-2xl border border-amber-200 dark:border-amber-500/20">
                <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-bold">No instances available</p>
                <p className="text-xs mt-1 opacity-80">Please create an instance first.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">Select Target Instance</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {instances.map(instance => (
                      <div 
                        key={instance.id}
                        onClick={() => setSelectedInstanceId(instance.id)}
                        className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all border ${
                          selectedInstanceId === instance.id 
                            ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-500 ring-1 ring-primary-500' 
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          selectedInstanceId === instance.id ? 'bg-primary-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                        }`}>
                          {instance.iconType === 'apple' ? <Apple className="w-5 h-5" /> : instance.iconType === 'server' ? <Server className="w-5 h-5" /> : <Box className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className={`font-bold text-sm ${selectedInstanceId === instance.id ? 'text-primary-900 dark:text-primary-100' : 'text-zinc-900 dark:text-zinc-100'}`}>{instance.name}</h4>
                          <p className={`text-xs ${selectedInstanceId === instance.id ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            {instance.status === 'online' ? 'Online' : 'Offline'} • {instance.ip}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => installSkillMutation.mutate(installModalSkill)}
                  disabled={installSkillMutation.isPending || !selectedInstanceId}
                  className="w-full bg-primary-500 text-white py-3.5 rounded-xl font-bold hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-md shadow-primary-500/20 flex items-center justify-center gap-2"
                >
                  {installSkillMutation.isPending ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Installing...</>
                  ) : (
                    'Confirm Installation'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Install Pack Modal */}
      <Modal 
        isOpen={!!installModalPack} 
        onClose={() => setInstallModalPack(null)}
        title="Install Skill Package"
      >
        {installModalPack && (
          <div className="space-y-6">
            <div className="bg-primary-50 dark:bg-primary-500/10 rounded-2xl p-4 border border-primary-100 dark:border-primary-500/20 flex gap-4 items-center">
              <div className="w-12 h-12 bg-white dark:bg-zinc-800 border border-primary-200 dark:border-primary-500/30 text-primary-600 dark:text-primary-400 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">{installModalPack.name}</h4>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Bundle Installation</p>
              </div>
            </div>
            
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
              <h5 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">Included Skills</h5>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <span key={i} className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Skill {i}
                  </span>
                ))}
                <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  + more
                </span>
              </div>
            </div>

            {instances.length === 0 ? (
              <div className="text-center p-5 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-500 rounded-2xl border border-amber-200 dark:border-amber-500/20">
                <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-bold">No instances available</p>
                <p className="text-xs mt-1 opacity-80">Please create an instance first.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">Select Target Instance</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {instances.map(instance => (
                      <div 
                        key={instance.id}
                        onClick={() => setSelectedInstanceId(instance.id)}
                        className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all border ${
                          selectedInstanceId === instance.id 
                            ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-500 ring-1 ring-primary-500' 
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          selectedInstanceId === instance.id ? 'bg-primary-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                        }`}>
                          {instance.iconType === 'apple' ? <Apple className="w-5 h-5" /> : instance.iconType === 'server' ? <Server className="w-5 h-5" /> : <Box className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className={`font-bold text-sm ${selectedInstanceId === instance.id ? 'text-primary-900 dark:text-primary-100' : 'text-zinc-900 dark:text-zinc-100'}`}>{instance.name}</h4>
                          <p className={`text-xs ${selectedInstanceId === instance.id ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            {instance.status === 'online' ? 'Online' : 'Offline'} • {instance.ip}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => installPackMutation.mutate(installModalPack)}
                  disabled={installPackMutation.isPending || !selectedInstanceId}
                  className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-md shadow-primary-500/20 flex items-center justify-center gap-2"
                >
                  {installPackMutation.isPending ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Installing Package...</>
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
