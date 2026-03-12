import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Command, LayoutGrid, Github, Box, Server, Cpu, Settings, MessageCircle, Terminal } from 'lucide-react';
import Fuse from 'fuse.js';
import { useInstanceStore } from '../store/useInstanceStore';
import { instanceService, Instance } from '../services/instanceService';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  action: () => void;
  category: string;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { setActiveInstanceId } = useInstanceStore();
  const [instances, setInstances] = useState<Instance[]>([]);

  // Toggle on Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Focus input when opened and fetch instances
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
      instanceService.getInstances().then(setInstances).catch(console.error);
    }
  }, [isOpen]);

  const commands: CommandItem[] = useMemo(() => {
    const baseCommands = [
      { id: 'nav-apps', title: 'Go to App Store', subtitle: 'Browse AI applications', icon: LayoutGrid, category: 'Navigation', action: () => navigate('/apps') },
      { id: 'nav-github', title: 'Go to GitHub Repos', subtitle: 'Install open-source projects', icon: Github, category: 'Navigation', action: () => navigate('/github') },
      { id: 'nav-hf', title: 'Go to Hugging Face', subtitle: 'Download AI models', icon: Box, category: 'Navigation', action: () => navigate('/huggingface') },
      { id: 'nav-instances', title: 'Go to Instances', subtitle: 'Manage running containers', icon: Server, category: 'Navigation', action: () => navigate('/instances') },
      { id: 'nav-devices', title: 'Go to Devices', subtitle: 'Hardware & GPU settings', icon: Cpu, category: 'Navigation', action: () => navigate('/devices') },
      { id: 'nav-chat', title: 'Go to AI Chat', subtitle: 'Talk to your local models', icon: MessageCircle, category: 'Navigation', action: () => navigate('/chat') },
      { id: 'nav-settings', title: 'Go to Settings', subtitle: 'Preferences and configuration', icon: Settings, category: 'Navigation', action: () => navigate('/settings') },
      { id: 'action-terminal', title: 'Open Terminal', subtitle: 'Launch local CLI', icon: Terminal, category: 'Actions', action: () => console.log('Terminal opened') },
    ];

    const instanceCommands = instances.map(instance => ({
      id: `switch-instance-${instance.id}`,
      title: `Switch Instance: ${instance.name}`,
      subtitle: `${instance.ip} • ${instance.status}`,
      icon: Server,
      category: 'Instances',
      action: () => {
        setActiveInstanceId(instance.id);
      }
    }));

    return [...baseCommands, ...instanceCommands];
  }, [navigate, instances, setActiveInstanceId]);

  const fuse = useMemo(() => new Fuse(commands, {
    keys: ['title', 'subtitle', 'category'],
    threshold: 0.4,
    includeScore: true,
  }), [commands]);

  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;
    return fuse.search(search).map(result => result.item);
  }, [search, commands, fuse]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex]);

  // Reset selection on search change
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 sm:px-0">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm"
        />

        {/* Command Palette */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ 
            type: "spring", 
            stiffness: 400, 
            damping: 30,
            mass: 0.8
          }}
          className="relative w-full max-w-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl rounded-2xl shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden flex flex-col"
        >
          {/* Search Input */}
          <div className="flex items-center px-4 py-4 border-b border-zinc-100 dark:border-zinc-800">
            <Search className="w-5 h-5 text-zinc-400 mr-3 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent border-none outline-none text-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
            <div className="flex items-center gap-1 ml-3">
              <kbd className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs font-sans font-medium text-zinc-500 dark:text-zinc-400">ESC</kbd>
            </div>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                <Command className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p>No results found.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredCommands.map((cmd, index) => {
                  const Icon = cmd.icon;
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        setIsOpen(false);
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                        isSelected 
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900' 
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${
                        isSelected 
                          ? 'text-zinc-300 dark:text-zinc-600' 
                          : 'text-zinc-400 dark:text-zinc-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${
                          isSelected 
                            ? 'text-white dark:text-zinc-900' 
                            : 'text-zinc-900 dark:text-zinc-100'
                        }`}>
                          {cmd.title}
                        </div>
                        {cmd.subtitle && (
                          <div className={`text-xs truncate ${
                            isSelected 
                              ? 'text-zinc-400 dark:text-zinc-500' 
                              : 'text-zinc-500 dark:text-zinc-400'
                          }`}>
                            {cmd.subtitle}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <kbd className={`hidden sm:block px-2 py-1 rounded text-[10px] font-sans font-medium uppercase tracking-wider ${
                          isSelected 
                            ? 'bg-white/10 dark:bg-black/10 text-zinc-300 dark:text-zinc-600' 
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                        }`}>
                          Enter
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="px-4 py-3 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><kbd className="font-sans bg-zinc-200/50 dark:bg-zinc-800/50 px-1.5 py-0.5 rounded">↑</kbd><kbd className="font-sans bg-zinc-200/50 dark:bg-zinc-800/50 px-1.5 py-0.5 rounded">↓</kbd> to navigate</span>
              <span className="flex items-center gap-1"><kbd className="font-sans bg-zinc-200/50 dark:bg-zinc-800/50 px-1.5 py-0.5 rounded">↵</kbd> to select</span>
            </div>
            <div className="font-medium">Claw Studio Command Palette</div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
