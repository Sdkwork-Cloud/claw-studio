import React, { useEffect } from 'react';
import { Sun, Moon, Laptop, Globe, Check } from 'lucide-react';
import { Section, ToggleRow } from './Shared';
import { useAppStore, ThemeMode, ThemeColor, Language } from '@sdkwork/claw-studio-business/stores/useAppStore';

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
