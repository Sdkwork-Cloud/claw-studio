import { useEffect, useRef, type ReactNode } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import {
  useAppStore,
  useUpdateStore,
  type LanguagePreference,
} from '@sdkwork/claw-core';
import { ensureI18n } from '@sdkwork/claw-i18n';
import { LanguageManager } from './LanguageManager';
import { ThemeManager } from './ThemeManager';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export interface AppProvidersProps {
  children: ReactNode;
  onLanguagePreferenceChange?: (languagePreference: LanguagePreference) => void;
}

export function AppProviders({
  children,
  onLanguagePreferenceChange,
}: AppProvidersProps) {
  const themeMode = useAppStore((state) => state.themeMode);
  const startupCheckStartedRef = useRef(false);
  const runStartupCheck = useUpdateStore((state) => state.runStartupCheck);

  useEffect(() => {
    void ensureI18n();
  }, []);

  useEffect(() => {
    if (!startupCheckStartedRef.current) {
      startupCheckStartedRef.current = true;
      void runStartupCheck();
    }
  }, [runStartupCheck]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeManager />
      <LanguageManager onLanguagePreferenceChange={onLanguagePreferenceChange} />
      <Router>
        {children}
        <Toaster
          position="bottom-right"
          richColors
          theme={themeMode === 'system' ? 'system' : themeMode === 'dark' ? 'dark' : 'light'}
        />
      </Router>
    </QueryClientProvider>
  );
}
