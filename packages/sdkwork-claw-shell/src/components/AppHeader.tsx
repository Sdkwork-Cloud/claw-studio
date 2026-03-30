import {
  Suspense,
  lazy,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { ChevronDown, CircleUserRound, Search, Smartphone } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  DesktopWindowControls,
  openExternalUrl,
  useAuthStore,
} from '@sdkwork/claw-core';
import { pointsQueryKeys, pointsService } from '@sdkwork/claw-points';
import { AccountMenuContent } from './AccountMenuContent';
import {
  buildAuthenticatedAccountMenuSections,
  buildGuestAccountMenuSections,
  MOBILE_APP_DOWNLOAD_URL,
  type AccountMenuAction,
} from './accountMenuModel';
import { OPEN_COMMAND_PALETTE_EVENT } from './commandPaletteEvents';

const InstanceSwitcher = lazy(() =>
  import('./InstanceSwitcher').then((module) => ({
    default: module.InstanceSwitcher,
  })),
);
const PointsHeaderEntry = lazy(() =>
  import('../lazy/points.ts').then((module) => ({
    default: module.PointsHeaderEntry,
  })),
);

function InstanceSwitcherFallback() {
  return (
    <div
      aria-hidden="true"
      className="flex h-9 w-full items-center justify-between rounded-2xl bg-zinc-950/[0.045] px-3 dark:bg-white/[0.06]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <div className="space-y-1.5">
          <div className="h-2.5 w-24 rounded-full bg-zinc-300/80 dark:bg-zinc-700/80" />
          <div className="h-2 w-20 rounded-full bg-zinc-200/90 dark:bg-zinc-800/90" />
        </div>
      </div>
      <div className="h-4 w-4 rounded-full bg-zinc-300/80 dark:bg-zinc-700/80" />
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary-600">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 text-white"
      >
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
  );
}

function HeaderActionButton({
  title,
  onClick,
  children,
  className = '',
  ...buttonProps
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      data-tauri-drag-region="false"
      title={title}
      onClick={onClick}
      {...buttonProps}
      className={`flex h-9 items-center justify-center rounded-2xl bg-zinc-950/[0.045] px-3 text-zinc-600 transition-colors hover:bg-zinc-950/[0.08] hover:text-zinc-950 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/[0.12] dark:hover:text-white ${className}`}
    >
      {children}
    </button>
  );
}

export interface AppHeaderProps {
  mode?: 'default' | 'auth';
}

