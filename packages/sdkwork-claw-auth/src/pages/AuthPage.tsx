import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Chrome,
  Github,
  Lock,
  Mail,
  QrCode,
  Smartphone,
  User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@sdkwork/claw-core';
import { Button, Input, Label } from '@sdkwork/claw-ui';

type AuthMode = 'login' | 'register' | 'forgot';

function resolveAuthMode(pathname: string): AuthMode {
  if (pathname === '/register') {
    return 'register';
  }

  if (pathname === '/forgot-password') {
    return 'forgot';
  }

  return 'login';
}

function resolveRedirectTarget(rawTarget: string | null) {
  if (!rawTarget || !rawTarget.startsWith('/')) {
    return '/dashboard';
  }

  if (
    rawTarget === '/auth' ||
    rawTarget === '/login' ||
    rawTarget === '/register' ||
    rawTarget === '/forgot-password'
  ) {
    return '/dashboard';
  }

  return rawTarget;
}

export function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, signIn, register } = useAuthStore();
  const mode = resolveAuthMode(location.pathname);
  const redirectTarget = resolveRedirectTarget(searchParams.get('redirect'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const nextEmail = searchParams.get('email');
    if (nextEmail) {
      setEmail(nextEmail);
    }
  }, [searchParams]);

  const withRedirect = (pathname: string) => {
    const params = new URLSearchParams();
    if (redirectTarget !== '/dashboard') {
      params.set('redirect', redirectTarget);
    }

    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
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
        navigate(redirectTarget, { replace: true });
        return;
      }

      if (mode === 'register') {
        await register({ name, email, password });
        navigate(redirectTarget, { replace: true });
        return;
      }

      navigate(withRedirect('/login'), { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthenticated) {
    return <Navigate to={redirectTarget} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950 sm:p-8">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900 md:flex-row">
        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden bg-zinc-900 p-8 text-white dark:bg-black md:w-2/5">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600/20 to-transparent" />
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 shadow-lg">
              <QrCode className="h-8 w-8 text-white" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">{t('auth.qrLogin')}</h2>
            <p className="mb-8 max-w-[200px] text-sm text-zinc-400">{t('auth.qrDesc')}</p>

            <div className="mb-6 rounded-2xl bg-white p-4 shadow-xl">
              <div className="flex h-48 w-48 items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-100">
                <QrCode className="h-24 w-24 text-zinc-400" />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Smartphone className="h-4 w-4" />
              <span>{t('auth.openApp')}</span>
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
                  <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800">
                    <Github className="h-5 w-5" />
                    {t('auth.providers.github')}
                  </button>
                  <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800">
                    <Chrome className="h-5 w-5" />
                    {t('auth.providers.google')}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
              {mode === 'login' ? (
                <>
                  {t('auth.noAccount')}{' '}
                  <button
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
                    onClick={() => navigate(withRedirect('/login'))}
                    className="font-bold text-primary-600 transition-colors hover:text-primary-500"
                  >
                    {t('auth.signIn')}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => navigate(withRedirect('/login'))}
                  className="mx-auto flex items-center justify-center gap-1 font-bold text-primary-600 transition-colors hover:text-primary-500"
                >
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  {t('auth.backToLogin')}
                </button>
              )}
            </div>

            {mode === 'login' ? null : mode === 'register' ? null : (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => navigate(withRedirect('/register'))}
                  className="text-sm font-medium text-primary-600 transition-colors hover:text-primary-500"
                >
                  {t('auth.signUp')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
