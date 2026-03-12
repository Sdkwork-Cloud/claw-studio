import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Server, Folder, GitBranch, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  repoName: string;
  type: 'github' | 'huggingface';
}

export function InstallModal({ isOpen, onClose, title, repoName, type }: InstallModalProps) {
  const [step, setStep] = useState<'config' | 'installing' | 'success' | 'error'>('config');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('config');
      setProgress(0);
      setLogs([]);
    }
  }, [isOpen]);

  const handleInstall = () => {
    setStep('installing');
    setLogs([`Starting installation for ${repoName}...`, `Connecting to ${type === 'github' ? 'GitHub' : 'HuggingFace'}...`]);
    
    // Simulate installation process
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.random() * 15;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);
        setLogs(prev => [...prev, 'Installation completed successfully.']);
        setTimeout(() => setStep('success'), 500);
      } else {
        const newLogs = [...logs];
        if (currentProgress > 20 && logs.length < 3) newLogs.push('Downloading repository metadata...');
        if (currentProgress > 50 && logs.length < 4) newLogs.push('Fetching files and dependencies...');
        if (currentProgress > 80 && logs.length < 5) newLogs.push('Configuring local environment...');
        setLogs(newLogs);
      }
      setProgress(currentProgress);
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
          onClick={step === 'installing' ? undefined : onClose}
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
              <p className="text-sm text-zinc-500">{repoName}</p>
            </div>
            {step !== 'installing' && (
              <button 
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto">
            {step === 'config' && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                    <Server className="w-4 h-4 text-zinc-400" /> Target Instance
                  </label>
                  <select className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all">
                    <option>Local Environment (Default)</option>
                    <option>Docker Container (claw-env-1)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                    <Folder className="w-4 h-4 text-zinc-400" /> Install Path
                  </label>
                  <input 
                    type="text" 
                    defaultValue={`~/openclaw/${type === 'github' ? 'repos' : 'models'}/${repoName.split('/').pop()}`}
                    className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-zinc-400" /> {type === 'github' ? 'Branch / Tag' : 'Revision'}
                  </label>
                  <select className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all">
                    <option>main</option>
                    <option>v1.0.0</option>
                    <option>dev</option>
                  </select>
                </div>
              </div>
            )}

            {step === 'installing' && (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-6">
                <div className="relative">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-zinc-100" />
                    <circle 
                      cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" 
                      strokeDasharray={251.2} 
                      strokeDashoffset={251.2 - (251.2 * progress) / 100}
                      className="text-primary-500 transition-all duration-300 ease-out" 
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-zinc-900">{Math.round(progress)}%</span>
                  </div>
                </div>
                
                <div className="w-full max-w-sm space-y-2">
                  <div className="text-sm font-medium text-zinc-900">Installing {repoName}...</div>
                  <div className="h-32 bg-zinc-950 rounded-xl p-3 overflow-y-auto text-left font-mono text-[10px] text-zinc-400 space-y-1">
                    {logs.map((log, i) => (
                      <div key={i} className="animate-fade-in">{`> ${log}`}</div>
                    ))}
                    <div className="flex items-center gap-2 text-primary-400">
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 'success' && (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900">Installation Complete</h3>
                <p className="text-sm text-zinc-500 max-w-xs">
                  {repoName} has been successfully installed and is ready to use.
                </p>
              </div>
            )}

            {step === 'error' && (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900">Installation Failed</h3>
                <p className="text-sm text-zinc-500 max-w-xs">
                  An error occurred while installing {repoName}. Please check the logs and try again.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
            {step === 'config' && (
              <>
                <button 
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleInstall}
                  className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Start Install
                </button>
              </>
            )}
            {(step === 'success' || step === 'error') && (
              <button 
                onClick={onClose}
                className="px-6 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold rounded-xl shadow-sm transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
