import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Download, Share, ShieldCheck, HardDrive, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { appStoreService, AppItem } from '../../services/appStoreService';

export function AppDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<AppItem | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchApp = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await appStoreService.getApp(id);
        setApp(data);
      } catch (error) {
        console.error('Failed to fetch app:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchApp();
  }, [id]);

  const [installState, setInstallState] = useState<'idle' | 'downloading' | 'installing' | 'installed'>('idle');
  const [progress, setProgress] = useState(0);

  const handleInstall = async () => {
    if (installState !== 'idle' || !app) return;
    
    setInstallState('downloading');
    setProgress(0);
    
    try {
      await appStoreService.installApp(app.id, (p) => {
        setProgress(p);
        if (p >= 100) {
          setInstallState('installing');
        }
      });
      setInstallState('installed');
      toast.success(`${app.name} installed successfully!`);
    } catch (error) {
      console.error('Failed to install app:', error);
      toast.error(`Failed to install ${app.name}`);
      setInstallState('idle');
      setProgress(0);
    }
  };

  const handleUninstall = async () => {
    if (installState !== 'installed' || !app) return;
    if (confirm(`Are you sure you want to uninstall ${app.name}?`)) {
      try {
        await appStoreService.uninstallApp(app.id);
        setInstallState('idle');
        setProgress(0);
        toast.success(`${app.name} uninstalled successfully.`);
      } catch (error) {
        console.error('Failed to uninstall app:', error);
        toast.error(`Failed to uninstall ${app.name}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-zinc-950">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">App not found</h2>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-primary-600 text-white rounded-xl font-bold">Go Back</button>
      </div>
    );
  }

  return (
    <div className="h-full bg-white dark:bg-zinc-950 overflow-y-auto scrollbar-hide">
      {/* Header Bar */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </button>
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">App Details</div>
      </div>

      <div className="max-w-5xl mx-auto p-8">
        {/* App Header */}
        <div className="flex flex-col md:flex-row gap-8 items-start mb-12">
          <img 
            src={app.icon} 
            alt={app.name} 
            className="w-32 h-32 md:w-40 md:h-40 rounded-3xl shadow-lg border border-zinc-100 dark:border-zinc-800 object-cover shrink-0"
            referrerPolicy="no-referrer"
          />
          
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-2">{app.name}</h1>
            <h2 className="text-lg text-zinc-500 dark:text-zinc-400 mb-4">{app.developer}</h2>
            
            <div className="flex flex-wrap items-center gap-6 mb-6">
              <div className="flex flex-col">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Rating</span>
                <div className="flex items-center gap-1 text-zinc-900 dark:text-zinc-100 font-bold">
                  {app.rating} <Star className="w-4 h-4 fill-zinc-900 dark:fill-zinc-100" />
                </div>
              </div>
              <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex flex-col">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Category</span>
                <div className="text-zinc-900 dark:text-zinc-100 font-medium">{app.category}</div>
              </div>
              <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex flex-col">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Age</span>
                <div className="text-zinc-900 dark:text-zinc-100 font-medium">{app.ageRating}</div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {installState === 'idle' && (
                <button 
                  onClick={handleInstall}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-2.5 rounded-full font-bold transition-colors shadow-sm flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Install to Local
                </button>
              )}
              
              {installState === 'downloading' && (
                <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 px-6 py-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 w-64">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                      <span>Downloading...</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary-500 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {installState === 'installing' && (
                <button disabled className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-8 py-2.5 rounded-full font-bold flex items-center gap-2 cursor-not-allowed">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Installing...
                </button>
              )}

              {installState === 'installed' && (
                <div className="flex items-center gap-2">
                  <button className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 px-8 py-2.5 rounded-full font-bold transition-colors shadow-sm flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Open App
                  </button>
                  <button 
                    onClick={handleUninstall}
                    className="bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 px-6 py-2.5 rounded-full font-bold transition-colors shadow-sm flex items-center gap-2"
                  >
                    Uninstall
                  </button>
                </div>
              )}

              <button className="p-2.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                <Share className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Screenshots */}
        {app.screenshots && app.screenshots.length > 0 && (
          <div className="mb-12">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">Preview</h3>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
              {app.screenshots.map((src: string, idx: number) => (
                <img 
                  key={idx}
                  src={src}
                  alt={`Screenshot ${idx + 1}`}
                  className="snap-start shrink-0 h-64 md:h-80 rounded-2xl border border-zinc-200 dark:border-zinc-800 object-cover shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ))}
            </div>
          </div>
        )}

        {/* Description & Info Grid */}
        <div className="grid md:grid-cols-3 gap-12">
          <div className="md:col-span-2 space-y-8">
            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">About this app</h3>
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-400 leading-relaxed">{app.description}</p>
              </div>
            </div>
            
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800/50">
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2">What's New</h4>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Version {app.version} • {app.releaseDate}</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                - Performance improvements and bug fixes.<br/>
                - Added support for the latest OpenClaw Core APIs.<br/>
                - UI enhancements for better accessibility.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">Information</h3>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <HardDrive className="w-5 h-5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Size</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">{app.size}</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Compatibility</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">{app.compatibility}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
