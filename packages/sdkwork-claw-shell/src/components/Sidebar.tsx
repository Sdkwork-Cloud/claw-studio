import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Check,
  ChevronDown,
  Clock,
  Code,
  Cpu,
  Download,
  Github,
  Globe,
  Hash,
  HelpCircle,
  LayoutGrid,
  MessageCircle,
  Network,
  Package,
  PanelLeftClose,
  Router,
  Server,
  Settings,
  Users,
  Puzzle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore, useInstanceStore } from '@sdkwork/claw-core';
import { instanceService, type Instance } from '@sdkwork/claw-instances';

export function Sidebar() {
  const { isSidebarCollapsed, toggleSidebar, hiddenSidebarItems } = useAppStore();
  const { activeInstanceId, setActiveInstanceId } = useInstanceStore();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isInstanceDropdownOpen, setIsInstanceDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    async function fetchInstances() {
      try {
        const data = await instanceService.getInstances();
        setInstances(data);
        if (data.length > 0 && !activeInstanceId) {
          setActiveInstanceId(data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch instances:', error);
      }
    }

    void fetchInstances();
  }, [activeInstanceId, setActiveInstanceId]);

  const activeInstance = instances.find((instance) => instance.id === activeInstanceId);

  const navItems = [
    {
      section: t('sidebar.workspace', 'Workspace'),
      items: [
        { id: 'chat', to: '/chat', icon: MessageCircle, label: t('sidebar.aiChat', 'AI Chat') },
        { id: 'channels', to: '/channels', icon: Hash, label: t('sidebar.channels', 'Channels') },
        { id: 'tasks', to: '/tasks', icon: Clock, label: t('sidebar.cronTasks', 'Cron Tasks') },
      ],
    },
    {
      section: t('sidebar.ecosystem', 'Ecosystem'),
      items: [
        { id: 'apps', to: '/apps', icon: LayoutGrid, label: t('sidebar.appStore', 'App Store'), badge: 'HOT' },
        { id: 'market', to: '/market', icon: Package, label: t('sidebar.market', 'ClawHub') },
        { id: 'extensions', to: '/extensions', icon: Puzzle, label: t('sidebar.extensions', 'Extensions') },
        { id: 'claw-upload', to: '/claw-upload', icon: Globe, label: t('sidebar.clawUpload', 'Claw Upload') },
        { id: 'community', to: '/community', icon: Users, label: t('sidebar.community', 'Community') },
        { id: 'github', to: '/github', icon: Github, label: t('sidebar.githubRepos', 'GitHub Repos') },
        { id: 'huggingface', to: '/huggingface', icon: Box, label: t('sidebar.huggingFace', 'Hugging Face') },
        { id: 'claw-center', to: '/claw-center', icon: Network, label: t('sidebar.clawMall', 'Claw Mall') },
      ],
    },
    {
      section: t('sidebar.setup', 'Setup'),
      items: [
        { id: 'install', to: '/install', icon: Download, label: t('sidebar.install', 'Install Claw Studio') },
        { id: 'instances', to: '/instances', icon: Server, label: t('sidebar.instances', 'Instances') },
        { id: 'devices', to: '/devices', icon: Cpu, label: t('sidebar.devices', 'Devices') },
        { id: 'codebox', to: '/codebox', icon: Code, label: t('sidebar.codebox', 'CodeBox') },
        { id: 'api-router', to: '/api-router', icon: Router, label: t('sidebar.apiRouter', 'Api Router') },
      ],
    },
  ]
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !hiddenSidebarItems.includes(item.id)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <motion.div
      initial={false}
      animate={{ width: isSidebarCollapsed ? 60 : 240 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
        mass: 0.8,
      }}
      className="bg-zinc-950 text-zinc-300 flex flex-col h-full border-r border-zinc-900 relative z-20 shrink-0 group/sidebar overflow-hidden"
    >
      <div className={`pt-6 pb-4 flex flex-col ${isSidebarCollapsed ? 'items-center' : 'px-5'} relative`}>
        <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} overflow-hidden whitespace-nowrap w-full`}>
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
          {!isSidebarCollapsed ? <span className="text-xl font-bold text-white tracking-tight">Claw Studio</span> : null}

          {!isSidebarCollapsed ? (
            <button
              onClick={toggleSidebar}
              className="absolute right-4 top-6 text-zinc-500 hover:text-white opacity-0 group-hover/sidebar:opacity-100 transition-opacity p-1 rounded-md hover:bg-zinc-800"
              title="Collapse Sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        <div className={`mt-6 relative ${isSidebarCollapsed ? 'flex justify-center w-full' : ''}`}>
          <button
            onClick={() => setIsInstanceDropdownOpen((open) => !open)}
            className={
              isSidebarCollapsed
                ? 'w-10 h-10 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-colors relative group'
                : 'w-full flex items-center justify-between bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl px-3 py-2 transition-colors'
            }
            title={isSidebarCollapsed ? activeInstance?.name || t('sidebar.selectInstance', 'Select Instance') : undefined}
          >
            {isSidebarCollapsed ? (
              <>
                <Server className="w-5 h-5 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-zinc-950 ${activeInstance?.status === 'online' ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${activeInstance?.status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-zinc-500'}`} />
                  <span className="text-sm font-medium text-zinc-200 truncate">
                    {activeInstance ? activeInstance.name : t('sidebar.selectInstance', 'Select Instance')}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isInstanceDropdownOpen ? 'rotate-180' : ''}`} />
              </>
            )}
          </button>

          <AnimatePresence>
            {isInstanceDropdownOpen ? (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsInstanceDropdownOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: isSidebarCollapsed ? 0 : -10, x: isSidebarCollapsed ? -10 : 0, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                  exit={{ opacity: 0, y: isSidebarCollapsed ? 0 : -10, x: isSidebarCollapsed ? -10 : 0, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className={`absolute ${isSidebarCollapsed ? 'top-0 left-full ml-4 w-64' : 'top-full left-0 right-0 mt-2'} bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-40 overflow-hidden`}
                >
                  <div className="px-3 py-2 border-b border-zinc-800/50 bg-zinc-950/30 flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('sidebar.switchInstance', 'Switch Instance')}</span>
                    <span className="text-[10px] text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">{instances.length}</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1 scrollbar-hide">
                    {instances.map((instance) => (
                      <button
                        key={instance.id}
                        onClick={() => {
                          setActiveInstanceId(instance.id);
                          setIsInstanceDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-zinc-800/80 transition-colors group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${instance.status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-zinc-500'}`} />
                          <div className="flex flex-col items-start truncate">
                            <span className={`text-sm truncate ${activeInstanceId === instance.id ? 'text-white font-medium' : 'text-zinc-300 group-hover:text-white transition-colors'}`}>
                              {instance.name}
                            </span>
                            <span className="text-[10px] text-zinc-500 truncate font-mono">{instance.ip}</span>
                          </div>
                        </div>
                        {activeInstanceId === instance.id ? <Check className="w-4 h-4 text-primary-500 shrink-0" /> : null}
                      </button>
                    ))}
                    {instances.length === 0 ? (
                      <div className="px-3 py-6 flex flex-col items-center justify-center text-center">
                        <Server className="w-8 h-8 text-zinc-700 mb-2" />
                        <span className="text-sm text-zinc-400">{t('sidebar.noInstances', 'No instances found')}</span>
                        <span className="text-xs text-zinc-500 mt-1">{t('sidebar.addOne', 'Add one to get started')}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="p-2 border-t border-zinc-800 bg-zinc-950/50">
                    <button
                      onClick={() => {
                        setIsInstanceDropdownOpen(false);
                        navigate('/instances');
                      }}
                      className="w-full flex items-center justify-center gap-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 py-2 rounded-lg transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5" /> {t('sidebar.manageInstances', 'Manage Instances')}
                    </button>
                  </div>
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <nav className={`flex-1 space-y-6 overflow-y-auto overflow-x-hidden scrollbar-hide mt-4 ${isSidebarCollapsed ? 'px-2' : 'px-4'}`}>
        {navItems.map((group) => (
          <div key={group.section}>
            {!isSidebarCollapsed ? (
              <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-3 px-3">
                {group.section}
              </div>
            ) : (
              <div className="h-px bg-zinc-800/50 my-4 mx-2" />
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={({ isActive }) => `flex items-center ${isSidebarCollapsed ? 'justify-center w-10 h-10 mx-auto' : 'justify-between px-3 py-2.5'} rounded-xl transition-all duration-200 group relative ${isActive ? 'bg-primary-500/10 text-primary-400 font-medium' : 'hover:bg-zinc-800/50 hover:text-zinc-200 text-zinc-400'}`}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && !isSidebarCollapsed ? (
                        <motion.div
                          layoutId="sidebar-active-indicator"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary-500 rounded-r-full"
                        />
                      ) : null}
                      <div className="flex items-center gap-3">
                        <item.icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-primary-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                        {!isSidebarCollapsed ? <span className="text-[14px] tracking-tight">{item.label}</span> : null}
                      </div>
                      {!isSidebarCollapsed && item.badge ? (
                        <span className="bg-primary-500/20 text-primary-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-primary-500/20">
                          {item.badge}
                        </span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-900 flex flex-col gap-1">
        <NavLink
          to="/docs"
          title={isSidebarCollapsed ? t('sidebar.documentation', 'Documentation') : undefined}
          className={({ isActive }) => `flex items-center ${isSidebarCollapsed ? 'justify-center w-10 h-10 mx-auto' : 'px-3 py-2.5 gap-3'} rounded-xl transition-all duration-200 group relative ${isActive ? 'bg-primary-500/10 text-primary-400 font-medium' : 'hover:bg-zinc-800/50 hover:text-zinc-200 text-zinc-400'}`}
        >
          {({ isActive }) => (
            <>
              {isActive && !isSidebarCollapsed ? (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary-500 rounded-r-full"
                />
              ) : null}
              <HelpCircle className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-primary-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
              {!isSidebarCollapsed ? <span className="text-[14px] tracking-tight">{t('sidebar.documentation', 'Documentation')}</span> : null}
            </>
          )}
        </NavLink>
        <NavLink
          to="/settings"
          title={isSidebarCollapsed ? t('sidebar.settings', 'Settings') : undefined}
          className={({ isActive }) => `flex items-center ${isSidebarCollapsed ? 'justify-center w-10 h-10 mx-auto' : 'px-3 py-2.5 gap-3'} rounded-xl transition-all duration-200 group relative ${isActive ? 'bg-primary-500/10 text-primary-400 font-medium' : 'hover:bg-zinc-800/50 hover:text-zinc-200 text-zinc-400'}`}
        >
          {({ isActive }) => (
            <>
              {isActive && !isSidebarCollapsed ? (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary-500 rounded-r-full"
                />
              ) : null}
              <Settings className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-primary-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
              {!isSidebarCollapsed ? <span className="flex-1 text-[14px] tracking-tight">{t('sidebar.settings', 'Settings')}</span> : null}
              {!isSidebarCollapsed ? (
                <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                  <kbd>⌘</kbd>
                  <kbd>K</kbd>
                </div>
              ) : null}
            </>
          )}
        </NavLink>
      </div>
    </motion.div>
  );
}
