import {
  Component,
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import {
  AppProviders,
  MainLayout,
  bootstrapShellRuntime,
  listSidebarRoutePrefetchPaths,
  prefetchSidebarRoute,
  prefetchSidebarRoutes,
  resolveSidebarStartupRoute,
} from '@sdkwork/claw-shell';
import type { DistributionId } from '@sdkwork/claw-distribution';
import { getDistributionManifest } from '@sdkwork/claw-distribution';
import type { RuntimeLanguagePreference } from '@sdkwork/claw-infrastructure';
import { getDesktopWindow, isTauriRuntime } from '../runtime';
import { getAppInfo, setAppLanguage } from '../tauriBridge';
import { DesktopProviders } from '../providers/DesktopProviders';
import { DesktopStartupScreen } from './DesktopStartupScreen';
import { DesktopTrayRouteBridge } from './DesktopTrayRouteBridge';
import {
  getStartupMinimumWaitMs,
  getStartupProgressModel,
  readStartupAppearanceSnapshot,
  resolveStartupBootstrapStage,
  type StartupAppearanceSnapshot,
  type StartupMilestoneSnapshot,
} from './startupPresentation';

const APP_STORAGE_KEY = 'claw-studio-app-storage';
const SPLASH_MINIMUM_VISIBLE_MS = 180;
const SPLASH_EXIT_DURATION_MS = 120;
const STARTUP_LOG_PREFIX = '[desktop-startup]';

const INITIAL_STARTUP_MILESTONES: StartupMilestoneSnapshot = {
  hasWindowPresented: false,
  hasRuntimeConnected: false,
  hasShellBootstrapped: false,
  hasShellMounted: false,
};

interface DesktopBootstrapAppProps {
  appName: string;
  initialAppearance: StartupAppearanceSnapshot;
}

type StartupLogLevel = 'info' | 'warn' | 'error';

function resolveErrorMessage(error: unknown, language: StartupAppearanceSnapshot['language']) {
  const fallback =
    language === 'zh'
      ? '\u65e0\u6cd5\u5b8c\u6210\u684c\u9762\u5de5\u4f5c\u53f0\u521d\u59cb\u5316\uff0c\u8bf7\u68c0\u67e5\u8fd0\u884c\u73af\u5883\u540e\u91cd\u8bd5\u3002'
      : 'The desktop workspace could not be initialized. Review the runtime and try again.';

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

function waitFor(ms: number) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

function writeStartupLog(
  level: StartupLogLevel,
  runId: number,
  elapsedMs: number,
  message: string,
  details?: unknown,
) {
  const logger =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  const prefix = `${STARTUP_LOG_PREFIX}[run:${runId}][${elapsedMs}ms] ${message}`;

  if (typeof details === 'undefined') {
    logger(prefix);
    return;
  }

  logger(prefix, details);
}

interface DesktopShellErrorBoundaryProps {
  resetKey: number;
  onError: (error: Error) => void;
  children: ReactNode;
}

interface DesktopShellErrorBoundaryState {
  hasError: boolean;
}

class DesktopShellErrorBoundary extends Component<
  DesktopShellErrorBoundaryProps,
  DesktopShellErrorBoundaryState
> {
  state: DesktopShellErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): DesktopShellErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    this.props.onError(error);
  }

  componentDidUpdate(prevProps: DesktopShellErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

export function readInitialStartupAppearance() {
  if (typeof window === 'undefined') {
    return readStartupAppearanceSnapshot({
      storageValue: null,
      browserLanguage: 'en',
      prefersDark: false,
    });
  }

  let storageValue: string | null = null;

  try {
    storageValue = window.localStorage.getItem(APP_STORAGE_KEY);
  } catch {
    storageValue = null;
  }

  return readStartupAppearanceSnapshot({
    storageValue,
    browserLanguage: window.navigator.language,
    prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
  });
}

export function applyStartupAppearanceHints(appearance: StartupAppearanceSnapshot) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.setAttribute('lang', appearance.language);
  document.body.style.backgroundColor = '#12090a';
  document.body.style.color = '#fff1f2';
}

export function DesktopBootstrapApp({
  appName,
  initialAppearance,
}: DesktopBootstrapAppProps) {
  const [appearance] = useState(initialAppearance);
  const [retrySeed, setRetrySeed] = useState(0);
  const [milestones, setMilestones] = useState<StartupMilestoneSnapshot>(
    INITIAL_STARTUP_MILESTONES,
  );
  const [shouldRenderShell, setShouldRenderShell] = useState(false);
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [status, setStatus] = useState<'booting' | 'launching' | 'error'>('booting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startedAtRef = useRef(Date.now());
  const bootRunIdRef = useRef(0);
  const splashHandoffRunIdRef = useRef(0);
  const stageLogSignatureRef = useRef('');

  const stage = useMemo(
    () => resolveStartupBootstrapStage(milestones),
    [milestones],
  );
  const progress = useMemo(
    () =>
      getStartupProgressModel({
        milestones,
        language: appearance.language,
      }),
    [appearance.language, milestones],
  );

  const logStartup = useEffectEvent(
    (level: StartupLogLevel, message: string, details?: unknown, runId = bootRunIdRef.current) => {
      writeStartupLog(level, runId, Math.max(0, Date.now() - startedAtRef.current), message, details);
    },
  );

  useEffect(() => {
    const signature = `${bootRunIdRef.current}:${stage}:${status}:${progress.progress}`;
    if (stageLogSignatureRef.current === signature) {
      return;
    }

    stageLogSignatureRef.current = signature;
    logStartup('info', `Stage changed to "${stage}"`, {
      status,
      progress: progress.progress,
      isSplashVisible,
      shouldRenderShell,
      milestones,
    });
  }, [isSplashVisible, logStartup, milestones, progress.progress, shouldRenderShell, stage, status]);

  useEffect(() => {
    if (
      stage !== 'ready' ||
      status === 'error' ||
      splashHandoffRunIdRef.current === bootRunIdRef.current
    ) {
      return;
    }

    const runId = bootRunIdRef.current;
    splashHandoffRunIdRef.current = runId;
    let cancelled = false;

    void (async () => {
      logStartup('info', 'Startup marked ready. Waiting for splash handoff.', undefined, runId);
      await waitFor(
        getStartupMinimumWaitMs({
          currentTimeMs: Date.now(),
          startedAtMs: startedAtRef.current,
          minimumVisibleMs: SPLASH_MINIMUM_VISIBLE_MS,
        }),
      );
      if (cancelled || bootRunIdRef.current !== runId) {
        return;
      }

      logStartup('info', 'Hiding splash screen.', undefined, runId);
      setIsSplashVisible(false);
      await waitFor(SPLASH_EXIT_DURATION_MS);
      if (cancelled || bootRunIdRef.current !== runId) {
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stage, status]);

  const handleShellRenderError = useEffectEvent((error: Error) => {
    logStartup('error', 'Shell render failed.', error);
    bootRunIdRef.current += 1;
    setStatus('error');
    setErrorMessage(resolveErrorMessage(error, appearance.language));
    setShouldRenderShell(false);
    setIsSplashVisible(true);
    setMilestones((current) =>
      current.hasShellMounted ? { ...current, hasShellMounted: false } : current,
    );
  });

  const handleLanguagePreferenceChange = useEffectEvent(
    (languagePreference: RuntimeLanguagePreference) => {
      void setAppLanguage(languagePreference);
    },
  );

  useEffect(() => {
    if (!shouldRenderShell || status !== 'launching' || milestones.hasShellMounted) {
      return;
    }

    const runId = bootRunIdRef.current;
    let cancelled = false;

    void (async () => {
      logStartup('info', 'Shell render requested. Waiting for first paints.', undefined, runId);
      await waitForNextPaint();
      await waitForNextPaint();
      if (cancelled || bootRunIdRef.current !== runId) {
        return;
      }

      logStartup('info', 'Shell first paint confirmed.', undefined, runId);
      setMilestones((current) =>
        current.hasShellMounted ? current : { ...current, hasShellMounted: true },
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [milestones.hasShellMounted, shouldRenderShell, status]);

  const revealStartupWindow = useEffectEvent(async () => {
    logStartup('info', 'Preparing startup window.');
    await waitForNextPaint();

    if (!isTauriRuntime()) {
      logStartup('warn', 'Skipping native window reveal because Tauri runtime is unavailable.');
      return;
    }

    let desktopWindow = getDesktopWindow();
    let attempts = 0;

    while (!desktopWindow && attempts < 6) {
      attempts += 1;
      await waitFor(80);
      desktopWindow = getDesktopWindow();
    }

    if (!desktopWindow) {
      logStartup('error', 'Desktop window handle was unavailable during startup.');
      throw new Error('The desktop window handle was unavailable during startup.');
    }

    if (attempts > 0) {
      logStartup('info', 'Desktop window handle resolved after retries.', { attempts });
    }

    await desktopWindow.show();
    await desktopWindow.setFocus().catch(() => {
      // Focus is best-effort after reveal.
    });
    logStartup('info', 'Startup window revealed.');
  });

  const connectDesktopRuntime = useEffectEvent(async () => {
    logStartup('info', 'Connecting desktop runtime via app.getInfo().', {
      isTauriRuntime: isTauriRuntime(),
    });
    const appInfo = await getAppInfo();
    logStartup('info', 'app.getInfo() resolved.', appInfo);

    if (isTauriRuntime() && !appInfo) {
      logStartup('error', 'Desktop runtime probe returned an empty payload.');
      throw new Error('The desktop runtime did not respond during startup.');
    }
  });

  const runBootstrap = useEffectEvent(async () => {
    const runId = bootRunIdRef.current + 1;
    bootRunIdRef.current = runId;
    splashHandoffRunIdRef.current = 0;
    const desktopWindow = getDesktopWindow();

    startedAtRef.current = Date.now();
    stageLogSignatureRef.current = '';
    setMilestones(INITIAL_STARTUP_MILESTONES);
    setStatus('booting');
    setErrorMessage(null);
    setShouldRenderShell(false);
    setIsSplashVisible(true);
    logStartup(
      'info',
      'Bootstrap started.',
      {
        appName,
        distribution: resolveDesktopDistributionId(),
        isTauriRuntime: isTauriRuntime(),
        hasDesktopWindow: Boolean(desktopWindow),
      },
      runId,
    );

    if (desktopWindow) {
      await desktopWindow.setFullscreen(false).catch(() => {
        // Ignore startup fullscreen reset failures and continue booting.
      });
      await desktopWindow
        .isMaximized()
        .then((isMaximizedWindow) => {
          if (!isMaximizedWindow) {
            return;
          }

          logStartup('info', 'Restoring maximized window to default startup size.', undefined, runId);
          return desktopWindow.unmaximize();
        })
        .catch(() => {
          // Ignore startup unmaximize failures and continue booting.
        });
    }

    try {
      await revealStartupWindow();
      if (bootRunIdRef.current !== runId) {
        return;
      }

      setMilestones((current) => ({ ...current, hasWindowPresented: true }));

      await connectDesktopRuntime();
      if (bootRunIdRef.current !== runId) {
        return;
      }

      setMilestones((current) => ({ ...current, hasRuntimeConnected: true }));

      const startupRoute = resolveSidebarStartupRoute(window.location.pathname);
      const warmSidebarRoutesHandle = window.setTimeout(() => {
        if (bootRunIdRef.current !== runId) {
          return;
        }

        prefetchSidebarRoutes(
          listSidebarRoutePrefetchPaths().filter((path) => path !== startupRoute),
        );
      }, 0);
      prefetchSidebarRoute(startupRoute);

      logStartup('info', 'Bootstrapping shell runtime.', undefined, runId);
      await bootstrapShellRuntime();
      if (bootRunIdRef.current !== runId) {
        window.clearTimeout(warmSidebarRoutesHandle);
        return;
      }

      setMilestones((current) => ({ ...current, hasShellBootstrapped: true }));

      logStartup('info', 'Shell runtime bootstrapped. Requesting AppRoot render.', undefined, runId);
      startTransition(() => {
        setShouldRenderShell(true);
        setStatus('launching');
      });
    } catch (error) {
      if (bootRunIdRef.current !== runId) {
        return;
      }

      logStartup('error', 'Bootstrap failed.', error, runId);
      setStatus('error');
      setErrorMessage(resolveErrorMessage(error, appearance.language));
      setShouldRenderShell(false);
      setIsSplashVisible(true);
    }
  });

  useEffect(() => {
    void runBootstrap();
  }, [retrySeed]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#12090a]">
      {shouldRenderShell ? (
        <DesktopProviders>
          <DesktopShellErrorBoundary
            resetKey={retrySeed}
            onError={handleShellRenderError}
          >
            <div className="h-full w-full">
              <AppProviders onLanguagePreferenceChange={handleLanguagePreferenceChange}>
                <DesktopTrayRouteBridge />
                <MainLayout />
              </AppProviders>
            </div>
          </DesktopShellErrorBoundary>
        </DesktopProviders>
      ) : null}

      <DesktopStartupScreen
        appName={appName}
        language={appearance.language}
        progress={progress}
        status={status}
        errorMessage={errorMessage}
        isVisible={isSplashVisible || status === 'error'}
        onRetry={() => {
          setRetrySeed((value) => value + 1);
        }}
      />
    </div>
  );
}

export function resolveDesktopDistributionId(): DistributionId {
  const distribution = import.meta.env.VITE_DISTRIBUTION_ID;
  return distribution === 'cn' ? 'cn' : 'global';
}

export function resolveDesktopBootstrapContext() {
  const distributionId = resolveDesktopDistributionId();
  const manifest = getDistributionManifest(distributionId);

  return {
    appName: manifest.appName,
    initialAppearance: readInitialStartupAppearance(),
  };
}
