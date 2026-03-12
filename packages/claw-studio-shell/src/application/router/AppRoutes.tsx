import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Account } from '@sdkwork/claw-studio-account';
import { Devices } from '@sdkwork/claw-studio-devices';
import { Market, SkillDetail, SkillPackDetail } from '@sdkwork/claw-studio-market';
import { Install, InstallDetail } from '@sdkwork/claw-studio-install';
import { Channels } from '@sdkwork/claw-studio-channels';
import { Instances, InstanceDetail } from '@sdkwork/claw-studio-instances';
import { Tasks } from '@sdkwork/claw-studio-tasks';
import { Chat } from '@sdkwork/claw-studio-chat';
import { Settings } from '@sdkwork/claw-studio-settings';
import { Docs } from '@sdkwork/claw-studio-docs';
import { AppStore, AppDetail } from '@sdkwork/claw-studio-apps';
import { Community, CommunityPostDetail, NewPost } from '@sdkwork/claw-studio-community';
import { Extensions } from '@sdkwork/claw-studio-extensions';
import { GitHubRepos, GitHubRepoDetail } from '@sdkwork/claw-studio-github';
import { HuggingFaceModels, HuggingFaceModelDetail } from '@sdkwork/claw-studio-huggingface';
import { ClawCenter, ClawDetail } from '@sdkwork/claw-studio-claw-center';
import { ROUTE_PATHS } from './routePaths';

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
        <Route path={ROUTE_PATHS.ROOT} element={<Navigate to={ROUTE_PATHS.CHAT} replace />} />
        <Route path={ROUTE_PATHS.ACCOUNT} element={<PageWrapper><Account /></PageWrapper>} />
        <Route path={ROUTE_PATHS.INSTALL} element={<PageWrapper><Install /></PageWrapper>} />
        <Route path={ROUTE_PATHS.INSTALL_DETAIL} element={<PageWrapper><InstallDetail /></PageWrapper>} />
        <Route path={ROUTE_PATHS.INSTANCES} element={<PageWrapper><Instances /></PageWrapper>} />
        <Route path={ROUTE_PATHS.INSTANCE_DETAIL} element={<PageWrapper><InstanceDetail /></PageWrapper>} />
        <Route path={ROUTE_PATHS.DEVICES} element={<PageWrapper><Devices /></PageWrapper>} />
        <Route path={ROUTE_PATHS.CLAW_CENTER} element={<PageWrapper><ClawCenter /></PageWrapper>} />
        <Route path={ROUTE_PATHS.CLAW_DETAIL} element={<PageWrapper><ClawDetail /></PageWrapper>} />
        <Route path={ROUTE_PATHS.MARKET} element={<PageWrapper><Market /></PageWrapper>} />
        <Route path={ROUTE_PATHS.SKILL_DETAIL} element={<PageWrapper><SkillDetail /></PageWrapper>} />
        <Route path={ROUTE_PATHS.SKILL_PACK_DETAIL} element={<PageWrapper><SkillPackDetail /></PageWrapper>} />
        <Route path={ROUTE_PATHS.APPS} element={<PageWrapper><AppStore /></PageWrapper>} />
        <Route path={ROUTE_PATHS.APP_DETAIL} element={<PageWrapper><AppDetail /></PageWrapper>} />
        <Route path={ROUTE_PATHS.EXTENSIONS} element={<PageWrapper><Extensions /></PageWrapper>} />
        <Route path={ROUTE_PATHS.COMMUNITY} element={<PageWrapper><Community /></PageWrapper>} />
        <Route path={ROUTE_PATHS.COMMUNITY_NEW} element={<PageWrapper><NewPost /></PageWrapper>} />
        <Route path={ROUTE_PATHS.COMMUNITY_DETAIL} element={<PageWrapper><CommunityPostDetail /></PageWrapper>} />
        <Route path={ROUTE_PATHS.GITHUB} element={<PageWrapper><GitHubRepos /></PageWrapper>} />
        <Route path={ROUTE_PATHS.GITHUB_DETAIL} element={<PageWrapper><GitHubRepoDetail /></PageWrapper>} />
        <Route path={ROUTE_PATHS.HUGGINGFACE} element={<PageWrapper><HuggingFaceModels /></PageWrapper>} />
        <Route path={ROUTE_PATHS.HUGGINGFACE_DETAIL} element={<PageWrapper><HuggingFaceModelDetail /></PageWrapper>} />
        <Route path={ROUTE_PATHS.CHANNELS} element={<PageWrapper><Channels /></PageWrapper>} />
        <Route path={ROUTE_PATHS.TASKS} element={<PageWrapper><Tasks /></PageWrapper>} />
        <Route path={ROUTE_PATHS.CHAT} element={<PageWrapper><Chat /></PageWrapper>} />
        <Route path={ROUTE_PATHS.SETTINGS} element={<PageWrapper><Settings /></PageWrapper>} />
        <Route path={ROUTE_PATHS.DOCS} element={<PageWrapper><Docs /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
}
