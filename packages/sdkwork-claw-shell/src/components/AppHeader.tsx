import { useEffect, useState, type ReactNode } from 'react';
import { Minus, Search, Smartphone, Square, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { platform, useAppStore } from '@sdkwork/claw-core';
import { InstanceSwitcher } from './InstanceSwitcher';
import { OPEN_COMMAND_PALETTE_EVENT } from './commandPaletteEvents';

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
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-tauri-drag-region="false"
      title={title}
      onClick={onClick}
      className={`flex h-9 items-center justify-center rounded-2xl bg-zinc-950/[0.045] px-3 text-zinc-600 transition-colors hover:bg-zinc-950/[0.08] hover:text-zinc-950 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/[0.12] dark:hover:text-white ${className}`}
    >
      {children}
    </button>
  );
}

function WindowSizeGlyph({ isMaximized }: { isMaximized: boolean }) {
  if (!isMaximized) {
    return <Square className="h-3.5 w-3.5" />;
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5">
      <path
        d="M9 5h10v10M5 9h10v10H5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useDesktopWindowMaximized(isDesktop: boolean) {
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);

  useEffect(() => {
    if (!isDesktop) {
      setIsWindowMaximized(false);
      return;
    }

    let active = true;
    let unsubscribe = () => {};

    void (async () => {
      setIsWindowMaximized(await platform.isWindowMaximized());
      unsubscribe = await platform.subscribeWindowMaximized((nextState) => {
        if (!active) {
          return;
        }

        setIsWindowMaximized(nextState);
      });
    })();

    return () => {
      active = false;
      void unsubscribe();
    };
  }, [isDesktop]);

  return isWindowMaximized;
}

function DesktopWindowControls() {
  const { t } = useTranslation();
  const isWindowMaximized = useDesktopWindowMaximized(true);
  const maximizeLabel = isWindowMaximized
    ? t('common.restoreWindow')
    : t('common.maximizeWindow');

  return (
    <div
      data-tauri-drag-region="false"
      className="flex h-full items-stretch"
    >
      <button
        type="button"
        data-tauri-drag-region="false"
        title={t('common.minimizeWindow')}
        onClick={() => {
          void platform.minimizeWindow();
        }}
        className="flex h-full w-11 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-950/[0.06] hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.1] dark:hover:text-white"
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        data-tauri-drag-region="false"
        title={maximizeLabel}
        onClick={() => {
          void (isWindowMaximized ? platform.restoreWindow() : platform.maximizeWindow());
        }}
        className="flex h-full w-11 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-950/[0.06] hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.1] dark:hover:text-white"
      >
        <WindowSizeGlyph isMaximized={isWindowMaximized} />
      </button>
      <button
        type="button"
        data-tauri-drag-region="false"
        title={t('common.closeWindow')}
        onClick={() => {
          void platform.closeWindow();
        }}
        className="flex h-full w-11 items-center justify-center text-zinc-500 transition-colors hover:bg-rose-500 hover:text-white dark:text-zinc-300"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AppHeader() {
  const { t } = useTranslation();
  const isDesktop = platform.getPlatform() === 'desktop';
  const openMobileAppDialog = useAppStore((state) => state.openMobileAppDialog);

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
        </div>

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
            <InstanceSwitcher />
          </div>
        </div>

        <div
          data-slot="app-header-trailing"
          data-tauri-drag-region="false"
          className="ml-auto flex h-full items-center justify-end gap-2"
        >
          <HeaderActionButton
            title={t('install.mobileGuide.headerAction')}
            onClick={openMobileAppDialog}
            className="gap-2 px-2.5"
          >
            <Smartphone className="h-4 w-4" />
            <span className="hidden text-xs font-medium lg:inline">
              {t('install.mobileGuide.headerAction')}
            </span>
          </HeaderActionButton>
          {isDesktop ? <DesktopWindowControls /> : null}
        </div>
      </header>
    </div>
  );
}
