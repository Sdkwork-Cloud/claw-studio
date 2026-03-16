import React, { useEffect, useState } from 'react';
import { AlertTriangle, Database, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Section, ToggleRow } from './Shared';
import { settingsService, type UserPreferences } from './services';

export function DataPrivacySettings() {
  const [prefs, setPrefs] = useState<UserPreferences['privacy'] | null>(null);

  useEffect(() => {
    settingsService.getPreferences().then((preferences) => setPrefs(preferences.privacy));
  }, []);

  const handleToggle = async (key: keyof UserPreferences['privacy']) => {
    if (!prefs) {
      return;
    }

    const nextPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(nextPrefs);

    try {
      await settingsService.updatePreferences({ privacy: nextPrefs });
    } catch (error) {
      setPrefs(prefs);
      toast.error('Failed to update preference');
    }
  };

  if (!prefs) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Data & Privacy
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Control your data, telemetry, and account deletion.
        </p>
      </div>

      <div className="space-y-6">
        <Section title="Telemetry & Analytics">
          <div className="space-y-4">
            <ToggleRow
              title="Share usage data"
              description="Help us improve Claw Studio by sharing anonymous usage statistics and crash reports."
              enabled={prefs.shareUsageData}
              onToggle={() => handleToggle('shareUsageData')}
            />
            <ToggleRow
              title="Personalized recommendations"
              description="Allow us to suggest skills and packs based on your installed devices."
              enabled={prefs.personalizedRecommendations}
              onToggle={() => handleToggle('personalizedRecommendations')}
            />
          </div>
        </Section>

        <Section title="Export Data">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <Database className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Download your data
              </h4>
              <p className="mb-4 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Get a copy of your OpenClaw data, including device configurations,
                installed skills, and task history in JSON format.
              </p>
              <button
                onClick={() =>
                  toast.success('Data export requested. You will receive an email shortly.')
                }
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Download className="h-4 w-4" />
                Request Data Export
              </button>
            </div>
          </div>
        </Section>

        <Section title="Delete Account">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
              <AlertTriangle className="h-6 w-6 text-red-500 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-600 dark:text-red-400">
                Permanently delete account
              </h4>
              <p className="mb-4 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Once you delete your account, there is no going back. Please be certain.
                All your devices will be unlinked and data will be permanently erased.
              </p>
              <button
                onClick={() =>
                  toast.success('Account deletion initiated. Please check your email to confirm.')
                }
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
              >
                <Trash2 className="h-4 w-4" />
                Delete Account
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
