import { startTransition, useEffect, useState, type FormEvent } from 'react';
import * as QRCode from 'qrcode';
import {
  ArrowRight,
  Chrome,
  Github,
  LoaderCircle,
  Lock,
  Mail,
  MessageCircle,
  Music2,
  QrCode,
  RefreshCw,
  Smartphone,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  appAuthService,
  type AppAuthLoginQrCode,
  type AppAuthSocialProvider,
  useAuthStore,
} from '@sdkwork/claw-core';
import { Button, Input, Label } from '@sdkwork/claw-ui';
import { buildOAuthCallbackUri, resolveRedirectTarget } from './authRouteUtils.ts';

type AuthMode = 'login' | 'register' | 'forgot';
type QrPanelState = 'idle' | 'loading' | 'pending' | 'scanned' | 'confirmed' | 'expired' | 'error';

const QR_POLL_INTERVAL_MS = 2_000;

function resolveAuthMode(pathname: string): AuthMode {
  if (pathname === '/register') {
    return 'register';
  }

  if (pathname === '/forgot-password') {
    return 'forgot';
  }

  return 'login';
}

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function ProviderGlyph({ provider }: { provider: AppAuthSocialProvider }) {
  if (provider === 'github') {
    return <Github className="h-5 w-5" />;
  }

  if (provider === 'google') {
    return <Chrome className="h-5 w-5" />;
  }

  if (provider === 'wechat') {
    return <MessageCircle className="h-5 w-5" />;
  }

  return (
    <Music2 className="h-5 w-5" />
  );
}

function resolveQrStatusCopy(t: (key: string) => string, state: QrPanelState) {
  if (state === 'loading') {
    return t('auth.qrStatus.loading');
  }
  if (state === 'scanned') {
    return t('auth.qrStatus.scanned');
  }
  if (state === 'confirmed') {
    return t('auth.qrStatus.confirmed');
  }
  if (state === 'expired') {
    return t('auth.qrStatus.expired');
  }
  if (state === 'error') {
    return t('auth.qrStatus.error');
  }
  return t('auth.qrStatus.pending');
}

function resolveQrStatusAccent(state: QrPanelState) {
  if (state === 'scanned') {
    return 'text-amber-300';
  }
  if (state === 'confirmed') {
    return 'text-emerald-300';
  }
  if (state === 'expired' || state === 'error') {
    return 'text-rose-300';
  }
  return 'text-zinc-300';
}

const SOCIAL_PROVIDERS: AppAuthSocialProvider[] = ['wechat', 'douyin', 'github', 'google'];

