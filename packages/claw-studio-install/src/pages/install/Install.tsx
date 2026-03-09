import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Monitor, Server, Cloud, Package, Github, ChevronRight, DownloadCloud, Play, SquareTerminal, FileText, X, CheckCircle2, AlertCircle, Info, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { installerService } from '../../services';

export function Install() {
  const navigate = useNavigate();
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  const [selectedOS, setSelectedOS] = useState<string>('');
  const [installStatus, setInstallStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [installOutput, setInstallOutput] = useState<string>('');

  const methods = [
    {
      id: 'script',
      title: 'Quick Install Script',
      icon: <Terminal className="w-6 h-6 text-primary-500 dark:text-primary-400" />,
      description: 'The easiest, one-click installation method. Automatically handles Node.js and onboarding.',
      tags: ['macOS', 'Linux', 'WSL2', 'Windows'],
      recommended: true,
      canInstall: true,
      osOptions: [
        { id: 'macos', label: 'macOS', command: 'curl -fsSL https://openclaw.ai/install.sh | bash' },
        { id: 'linux', label: 'Linux', command: 'curl -fsSL https://openclaw.ai/install.sh | bash' },
        { id: 'windows', label: 'Windows (PowerShell)', command: 'iwr -useb https://openclaw.ai/install.ps1 | iex' }
      ]
    },
    {
      id: 'docker',
      title: 'Docker Gateway',
      icon: <Server className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />,
      description: 'Run Claw Studio in an isolated container environment using Docker Compose.',
      tags: ['Docker', 'NAS', 'Home Server'],
      canInstall: true,
      osOptions: [
        { id: 'macos', label: 'macOS', command: './docker-setup.sh' },
        { id: 'linux', label: 'Linux', command: './docker-setup.sh' },
        { id: 'windows', label: 'Windows (WSL2)', command: './docker-setup.sh' }
      ]
    },
    {
      id: 'npm',
      title: 'NPM / PNPM',
      icon: <Package className="w-6 h-6 text-amber-500 dark:text-amber-400" />,
      description: 'For users who already have Node 22+ and prefer to manage the installation themselves.',
      tags: ['Node.js', 'npm', 'pnpm'],
      canInstall: true,
      osOptions: [
        { id: 'cross', label: 'Cross-platform (Node 22+)', command: 'npm install -g openclaw@latest && openclaw onboard --install-daemon' }
      ]
    },
    {
      id: 'cloud',
      title: 'Cloud Deploy',
      icon: <Cloud className="w-6 h-6 text-purple-500 dark:text-purple-400" />,
      description: 'Deploy OpenClaw to a VPS or Cloud Provider like Hetzner, GCP, Fly.io, or AWS.',
      tags: ['VPS', 'Cloud', 'Ubuntu'],
      canInstall: false
    },
    {
      id: 'source',
      title: 'From Source',
      icon: <Github className="w-6 h-6 text-zinc-700 dark:text-zinc-300" />,
      description: 'For contributors or anyone who wants to run from a local checkout to test the latest features.',
      tags: ['Git', 'Development'],
      canInstall: true,
      osOptions: [
        { id: 'cross', label: 'Cross-platform (Git required)', command: 'git clone https://github.com/openclaw/openclaw.git && cd openclaw && pnpm install && pnpm build' }
      ]
    }
  ];

  const openInstallModal = (e: React.MouseEvent, method: any) => {
    e.stopPropagation();
    setSelectedMethod(method);
    setSelectedOS(method.osOptions?.[0]?.id || '');
    setInstallStatus('idle');
    setInstallOutput('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (installStatus === 'running') return;
    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedMethod(null);
      setInstallStatus('idle');
      setInstallOutput('');
    }, 200);
  };

  const handleInstall = async () => {
    if (!selectedMethod || !selectedOS) return;
    
    const osOption = selectedMethod.osOptions.find((o: any) => o.id === selectedOS);
    const command = osOption?.command || 'echo "Unknown command"';

    setInstallStatus('running');
    setInstallOutput(`Preparing installation for ${osOption?.label}...\n\nExecuting via Tauri backend...\n`);
    
    try {
      const result = await installerService.executeInstallScript(command);
      setInstallOutput(prev => prev + '\n' + result);
      setInstallStatus('success');
    } catch (err: any) {
      setInstallStatus('error');
      setInstallOutput(prev => prev + '\nError: ' + (err.message || String(err)));
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto h-full overflow-y-auto scrollbar-hide bg-zinc-50 dark:bg-zinc-950">
      <div className="mb-12 text-center max-w-3xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-20 h-20 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-primary-100/50 dark:border-primary-500/20"
        >
          <DownloadCloud className="w-10 h-10" />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4"
        >
          Deploy OpenClaw
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-zinc-500 dark:text-zinc-400 text-lg leading-relaxed max-w-2xl mx-auto"
        >
          Choose your preferred deployment architecture. We recommend the Quick Install Script for most edge nodes and local environments.
        </motion.p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="bg-zinc-900 dark:bg-zinc-900/80 rounded-3xl p-6 md:p-8 mb-12 flex flex-col md:flex-row items-center gap-6 max-w-4xl mx-auto shadow-xl border border-zinc-800 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="w-14 h-14 bg-zinc-800 text-zinc-300 rounded-2xl flex items-center justify-center shrink-0 border border-zinc-700 relative z-10">
          <Cpu className="w-7 h-7" />
        </div>
        <div className="relative z-10 flex-1 text-center md:text-left">
          <h3 className="text-lg font-bold text-white mb-1">System Requirements</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Node 22+ is required (the script installs it automatically). Supported on macOS, Linux, and Windows (WSL2 strongly recommended).
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {methods.map((method, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 + (idx * 0.1) }}
            key={method.id}
            className={`group relative bg-white dark:bg-zinc-900 border rounded-3xl p-6 transition-all flex flex-col h-full ${
              method.recommended 
                ? 'border-primary-500 dark:border-primary-500/50 shadow-lg shadow-primary-500/10 dark:shadow-primary-900/20 ring-1 ring-primary-500/20 dark:ring-primary-500/10' 
                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md dark:hover:shadow-zinc-900/50'
            }`}
          >
            {method.recommended && (
              <div className="absolute -top-3 left-6 bg-primary-600 dark:bg-primary-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                Recommended
              </div>
            )}

            <div className="flex items-start justify-between mb-5 mt-2">
              <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-100 dark:border-zinc-700 shadow-sm group-hover:scale-105 transition-transform">
                {method.icon}
              </div>
            </div>

            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">{method.title}</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed mb-6 flex-1">
              {method.description}
            </p>

            <div className="flex flex-wrap gap-2 mb-8">
              {method.tags.map(tag => (
                <span key={tag} className="px-2.5 py-1 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-auto flex flex-col gap-3">
              {method.canInstall ? (
                <button 
                  onClick={(e) => openInstallModal(e, method)}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all shadow-sm ${
                    method.recommended 
                      ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-900/20' 
                      : 'bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900'
                  }`}
                >
                  <DownloadCloud className="w-4 h-4" />
                  Install Now
                </button>
              ) : (
                <div className="w-full flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500 px-4 py-3 rounded-xl font-bold text-sm cursor-not-allowed border border-zinc-200 dark:border-zinc-800 border-dashed">
                  Local Install Not Available
                </div>
              )}
              
              <button 
                onClick={() => navigate(`/docs#${method.id}`)}
                className="w-full flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 px-4 py-3 rounded-xl font-bold text-sm transition-colors"
              >
                <FileText className="w-4 h-4" />
                View Documentation
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Installation Modal */}
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
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-zinc-200 dark:border-zinc-800"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-100 dark:border-zinc-700 shadow-sm">
                    {selectedMethod.icon}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Install via {selectedMethod.title}</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">Automated Deployment</p>
                  </div>
                </div>
                <button 
                  onClick={closeModal}
                  disabled={installStatus === 'running'}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto flex-1 bg-zinc-50/50 dark:bg-zinc-950/50">
                {installStatus === 'idle' ? (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4 uppercase tracking-wider">Select Target OS</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {selectedMethod.osOptions.map((os: any) => (
                          <button
                            key={os.id}
                            onClick={() => setSelectedOS(os.id)}
                            className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all ${
                              selectedOS === os.id 
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 shadow-md shadow-primary-500/10' 
                                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm'
                            }`}
                          >
                            <Monitor className={`w-8 h-8 mb-3 ${selectedOS === os.id ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
                            <span className="text-sm font-bold text-center">{os.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-primary-50/50 dark:bg-primary-500/5 border border-primary-100 dark:border-primary-500/20 rounded-2xl p-5 flex gap-4">
                      <Info className="w-6 h-6 text-primary-500 dark:text-primary-400 shrink-0" />
                      <p className="text-sm text-primary-900 dark:text-primary-200 leading-relaxed font-medium">
                        Clicking "Start Deployment" will securely execute the official installation script for your selected operating system directly on your local machine.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                      {installStatus === 'running' && <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>}
                      {installStatus === 'success' && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                      {installStatus === 'error' && <AlertCircle className="w-6 h-6 text-red-500" />}
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">
                        {installStatus === 'running' && 'Deploying OpenClaw...'}
                        {installStatus === 'success' && 'Deployment Complete!'}
                        {installStatus === 'error' && 'Deployment Failed'}
                      </span>
                    </div>

                    <div className="bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden flex flex-col h-72 shadow-inner">
                      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
                        <SquareTerminal className="w-4 h-4 text-zinc-400" />
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Terminal Output</span>
                      </div>
                      <div className="p-5 overflow-y-auto flex-1 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                        <span className={installStatus === 'error' ? 'text-red-400' : 'text-emerald-400'}>
                          {installOutput}
                        </span>
                        {installStatus === 'running' && (
                          <span className="inline-block w-2 h-4 bg-zinc-400 animate-pulse ml-1 align-middle"></span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-5 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-end gap-3">
                {installStatus === 'idle' ? (
                  <>
                    <button 
                      onClick={closeModal}
                      className="px-6 py-3 rounded-xl font-bold text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleInstall}
                      disabled={!selectedOS}
                      className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-primary-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play className="w-4 h-4" />
                      Start Deployment
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={closeModal}
                    disabled={installStatus === 'running'}
                    className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 px-8 py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 shadow-md"
                  >
                    {installStatus === 'success' ? 'Done' : 'Close'}
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
