import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeColor = 'lobster' | 'tech-blue' | 'green-tech' | 'zinc' | 'violet' | 'rose';
export type Language = 'en' | 'zh' | 'ja';

interface AppState {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
  
  language: Language;
  setLanguage: (lang: Language) => void;
}

const getDefaultLanguage = (): Language => {
  if (typeof navigator === 'undefined') return 'en';
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('zh')) return 'zh';
  if (browserLang.startsWith('ja')) return 'ja';
  return 'en';
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      
      themeMode: 'system',
      setThemeMode: (themeMode) => set({ themeMode }),
      
      themeColor: 'lobster',
      setThemeColor: (themeColor) => set({ themeColor }),
      
      language: getDefaultLanguage(),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'claw-studio-app-storage',
    }
  )
);
