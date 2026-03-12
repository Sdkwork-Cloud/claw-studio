import React, { useState, useEffect } from 'react';
import { Book, ChevronRight, Hash, Terminal, Cpu, Package, Zap, DownloadCloud } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { IntroDoc } from './content/IntroDoc';
import { QuickstartDoc } from './content/QuickstartDoc';
import { ArchitectureDoc } from './content/ArchitectureDoc';
import { SkillsDoc } from './content/SkillsDoc';
import { CliDoc } from './content/CliDoc';
import { InstallDoc } from './content/InstallDoc';

const DOCS_NAV = [
  {
    section: 'Getting Started',
    items: [
      { id: 'intro', title: 'Introduction', icon: Book },
      { id: 'quickstart', title: 'Quick Start', icon: Zap },
      { id: 'install', title: 'Installation', icon: DownloadCloud },
    ]
  },
  {
    section: 'Core Concepts',
    items: [
      { id: 'architecture', title: 'Architecture', icon: Cpu },
      { id: 'skills', title: 'Skills & Packs', icon: Package },
    ]
  },
  {
    section: 'API Reference',
    items: [
      { id: 'cli', title: 'CLI Commands', icon: Terminal },
    ]
  }
];

export function Docs() {
  const [activeDoc, setActiveDoc] = useState('intro');
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      // If there's a hash, it likely means we came from the install page
      // Set the active doc to 'install' and let the InstallDoc component handle the scrolling
      setActiveDoc('install');
    }
  }, [location]);

  return (
    <div className="flex h-full bg-white dark:bg-zinc-950">
      {/* Docs Sidebar */}
      <div className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0 flex flex-col">
        <div className="p-6 pb-4">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Documentation</h1>
        </div>
        <nav className="flex-1 px-4 space-y-6 overflow-y-auto pb-6">
          {DOCS_NAV.map((group, idx) => (
            <div key={idx}>
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-3">
                {group.section}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = activeDoc === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveDoc(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                        isActive 
                          ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 font-medium' 
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      <item.icon className={`w-4 h-4 ${isActive ? 'text-primary-500 dark:text-primary-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
                      {item.title}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8 md:p-12 lg:px-16">
          <motion.div
            key={activeDoc}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="prose prose-zinc dark:prose-invert prose-primary max-w-none"
          >
            {activeDoc === 'intro' && <IntroDoc />}
            {activeDoc === 'quickstart' && <QuickstartDoc />}
            {activeDoc === 'install' && <InstallDoc />}
            {activeDoc === 'architecture' && <ArchitectureDoc />}
            {activeDoc === 'skills' && <SkillsDoc />}
            {activeDoc === 'cli' && <CliDoc />}
          </motion.div>
        </div>
      </div>
      
      {/* Right Sidebar (Table of Contents) - Hidden on smaller screens */}
      <div className="hidden xl:block w-64 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0 p-6">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">On this page</div>
        <nav className="space-y-2.5 text-sm text-zinc-500 dark:text-zinc-400">
          <a href="#" className="block hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Overview</a>
          <a href="#" className="block hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Key Features</a>
          <a href="#" className="block hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Use Cases</a>
          <a href="#" className="block hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Next Steps</a>
        </nav>
      </div>
    </div>
  );
}