export function AppHeader({ mode = 'default' }: AppHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, signOut } = useAuthStore();
  const isAuthMode = mode === 'auth';
  const [shouldRenderInstanceSwitcher, setShouldRenderInstanceSwitcher] = useState(false);
  const [shouldRenderPointsEntry, setShouldRenderPointsEntry] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const loginRedirectTarget = `${location.pathname}${location.search}` || '/';
  const loginTarget = `/login?redirect=${encodeURIComponent(loginRedirectTarget)}`;
  const {
    data: pointsDashboard = pointsService.getEmptyDashboard(),
    isError: isPointsDashboardError,
  } = useQuery({
    queryKey: pointsQueryKeys.dashboard,
    queryFn: () => pointsService.getDashboard(),
    placeholderData: pointsService.getEmptyDashboard(),
    enabled: !isAuthMode && isAuthenticated,
  });
  const hasLivePointsSummary = pointsDashboard.summary.isAuthenticated;

  const accountMenuSections = useMemo(
    () =>
      isAuthenticated
        ? buildAuthenticatedAccountMenuSections()
        : buildGuestAccountMenuSections(loginTarget),
    [isAuthenticated, loginTarget],
  );
  const membershipLabel = isAuthenticated
    ? hasLivePointsSummary
      ? pointsDashboard.summary.currentPlan.name || t('headerAccountMenu.free')
      : isPointsDashboardError
        ? t('headerAccountMenu.unavailableMembership')
        : t('headerAccountMenu.loadingMembership')
    : t('headerAccountMenu.guest');
  const pointsLabel = isAuthenticated
    ? hasLivePointsSummary
      ? `${new Intl.NumberFormat().format(pointsDashboard.summary.balancePoints)} ${t('headerAccountMenu.pointsUnit')}`
      : isPointsDashboardError
        ? t('headerAccountMenu.unavailablePoints')
        : t('headerAccountMenu.loadingPoints')
    : t('headerAccountMenu.guestPoints');

  useEffect(() => {
    if (isAuthMode) {
      setShouldRenderInstanceSwitcher(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      startTransition(() => {
        setShouldRenderInstanceSwitcher(true);
      });
    }, 90);

    return () => window.clearTimeout(timeout);
  }, [isAuthMode]);

  useEffect(() => {
    if (isAuthMode) {
      setShouldRenderPointsEntry(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      startTransition(() => {
        setShouldRenderPointsEntry(true);
      });
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [isAuthMode]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isAccountMenuOpen]);

  useEffect(() => {
    setIsAccountMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  const handleDownloadMobileApp = async () => {
    try {
      await openExternalUrl(MOBILE_APP_DOWNLOAD_URL);
    } catch (error: any) {
      toast.error(error?.message || t('headerAccountMenu.downloadFailed'));
    }
  };

  const handleAccountAction = async (action: AccountMenuAction) => {
    setIsAccountMenuOpen(false);

    if (action.id === 'sign-out') {
      await signOut();
      navigate('/login', { replace: true });
      return;
    }

    if (action.to) {
      navigate(action.to);
    }
  };

  return (
    <div className="relative z-30 bg-white/72 backdrop-blur-xl dark:bg-zinc-950/78">
      <header className="relative flex h-12 items-center px-3 sm:px-4">
        <div
          data-slot="app-header-leading"
          data-tauri-drag-region
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-none text-zinc-950 dark:text-zinc-50">
                {t('sidebar.brand')}
              </div>
            </div>
          </div>

          {!isAuthMode ? (
            <div
              data-slot="app-header-search"
              data-tauri-drag-region="false"
              className="ml-4"
            >
              <HeaderActionButton
                title={t('commandPalette.searchPlaceholder')}
                onClick={() => {
                  document.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
                }}
                className="gap-2 px-2.5"
              >
                <Search className="h-4 w-4" />
                <span className="hidden text-xs font-medium md:inline">{t('common.search')}</span>
                <span className="hidden rounded-full bg-zinc-950/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:bg-white/[0.08] dark:text-zinc-400 md:inline">
                  {t('commandPalette.shortcut')}
                </span>
              </HeaderActionButton>
            </div>
          ) : null}
        </div>

        {!isAuthMode ? (
          <div
            data-slot="app-header-center"
            data-tauri-drag-region="false"
            className="pointer-events-none absolute left-1/2 top-1/2 flex w-full max-w-[36rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-3 px-28 lg:px-32"
          >
            <span
              data-slot="app-header-workspace"
              className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400 md:inline"
            >
              {t('sidebar.workspace')}
            </span>
            <div className="pointer-events-auto w-full max-w-[24rem]">
              {shouldRenderInstanceSwitcher ? (
                <Suspense fallback={<InstanceSwitcherFallback />}>
                  <InstanceSwitcher />
                </Suspense>
              ) : (
                <InstanceSwitcherFallback />
              )}
            </div>
          </div>
        ) : null}

        <div
          data-slot="app-header-trailing"
          data-tauri-drag-region="false"
          className="ml-auto flex h-full items-center justify-end gap-2"
        >
          {!isAuthMode ? (
            <>
              <HeaderActionButton
                title={t('install.mobileGuide.headerAction')}
                onClick={() => {
                  void handleDownloadMobileApp();
                }}
                className="gap-2 px-2.5"
              >
                <Smartphone className="h-4 w-4" />
                <span className="hidden text-xs font-medium lg:inline">
                  {t('install.mobileGuide.headerAction')}
                </span>
              </HeaderActionButton>
              {shouldRenderPointsEntry ? (
                <Suspense fallback={null}>
                  <PointsHeaderEntry />
                </Suspense>
              ) : null}
              <div ref={accountMenuRef} className="relative">
                <HeaderActionButton
                  title={user?.displayName || t('sidebar.userMenu.open')}
                  onClick={() => setIsAccountMenuOpen((open) => !open)}
                  className="gap-2 px-2"
                  aria-haspopup="menu"
                  aria-expanded={isAccountMenuOpen}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-950/8 text-xs font-semibold text-zinc-700 dark:bg-white/10 dark:text-zinc-100">
                    {isAuthenticated && user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : isAuthenticated ? (
                      user?.initials
                    ) : (
                      <CircleUserRound className="h-4 w-4" />
                    )}
                  </div>
                  <span className="hidden max-w-28 truncate text-xs font-medium lg:inline">
                    {isAuthenticated ? user?.displayName : t('sidebar.userMenu.login')}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${isAccountMenuOpen ? 'rotate-180' : ''}`}
                  />
                </HeaderActionButton>

                {isAccountMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50">
                    <AccountMenuContent
                      isAuthenticated={isAuthenticated}
                      user={user}
                      membershipLabel={membershipLabel}
                      pointsLabel={pointsLabel}
                      sections={accountMenuSections}
                      onAction={(action) => {
                        void handleAccountAction(action);
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
          <DesktopWindowControls variant="header" />
        </div>
      </header>
    </div>
  );
}
