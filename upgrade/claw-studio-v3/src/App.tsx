import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { CommandPalette } from './components/CommandPalette';
import { GlobalTaskManager } from './components/GlobalTaskManager';
import { Devices } from './pages/devices/Devices';
import { Market } from './pages/market/Market';
import { SkillDetail } from './pages/market/SkillDetail';
import { SkillPackDetail } from './pages/market/SkillPackDetail';
import { Install } from './pages/install/Install';
import { InstallDetail } from './pages/install/InstallDetail';
import { Channels } from './pages/channels/Channels';
import { Instances } from './pages/instances/Instances';
import { InstanceDetail } from './pages/instances/InstanceDetail';
import { Tasks } from './pages/tasks/Tasks';
import { Chat } from './pages/chat/Chat';
import { Settings } from './pages/settings/Settings';
import { Docs } from './pages/docs/Docs';
import { AppStore } from './pages/apps/AppStore';
import { AppDetail } from './pages/apps/AppDetail';
import { Community } from './pages/community/Community';
import { CommunityPostDetail } from './pages/community/CommunityPostDetail';
import { NewPost } from './pages/community/NewPost';
import { GitHubRepos } from './pages/github/GitHubRepos';
import { GitHubRepoDetail } from './pages/github/GitHubRepoDetail';
import { HuggingFaceModels } from './pages/huggingface/HuggingFaceModels';
import { HuggingFaceModelDetail } from './pages/huggingface/HuggingFaceModelDetail';
import { ClawCenter } from './pages/claw-center/ClawCenter';
import { ClawDetail } from './pages/claw-center/ClawDetail';
import { Extensions } from './pages/extensions/Extensions';
import { Account } from './pages/account/Account';
import { useAppStore } from './store/useAppStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/install" element={<PageWrapper><Install /></PageWrapper>} />
        <Route path="/install/:method" element={<PageWrapper><InstallDetail /></PageWrapper>} />
        <Route path="/instances" element={<PageWrapper><Instances /></PageWrapper>} />
        <Route path="/instances/:id" element={<PageWrapper><InstanceDetail /></PageWrapper>} />
        <Route path="/devices" element={<PageWrapper><Devices /></PageWrapper>} />
        <Route path="/claw-center" element={<PageWrapper><ClawCenter /></PageWrapper>} />
        <Route path="/claw-center/:id" element={<PageWrapper><ClawDetail /></PageWrapper>} />
        <Route path="/market" element={<PageWrapper><Market /></PageWrapper>} />
        <Route path="/market/:id" element={<PageWrapper><SkillDetail /></PageWrapper>} />
        <Route path="/market/packs/:id" element={<PageWrapper><SkillPackDetail /></PageWrapper>} />
        <Route path="/apps" element={<PageWrapper><AppStore /></PageWrapper>} />
        <Route path="/apps/:id" element={<PageWrapper><AppDetail /></PageWrapper>} />
        <Route path="/extensions" element={<PageWrapper><Extensions /></PageWrapper>} />
        <Route path="/account" element={<PageWrapper><Account /></PageWrapper>} />
        <Route path="/community" element={<PageWrapper><Community /></PageWrapper>} />
        <Route path="/community/new" element={<PageWrapper><NewPost /></PageWrapper>} />
        <Route path="/community/:id" element={<PageWrapper><CommunityPostDetail /></PageWrapper>} />
        <Route path="/github" element={<PageWrapper><GitHubRepos /></PageWrapper>} />
        <Route path="/github/:id" element={<PageWrapper><GitHubRepoDetail /></PageWrapper>} />
        <Route path="/huggingface" element={<PageWrapper><HuggingFaceModels /></PageWrapper>} />
        <Route path="/huggingface/:id" element={<PageWrapper><HuggingFaceModelDetail /></PageWrapper>} />
        <Route path="/channels" element={<PageWrapper><Channels /></PageWrapper>} />
        <Route path="/tasks" element={<PageWrapper><Tasks /></PageWrapper>} />
        <Route path="/chat" element={<PageWrapper><Chat /></PageWrapper>} />
        <Route path="/settings" element={<PageWrapper><Settings /></PageWrapper>} />
        <Route path="/docs" element={<PageWrapper><Docs /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

function ThemeManager() {
  const { themeMode, themeColor, language } = useAppStore();

  useEffect(() => {
    const root = document.documentElement;
    
    const applyTheme = () => {
      // Apply theme color
      root.setAttribute('data-theme', themeColor);
      
      // Apply dark mode
      if (
        themeMode === 'dark' || 
        (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      
      // Apply language
      root.setAttribute('lang', language);
    };

    applyTheme();

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode, themeColor, language]);

  return null;
}

function AppContent() {
  useKeyboardShortcuts();
  
  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans overflow-hidden transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 overflow-auto scrollbar-hide relative z-10">
        <AnimatedRoutes />
      </main>
      <CommandPalette />
      <GlobalTaskManager />
    </div>
  );
}

export default function App() {
  const { themeMode } = useAppStore();
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeManager />
      <Router>
        <AppContent />
        <Toaster 
          position="bottom-right" 
          richColors 
          theme={themeMode === 'system' ? 'system' : themeMode === 'dark' ? 'dark' : 'light'} 
        />
      </Router>
    </QueryClientProvider>
  );
}
