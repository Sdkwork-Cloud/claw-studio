import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Star, ShieldCheck, Clock, HardDrive, AlertCircle, CheckCircle2, MessageSquare, FileText, Share, Globe, Github, Info, Loader2, Server, Apple, Box } from 'lucide-react';
import Markdown from 'react-markdown';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '@sdkwork/claw-studio-shared-ui';
import type { Skill, Review } from '@sdkwork/claw-studio-domain';
import { marketService } from '../../services/marketService';
import { instanceService, Instance } from '../../services/instanceService';
import { useTaskStore } from '@sdkwork/claw-studio-business/stores/useTaskStore';

export function SkillDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'readme' | 'reviews'>('readme');

  const { data: skill, isLoading: isLoadingSkill } = useQuery<Skill>({
    queryKey: ['skill', id],
    queryFn: () => marketService.getSkill(id!)
  });

  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: ['reviews', id],
    queryFn: () => marketService.getSkillReviews(id!)
  });

  const { data: instances = [], isLoading: isLoadingInstances } = useQuery<Instance[]>({
    queryKey: ['instances'],
    queryFn: instanceService.getInstances
  });

  const { addTask, updateTask } = useTaskStore();

  const handleDownloadLocal = () => {
    if (!skill) return;
    
    toast.success(`Started downloading ${skill.name}`);
    
    const taskId = addTask({
      title: `Downloading ${skill.name}`,
      subtitle: 'Fetching skill package...',
      type: 'download'
    });

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        clearInterval(interval);
        updateTask(taskId, { progress: 100, status: 'success', subtitle: 'Download complete' });
        toast.success(`${skill.name} downloaded successfully`);
        
        // Simulate actual file download trigger
        const blob = new Blob([JSON.stringify(skill, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${skill.id}-skill.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        updateTask(taskId, { progress });
      }
    }, 500);
  };

  const installMutation = useMutation({
    mutationFn: async () => {
      if (!skill || !selectedInstanceId) throw new Error('Invalid selection');
      return marketService.installSkill(selectedInstanceId, skill.id);
    },
    onSuccess: () => {
      toast.success('Installation Started', {
        description: `Installing ${skill?.name} to the selected instance.`
      });
      queryClient.invalidateQueries({ queryKey: ['skill', id] });
      setTimeout(() => {
        setIsInstallModalOpen(false);
        navigate('/instances');
      }, 1500);
    },
    onError: (error: Error) => {
      toast.error('Installation Failed', {
        description: error.message
      });
    }
  });

  React.useEffect(() => {
    if (instances.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(instances[0].id);
    }
  }, [instances]);

  if (isLoadingSkill || isLoadingInstances) {
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

  if (!skill) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Skill not found</h2>
        <button onClick={() => navigate('/market')} className="mt-4 text-primary-500 hover:underline">Return to Market</button>
      </div>
    );
  }

  const isInstalling = installMutation.isPending;

  return (
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
          <div className="w-24 h-24 md:w-32 md:h-32 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-primary-500 dark:text-primary-400 rounded-3xl flex items-center justify-center font-bold text-4xl md:text-5xl uppercase shadow-sm shrink-0">
            {skill.name.substring(0, 2)}
          </div>
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md text-xs font-bold uppercase tracking-wider">
                {skill.category}
              </span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" /> Official
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2">{skill.name}</h1>
            <p className="text-lg text-zinc-500 dark:text-zinc-400 font-medium mb-4">{skill.author}</p>
            <div className="flex items-center gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="text-zinc-900 dark:text-zinc-100">{skill.rating.toFixed(1)}</span>
                <span className="text-zinc-400 dark:text-zinc-500 font-normal">({reviews.length} Ratings)</span>
              </div>
              <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
              <div className="flex items-center gap-1.5">
                <Download className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                {skill.downloads.toLocaleString()} Installs
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-row md:flex-col items-center md:items-end gap-3 shrink-0 pt-2">
          <button 
            onClick={() => setIsInstallModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary-500 text-white px-8 py-3.5 rounded-2xl hover:bg-primary-600 transition-all font-bold text-base shadow-lg shadow-primary-500/20 active:scale-95"
          >
            <Download className="w-5 h-5" />
            Get Skill
          </button>
          <button 
            onClick={handleDownloadLocal}
            className="w-full md:w-auto md:px-4 md:py-2 flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-semibold text-sm shadow-sm"
          >
            <HardDrive className="w-4 h-4" />
            <span className="hidden md:inline">Download to Local</span>
          </button>
          <button className="w-12 h-12 md:w-auto md:h-auto md:px-4 md:py-2 flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-semibold text-sm shadow-sm">
            <Share className="w-4 h-4" />
            <span className="hidden md:inline">Share</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left Column: Content */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Media Gallery (Mock) */}
          <div className="w-full aspect-video bg-zinc-950 rounded-3xl overflow-hidden relative group shadow-md border border-zinc-200 dark:border-zinc-800">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-transparent"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-zinc-500 font-mono text-sm flex items-center gap-2">
                <Info className="w-4 h-4" /> Media Preview Unavailable
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-zinc-200 dark:border-zinc-800">
            <nav className="flex gap-8">
              <button
                onClick={() => setActiveTab('readme')}
                className={`pb-4 text-sm font-bold transition-colors relative ${
                  activeTab === 'readme' ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Overview
                {activeTab === 'readme' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-t-full"></span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`pb-4 text-sm font-bold transition-colors relative ${
                  activeTab === 'reviews' ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Ratings & Reviews
                {activeTab === 'reviews' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-t-full"></span>
                )}
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="min-h-[400px]">
            {activeTab === 'readme' && (
              <div className="prose prose-zinc dark:prose-invert prose-primary max-w-none prose-headings:font-bold prose-h2:text-2xl prose-h3:text-xl prose-p:text-zinc-600 dark:prose-p:text-zinc-400 prose-p:leading-relaxed">
                <Markdown>{skill.readme || skill.description}</Markdown>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-6">
                {reviews.length === 0 ? (
                  <div className="text-center py-16 text-zinc-500 dark:text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/50">
                    <MessageSquare className="w-8 h-8 mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">No reviews yet</p>
                    <p className="text-sm mt-1">Be the first to review this skill.</p>
                  </div>
                ) : (
                  reviews.map(review => (
                    <div key={review.id} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-6 rounded-3xl shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full flex items-center justify-center font-bold text-sm">
                            {review.user_name.substring(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{review.user_name}</p>
                            <p className="text-xs text-zinc-400 font-medium">{new Date(review.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`w-4 h-4 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'fill-zinc-100 dark:fill-zinc-800 text-zinc-200 dark:text-zinc-700'}`} 
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{review.comment}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Meta Information */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-6">Information</h3>
            
            <div className="space-y-5">
              <div className="flex justify-between items-start">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm">Provider</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm text-right">{skill.author}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm">Version</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm text-right">{skill.version}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm">Size</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm text-right">{skill.size}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm">Category</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm text-right">{skill.category}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm">Compatibility</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm text-right">Claw Studio v0.2.0+</span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
              <a href="#" className="flex items-center justify-between text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
                <span className="flex items-center gap-2"><Globe className="w-4 h-4" /> Developer Website</span>
                <ArrowLeft className="w-4 h-4 rotate-135" />
              </a>
              <a href="#" className="flex items-center justify-between text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
                <span className="flex items-center gap-2"><Github className="w-4 h-4" /> Source Code</span>
                <ArrowLeft className="w-4 h-4 rotate-135" />
              </a>
              <a href="#" className="flex items-center justify-between text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
                <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Privacy Policy</span>
                <ArrowLeft className="w-4 h-4 rotate-135" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Install Modal */}
      <Modal 
        isOpen={isInstallModalOpen} 
        onClose={() => setIsInstallModalOpen(false)}
        title="Install Skill"
      >
        <div className="space-y-6">
          <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 flex gap-4 items-center">
            <div className="w-12 h-12 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-primary-500 dark:text-primary-400 rounded-xl flex items-center justify-center font-bold text-xl uppercase shrink-0 shadow-sm">
              {skill.name.substring(0, 2)}
            </div>
            <div>
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100">{skill.name}</h4>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">v{skill.version}</p>
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
                onClick={() => installMutation.mutate()}
                disabled={isInstalling || !selectedInstanceId}
                className="w-full bg-primary-500 text-white py-3.5 rounded-xl font-bold hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-md shadow-primary-500/20 flex items-center justify-center gap-2"
              >
                {isInstalling ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Installing...</>
                ) : (
                  'Confirm Installation'
                )}
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
