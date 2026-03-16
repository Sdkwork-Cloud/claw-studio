import React, { useEffect, useState } from 'react';
import { Laptop, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Section, ToggleRow } from './Shared';
import { settingsService, type UserPreferences } from './services';

export function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences['security'] | null>(null);

  useEffect(() => {
    settingsService.getPreferences().then((preferences) => setPrefs(preferences.security));
  }, []);

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setIsUpdating(true);
    try {
      await settingsService.updatePassword(currentPassword, newPassword);
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error('Failed to update password');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggle = async (key: keyof UserPreferences['security']) => {
    if (!prefs) {
      return;
    }

    const nextPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(nextPrefs);

    try {
      await settingsService.updatePreferences({ security: nextPrefs });
    } catch (error) {
      setPrefs(prefs);
      toast.error('Failed to update preference');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Security
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Manage your password and secure your account.
        </p>
      </div>

      <div className="space-y-6">
        <Section title="Change Password">
          <div className="max-w-md space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="••••••••"
                className="block w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-primary-500 focus:ring-primary-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="••••••••"
                className="block w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-primary-500 focus:ring-primary-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="••••••••"
                className="block w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-primary-500 focus:ring-primary-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="pt-2">
              <button
                onClick={handleUpdatePassword}
                disabled={isUpdating}
                className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isUpdating ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        </Section>

        <Section title="Two-Factor Authentication">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-500/10">
              <Smartphone className="h-6 w-6 text-primary-500 dark:text-primary-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Authenticator App
              </h4>
              <p className="mb-4 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Use an app like Google Authenticator or 1Password to generate one-time
                codes.
              </p>
              <button
                onClick={() => handleToggle('twoFactorAuth')}
                className={`rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
                  prefs?.twoFactorAuth
                    ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {prefs?.twoFactorAuth ? 'Disable 2FA' : 'Enable 2FA'}
              </button>
            </div>
          </div>
        </Section>

        <Section title="Security Alerts">
          <div className="space-y-4">
            {prefs ? (
              <ToggleRow
                title="Login Alerts"
                description="Get notified when anyone logs into your account from an unrecognized device."
                enabled={prefs.loginAlerts}
                onToggle={() => handleToggle('loginAlerts')}
              />
            ) : null}
          </div>
        </Section>

        <Section title="Active Sessions">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
              <div className="flex items-center gap-4">
                <Laptop className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    MacBook Pro - Safari
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    San Francisco, CA • Active now
                  </div>
                </div>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                Current
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-4">
                <Smartphone className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    iPhone 13 - Claw Studio App
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    San Francisco, CA • Last active 2 hours ago
                  </div>
                </div>
              </div>
              <button
                onClick={() => toast.success('Session revoked successfully')}
                className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
              >
                Revoke
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
