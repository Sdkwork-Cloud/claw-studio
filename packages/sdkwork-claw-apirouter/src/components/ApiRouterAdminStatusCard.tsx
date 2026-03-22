import { useState, type FormEvent } from 'react';
import { KeyRound, LogIn, LogOut, RefreshCw, ServerCog } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ApiRouterAdminStatus } from '../services';
import { Button, Input, Label } from '@sdkwork/claw-ui';

export interface ApiRouterAdminStatusCardProps {
  status: ApiRouterAdminStatus;
  isSigningIn?: boolean;
  isSigningOut?: boolean;
  onRefresh: () => void;
  onLogin: (input: { email: string; password: string }) => void;
  onLogout: () => void;
}

function toneClassName(status: ApiRouterAdminStatus['state']) {
  switch (status) {
    case 'authenticated':
      return {
        shell:
          'border-emerald-200/80 bg-emerald-50/90 text-emerald-950 dark:border-emerald-900/80 dark:bg-emerald-950/30 dark:text-emerald-100',
        badge:
          'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950',
      };
    case 'needsLogin':
      return {
        shell:
          'border-amber-200/80 bg-amber-50/90 text-amber-950 dark:border-amber-900/80 dark:bg-amber-950/30 dark:text-amber-100',
        badge:
          'bg-amber-500 text-amber-950 dark:bg-amber-300 dark:text-amber-950',
      };
    case 'needsConfiguration':
      return {
        shell:
          'border-orange-200/80 bg-orange-50/90 text-orange-950 dark:border-orange-900/80 dark:bg-orange-950/30 dark:text-orange-100',
        badge:
          'bg-orange-500 text-orange-950 dark:bg-orange-300 dark:text-orange-950',
      };
    case 'unavailable':
      return {
        shell:
          'border-rose-200/80 bg-rose-50/90 text-rose-950 dark:border-rose-900/80 dark:bg-rose-950/30 dark:text-rose-100',
        badge:
          'bg-rose-600 text-white dark:bg-rose-400 dark:text-rose-950',
      };
    default: {
      const exhaustiveCheck: never = status;
      throw new Error(`Unsupported router admin state: ${exhaustiveCheck}`);
    }
  }
}

function authSourceLabelKey(authSource: ApiRouterAdminStatus['authSource']) {
  switch (authSource) {
    case 'session':
      return 'apiRouterPage.admin.authSource.session';
    case 'managedBootstrap':
      return 'apiRouterPage.admin.authSource.managedBootstrap';
    case 'configuredToken':
      return 'apiRouterPage.admin.authSource.configuredToken';
    case 'none':
      return 'apiRouterPage.admin.authSource.none';
    default: {
      const exhaustiveCheck: never = authSource;
      throw new Error(`Unsupported router auth source: ${exhaustiveCheck}`);
    }
  }
}

function stateLabelKey(state: ApiRouterAdminStatus['state']) {
  switch (state) {
    case 'authenticated':
      return 'apiRouterPage.admin.state.authenticated';
    case 'needsLogin':
      return 'apiRouterPage.admin.state.needsLogin';
    case 'needsConfiguration':
      return 'apiRouterPage.admin.state.needsConfiguration';
    case 'unavailable':
      return 'apiRouterPage.admin.state.unavailable';
    default: {
      const exhaustiveCheck: never = state;
      throw new Error(`Unsupported router admin state: ${exhaustiveCheck}`);
    }
  }
}

function resolveDescriptionKey(status: ApiRouterAdminStatus) {
  if (status.state === 'authenticated') {
    if (status.authSource === 'managedBootstrap') {
      return 'apiRouterPage.admin.messages.managedBootstrapConnected';
    }

    return status.authSource === 'configuredToken'
      ? 'apiRouterPage.admin.messages.configuredTokenConnected'
      : 'apiRouterPage.admin.messages.sessionConnected';
  }

  if (status.state === 'needsLogin') {
    return status.authSource === 'none'
      ? 'apiRouterPage.admin.messages.signInRequired'
      : 'apiRouterPage.admin.messages.reauthenticateRequired';
  }

  if (status.state === 'needsConfiguration') {
    return 'apiRouterPage.admin.messages.configuredTokenConfigurationRequired';
  }

  return null;
}