export function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, signIn, register, sendPasswordReset, applySession } = useAuthStore();
  const mode = resolveAuthMode(location.pathname);
  const redirectTarget = resolveRedirectTarget(searchParams.get('redirect'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeOAuthProvider, setActiveOAuthProvider] = useState<AppAuthSocialProvider | null>(null);
  const [qrState, setQrState] = useState<QrPanelState>('idle');
  const [qrCode, setQrCode] = useState<AppAuthLoginQrCode | null>(null);
  const [qrImageSrc, setQrImageSrc] = useState('');
  const [qrErrorMessage, setQrErrorMessage] = useState('');
  const [qrReloadNonce, setQrReloadNonce] = useState(0);

  useEffect(() => {
    const nextEmail = searchParams.get('email');
    if (nextEmail) {
      setEmail(nextEmail);
    }
  }, [searchParams]);

  useEffect(() => {
    if (mode !== 'login') {
      setQrState('idle');
      setQrCode(null);
      setQrImageSrc('');
      setQrErrorMessage('');
      return;
    }

    let disposed = false;
    let pollTimer: ReturnType<typeof window.setTimeout> | null = null;

    const clearPollTimer = () => {
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
      }
    };

    const schedulePoll = (qrKey: string, delayMs = QR_POLL_INTERVAL_MS) => {
      clearPollTimer();
      pollTimer = window.setTimeout(() => {
        void pollStatus(qrKey);
      }, delayMs);
    };

    const pollStatus = async (qrKey: string) => {
      try {
        const statusResult = await appAuthService.checkLoginQrCodeStatus(qrKey);
        if (disposed) {
          return;
        }

        if (statusResult.status === 'confirmed' && statusResult.session) {
          setQrState('confirmed');
          applySession(statusResult.session);
          startTransition(() => {
            navigate(redirectTarget, { replace: true });
          });
          return;
        }

        setQrState(statusResult.status);

        if (statusResult.status === 'expired') {
          clearPollTimer();
          return;
        }

        schedulePoll(qrKey);
      } catch (error) {
        if (disposed) {
          return;
        }
        setQrState('error');
        setQrErrorMessage(
          readErrorMessage(error, t('auth.errors.qrStatusFailed')),
        );
        clearPollTimer();
      }
    };

    const loadQrCode = async () => {
      setQrState('loading');
      setQrCode(null);
      setQrImageSrc('');
      setQrErrorMessage('');

      try {
        const nextQrCode = await appAuthService.generateLoginQrCode();
        if (disposed) {
          return;
        }

        let nextImageSrc = '';
        if (nextQrCode.qrUrl) {
          nextImageSrc = nextQrCode.qrUrl;
        } else if (nextQrCode.qrContent) {
          nextImageSrc = await QRCode.toDataURL(nextQrCode.qrContent, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 320,
            color: {
              dark: '#111827',
              light: '#ffffff',
            },
          });
        } else {
          throw new Error(t('auth.errors.invalidQrPayload'));
        }

        if (disposed) {
          return;
        }

        setQrCode(nextQrCode);
        setQrImageSrc(nextImageSrc);
        setQrState('pending');
        schedulePoll(nextQrCode.qrKey);
      } catch (error) {
        if (disposed) {
          return;
        }
        setQrState('error');
        setQrErrorMessage(
          readErrorMessage(error, t('auth.errors.qrGenerateFailed')),
        );
      }
    };

    void loadQrCode();

    return () => {
      disposed = true;
      clearPollTimer();
    };
  }, [applySession, mode, navigate, qrReloadNonce, redirectTarget, t]);

  const withRedirect = (pathname: string) => {
    const [basePath, rawQuery = ''] = pathname.split('?');
    const params = new URLSearchParams(rawQuery);
    if (redirectTarget !== '/dashboard') {
      params.set('redirect', redirectTarget);
    }

    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await signIn({ email, password });
        startTransition(() => {
          navigate(redirectTarget, { replace: true });
        });
        return;
      }

      if (mode === 'register') {
        await register({ name, email, password });
        startTransition(() => {
          navigate(redirectTarget, { replace: true });
        });
        return;
      }

      await sendPasswordReset(email);
      startTransition(() => {
        navigate(withRedirect(`/login?email=${encodeURIComponent(email.trim())}`), {
          replace: true,
        });
      });
    } catch (error) {
      toast.error(
        readErrorMessage(
          error,
          mode === 'forgot' ? t('auth.errors.passwordResetFailed') : t('auth.errors.signInFailed'),
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialSignIn = async (provider: AppAuthSocialProvider) => {
    if (activeOAuthProvider) {
      return;
    }

    setActiveOAuthProvider(provider);

    try {
      const authUrl = await appAuthService.getOAuthAuthorizationUrl({
        provider,
        redirectUri: buildOAuthCallbackUri(provider, redirectTarget),
        state: redirectTarget !== '/dashboard' ? redirectTarget : undefined,
      });
      window.location.assign(authUrl);
    } catch (error) {
      setActiveOAuthProvider(null);
      toast.error(readErrorMessage(error, t('auth.errors.oauthStartFailed')));
    }
  };

  if (isAuthenticated) {
    return <Navigate to={redirectTarget} replace />;
  }

  return (
    <div className="relative flex min-h-full items-center justify-center p-4 sm:p-8">
      <div className="relative z-10 flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900 md:flex-row">
        <div className="relative flex w-full flex-col justify-between overflow-hidden bg-zinc-950 p-8 text-white dark:bg-black md:w-2/5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_transparent_62%)]" />

          <div className="relative z-10">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 shadow-lg">
              <QrCode className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-black tracking-tight">{t('auth.qrLogin')}</h2>
            <p className="mt-3 max-w-[260px] text-sm leading-7 text-zinc-300">
              {qrCode?.description || t('auth.qrDesc')}
            </p>
          </div>

          <div className="relative z-10 mt-8">
            <div className="rounded-[28px] bg-white/95 p-4 shadow-2xl">
              <div className="relative overflow-hidden rounded-2xl bg-white">
                {qrImageSrc ? (
                  <img
                    src={qrImageSrc}
                    alt={t('auth.qrAlt')}
                    className={`h-56 w-full object-contain transition-opacity ${
                      qrState === 'expired' || qrState === 'error' ? 'opacity-40' : 'opacity-100'
                    }`}
                  />
                ) : (
                  <div className="flex h-56 items-center justify-center bg-zinc-100">
                    <LoaderCircle className="h-8 w-8 animate-spin text-zinc-400" />
                  </div>
                )}

                {qrState === 'expired' || qrState === 'error' ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/10">
                    <Button
                      type="button"
                      onClick={() => setQrReloadNonce((value) => value + 1)}
                      className="h-auto rounded-xl px-4 py-2.5 text-sm font-bold"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {t('auth.qrRefresh')}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className={`mt-5 text-sm font-medium ${resolveQrStatusAccent(qrState)}`}>
              {resolveQrStatusCopy(t, qrState)}
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {qrState === 'error'
                ? qrErrorMessage
                : qrState === 'scanned'
                  ? t('auth.qrScannedHint')
                  : t('auth.openApp')}
            </p>
            {qrCode?.qrContent ? (
              <div className="mt-4 break-all rounded-2xl bg-white/8 px-3 py-2 font-mono text-[11px] leading-5 text-zinc-300">
                {qrCode.qrContent}
              </div>
            ) : null}
            <div className="mt-5 flex items-center gap-2 text-sm text-zinc-400">
              <Smartphone className="h-4 w-4" />
              <span>{t('auth.qrWeChatHint')}</span>
            </div>
          </div>
        </div>

        <div className="w-full p-8 md:w-3/5 md:p-12">
          <div className="mx-auto max-w-md">
            <div className="mb-8">
              <h1 className="mb-2 text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                {mode === 'login'
                  ? t('auth.welcomeBack')
                  : mode === 'register'
                    ? t('auth.createAccount')
                    : t('auth.resetPassword')}
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400">
                {mode === 'login'
                  ? t('auth.loginDesc')
                  : mode === 'register'
                    ? t('auth.registerDesc')
                    : t('auth.resetDesc')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'register' ? (
                <div>
                  <Label className="mb-1.5 block text-zinc-700 dark:text-zinc-300">
                    {t('auth.name')}
                  </Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <User className="h-5 w-5 text-zinc-400" />
                    </div>
                    <Input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="py-2.5 pl-10 pr-3"
                      placeholder={t('auth.placeholders.name')}
                      required
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <Label className="mb-1.5 block text-zinc-700 dark:text-zinc-300">
                  {t('auth.email')}
                </Label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-5 w-5 text-zinc-400" />
                  </div>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="py-2.5 pl-10 pr-3"
                    placeholder={t('auth.placeholders.email')}
                    required
                  />
                </div>
              </div>

              {mode !== 'forgot' ? (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label className="text-zinc-700 dark:text-zinc-300">
                      {t('auth.password')}
                    </Label>
                    {mode === 'login' ? (
                      <button
                        type="button"
                        onClick={() => navigate(withRedirect('/forgot-password'))}
                        className="text-sm font-medium text-primary-600 transition-colors hover:text-primary-500"
                      >
                        {t('auth.forgotPassword')}
                      </button>
                    ) : null}
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="h-5 w-5 text-zinc-400" />
                    </div>
                    <Input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="py-2.5 pl-10 pr-3"
                      placeholder={t('auth.placeholders.password')}
                      required
                    />
                  </div>
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-auto w-full py-3 font-bold"
              >
                {isSubmitting
                  ? t('common.loading')
                  : mode === 'login'
                    ? t('auth.signIn')
                    : mode === 'register'
                      ? t('auth.signUp')
                      : t('auth.sendResetLink')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            {mode === 'login' ? (
              <div className="mt-8">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-900">
                      {t('auth.continueWith')}
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  {SOCIAL_PROVIDERS.map((provider) => {
                    const isBusy = activeOAuthProvider === provider;
                    return (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => {
                          void handleSocialSignIn(provider);
                        }}
                        disabled={Boolean(activeOAuthProvider)}
                        className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      >
                        <span className="flex items-center gap-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                          <ProviderGlyph provider={provider} />
                          {t(`auth.providers.${provider}`)}
                        </span>
                        {isBusy ? (
                          <LoaderCircle className="h-4 w-4 animate-spin text-primary-500" />
                        ) : (
                          <ArrowRight className="h-4 w-4 text-zinc-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
              {mode === 'login' ? (
                <>
                  {t('auth.noAccount')}{' '}
                  <button
                    type="button"
                    onClick={() => navigate(withRedirect('/register'))}
                    className="font-bold text-primary-600 transition-colors hover:text-primary-500"
                  >
                    {t('auth.signUp')}
                  </button>
                </>
              ) : mode === 'register' ? (
                <>
                  {t('auth.hasAccount')}{' '}
                  <button
                    type="button"
                    onClick={() => navigate(withRedirect('/login'))}
                    className="font-bold text-primary-600 transition-colors hover:text-primary-500"
                  >
                    {t('auth.signIn')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(withRedirect('/login'))}
                  className="mx-auto flex items-center justify-center gap-1 font-bold text-primary-600 transition-colors hover:text-primary-500"
                >
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  {t('auth.backToLogin')}
                </button>
              )}
            </div>

            {mode === 'forgot' ? (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => navigate(withRedirect('/register'))}
                  className="text-sm font-medium text-primary-600 transition-colors hover:text-primary-500"
                >
                  {t('auth.signUp')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
