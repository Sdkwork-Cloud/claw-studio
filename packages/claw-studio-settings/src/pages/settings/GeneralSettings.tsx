import React, { useEffect } from 'react';
import { ArrowUpRight, Check, Globe, Laptop, LoaderCircle, Moon, RefreshCw, Sun } from 'lucide-react';
import { Section, ToggleRow } from './Shared';
import { useAppStore, ThemeMode, ThemeColor, Language } from '@sdkwork/claw-studio-business/stores/useAppStore';
import { useUpdateStore } from '@sdkwork/claw-studio-business/stores/useUpdateStore';

const THEME_COLORS: { id: ThemeColor; label: string; colorClass: string }[] = [
  { id: 'tech-blue', label: 'Tech Blue', colorClass: 'bg-blue-500' },
  { id: 'lobster', label: 'Lobster', colorClass: 'bg-red-500' },
  { id: 'green-tech', label: 'Green Tech', colorClass: 'bg-emerald-500' },
  { id: 'zinc', label: 'Zinc', colorClass: 'bg-zinc-500' },
  { id: 'violet', label: 'Violet', colorClass: 'bg-violet-500' },
  { id: 'rose', label: 'Rose', colorClass: 'bg-rose-500' },
];

export function GeneralSettings() {
  const { themeMode, setThemeMode, themeColor, setThemeColor, language, setLanguage } = useAppStore();
  const updateStatus = useUpdateStore((state) => state.status);
  const updateResult = useUpdateStore((state) => state.result);
  const updateError = useUpdateStore((state) => state.error);
  const lastCheckedAt = useUpdateStore((state) => state.lastCheckedAt);
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates);
  const openLatestUpdateTarget = useUpdateStore((state) => state.openLatestUpdateTarget);
  const isCheckingUpdates = updateStatus === 'checking';
  const hasUpdate = updateResult?.hasUpdate === true;
  const checkedAtText = lastCheckedAt ? new Date(lastCheckedAt).toLocaleString() : 'Not checked yet';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">General</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage your basic application preferences.</p>
      </div>

      <div className="space-y-6">
        <Section title="Appearance">
          <div className="space-y-6">
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Theme Mode</div>
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
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Theme Color</div>
              <div className="flex flex-wrap gap-4">
                {THEME_COLORS.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setThemeColor(color.id)}
                    className={`group relative flex flex-col items-center gap-2`}
                  >
                    <div className={`w-10 h-10 rounded-full ${color.colorClass} flex items-center justify-center shadow-sm ring-2 ring-offset-2 dark:ring-offset-zinc-950 transition-all ${
                      themeColor === color.id ? 'ring-zinc-900 dark:ring-zinc-100 scale-110' : 'ring-transparent hover:scale-105'
                    }`}>
                      {themeColor === color.id && <Check className="w-5 h-5 text-white" />}
                    </div>
                    <span className={`text-xs font-medium ${themeColor === color.id ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300'}`}>
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
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Language</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">Select your preferred language</div>
                </div>
              </div>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 shadow-sm outline-none cursor-pointer"
              >
                <option value="en">English (US)</option>
                <option value="zh">中文 (简体)</option>
                <option value="ja">日本語</option>
              </select>
            </div>
          </div>
        </Section>

        <Section title="Startup">
          <div className="space-y-4">
            <ToggleRow 
              title="Launch on startup" 
              description="Automatically start Claw Studio when you log in to your computer."
              enabled={true}
            />
            <ToggleRow 
              title="Start minimized" 
              description="Open the application in the system tray instead of a window."
              enabled={false}
            />
          </div>
        </Section>

        <Section title="Application Updates">
          <div className="space-y-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Desktop update channel</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  Check the latest desktop version from the configured backend service.
                </div>
                <div className="text-xs text-zinc-400 dark:text-zinc-500">Last checked: {checkedAtText}</div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    void checkForUpdates();
                  }}
                  disabled={isCheckingUpdates}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  {isCheckingUpdates ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Check for updates
                </button>
                <button
                  onClick={() => {
                    void openLatestUpdateTarget();
                  }}
                  disabled={!hasUpdate || isCheckingUpdates}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Open update
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {isCheckingUpdates && 'Checking for the latest desktop release...'}
                {updateStatus === 'idle' && 'Update checks have not started yet.'}
                {updateStatus === 'unavailable' && 'Desktop update checks are currently unavailable.'}
                {updateStatus === 'error' && 'The last update check failed.'}
                {updateStatus === 'ready' && !hasUpdate && 'This desktop build is already up to date.'}
                {updateStatus === 'ready' && hasUpdate && `Version ${updateResult?.targetVersion || 'latest'} is available.`}
              </div>
              <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {updateStatus === 'ready' && hasUpdate && (updateResult?.summary || updateResult?.content || 'A newer desktop package is ready to download.')}
                {updateStatus === 'ready' && !hasUpdate && `Current version: ${updateResult?.currentVersion || 'unknown'}`}
                {(updateStatus === 'unavailable' || updateStatus === 'error') && (updateError || 'Review your desktop env configuration and backend connectivity.')}
                {(updateStatus === 'idle' || isCheckingUpdates) && 'The application will query the backend update API with your configured release channel and access token.'}
              </div>

              {hasUpdate && updateResult?.highlights?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {updateResult.highlights.slice(0, 3).map((highlight) => (
                    <span
                      key={highlight}
                      className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 dark:border-primary-900/60 dark:bg-primary-500/10 dark:text-primary-300"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function ThemeOption({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
        active ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-500/10' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
      }`}
    >
      <Icon className={`w-6 h-6 ${active ? 'text-primary-500 dark:text-primary-400' : 'text-zinc-500 dark:text-zinc-400'}`} />
      <span className={`text-sm font-medium ${active ? 'text-primary-700 dark:text-primary-300' : 'text-zinc-700 dark:text-zinc-300'}`}>{label}</span>
    </button>
  );
}