export function ApiRouterAdminStatusCard({
  status,
  isSigningIn = false,
  isSigningOut = false,
  onRefresh,
  onLogin,
  onLogout,
}: ApiRouterAdminStatusCardProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(status.sessionUser?.email || '');
  const [password, setPassword] = useState('');
  const tone = toneClassName(status.state);
  const descriptionKey = resolveDescriptionKey(status);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLogin({
      email: email.trim(),
      password,
    });
  }

  return (
    <section
      data-slot="api-router-admin-status-card"
      className={`rounded-[28px] border p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur ${tone.shell}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] opacity-70">
            {t('apiRouterPage.admin.title')}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">
              {t('apiRouterPage.admin.heading')}
            </h2>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.badge}`}>
              {t(stateLabelKey(status.state))}
            </span>
          </div>
          <p className="max-w-3xl text-sm leading-6 opacity-85">
            {descriptionKey ? t(descriptionKey) : status.message}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
            {t('apiRouterPage.admin.actions.refresh')}
          </Button>
          {status.allowsManualDisconnect ? (
            <Button type="button" variant="outline" onClick={onLogout} disabled={isSigningOut}>
              <LogOut className="h-4 w-4" />
              {t('apiRouterPage.admin.actions.disconnect')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="rounded-[22px] bg-white/55 p-4 dark:bg-black/20">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-65">
            {t('apiRouterPage.admin.fields.authSource')}
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4" />
            {t(authSourceLabelKey(status.authSource))}
          </div>
        </div>

        <div className="rounded-[22px] bg-white/55 p-4 dark:bg-black/20">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-65">
            {t('apiRouterPage.admin.fields.adminBaseUrl')}
          </div>
          <div className="mt-2 break-all text-sm font-medium">{status.adminBaseUrl}</div>
        </div>

        <div className="rounded-[22px] bg-white/55 p-4 dark:bg-black/20">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-65">
            {t('apiRouterPage.admin.fields.gatewayBaseUrl')}
          </div>
          <div className="mt-2 break-all text-sm font-medium">
            {status.gatewayBaseUrl || t('apiRouterPage.admin.values.autoResolved')}
          </div>
        </div>
      </div>

      {status.authenticated ? (
        <div className="mt-4 rounded-[22px] bg-white/55 p-4 dark:bg-black/20">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ServerCog className="h-4 w-4" />
            {t('apiRouterPage.admin.fields.operator')}
          </div>
          <div className="mt-2 text-sm">
            {status.operator?.email || status.sessionUser?.email || t('apiRouterPage.admin.values.unknown')}
          </div>
          <div className="mt-1 text-xs opacity-75">
            {status.operator?.displayName || status.sessionUser?.displayName || t('apiRouterPage.admin.values.unknown')}
          </div>
        </div>
      ) : status.allowsManualLogin ? (
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div className="rounded-[22px] bg-white/55 p-4 dark:bg-black/20">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="api-router-admin-email">
                  {t('apiRouterPage.admin.fields.email')}
                </Label>
                <Input
                  id="api-router-admin-email"
                  type="email"
                  autoComplete="username"
                  placeholder={t('apiRouterPage.admin.placeholders.email')}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-router-admin-password">
                  {t('apiRouterPage.admin.fields.password')}
                </Label>
                <Input
                  id="api-router-admin-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t('apiRouterPage.admin.placeholders.password')}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm opacity-80">
                {t('apiRouterPage.admin.loginHint')}
              </p>
              <Button type="submit" disabled={isSigningIn || !email.trim() || !password}>
                <LogIn className="h-4 w-4" />
                {t('apiRouterPage.admin.actions.signIn')}
              </Button>
            </div>
          </div>
        </form>
      ) : null}
    </section>
  );
}
