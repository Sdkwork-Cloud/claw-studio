import { Suspense, lazy, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';

const AuthPage = lazy(() =>
  import('@sdkwork/claw-auth').then((module) => ({
    default: module.AuthPage,
  })),
);
const AuthOAuthCallbackPage = lazy(() =>
  import('@sdkwork/claw-auth').then((module) => ({
    default: module.AuthOAuthCallbackPage,
  })),
);
const AgentMarket = lazy(() =>
  import('@sdkwork/claw-agent').then((module) => ({
    default: module.AgentMarket,
  })),
);
const AppStore = lazy(() =>
  import('@sdkwork/claw-apps').then((module) => ({
    default: module.AppStore,
  })),
);
const AppDetail = lazy(() =>
  import('@sdkwork/claw-apps').then((module) => ({
    default: module.AppDetail,
  })),
);
const ClawMall = lazy(() =>
  import('@sdkwork/claw-mall').then((module) => ({
    default: module.ClawMall,
  })),
);
const ProductDetail = lazy(() =>
  import('@sdkwork/claw-mall').then((module) => ({
    default: module.ProductDetail,
  })),
);
const ClawCenter = lazy(() =>
  import('@sdkwork/claw-center').then((module) => ({
    default: module.ClawCenter,
  })),
);
const ClawDetail = lazy(() =>
  import('@sdkwork/claw-center').then((module) => ({
    default: module.ClawDetail,
  })),
);
const ClawUpload = lazy(() =>
  import('@sdkwork/claw-center').then((module) => ({
    default: module.ClawUpload,
  })),
);
const Channels = lazy(() =>
  import('@sdkwork/claw-channels').then((module) => ({
    default: module.Channels,
  })),
);
const Chat = lazy(() =>
  import('@sdkwork/claw-chat').then((module) => ({
    default: module.Chat,
  })),
);
const Community = lazy(() =>
  import('@sdkwork/claw-community').then((module) => ({
    default: module.Community,
  })),
);
const CommunityPostDetail = lazy(() =>
  import('@sdkwork/claw-community').then((module) => ({
    default: module.CommunityPostDetail,
  })),
);
const NewPost = lazy(() =>
  import('@sdkwork/claw-community').then((module) => ({
    default: module.NewPost,
  })),
);
const Devices = lazy(() =>
  import('@sdkwork/claw-devices').then((module) => ({
    default: module.Devices,
  })),
);
const Dashboard = lazy(() =>
  import('@sdkwork/claw-dashboard').then((module) => ({
    default: module.Dashboard,
  })),
);
const Docs = lazy(() =>
  import('@sdkwork/claw-docs').then((module) => ({
    default: module.Docs,
  })),
);
const Extensions = lazy(() =>
  import('@sdkwork/claw-extensions').then((module) => ({
    default: module.Extensions,
  })),
);
const GitHubRepoDetail = lazy(() =>
  import('@sdkwork/claw-github').then((module) => ({
    default: module.GitHubRepoDetail,
  })),
);
const GitHubRepos = lazy(() =>
  import('@sdkwork/claw-github').then((module) => ({
    default: module.GitHubRepos,
  })),
);
const HuggingFaceModelDetail = lazy(() =>
  import('@sdkwork/claw-huggingface').then((module) => ({
    default: module.HuggingFaceModelDetail,
  })),
);
const HuggingFaceModels = lazy(() =>
  import('@sdkwork/claw-huggingface').then((module) => ({
    default: module.HuggingFaceModels,
  })),
);
const Install = lazy(() =>
  import('@sdkwork/claw-install').then((module) => ({
    default: module.Install,
  })),
);
const InstallDetail = lazy(() =>
  import('@sdkwork/claw-install').then((module) => ({
    default: module.InstallDetail,
  })),
);
const InstanceDetail = lazy(() =>
  import('@sdkwork/claw-instances').then((module) => ({
    default: module.InstanceDetail,
  })),
);
const Instances = lazy(() =>
  import('@sdkwork/claw-instances').then((module) => ({
    default: module.Instances,
  })),
);
const Nodes = lazy(() =>
  import('@sdkwork/claw-instances').then((module) => ({
    default: module.Nodes,
  })),
);
const Market = lazy(() =>
  import('@sdkwork/claw-market').then((module) => ({
    default: module.Market,
  })),
);
const SkillDetail = lazy(() =>
  import('@sdkwork/claw-market').then((module) => ({
    default: module.SkillDetail,
  })),
);
const SkillPackDetail = lazy(() =>
  import('@sdkwork/claw-market').then((module) => ({
    default: module.SkillPackDetail,
  })),
);
const ModelPurchase = lazy(() =>
  import('@sdkwork/claw-model-purchase').then((module) => ({
    default: module.ModelPurchase,
  })),
);
const Points = lazy(() =>
  import('@sdkwork/claw-points').then((module) => ({
    default: module.Points,
  })),
);
const Settings = lazy(() =>
  import('@sdkwork/claw-settings').then((module) => ({
    default: module.Settings,
  })),
);
const KernelCenter = lazy(() =>
  import('@sdkwork/claw-settings').then((module) => ({
    default: module.KernelCenter,
  })),
);
const Tasks = lazy(() =>
  import('@sdkwork/claw-tasks').then((module) => ({
    default: module.Tasks,
  })),
);

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

function RouteFallback() {
  return (
    <div className="flex h-full items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
    </div>
  );
}

function ComingSoonRoute({ message }: { message: string }) {
  return (
    <PageWrapper>
      <div className="p-8 text-center text-zinc-500">{message}</div>
    </PageWrapper>
  );
}

export function AppRoutes() {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <AnimatePresence initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/auth" element={<Navigate to="/login" replace />} />
        <Route
          path="/login"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AuthPage />
            </Suspense>
          }
        />
        <Route
          path="/register"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AuthPage />
            </Suspense>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AuthPage />
            </Suspense>
          }
        />
        <Route
          path="/login/oauth/callback/:provider"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AuthOAuthCallbackPage />
            </Suspense>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Dashboard />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/install"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Install />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/install/:method"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <InstallDetail />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/instances"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Instances />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/nodes"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Nodes />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/instances/:id"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <InstanceDetail />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/devices"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Devices />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/claw-center"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <ClawCenter />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/claw-center/:id"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <ClawDetail />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/claw-upload"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <ClawUpload />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/market"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Market />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/agents"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <AgentMarket />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/market/:id"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <SkillDetail />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/market/packs/:id"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <SkillPackDetail />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/apps"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <AppStore />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/apps/:id"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <AppDetail />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/mall"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <ClawMall />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/mall/:id"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <ProductDetail />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/extensions"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Extensions />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/community"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Community />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/community/new"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <NewPost />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/community/:id"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <CommunityPostDetail />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/github"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <GitHubRepos />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/github/:id"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <GitHubRepoDetail />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/huggingface"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <HuggingFaceModels />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/huggingface/:id"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <HuggingFaceModelDetail />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/channels"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Channels />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/tasks"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Tasks />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/chat"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Chat />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/settings"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Settings />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/kernel"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <KernelCenter />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/docs"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Docs />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/codebox"
          element={<ComingSoonRoute message={t('routes.codeboxComingSoon')} />}
        />
        <Route
          path="/model-purchase"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <ModelPurchase />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/points"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Points />
              </Suspense>
            </PageWrapper>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}
