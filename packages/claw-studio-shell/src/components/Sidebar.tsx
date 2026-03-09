import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Download, Server, MessageSquare, Settings, HelpCircle, Cpu, Clock, Package, MessageCircle, PanelLeftClose, PanelLeftOpen, Menu, LayoutGrid, Github, Box, Activity, Network, Hash, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppStore } from '@sdkwork/claw-studio-business/stores/useAppStore';

function TelemetryWidget({ isCollapsed }: { isCollapsed: boolean }) {
  const [cpu, setCpu] = useState(0);
  const [ram, setRam] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCpu(Math.floor(Math.random() * 40) + 10); // 10-50%
      setRam(Math.floor(Math.random() * 30) + 40); // 40-70%
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (isCollapsed) {
    return (
      <div className="p-4 border-t border-zinc-900 flex justify-center">
        <Activity className="w-5 h-5 text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-zinc-900 bg-zinc-950/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">System Resources</span>
        <Activity className="w-3.5 h-3.5 text-emerald-500" />
      </div>
      
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-[10px] font-medium text-zinc-400 mb-1">
            <span>CPU</span>
            <span className="text-zinc-300">{cpu}%</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-primary-500 rounded-full"
              animate={{ width: `${cpu}%` }}
              transition={{ ease: "linear", duration: 1 }}
            />
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-[10px] font-medium text-zinc-400 mb-1">
            <span>RAM (32GB)</span>
            <span className="text-zinc-300">{ram}%</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-purple-500 rounded-full"
              animate={{ width: `${ram}%` }}
              transition={{ ease: "linear", duration: 1 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { isSidebarCollapsed, toggleSidebar } = useAppStore();

  const navItems = [
    { section: 'Setup', items: [
      { to: '/install', icon: Download, label: 'Install Claw Studio' },
      { to: '/instances', icon: Server, label: 'Instances' },
      { to: '/devices', icon: Cpu, label: 'Devices' },
      { to: '/claw-center', icon: Network, label: 'Claw Center' },
    ]},
    { section: 'Ecosystem', items: [
      { to: '/apps', icon: LayoutGrid, label: 'App Store', badge: 'HOT' },
      { to: '/market', icon: Package, label: 'ClawHub' },
      { to: '/community', icon: Users, label: 'Community' },
      { to: '/github', icon: Github, label: 'GitHub Repos' },
      { to: '/huggingface', icon: Box, label: 'Hugging Face' },
    ]},
    { section: 'Workspace', items: [
      { to: '/chat', icon: MessageCircle, label: 'AI Chat' },
      { to: '/channels', icon: Hash, label: 'Channels' },
      { to: '/tasks', icon: Clock, label: 'Cron Tasks' },
    ]}
  ];

  return (
    <motion.div 
      initial={false}
      animate={{ width: isSidebarCollapsed ? 60 : 240 }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 30,
        mass: 0.8
      }}
      className="bg-zinc-950 text-zinc-300 flex flex-col h-full border-r border-zinc-900 relative z-20 shrink-0 group/sidebar overflow-hidden"
    >
      <div className={`pt-6 pb-4 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'px-5 gap-3'} overflow-hidden whitespace-nowrap relative`}>
        <div 
          onClick={isSidebarCollapsed ? toggleSidebar : undefined}
          className={`w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary-900/20 shrink-0 ${isSidebarCollapsed ? 'cursor-pointer hover:bg-primary-500 transition-colors' : ''}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white">
            <path d="M12 2v2" />
            <path d="M12 18v4" />
            <path d="M4.93 10.93l1.41 1.41" />
            <path d="M17.66 17.66l1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="M4.93 13.07l1.41-1.41" />
            <path d="M17.66 6.34l1.41-1.41" />
            <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path d="M12 6a6 6 0 0 1 6 6" />
            <path d="M12 18a6 6 0 0 1-6-6" />
          </svg>
        </div>
        {!isSidebarCollapsed && <span className="text-xl font-bold text-white tracking-tight">Claw Studio</span>}
        
        {!isSidebarCollapsed && (
          <button 
            onClick={toggleSidebar} 
            className="absolute right-4 text-zinc-500 hover:text-white opacity-0 group-hover/sidebar:opacity-100 transition-opacity p-1 rounded-md hover:bg-zinc-800"
            title="Collapse Sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className={`flex-1 space-y-6 overflow-y-auto overflow-x-hidden scrollbar-hide mt-2 ${isSidebarCollapsed ? 'px-2' : 'px-3'}`}>
        {navItems.map((group, idx) => (
          <div key={idx}>
            {!isSidebarCollapsed ? (
              <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2 px-3">
                {group.section}
              </div>
            ) : (
              <div className="h-px bg-zinc-800/50 my-3 mx-2" />
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink 
                  key={item.to}
                  to={item.to} 
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={({isActive}) => `flex items-center ${isSidebarCollapsed ? 'justify-center w-10 h-10 mx-auto' : 'justify-between px-3 py-2.5'} rounded-xl transition-all duration-200 ${isActive ? 'bg-primary-500/10 text-primary-500 font-medium' : 'hover:bg-zinc-900 hover:text-white text-zinc-400'}`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 shrink-0" />
                    {!isSidebarCollapsed && <span>{item.label}</span>}
                  </div>
                  {!isSidebarCollapsed && item.badge && (
                    <span className="bg-primary-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{item.badge}</span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <TelemetryWidget isCollapsed={isSidebarCollapsed} />

      <div className={`p-2 border-t border-zinc-900 flex flex-col gap-1`}>
        <NavLink to="/docs" title={isSidebarCollapsed ? "Documentation" : undefined} className={({isActive}) => `flex items-center ${isSidebarCollapsed ? 'justify-center w-10 h-10 mx-auto' : 'px-3 py-2.5 gap-3'} rounded-xl transition-colors ${isActive ? 'bg-primary-500/10 text-primary-500 font-medium' : 'hover:bg-zinc-900 hover:text-white text-zinc-400'}`}>
          <HelpCircle className="w-5 h-5 shrink-0" />
          {!isSidebarCollapsed && <span>Documentation</span>}
        </NavLink>
        <NavLink to="/settings" title={isSidebarCollapsed ? "Settings" : undefined} className={({isActive}) => `flex items-center ${isSidebarCollapsed ? 'justify-center w-10 h-10 mx-auto' : 'px-3 py-2.5 gap-3'} rounded-xl transition-colors ${isActive ? 'bg-primary-500/10 text-primary-500 font-medium' : 'hover:bg-zinc-900 hover:text-white text-zinc-400'}`}>
          <Settings className="w-5 h-5 shrink-0" />
          {!isSidebarCollapsed && <span className="flex-1">Settings</span>}
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
              <kbd>⌘</kbd>
              <kbd>K</kbd>
            </div>
          )}
        </NavLink>
      </div>
    </motion.div>
  );
}
