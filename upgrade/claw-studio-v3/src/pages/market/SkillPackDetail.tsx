import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Package, CheckCircle2, Circle, Cpu, AlertCircle, Loader2, Star, ShieldCheck, LayoutGrid, HardDrive, Server, Apple, Box } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import type { SkillPack, Skill } from '../../types';
import { marketService } from '../../services/marketService';
import { instanceService, Instance } from '../../services/instanceService';
import { mySkillService } from '../../services/mySkillService';
import { useTaskStore } from '../../store/useTaskStore';
import { useInstanceStore } from '../../store/useInstanceStore';

export function SkillPackDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const { activeInstanceId } = useInstanceStore();

  const { data: pack, isLoading: isLoadingPack } = useQuery<SkillPack>({
    queryKey: ['pack', id],
    queryFn: () => marketService.getPack(id!)
  });

  const { data: instances = [], isLoading: isLoadingInstances } = useQuery<Instance[]>({
    queryKey: ['instances'],
    queryFn: instanceService.getInstances
  });

  const { data: mySkills = [] } = useQuery<Skill[]>({
    queryKey: ['mySkills', activeInstanceId],
    queryFn: () => activeInstanceId ? mySkillService.getMySkills(activeInstanceId) : Promise.resolve([]),
    enabled: !!activeInstanceId
  });

  const { addTask, updateTask } = useTaskStore();

  const handleDownloadLocal = async () => {
    if (!pack) return;
    
    toast.success(`Started downloading ${pack.name}`);
    
    const taskId = addTask({
      title: `Downloading ${pack.name}`,
      subtitle: 'Fetching skill pack...',
      type: 'download'
    });

    try {
      await marketService.downloadPackLocal(pack, (progress) => {
        updateTask(taskId, { progress });
      });
      updateTask(taskId, { progress: 100, status: 'success', subtitle: 'Download complete' });
      toast.success(`${pack.name} downloaded successfully`);
    } catch (error) {
      updateTask(taskId, { status: 'error', subtitle: 'Download failed' });
      toast.error(`Failed to download ${pack.name}`);
    }
  };

  const installMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInstance || selectedSkills.size === 0) throw new Error('Invalid selection');
      return marketService.installPackWithSkills(selectedInstance, id!, Array.from(selectedSkills));
    },
    onSuccess: () => {
      toast.success('Installation Started', {
        description: `Installing ${selectedSkills.size} skills to the selected instance.`
      });
      queryClient.invalidateQueries({ queryKey: ['mySkills', activeInstanceId] });
      setTimeout(() => navigate('/instances'), 1500);
    },
    onError: (error: Error) => {
      toast.error('Installation Failed', {
        description: error.message
      });
    }
  });

  // Initialize selected skills when pack loads
  React.useEffect(() => {
    if (pack && selectedSkills.size === 0) {
      const uninstalledSkills = pack.skills.filter(s => !mySkills.some(ms => ms.id === s.id));
      setSelectedSkills(new Set(uninstalledSkills.map(s => s.id)));
    }
  }, [pack, mySkills]);

  // Initialize selected instance when instances load
  React.useEffect(() => {
    if (instances.length > 0 && !selectedInstance) {
      setSelectedInstance(instances[0].id);
    }
  }, [instances]);

  const toggleSkill = (skillId: string) => {
    const newSelected = new Set(selectedSkills);
    if (newSelected.has(skillId)) {
      newSelected.delete(skillId);
    } else {
      newSelected.add(skillId);
    }
    setSelectedSkills(newSelected);
  };

  const toggleAll = () => {
    if (!pack) return;
    const uninstalledSkills = pack.skills.filter(s => !mySkills.some(ms => ms.id === s.id));
    if (selectedSkills.size === uninstalledSkills.length) {
      setSelectedSkills(new Set());
    } else {
      setSelectedSkills(new Set(uninstalledSkills.map(s => s.id)));
    }
  };

  if (isLoadingPack || isLoadingInstances) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-8 animate-pulse">
        <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></div>
        <div className="flex gap-6">
          <div className="w-32 h-32 bg-zinc-200 dark:bg-zinc-800 rounded-3xl"></div>
          <div className="flex-1 space-y-4 pt-4">
            <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
            <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Pack not found</h2>
        <button onClick={() => navigate('/market')} className="mt-4 text-primary-500 hover:underline">Return to Market</button>
      </div>
    );
  }

  const isInstalling = installMutation.isPending;

  return (
    <div className="min-h-full bg-zinc-50/50 dark:bg-zinc-950">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Breadcrumb */}
        <button 
          onClick={() => navigate('/market')}
          className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors text-sm font-medium mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to ClawHub
        </button>

        {/* App Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 md:w-32 md:h-32 bg-primary-50 dark:bg-primary-500/10 border border-primary-100 dark:border-primary-500/20 text-primary-600 dark:text-primary-400 rounded-3xl flex items-center justify-center shadow-sm shrink-0">
              <Package className="w-12 h-12 md:w-16 md:h-16" />
            </div>
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-1 bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 rounded-md text-xs font-bold uppercase tracking-wider">
                  Skill Pack
                </span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Official
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2">{pack.name}</h1>
              <p className="text-lg text-zinc-500 dark:text-zinc-400 font-medium mb-4">{pack.author}</p>
              <div className="flex items-center gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="text-zinc-900 dark:text-zinc-100">{pack.rating.toFixed(1)}</span>
                </div>
                <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                <div className="flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                  {pack.downloads.toLocaleString()} Installs
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left Column: Content */}
          <div className="lg:col-span-2 space-y-8">
            
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">About this Pack</h2>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{pack.description}</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  Select Skills to Install
                </h2>
                <button 
                  onClick={toggleAll}
                  className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                >
                  {selectedSkills.size === (pack.skills.filter(s => !mySkills.some(ms => ms.id === s.id)).length) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {pack.skills?.map(skill => {
                  const isSelected = selectedSkills.has(skill.id);
                  const isInstalled = mySkills.some(s => s.id === skill.id);
                  return (
                    <div 
                      key={skill.id} 
                      onClick={() => !isInstalled && toggleSkill(skill.id)}
                      className={`flex items-center gap-4 p-4 rounded-2xl border transition-colors ${isInstalled ? 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 opacity-70 cursor-default' : isSelected ? 'border-primary-200 dark:border-primary-500/30 bg-primary-50/30 dark:bg-primary-500/10 cursor-pointer' : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer'}`}
                    >
                      <div className={`shrink-0 transition-colors ${isInstalled ? 'text-emerald-500' : isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-300 dark:text-zinc-600'}`}>
                        {isInstalled ? <CheckCircle2 className="w-6 h-6" /> : isSelected ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                      </div>
                      <div className="w-12 h-12 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-primary-500 dark:text-primary-400 rounded-xl flex items-center justify-center font-bold text-lg uppercase shadow-sm shrink-0">
                        {skill.name.substring(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-sm font-bold truncate ${isSelected || isInstalled ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'}`}>{skill.name}</h3>
                          {isInstalled && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Installed</span>}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{skill.category}</p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigate(`/market/${skill.id}`); }}
                        className="px-3 py-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      >
                        View
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Meta Information & Installation */}
          <div className="lg:col-span-1 space-y-8">
            
            {/* Installation Panel */}
            <div className="bg-zinc-900 dark:bg-zinc-950 rounded-3xl p-6 shadow-xl text-white sticky top-24 border border-zinc-800">
              <h3 className="font-bold text-white mb-6">Installation</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Target Instance</label>
                  <div className="space-y-2">
                    {instances.map(instance => (
                      <div 
                        key={instance.id}
                        onClick={() => setSelectedInstance(instance.id)}
                        className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
                          selectedInstance === instance.id 
                            ? 'bg-primary-500/20 border-primary-500/50 ring-1 ring-primary-500' 
                            : 'bg-zinc-800/50 dark:bg-zinc-900 border border-zinc-700 dark:border-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          selectedInstance === instance.id ? 'bg-primary-500 text-white' : 'bg-zinc-800 dark:bg-zinc-900 text-zinc-400'
                        }`}>
                          {instance.iconType === 'apple' ? <Apple className="w-5 h-5" /> : instance.iconType === 'server' ? <Server className="w-5 h-5" /> : <Box className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className={`font-bold text-sm ${selectedInstance === instance.id ? 'text-white' : 'text-zinc-300'}`}>{instance.name}</h4>
                          <p className={`text-xs ${selectedInstance === instance.id ? 'text-primary-300' : 'text-zinc-500'}`}>
                            {instance.status === 'online' ? 'Online' : 'Offline'} • {instance.ip}
                          </p>
                        </div>
                      </div>
                    ))}
                    {instances.length === 0 && (
                      <div className="p-4 text-center text-zinc-400 text-sm flex flex-col items-center gap-2 bg-zinc-800/50 dark:bg-zinc-900 rounded-xl border border-zinc-700 dark:border-zinc-800">
                        <AlertCircle className="w-6 h-6 text-amber-500" />
                        No instances available.
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800 dark:border-zinc-800/50">
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <p className="text-zinc-400 text-sm mb-1">Selected Skills</p>
                      <p className="text-3xl font-bold">{selectedSkills.size} <span className="text-lg text-zinc-500 font-normal">/ {pack.skills.filter(s => !mySkills.some(ms => ms.id === s.id)).length}</span></p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => installMutation.mutate()}
                    disabled={!selectedInstance || selectedSkills.size === 0 || isInstalling}
                    className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                      !selectedInstance || selectedSkills.size === 0 || isInstalling
                        ? 'bg-zinc-800 dark:bg-zinc-900 text-zinc-500 cursor-not-allowed'
                        : 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-600/20'
                    }`}
                  >
                    {isInstalling ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Installing...</>
                    ) : (
                      <><Download className="w-5 h-5" /> Install Pack</>
                    )}
                  </button>
                  <button
                    onClick={handleDownloadLocal}
                    className="w-full mt-3 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all bg-zinc-800 dark:bg-zinc-900 text-zinc-300 hover:bg-zinc-700 dark:hover:bg-zinc-800 border border-zinc-700 dark:border-zinc-800"
                  >
                    <HardDrive className="w-5 h-5" /> Download to Local
                  </button>
                </div>
              </div>
            </div>

            {/* Meta Info */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-6">Pack Information</h3>
              
              <div className="space-y-5">
                <div className="flex justify-between items-start">
                  <span className="text-zinc-500 dark:text-zinc-400 text-sm">Provider</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm text-right">{pack.author}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-zinc-500 dark:text-zinc-400 text-sm">Category</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm text-right">{pack.category}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-zinc-500 dark:text-zinc-400 text-sm">Total Skills</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm text-right">{pack.skills?.length || 0}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-zinc-500 dark:text-zinc-400 text-sm">Compatibility</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm text-right">Claw Studio v0.2.0+</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
