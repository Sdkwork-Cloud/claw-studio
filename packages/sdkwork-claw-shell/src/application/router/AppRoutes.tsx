import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AppDetail, AppStore } from '@sdkwork/claw-apps';
import { AuthPage } from '@sdkwork/claw-auth';
import { ClawCenter, ClawDetail, ClawUpload } from '@sdkwork/claw-center';
import { Channels } from '@sdkwork/claw-channels';
import { Chat } from '@sdkwork/claw-chat';
import { Community, CommunityPostDetail, NewPost } from '@sdkwork/claw-community';
import { Devices } from '@sdkwork/claw-devices';
import { Docs } from '@sdkwork/claw-docs';
import { Extensions } from '@sdkwork/claw-extensions';
import { GitHubRepoDetail, GitHubRepos } from '@sdkwork/claw-github';
import { HuggingFaceModelDetail, HuggingFaceModels } from '@sdkwork/claw-huggingface';
import { Install, InstallDetail } from '@sdkwork/claw-install';
import { InstanceDetail, Instances } from '@sdkwork/claw-instances';
import { Market, SkillDetail, SkillPackDetail } from '@sdkwork/claw-market';
import { Settings } from '@sdkwork/claw-settings';
import { Tasks } from '@sdkwork/claw-tasks';

function PageWrapper({ children }: { children: ReactNode }) {
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

export function AppRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/install" element={<PageWrapper><Install /></PageWrapper>} />
        <Route path="/install/:method" element={<PageWrapper><InstallDetail /></PageWrapper>} />
        <Route path="/instances" element={<PageWrapper><Instances /></PageWrapper>} />
        <Route path="/instances/:id" element={<PageWrapper><InstanceDetail /></PageWrapper>} />
        <Route path="/devices" element={<PageWrapper><Devices /></PageWrapper>} />
        <Route path="/claw-center" element={<PageWrapper><ClawCenter /></PageWrapper>} />
        <Route path="/claw-center/:id" element={<PageWrapper><ClawDetail /></PageWrapper>} />
        <Route path="/claw-upload" element={<PageWrapper><ClawUpload /></PageWrapper>} />
        <Route path="/market" element={<PageWrapper><Market /></PageWrapper>} />
        <Route path="/market/:id" element={<PageWrapper><SkillDetail /></PageWrapper>} />
        <Route path="/market/packs/:id" element={<PageWrapper><SkillPackDetail /></PageWrapper>} />
        <Route path="/apps" element={<PageWrapper><AppStore /></PageWrapper>} />
        <Route path="/apps/:id" element={<PageWrapper><AppDetail /></PageWrapper>} />
        <Route path="/extensions" element={<PageWrapper><Extensions /></PageWrapper>} />
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
        <Route
          path="/codebox"
          element={
            <PageWrapper>
              <div className="p-8 text-center text-zinc-500">CodeBox integration coming soon.</div>
            </PageWrapper>
          }
        />
        <Route
          path="/api-router"
          element={
            <PageWrapper>
              <div className="p-8 text-center text-zinc-500">Api Router integration coming soon.</div>
            </PageWrapper>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}
