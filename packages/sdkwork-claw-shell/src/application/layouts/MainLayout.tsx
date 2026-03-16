import { useLocation } from 'react-router-dom';
import { useKeyboardShortcuts } from '@sdkwork/claw-core';
import { CommandPalette } from '../../components/CommandPalette';
import { GlobalTaskManager } from '../../components/GlobalTaskManager';
import { Sidebar } from '../../components/Sidebar';
import { AppRoutes } from '../router/AppRoutes';
import { ROUTE_PATHS } from '../router/routePaths';

export function MainLayout() {
  useKeyboardShortcuts();

  const location = useLocation();
  const isAuthRoute = location.pathname === ROUTE_PATHS.AUTH;

  if (isAuthRoute) {
    return (
      <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans overflow-hidden transition-colors duration-300">
        <main className="flex-1 overflow-auto scrollbar-hide relative z-10">
          <AppRoutes />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans overflow-hidden transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 overflow-auto scrollbar-hide relative z-10">
        <AppRoutes />
      </main>
      <CommandPalette />
      <GlobalTaskManager />
    </div>
  );
}
