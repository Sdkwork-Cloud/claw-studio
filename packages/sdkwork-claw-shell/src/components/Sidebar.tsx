import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Blocks,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarClock,
  ChevronUp,
  CircleUserRound,
  Cpu,
  Download,
  Github,
  Hash,
  HelpCircle,
  LayoutGrid,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageCircle,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  PlugZap,
  type LucideIcon,
  Router,
  Server,
  Settings2,
  Store,
  Waypoints,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore, useAuthStore } from '@sdkwork/claw-core';
import { prefetchSidebarRoute } from '../application/router/routePrefetch';

const COLLAPSED_SIDEBAR_WIDTH = 72;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 360;

interface SidebarNavItem {
  id: string;
  to: string;
  icon: LucideIcon;
  label: string;
  badge?: string;
}

interface SidebarNavGroup {
  section: string;
  items: SidebarNavItem[];
}

function clampSidebarWidth(width: number) {
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width));
}

export function Sidebar() {
  const {
    isSidebarCollapsed,
    sidebarWidth,
    toggleSidebar,
    setSidebarCollapsed,
    setSidebarWidth,
    hiddenSidebarItems,
  } = useAppStore();
  const { isAuthenticated, user, signOut } = useAuthStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const accountSettingsTarget = '/settings?tab=account';
  const loginTarget = `/login?redirect=${encodeURIComponent(accountSettingsTarget)}`;

  const resolvedSidebarWidth = clampSidebarWidth(sidebarWidth);

  useEffect(() => {
    if (resolvedSidebarWidth !== sidebarWidth) {
      setSidebarWidth(resolvedSidebarWidth);
    }
  }, [resolvedSidebarWidth, setSidebarWidth, sidebarWidth]);

  useEffect(() => {
    if (!isSidebarResizing) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth = clampSidebarWidth(
        resizeStartWidthRef.current + (event.clientX - resizeStartXRef.current),
      );
      setSidebarWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setIsSidebarResizing(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isSidebarResizing, setSidebarWidth]);

  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [isSidebarCollapsed, location.pathname, location.search]);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isUserMenuOpen]);

  const startSidebarResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const nextWidth = isSidebarCollapsed ? MIN_SIDEBAR_WIDTH : resolvedSidebarWidth;
      resizeStartXRef.current = event.clientX;
      resizeStartWidthRef.current = nextWidth;

      if (isSidebarCollapsed) {
        setSidebarCollapsed(false);
        setSidebarWidth(nextWidth);
      }

      setIsSidebarResizing(true);
    },
    [isSidebarCollapsed, resolvedSidebarWidth, setSidebarCollapsed, setSidebarWidth],
  );

  const navItems: SidebarNavGroup[] = [
    {
      section: t('sidebar.workspace'),
      items: [
        { id: 'chat', to: '/chat', icon: MessageCircle, label: t('sidebar.aiChat') },
        { id: 'channels', to: '/channels', icon: Hash, label: t('sidebar.channels') },
        { id: 'tasks', to: '/tasks', icon: CalendarClock, label: t('sidebar.cronTasks') },
        { id: 'dashboard', to: '/dashboard', icon: LayoutDashboard, label: t('sidebar.dashboard') },
      ],
    },
    {
      section: t('sidebar.ecosystem'),
      items: [
        {
          id: 'market',
          to: '/market',
          icon: Blocks,
          label: t('sidebar.market'),
          badge: t('sidebar.hotBadge'),
        },
        {
          id: 'agents',
          to: '/agents',
          icon: BriefcaseBusiness,
          label: t('sidebar.agentMarket'),
        },
        { id: 'mall', to: '/mall', icon: Store, label: t('sidebar.clawMall') },
        {
          id: 'apps',
          to: '/apps',
          icon: LayoutGrid,
          label: t('sidebar.appStore'),
        },
        { id: 'extensions', to: '/extensions', icon: PlugZap, label: t('sidebar.extensions') },
        { id: 'claw-upload', to: '/claw-center', icon: Waypoints, label: t('sidebar.clawUpload') },
        { id: 'community', to: '/community', icon: Newspaper, label: t('sidebar.community') },
        { id: 'github', to: '/github', icon: Github, label: t('sidebar.githubRepos') },
        { id: 'huggingface', to: '/huggingface', icon: BrainCircuit, label: t('sidebar.huggingFace') },
      ],
    },
    {
      section: t('sidebar.setup'),
      items: [
        { id: 'install', to: '/install', icon: Download, label: t('sidebar.install') },
        { id: 'kernel', to: '/kernel', icon: Cpu, label: t('sidebar.kernelCenter') },
        { id: 'nodes', to: '/nodes', icon: Waypoints, label: t('sidebar.nodes') },
        { id: 'instances', to: '/instances', icon: Server, label: t('sidebar.instances') },
        { id: 'api-router', to: '/api-router', icon: Router, label: t('sidebar.apiRouter') },
      ],
    },
  ]
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !hiddenSidebarItems.includes(item.id)),
    }))
    .filter((group) => group.items.length > 0);

  const currentSidebarWidth = isSidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : resolvedSidebarWidth;
  const showEdgeAffordances = isSidebarHovered || isSidebarResizing;
  const userMenuTitle = isAuthenticated
    ? isUserMenuOpen
      ? t('sidebar.userMenu.close')
      : t('sidebar.userMenu.open')
    : t('sidebar.userMenu.login');

  const handleUserControlClick = () => {
    if (!isAuthenticated) {
      navigate(loginTarget);
      return;
    }

    setIsUserMenuOpen((open) => !open);
  };

  const handleOpenAccountSettings = () => {
    setIsUserMenuOpen(false);
    navigate(accountSettingsTarget);
  };

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);

    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div
      className={`relative z-20 flex h-full shrink-0 ${
        isSidebarResizing ? '' : 'transition-[width] duration-200 ease-out'
      }`}
      style={{ width: currentSidebarWidth }}
      onMouseEnter={() => setIsSidebarHovered(true)}
      onMouseLeave={() => setIsSidebarHovered(false)}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden border-r border-zinc-900/90 bg-[linear-gradient(180deg,_#13151a_0%,_#0b0c10_100%)] text-zinc-300 shadow-[18px_0_50px_rgba(9,9,11,0.16)]"
      >
        <nav
          className={`scrollbar-hide flex-1 space-y-5 overflow-x-hidden overflow-y-auto ${
            isSidebarCollapsed ? 'px-2 py-4' : 'px-3 py-5'
          }`}
        >
          {navItems.map((group) => (
            <div key={group.section}>
              {!isSidebarCollapsed ? (
                <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  {group.section}
                </div>
              ) : (
                <div className="mx-2 my-4 h-px bg-white/6" />
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={isSidebarCollapsed ? item.label : undefined}
                    onMouseEnter={() => prefetchSidebarRoute(item.to)}
                    onFocus={() => prefetchSidebarRoute(item.to)}
                    onPointerDown={() => prefetchSidebarRoute(item.to)}
                    className={({ isActive }) =>
                      `group relative flex items-center rounded-2xl transition-all duration-200 ${
                        isSidebarCollapsed
                          ? 'mx-auto h-11 w-11 justify-center'
                          : 'justify-between px-3 py-2.5'
                      } ${
                        isActive
                          ? 'bg-white/[0.08] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                          : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && !isSidebarCollapsed ? (
                          <motion.div
                            layoutId="sidebar-active-indicator"
                            className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-500"
                          />
                        ) : null}
                        <div className="flex items-center gap-3">
                          <item.icon
                            className={`h-4 w-4 shrink-0 transition-colors ${
                              isActive ? 'text-primary-400' : 'text-zinc-500 group-hover:text-zinc-300'
                            }`}
                          />
                          {!isSidebarCollapsed ? (
                            <span className="text-[14px] tracking-tight">{item.label}</span>
                          ) : null}
                        </div>
                        {!isSidebarCollapsed && item.badge ? (
                          <span className="rounded-full border border-primary-500/20 bg-primary-500/15 px-1.5 py-0.5 text-[10px] font-bold text-primary-300">
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

        <div className="flex flex-col gap-1 border-t border-white/5 p-3">
          <NavLink
            to="/docs"
            title={isSidebarCollapsed ? t('sidebar.documentation') : undefined}
            className={({ isActive }) =>
              `group relative flex items-center rounded-2xl transition-all duration-200 ${
                isSidebarCollapsed ? 'mx-auto h-11 w-11 justify-center' : 'gap-3 px-3 py-2.5'
              } ${
                isActive
                  ? 'bg-white/[0.08] font-medium text-white'
                  : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && !isSidebarCollapsed ? (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-500"
                  />
                ) : null}
                <HelpCircle
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    isActive ? 'text-primary-400' : 'text-zinc-500 group-hover:text-zinc-300'
                  }`}
                />
                {!isSidebarCollapsed ? (
                  <span className="text-[14px] tracking-tight">{t('sidebar.documentation')}</span>
                ) : null}
              </>
            )}
          </NavLink>
          <div ref={userMenuRef} className="relative">
            {isUserMenuOpen ? (
              <div
                className={`absolute z-40 rounded-3xl border border-white/10 bg-zinc-950/96 p-2 shadow-[0_20px_48px_rgba(9,9,11,0.34)] backdrop-blur-xl ${
                  isSidebarCollapsed ? 'bottom-0 left-full ml-3 w-64' : 'bottom-full left-0 right-0 mb-2'
                }`}
              >
                <div className="mb-2 rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-500/15 text-sm font-bold text-primary-200">
                      {user?.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        user?.initials
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">
                        {user?.displayName}
                      </div>
                      <div className="truncate text-xs text-zinc-400">{user?.email}</div>
                    </div>
                  </div>
                  <div className="mt-3 inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                    {t('sidebar.userMenu.signedIn')}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAccountSettings}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <Settings2 className="h-4 w-4 text-zinc-500" />
                  <span>{t('sidebar.userMenu.profileSettings')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void handleSignOut();
                  }}
                  className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm text-rose-300 transition-colors hover:bg-rose-500/10 hover:text-rose-200"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t('sidebar.userMenu.logout')}</span>
                </button>
              </div>
            ) : null}

            <button
              type="button"
              data-slot="sidebar-user-control"
              title={isSidebarCollapsed ? userMenuTitle : undefined}
              onClick={handleUserControlClick}
              className={`group relative flex w-full items-center rounded-2xl border border-white/8 bg-white/[0.04] text-zinc-300 transition-all duration-200 hover:bg-white/[0.07] hover:text-white ${
                isSidebarCollapsed
                  ? 'mx-auto h-11 w-11 justify-center px-0'
                  : 'gap-3 px-2.5 py-2.5'
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.08] text-sm font-semibold text-white">
                {isAuthenticated && user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : isAuthenticated ? (
                  user?.initials
                ) : (
                  <CircleUserRound className="h-4 w-4 text-zinc-300" />
                )}
              </div>

              {!isSidebarCollapsed ? (
                <>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-semibold text-white">
                      {isAuthenticated ? user?.displayName : t('sidebar.userMenu.guest')}
                    </div>
                    <div className="truncate text-xs text-zinc-500">
                      {isAuthenticated ? user?.email : t('sidebar.userMenu.loginHint')}
                    </div>
                  </div>

                  {isAuthenticated ? (
                    <ChevronUp
                      className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
                        isUserMenuOpen ? '' : 'rotate-180'
                      }`}
                    />
                  ) : (
                    <LogIn className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-300" />
                  )}
                </>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        data-slot="sidebar-edge-control"
        title={isSidebarCollapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
        onClick={toggleSidebar}
        className={`absolute right-1 top-5 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-zinc-200 shadow-[0_10px_24px_rgba(9,9,11,0.26)] transition-all duration-200 dark:bg-zinc-900 ${
          showEdgeAffordances
            ? 'opacity-100 hover:scale-105 hover:bg-zinc-900'
            : 'pointer-events-none opacity-0'
        }`}
      >
        {isSidebarCollapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </button>

      <div
        data-slot="sidebar-resize-handle"
        onPointerDown={startSidebarResize}
        className="absolute inset-y-0 right-0 z-20 w-3 cursor-col-resize touch-none"
      />
    </div>
  );
}
