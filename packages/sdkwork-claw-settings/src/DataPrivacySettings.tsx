import React, { useEffect, useState } from 'react';
import { AlertTriangle, Database, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLocalizedText } from '@sdkwork/claw-i18n';
import { Section, ToggleRow } from './Shared';
import { settingsService, type UserPreferences } from './services';

export function DataPrivacySettings() {
  const [prefs, setPrefs] = useState<UserPreferences['privacy'] | null>(null);
  const { text } = useLocalizedText();

  useEffect(() => {
    void settingsService
      .getPreferences()
      .then((preferences) => setPrefs(preferences.privacy));
  }, []);

  const handleToggle = async (key: keyof UserPreferences['privacy']) => {
    if (!prefs) {
      return;
    }

    const nextPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(nextPrefs);

    try {
      await settingsService.updatePreferences({ privacy: nextPrefs });
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
          {text('Data & Privacy', '\u6570\u636e\u4e0e\u9690\u79c1')}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {text(
            'Control your data, telemetry, and account deletion.',
            '\u7ba1\u7406\u4f60\u7684\u6570\u636e\u3001\u9065\u6d4b\u53ca\u8d26\u6237\u5220\u9664\u8bbe\u7f6e\u3002',
          )}
        </p>
      </div>

      <div className="space-y-6">
        <Section title={text('Telemetry & Analytics', '\u9065\u6d4b\u4e0e\u5206\u6790')}>
          <div className="space-y-4">
            <ToggleRow
              title={text('Share usage data', '\u5206\u4eab\u4f7f\u7528\u6570\u636e')}
              description={text(
                'Help us improve Claw Studio by sharing anonymous usage statistics and crash reports.',
                '\u901a\u8fc7\u5206\u4eab\u533f\u540d\u4f7f\u7528\u7edf\u8ba1\u4e0e\u5d29\u6e83\u62a5\u544a\uff0c\u5e2e\u52a9\u6211\u4eec\u6539\u8fdb Claw Studio\u3002',
              )}
              enabled={prefs.shareUsageData}
              onToggle={() => handleToggle('shareUsageData')}
            />
            <ToggleRow
              title={text(
                'Personalized recommendations',
                '\u4e2a\u6027\u5316\u63a8\u8350',
              )}
              description={text(
                'Allow us to suggest skills and packs based on your installed devices.',
                '\u5141\u8bb8\u6211\u4eec\u57fa\u4e8e\u4f60\u5df2\u5b89\u88c5\u7684\u8bbe\u5907\u4e3a\u4f60\u63a8\u8350\u6280\u80fd\u4e0e\u5957\u88c5\u3002',
              )}
              enabled={prefs.personalizedRecommendations}
              onToggle={() => handleToggle('personalizedRecommendations')}
            />
          </div>
        </Section>

        <Section title={text('Export Data', '\u5bfc\u51fa\u6570\u636e')}>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <Database className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {text('Download your data', '\u4e0b\u8f7d\u4f60\u7684\u6570\u636e')}
              </h4>
              <p className="mb-4 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {text(
                  'Get a copy of your Claw Studio data, including device configurations, installed skills, and task history in JSON format.',
                  '\u83b7\u53d6\u4e00\u4efd Claw Studio \u6570\u636e\u526f\u672c\uff0c\u5305\u62ec\u8bbe\u5907\u914d\u7f6e\u3001\u5df2\u5b89\u88c5\u7684\u6280\u80fd\u4ee5\u53ca JSON \u683c\u5f0f\u7684\u4efb\u52a1\u5386\u53f2\u3002',
                )}
              </p>
              <button
                onClick={() =>
                  toast.success(
                    text(
                      'Data export requested. You will receive an email shortly.',
                      '\u5df2\u63d0\u4ea4\u6570\u636e\u5bfc\u51fa\u7533\u8bf7\uff0c\u7a0d\u540e\u4f1a\u901a\u8fc7\u90ae\u4ef6\u53d1\u9001\u7ed9\u4f60\u3002',
                    ),
                  )
                }
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Download className="h-4 w-4" />
                {text('Request Data Export', '\u7533\u8bf7\u5bfc\u51fa\u6570\u636e')}
              </button>
            </div>
          </div>
        </Section>

        <Section title={text('Delete Account', '\u5220\u9664\u8d26\u6237')}>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
              <AlertTriangle className="h-6 w-6 text-red-500 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-600 dark:text-red-400">
                {text(
                  'Permanently delete account',
                  '\u6c38\u4e45\u5220\u9664\u8d26\u6237',
                )}
              </h4>
              <p className="mb-4 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {text(
                  'Once you delete your account, there is no going back. Please be certain. All your devices will be unlinked and data will be permanently erased.',
                  '\u8d26\u6237\u5220\u9664\u540e\u5c06\u65e0\u6cd5\u6062\u590d\uff0c\u8bf7\u52a1\u5fc5\u786e\u8ba4\u3002\u6240\u6709\u8bbe\u5907\u90fd\u4f1a\u88ab\u89e3\u7ed1\uff0c\u6570\u636e\u4e5f\u5c06\u88ab\u6c38\u4e45\u5220\u9664\u3002',
                )}
              </p>
              <button
                onClick={() =>
                  toast.success(
                    text(
                      'Account deletion initiated. Please check your email to confirm.',
                      '\u5df2\u53d1\u8d77\u8d26\u6237\u5220\u9664\u6d41\u7a0b\uff0c\u8bf7\u67e5\u770b\u90ae\u4ef6\u8fdb\u884c\u786e\u8ba4\u3002',
                    ),
                  )
                }
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
              >
                <Trash2 className="h-4 w-4" />
                {text('Delete Account', '\u5220\u9664\u8d26\u6237')}
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
