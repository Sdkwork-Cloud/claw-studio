import React, { useState, useEffect } from 'react';
import { Section, ToggleRow } from './Shared';
import { settingsService, UserPreferences } from '../../services/settingsService';
import { toast } from 'sonner';

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<UserPreferences['notifications'] | null>(null);

  useEffect(() => {
    settingsService.getPreferences().then(p => setPrefs(p.notifications));
  }, []);

  const handleToggle = async (key: keyof UserPreferences['notifications']) => {
    if (!prefs) return;
    const newValue = !prefs[key];
    setPrefs({ ...prefs, [key]: newValue });
    try {
      await settingsService.updatePreferences({ notifications: { ...prefs, [key]: newValue } });
    } catch (error) {
      setPrefs({ ...prefs, [key]: !newValue });
      toast.error('Failed to update preference');
    }
  };

  if (!prefs) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">Notifications</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Choose what updates you want to receive.</p>
      </div>

      <div className="space-y-6">
        <Section title="Email Notifications">
          <div className="space-y-4">
            <ToggleRow 
              title="System Updates" 
              description="Receive emails about Claw Studio updates and new features."
              enabled={prefs.systemUpdates}
              onToggle={() => handleToggle('systemUpdates')}
            />
            <ToggleRow 
              title="Task Failures" 
              description="Get notified when a scheduled task fails to execute."
              enabled={prefs.taskFailures}
              onToggle={() => handleToggle('taskFailures')}
            />
            <ToggleRow 
              title="Security Alerts" 
              description="Receive alerts about unusual account activity."
              enabled={prefs.securityAlerts}
              onToggle={() => handleToggle('securityAlerts')}
            />
          </div>
        </Section>

        <Section title="Desktop Notifications">
          <div className="space-y-4">
            <ToggleRow 
              title="Task Completions" 
              description="Show a desktop notification when a task finishes successfully."
              enabled={prefs.taskCompletions}
              onToggle={() => handleToggle('taskCompletions')}
            />
            <ToggleRow 
              title="New Messages" 
              description="Notify me when I receive a new message in channels."
              enabled={prefs.newMessages}
              onToggle={() => handleToggle('newMessages')}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
