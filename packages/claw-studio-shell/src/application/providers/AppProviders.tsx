import { useEffect, useRef, type ReactNode } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAppStore } from '@sdkwork/claw-studio-business/stores/useAppStore';
import { useUpdateStore } from '@sdkwork/claw-studio-business/stores/useUpdateStore';
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

export function AppProviders({ children }: { children: ReactNode }) {
  const { themeMode } = useAppStore();
  const startupCheckStartedRef = useRef(false);
  const runStartupCheck = useUpdateStore((state) => state.runStartupCheck);

  useEffect(() => {
    if (!startupCheckStartedRef.current) {
      startupCheckStartedRef.current = true;
      void runStartupCheck();
    }
  }, [runStartupCheck]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeManager />
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
