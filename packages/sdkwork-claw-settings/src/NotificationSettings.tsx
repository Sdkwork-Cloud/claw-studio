import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useLocalizedText } from '@sdkwork/claw-i18n';
import { Section, ToggleRow } from './Shared';
import { settingsService, type UserPreferences } from './services';

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<UserPreferences['notifications'] | null>(null);
  const { text } = useLocalizedText();

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
      toast.error(
        text('Failed to update preference', '\u66f4\u65b0\u504f\u597d\u8bbe\u7f6e\u5931\u8d25'),
      );
    }
  };

  if (!prefs) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {text('Notifications', '\u901a\u77e5')}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {text(
            'Choose what updates you want to receive.',
            '\u9009\u62e9\u4f60\u5e0c\u671b\u63a5\u6536\u7684\u66f4\u65b0\u901a\u77e5\u3002',
          )}
        </p>
      </div>

      <div className="space-y-6">
        <Section title={text('Email Notifications', '\u90ae\u4ef6\u901a\u77e5')}>
          <div className="space-y-4">
            <ToggleRow
              title={text('System Updates', '\u7cfb\u7edf\u66f4\u65b0')}
              description={text(
                'Receive emails about Claw Studio updates and new features.',
                '\u901a\u8fc7\u90ae\u4ef6\u63a5\u6536 Claw Studio \u66f4\u65b0\u4e0e\u65b0\u529f\u80fd\u901a\u77e5\u3002',
              )}
              enabled={prefs.systemUpdates}
              onToggle={() => handleToggle('systemUpdates')}
            />
            <ToggleRow
              title={text('Task Failures', '\u4efb\u52a1\u5931\u8d25')}
              description={text(
                'Get notified when a scheduled task fails to execute.',
                '\u5f53\u5b9a\u65f6\u4efb\u52a1\u6267\u884c\u5931\u8d25\u65f6\u63a5\u6536\u901a\u77e5\u3002',
              )}
              enabled={prefs.taskFailures}
              onToggle={() => handleToggle('taskFailures')}
            />
            <ToggleRow
              title={text('Security Alerts', '\u5b89\u5168\u63d0\u9192')}
              description={text(
                'Receive alerts about unusual account activity.',
                '\u63a5\u6536\u5173\u4e8e\u8d26\u6237\u5f02\u5e38\u6d3b\u52a8\u7684\u63d0\u9192\u3002',
              )}
              enabled={prefs.securityAlerts}
              onToggle={() => handleToggle('securityAlerts')}
            />
          </div>
        </Section>

        <Section title={text('Desktop Notifications', '\u684c\u9762\u901a\u77e5')}>
          <div className="space-y-4">
            <ToggleRow
              title={text('Task Completions', '\u4efb\u52a1\u5b8c\u6210')}
              description={text(
                'Show a desktop notification when a task finishes successfully.',
                '\u5f53\u4efb\u52a1\u6210\u529f\u5b8c\u6210\u65f6\u663e\u793a\u684c\u9762\u901a\u77e5\u3002',
              )}
              enabled={prefs.taskCompletions}
              onToggle={() => handleToggle('taskCompletions')}
            />
            <ToggleRow
              title={text('New Messages', '\u65b0\u6d88\u606f')}
              description={text(
                'Notify me when I receive a new message in channels.',
                '\u5f53\u6211\u5728\u9891\u9053\u4e2d\u6536\u5230\u65b0\u6d88\u606f\u65f6\u901a\u77e5\u6211\u3002',
              )}
              enabled={prefs.newMessages}
              onToggle={() => handleToggle('newMessages')}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
