import React, { useEffect, useState } from 'react';
import { Check, Globe, Laptop, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  type Language,
  type ThemeColor,
  useAppStore,
} from '@sdkwork/claw-core';
import { Section, ToggleRow } from './Shared';
import { settingsService, type UserPreferences } from './services';

const THEME_COLORS: { id: ThemeColor; label: string; colorClass: string }[] = [
  { id: 'tech-blue', label: 'Tech Blue', colorClass: 'bg-blue-500' },
  { id: 'lobster', label: 'Lobster', colorClass: 'bg-red-500' },
  { id: 'green-tech', label: 'Green Tech', colorClass: 'bg-emerald-500' },
  { id: 'zinc', label: 'Zinc', colorClass: 'bg-zinc-500' },
  { id: 'violet', label: 'Violet', colorClass: 'bg-violet-500' },
  { id: 'rose', label: 'Rose', colorClass: 'bg-rose-500' },
];

export function GeneralSettings() {
  const {
    themeMode,
    setThemeMode,
    themeColor,
    setThemeColor,
    language,
    setLanguage,
    hiddenSidebarItems,
    toggleSidebarItem,
  } = useAppStore();
  const [prefs, setPrefs] = useState<UserPreferences['general'] | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    settingsService.getPreferences().then((preferences) => setPrefs(preferences.general));
  }, []);

  const handleToggle = async (key: keyof UserPreferences['general']) => {
    if (!prefs) {
      return;
    }

    const nextPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(nextPrefs);
    try {
      await settingsService.updatePreferences({ general: nextPrefs });
    } catch (error) {
      setPrefs(prefs);
      toast.error('Failed to update preference');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          General
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Manage your basic application preferences.
        </p>
      </div>

      <div className="space-y-6">
        <Section title="Appearance">
          <div className="space-y-6">
            <div>
              <div className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Theme Mode
              </div>
              <div className="grid grid-cols-3 gap-4">
                <ThemeOption
                  icon={Sun}
                  label="Light"
                  active={themeMode === 'light'}
                  onClick={() => setThemeMode('light')}
                />
                <ThemeOption
                  icon={Moon}
                  label="Dark"
                  active={themeMode === 'dark'}
                  onClick={() => setThemeMode('dark')}
                />
                <ThemeOption
                  icon={Laptop}
                  label="System"
                  active={themeMode === 'system'}
                  onClick={() => setThemeMode('system')}
                />
              </div>
            </div>

            <div>
              <div className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Theme Color
              </div>
              <div className="flex flex-wrap gap-4">
                {THEME_COLORS.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setThemeColor(color.id)}
                    className="group relative flex flex-col items-center gap-2"
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${color.colorClass} shadow-sm ring-2 ring-offset-2 transition-all dark:ring-offset-zinc-950 ${
                        themeColor === color.id
                          ? 'scale-110 ring-zinc-900 dark:ring-zinc-100'
                          : 'ring-transparent hover:scale-105'
                      }`}
                    >
                      {themeColor === color.id ? (
                        <Check className="h-5 w-5 text-white" />
                      ) : null}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        themeColor === color.id
                          ? 'text-zinc-900 dark:text-zinc-100'
                          : 'text-zinc-500 group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-300'
                      }`}
                    >
                      {color.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Language & Region">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <Globe className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Language
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    Select your preferred language
                  </div>
                </div>
              </div>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                className="block cursor-pointer rounded-lg border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-primary-500 focus:ring-primary-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="en">English (US)</option>
                <option value="zh">中文 (简体)</option>
                <option value="ja">日本語</option>
              </select>
            </div>
          </div>
        </Section>

        <Section title="Sidebar Navigation">
          <div className="space-y-4">
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Choose which items to display in the sidebar.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { id: 'chat', label: t('sidebar.aiChat', 'AI Chat') },
                { id: 'channels', label: t('sidebar.channels', 'Channels') },
                { id: 'tasks', label: t('sidebar.cronTasks', 'Cron Tasks') },
                { id: 'apps', label: t('sidebar.appStore', 'App Store') },
                { id: 'market', label: t('sidebar.market', 'ClawHub') },
                { id: 'extensions', label: t('sidebar.extensions', 'Extensions') },
                { id: 'claw-upload', label: t('sidebar.clawUpload', 'Claw Upload') },
                { id: 'community', label: t('sidebar.community', 'Community') },
                { id: 'github', label: t('sidebar.githubRepos', 'GitHub Repos') },
                { id: 'huggingface', label: t('sidebar.huggingFace', 'Hugging Face') },
                { id: 'claw-center', label: t('sidebar.clawMall', 'Claw Mall') },
                { id: 'install', label: t('sidebar.install', 'Install Claw Studio') },
                { id: 'instances', label: t('sidebar.instances', 'Instances') },
                { id: 'devices', label: t('sidebar.devices', 'Devices') },
                { id: 'codebox', label: t('sidebar.codebox', 'CodeBox') },
                { id: 'api-router', label: t('sidebar.apiRouter', 'Api Router') },
              ].map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                >
                  <input
                    type="checkbox"
                    checked={!hiddenSidebarItems.includes(item.id)}
                    onChange={() => toggleSidebarItem(item.id)}
                    className="h-4 w-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-900 dark:checked:bg-primary-500"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Startup">
          <div className="space-y-4">
            {prefs ? (
              <>
                <ToggleRow
                  title="Launch on startup"
                  description="Automatically start Claw Studio when you log in to your computer."
                  enabled={prefs.launchOnStartup}
                  onToggle={() => handleToggle('launchOnStartup')}
                />
                <ToggleRow
                  title="Start minimized"
                  description="Open the application in the system tray instead of a window."
                  enabled={prefs.startMinimized}
                  onToggle={() => handleToggle('startMinimized')}
                />
              </>
            ) : null}
          </div>
        </Section>
      </div>
    </div>
  );
}

function ThemeOption({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-4 transition-all ${
        active
          ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-500/10'
          : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700'
      }`}
    >
      <Icon
        className={`h-6 w-6 ${
          active ? 'text-primary-500 dark:text-primary-400' : 'text-zinc-500 dark:text-zinc-400'
        }`}
      />
      <span
        className={`text-sm font-medium ${
          active
            ? 'text-primary-700 dark:text-primary-300'
            : 'text-zinc-700 dark:text-zinc-300'
        }`}
      >
        {label}
      </span>
    </button>
  );
}
