import React, { useEffect, useState } from 'react';
import { Laptop, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useLocalizedText } from '@sdkwork/claw-i18n';
import { Button, Input, Label, Switch } from '@sdkwork/claw-ui';
import { Section, ToggleRow } from './Shared';
import { settingsService, type UserPreferences } from './services';

export function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences['security'] | null>(null);
  const { text } = useLocalizedText();
  const passwordPlaceholder = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

  useEffect(() => {
    settingsService.getPreferences().then((preferences) => setPrefs(preferences.security));
  }, []);

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(text('Please fill in all password fields', '\u8bf7\u586b\u5199\u6240\u6709\u5bc6\u7801\u5b57\u6bb5'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(text('New passwords do not match', '\u4e24\u6b21\u8f93\u5165\u7684\u65b0\u5bc6\u7801\u4e0d\u4e00\u81f4'));
      return;
    }

    setIsUpdating(true);
    try {
      await settingsService.updatePassword(currentPassword, newPassword);
      toast.success(text('Password updated successfully', '\u5bc6\u7801\u66f4\u65b0\u6210\u529f'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast.error(text('Failed to update password', '\u66f4\u65b0\u5bc6\u7801\u5931\u8d25'));
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
    } catch {
      setPrefs(prefs);
      toast.error(text('Failed to update preference', '\u66f4\u65b0\u504f\u597d\u8bbe\u7f6e\u5931\u8d25'));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {text('Security', '\u5b89\u5168')}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {text('Manage your password and secure your account.', '\u7ba1\u7406\u4f60\u7684\u5bc6\u7801\u5e76\u4fdd\u62a4\u8d26\u6237\u5b89\u5168\u3002')}
        </p>
      </div>

      <div className="space-y-6">
        <Section title={text('Change Password', '\u4fee\u6539\u5bc6\u7801')}>
          <div className="max-w-md space-y-4">
            <div>
              <Label className="mb-2 block">
                {text('Current Password', '\u5f53\u524d\u5bc6\u7801')}
              </Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder={passwordPlaceholder}
              />
            </div>
            <div>
              <Label className="mb-2 block">
                {text('New Password', '\u65b0\u5bc6\u7801')}
              </Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder={passwordPlaceholder}
              />
            </div>
            <div>
              <Label className="mb-2 block">
                {text('Confirm New Password', '\u786e\u8ba4\u65b0\u5bc6\u7801')}
              </Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={passwordPlaceholder}
              />
            </div>
            <div className="pt-2">
              <Button
                onClick={handleUpdatePassword}
                disabled={isUpdating}
                variant="outline"
                className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isUpdating ? text('Updating...', '\u66f4\u65b0\u4e2d...') : text('Update Password', '\u66f4\u65b0\u5bc6\u7801')}
              </Button>
            </div>
          </div>
        </Section>

        <Section title={text('Two-Factor Authentication', '\u53cc\u91cd\u8eab\u4efd\u9a8c\u8bc1')}>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-500/10">
              <Smartphone className="h-6 w-6 text-primary-500 dark:text-primary-400" />
            </div>
            <div className="flex-1 space-y-4">
              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {text('Authenticator App', '\u9a8c\u8bc1\u5668\u5e94\u7528')}
              </h4>
              <p className="mb-4 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {text(
                  'Use an app like Google Authenticator or 1Password to generate one-time codes.',
                  '\u4f7f\u7528 Google Authenticator \u6216 1Password \u7b49\u5e94\u7528\u751f\u6210\u4e00\u6b21\u6027\u9a8c\u8bc1\u7801\u3002',
                )}
              </p>
              <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {prefs?.twoFactorAuth
                      ? text('Disable 2FA', '\u5173\u95ed\u53cc\u91cd\u9a8c\u8bc1')
                      : text('Enable 2FA', '\u5f00\u542f\u53cc\u91cd\u9a8c\u8bc1')}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {text(
                      'Toggle multi-factor protection for this account.',
                      '\u5207\u6362\u5f53\u524d\u8d26\u6237\u7684\u591a\u91cd\u9a8c\u8bc1\u4fdd\u62a4\u3002',
                    )}
                  </div>
                </div>
                <Switch
                  checked={Boolean(prefs?.twoFactorAuth)}
                  onCheckedChange={() => handleToggle('twoFactorAuth')}
                />
              </div>
            </div>
          </div>
        </Section>

        <Section title={text('Security Alerts', '\u5b89\u5168\u63d0\u9192')}>
          <div className="space-y-4">
            {prefs ? (
              <ToggleRow
                title={text('Login Alerts', '\u767b\u5f55\u63d0\u9192')}
                description={text(
                  'Get notified when anyone logs into your account from an unrecognized device.',
                  '\u5f53\u6709\u4eba\u901a\u8fc7\u672a\u8bc6\u522b\u8bbe\u5907\u767b\u5f55\u4f60\u7684\u8d26\u6237\u65f6\u901a\u77e5\u4f60\u3002',
                )}
                enabled={prefs.loginAlerts}
                onToggle={() => handleToggle('loginAlerts')}
              />
            ) : null}
          </div>
        </Section>

        <Section title={text('Active Sessions', '\u6d3b\u8dc3\u4f1a\u8bdd')}>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
              <div className="flex items-center gap-4">
                <Laptop className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {text('MacBook Pro - Safari', 'MacBook Pro - Safari')}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {text('San Francisco, CA \u2022 Active now', '\u65e7\u91d1\u5c71\uff0c\u52a0\u5dde \u2022 \u5f53\u524d\u6d3b\u8dc3')}
                  </div>
                </div>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                {text('Current', '\u5f53\u524d\u8bbe\u5907')}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-4">
                <Smartphone className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {text('iPhone 13 - Claw Studio App', 'iPhone 13 - Claw Studio \u5e94\u7528')}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {text('San Francisco, CA \u2022 Last active 2 hours ago', '\u65e7\u91d1\u5c71\uff0c\u52a0\u5dde \u2022 2 \u5c0f\u65f6\u524d\u6d3b\u8dc3')}
                  </div>
                </div>
              </div>
              <button
                onClick={() => toast.success(text('Session revoked successfully', '\u4f1a\u8bdd\u5df2\u6210\u529f\u64a4\u9500'))}
                className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
              >
                {text('Revoke', '\u64a4\u9500')}
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
