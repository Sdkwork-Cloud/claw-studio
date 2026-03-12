import { Sidebar } from '../../components/Sidebar';
import { CommandPalette } from '../../components/CommandPalette';
import { GlobalTaskManager } from '../../components/GlobalTaskManager';
import { useKeyboardShortcuts } from '@sdkwork/claw-studio-business';
import { AppRoutes } from '../router/AppRoutes';

export function MainLayout() {
  useKeyboardShortcuts();

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans overflow-hidden transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 overflow-auto relative z-10">
        <AppRoutes />
      </main>
      <CommandPalette />
      <GlobalTaskManager />
    </div>
  );
}
