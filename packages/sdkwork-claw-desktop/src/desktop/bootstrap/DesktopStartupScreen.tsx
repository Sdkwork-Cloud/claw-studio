import { useEffect, useState, type ReactNode } from 'react';
import {
  closeWindow,
  isWindowMaximized as getIsWindowMaximized,
  maximizeWindow,
  minimizeWindow,
  restoreWindow,
  subscribeWindowMaximized,
} from '../tauriBridge';
import type { StartupLanguage, StartupProgressModel } from './startupPresentation';
import { getStartupCopy } from './startupPresentation';

interface DesktopStartupScreenProps {
  appName: string;
  language: StartupLanguage;
  progress: StartupProgressModel;
  status: 'booting' | 'launching' | 'error';
  errorMessage: string | null;
  isVisible: boolean;
  onRetry: () => void;
}

function BrandIcon({ isActive }: { isActive: boolean }) {
  return (
    <div
      className={`flex h-16 w-16 items-center justify-center rounded-[20px] border border-[#f87171]/20 bg-[#7f1d1d] text-white shadow-[0_18px_40px_rgba(65,12,16,0.32)] ${
        isActive ? 'motion-safe:animate-pulse' : ''
      }`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8">
        <path
          d="M12 2v2M12 18v4M4.93 10.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 13.07l1.41-1.41M17.66 6.34l1.41-1.41M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM12 6a6 6 0 0 1 6 6M12 18a6 6 0 0 1-6-6Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function WindowControlButton({
  label,
  onClick,
  children,
  intent = 'default',
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  intent?: 'default' | 'danger';
}) {
  const intentClassName =
    intent === 'danger'
      ? 'hover:border-[#f87171]/40 hover:bg-[#7f1d1d] hover:text-white'
      : 'hover:border-[#f87171]/22 hover:bg-[#2b1114] hover:text-white';

  return (
    <button
      type="button"
      data-tauri-drag-region="false"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-[#1a0d0f] text-[#fecdd3] transition-colors ${intentClassName}`}
    >
      {children}
    </button>
  );
}

function WindowSizeGlyph({ isMaximized }: { isMaximized: boolean }) {
  if (!isMaximized) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
        <rect
          x="5"
          y="5"
          width="14"
          height="14"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M9 5h10v10M5 9h10v10H5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useDesktopWindowMaximized() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    void (async () => {
      setIsMaximized(await getIsWindowMaximized());
      unsubscribe = await subscribeWindowMaximized((nextState) => {
        if (!active) {
          return;
        }

        setIsMaximized(nextState);
      });
    })();

    return () => {
      active = false;
      void unsubscribe();
    };
  }, []);

  return isMaximized;
}

function StartupWindowControls({ language }: { language: StartupLanguage }) {
  const isMaximizedWindow = useDesktopWindowMaximized();
  const labels =
    language === 'zh'
      ? {
          minimize: '\u6700\u5c0f\u5316\u7a97\u53e3',
          maximize: '\u6700\u5927\u5316\u7a97\u53e3',
          restore: '\u6062\u590d\u7a97\u53e3',
          close: '\u5173\u95ed\u7a97\u53e3',
        }
      : {
          minimize: 'Minimize window',
          maximize: 'Maximize window',
          restore: 'Restore window',
          close: 'Close window',
        };

  return (
    <div data-tauri-drag-region="false" className="flex items-center gap-2">
      <WindowControlButton label={labels.minimize} onClick={() => void minimizeWindow()}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
          <path
            d="M5 12h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </WindowControlButton>
      <WindowControlButton
        label={isMaximizedWindow ? labels.restore : labels.maximize}
        onClick={() =>
          void (isMaximizedWindow ? restoreWindow() : maximizeWindow())
        }
      >
        <WindowSizeGlyph isMaximized={isMaximizedWindow} />
      </WindowControlButton>
      <WindowControlButton
        label={labels.close}
        onClick={() => void closeWindow()}
        intent="danger"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
          <path
            d="M7 7l10 10M17 7 7 17"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </WindowControlButton>
    </div>
  );
}

export function DesktopStartupScreen({
  appName,
  language,
  progress,
  status,
  errorMessage,
  isVisible,
  onRetry,
}: DesktopStartupScreenProps) {
  const copy = getStartupCopy(language, appName);
  const statusText = status === 'error' ? copy.errorTitle : progress.statusLabel;
  const isBooting = status !== 'error' && progress.phase !== 'ready';

  return (
    <div
      data-tauri-drag-region
      className={`absolute inset-0 z-50 transition-opacity duration-200 ease-out ${
        isVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-[#12090a]" />

      <div className="relative flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-end px-4 pt-4 sm:px-5 sm:pt-5">
          <StartupWindowControls language={language} />
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
          <div className="w-full max-w-[27rem] rounded-[28px] border border-[#7f1d1d]/35 bg-[#180d0f] p-7 shadow-[0_24px_80px_rgba(39,8,11,0.52)]">
            <div className="flex items-center gap-4">
              <BrandIcon isActive={isBooting} />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-[-0.04em] text-[#fff1f2]">
                  {appName}
                </h1>
                <div className="mt-2 flex items-center gap-2 text-sm text-[#fda4af]">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full bg-[#ef4444] ${
                      isBooting ? 'motion-safe:animate-pulse' : ''
                    }`}
                  />
                  <span>{statusText}</span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="h-2 rounded-full bg-[#2b1417]">
                <div
                  className="h-full rounded-full bg-[#ef4444] transition-[width] duration-200 ease-out"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>

            {status === 'error' ? (
              <div className="mt-6 rounded-2xl border border-[#f87171]/25 bg-[#27080b] p-4">
                <p className="text-sm leading-6 text-[#ffe4e6]">{errorMessage}</p>
                <button
                  type="button"
                  data-tauri-drag-region="false"
                  onClick={onRetry}
                  className="mt-4 inline-flex items-center rounded-xl bg-[#ef4444] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#dc2626]"
                >
                  {copy.retryLabel}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
