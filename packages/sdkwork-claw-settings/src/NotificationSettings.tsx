import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Section, ToggleRow } from './Shared';
import { settingsService, type UserPreferences } from './services';

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<UserPreferences['notifications'] | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    void settingsService
      .getPreferences()
      .then((preferences) => setPrefs(preferences.notifications));
  }, []);

  const handleToggle = async (key: keyof UserPreferences['notifications']) => {
    if (!prefs) {
      return;
    }

    const nextPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(nextPrefs);

    try {
      await settingsService.updatePreferences({ notifications: nextPrefs });
    } catch {
      setPrefs(prefs);
      toast.error(t('settings.notifications.updatePreferenceFailed'));
    }
  };

  if (!prefs) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t('settings.notifications.title')}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t('settings.notifications.description')}
        </p>
      </div>

      <div className="space-y-6">
        <Section title={t('settings.notifications.emailTitle')}>
          <div className="space-y-4">
            <ToggleRow
              title={t('settings.notifications.systemUpdates')}
              description={t('settings.notifications.systemUpdatesDescription')}
              enabled={prefs.systemUpdates}
              onToggle={() => handleToggle('systemUpdates')}
            />
            <ToggleRow
              title={t('settings.notifications.taskFailures')}
              description={t('settings.notifications.taskFailuresDescription')}
              enabled={prefs.taskFailures}
              onToggle={() => handleToggle('taskFailures')}
            />
            <ToggleRow
              title={t('settings.notifications.securityAlerts')}
              description={t('settings.notifications.securityAlertsDescription')}
              enabled={prefs.securityAlerts}
              onToggle={() => handleToggle('securityAlerts')}
            />
          </div>
        </Section>

        <Section title={t('settings.notifications.desktopTitle')}>
          <div className="space-y-4">
            <ToggleRow
              title={t('settings.notifications.taskCompletions')}
              description={t('settings.notifications.taskCompletionsDescription')}
              enabled={prefs.taskCompletions}
              onToggle={() => handleToggle('taskCompletions')}
            />
            <ToggleRow
              title={t('settings.notifications.newMessages')}
              description={t('settings.notifications.newMessagesDescription')}
              enabled={prefs.newMessages}
              onToggle={() => handleToggle('newMessages')}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
