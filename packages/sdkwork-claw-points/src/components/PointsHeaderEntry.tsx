import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Coins, Crown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { pointsQueryKeys, pointsService } from '../services';
import { formatPoints } from './pointsCopy';

const PointsQuickPanel = lazy(() =>
  import('./PointsQuickPanel').then((module) => ({
    default: module.PointsQuickPanel,
  })),
);
const PointsRechargeDialog = lazy(() =>
  import('./PointsRechargeDialog').then((module) => ({
    default: module.PointsRechargeDialog,
  })),
);
const PointsUpgradeDialog = lazy(() =>
  import('./PointsUpgradeDialog').then((module) => ({
    default: module.PointsUpgradeDialog,
  })),
);

function HeaderChip({
  onClick,
  children,
  title,
  accent = false,
}: {
  onClick: () => void;
  children: ReactNode;
  title: string;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-9 items-center justify-center rounded-2xl px-3 text-xs font-medium transition-colors ${
        accent
          ? 'bg-rose-500/12 text-rose-600 hover:bg-rose-500/18 hover:text-rose-700 dark:bg-rose-500/14 dark:text-rose-300 dark:hover:bg-rose-500/22'
          : 'bg-zinc-950/[0.045] text-zinc-600 hover:bg-zinc-950/[0.08] hover:text-zinc-950 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/[0.12] dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

export function PointsHeaderEntry() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isRechargeOpen, setIsRechargeOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    data = pointsService.getEmptyDashboard(),
  } = useQuery({
    queryKey: pointsQueryKeys.dashboard,
    queryFn: () => pointsService.getDashboard(),
    placeholderData: pointsService.getEmptyDashboard(),
  });

  useEffect(() => {
    if (!isPanelOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsPanelOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isPanelOpen]);

  const handleOpenPointsPage = () => {
    setIsPanelOpen(false);
    navigate('/points');
  };

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      <HeaderChip
        title={t('points.header.upgrade')}
        onClick={() => setIsUpgradeOpen(true)}
        accent
      >
        <Crown className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline">{t('points.header.upgrade')}</span>
        <span className="lg:hidden">{t('points.header.upgradeShort')}</span>
      </HeaderChip>

      <HeaderChip
        title={t('points.header.pointsButton')}
        onClick={() => setIsPanelOpen((open) => !open)}
      >
        <Coins className="mr-2 h-4 w-4" />
        <span className="font-semibold">
          {formatPoints(data.summary.balancePoints, language)}
        </span>
        <span className="ml-1 hidden lg:inline">{t('points.units.points')}</span>
      </HeaderChip>

      <AnimatePresence>
        {isPanelOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 top-[calc(100%+0.75rem)] z-50"
          >
            <Suspense fallback={null}>
              <PointsQuickPanel
                summary={data.summary}
                recentTransactions={data.transactions.slice(0, 4)}
                onRecharge={() => {
                  setIsPanelOpen(false);
                  setIsRechargeOpen(true);
                }}
                onUpgrade={() => {
                  setIsPanelOpen(false);
                  setIsUpgradeOpen(true);
                }}
                onOpenPage={handleOpenPointsPage}
              />
            </Suspense>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isRechargeOpen ? (
        <Suspense fallback={null}>
          <PointsRechargeDialog
            isOpen={isRechargeOpen}
            onClose={() => setIsRechargeOpen(false)}
          />
        </Suspense>
      ) : null}
      {isUpgradeOpen ? (
        <Suspense fallback={null}>
          <PointsUpgradeDialog
            isOpen={isUpgradeOpen}
            onClose={() => setIsUpgradeOpen(false)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
