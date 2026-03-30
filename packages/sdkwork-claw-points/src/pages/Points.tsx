import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { Coins, Crown, Sparkles, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  filterPointsTransactions,
  pointsQueryKeys,
  pointsService,
  type PointsTransactionFilter,
} from '../services';
import {
  formatPoints,
  getCurrentPlanTitle,
} from '../components/pointsCopy';
import { PointsTransactionList } from '../components/PointsTransactionList';
import { resolvePointsPageView } from './pointsViewMode';

const PointsRechargeDialog = lazy(() =>
  import('../components/PointsRechargeDialog').then((module) => ({
    default: module.PointsRechargeDialog,
  })),
);
const PointsUpgradeDialog = lazy(() =>
  import('../components/PointsUpgradeDialog').then((module) => ({
    default: module.PointsUpgradeDialog,
  })),
);

function PointsStatCard({
  icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const toneClassName = tone === 'positive'
    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
    : tone === 'negative'
      ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300'
      : 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300';

  return (
    <article className="rounded-[28px] border border-zinc-200/80 bg-white/92 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-zinc-800/80 dark:bg-zinc-950/72">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClassName}`}>
          {icon}
        </div>
        <div className="text-sm text-zinc-500 dark:text-zinc-400">{label}</div>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
    </article>
  );
}

function renderMembershipMeta(
  summary: ReturnType<typeof pointsService.getEmptyDashboard>['summary'],
  t: (key: string, options?: Record<string, unknown>) => unknown,
  language: string,
) {
  if (!summary.isAuthenticated) {
    return String(t('points.auth.signInRequired'));
  }

  if (summary.currentPlan.status === 'free') {
    return String(t('points.membership.freeMeta'));
  }

  if (summary.currentPlan.remainingDays !== null) {
    return String(
      t('points.membership.remainingDays', {
        days: summary.currentPlan.remainingDays,
      }),
    );
  }

  if (summary.currentPlan.expireTime) {
    return String(
      t('points.membership.expireAt', {
        date: new Intl.DateTimeFormat(language, {
          dateStyle: 'medium',
        }).format(new Date(summary.currentPlan.expireTime)),
      }),
    );
  }

  return String(t('points.membership.vip'));
}

export function Points() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const pageView = resolvePointsPageView(searchParams.get('view'));
  const isMembershipView = pageView === 'membership';
  const [activeFilter, setActiveFilter] = useState<PointsTransactionFilter>('all');
  const [isRechargeOpen, setIsRechargeOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const {
    data = pointsService.getEmptyDashboard(),
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: pointsQueryKeys.dashboard,
    queryFn: () => pointsService.getDashboard(),
    placeholderData: pointsService.getEmptyDashboard(),
  });

  const transactions = useMemo(
    () => filterPointsTransactions(data.transactions, activeFilter),
    [activeFilter, data.transactions],
  );
  const heroEyebrow = isMembershipView ? t('points.page.membershipEyebrow') : t('points.page.eyebrow');
  const heroTitle = isMembershipView ? t('points.page.membershipTitle') : t('points.page.title');
  const heroDescription = isMembershipView
    ? t('points.page.membershipDescription')
    : t('points.page.description');

  if (isError) {
    return (
      <div
        data-slot="points-page"
        className="flex h-full items-center justify-center px-4 py-8"
      >
        <div className="max-w-lg rounded-[30px] border border-zinc-200/80 bg-white/92 p-10 text-center shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-zinc-800/80 dark:bg-zinc-950/70">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t('points.page.errorTitle')}
          </h1>
          <p className="mt-3 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
            {t('points.page.errorDescription')}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-6 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-950"
          >
            {t('points.page.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-slot="points-page"
      className="h-full overflow-y-auto px-4 py-4 sm:px-5 sm:py-5"
    >
      <div className="mx-auto max-w-[1440px] space-y-5">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
          <div
            data-slot="points-hero"
            className="overflow-hidden rounded-[34px] bg-[radial-gradient(circle_at_top_right,_rgba(244,63,94,0.18),_transparent_36%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.92))] px-6 py-7 text-white shadow-[0_24px_72px_rgba(15,23,42,0.2)]"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/65">
                  {heroEyebrow}
                </div>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                  {heroTitle}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72">
                  {heroDescription}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setIsUpgradeOpen(true)}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold transition-colors ${
                    isMembershipView
                      ? 'bg-white text-zinc-950 hover:bg-zinc-100'
                      : 'border border-white/14 bg-white/8 text-white hover:bg-white/12'
                  }`}
                >
                  {t('points.page.upgradeAction')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsRechargeOpen(true)}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold transition-colors ${
                    isMembershipView
                      ? 'border border-white/14 bg-white/8 text-white hover:bg-white/12'
                      : 'bg-white text-zinc-950 hover:bg-zinc-100'
                  }`}
                >
                  {t('points.page.rechargeAction')}
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)]">
              <div className={`rounded-[28px] p-5 backdrop-blur ${
                isMembershipView ? 'bg-white/6' : 'border border-white/14 bg-white/10'
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-white/65">
                      {t('points.page.availablePoints')}
                    </div>
                    <div className="mt-3 text-5xl font-semibold tracking-tight">
                      {isLoading ? '...' : formatPoints(data.summary.balancePoints, language)}
                    </div>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-[24px] bg-white/10 text-sky-200">
                    <Coins className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-500/12 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  {data.summary.isAuthenticated
                    ? isMembershipView
                      ? t('points.page.membershipSecondaryHint')
                      : t('points.page.growthHint')
                    : t('points.auth.signInRequired')}
                </div>
              </div>

              <div className={`rounded-[28px] p-5 backdrop-blur ${
                isMembershipView ? 'border border-white/14 bg-white/10' : 'bg-white/6'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/18 text-rose-200">
                    <Crown className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm text-white/65">
                      {t('points.page.currentPlan')}
                    </div>
                    <div className="mt-1 text-xl font-semibold text-white">
                      {getCurrentPlanTitle(t, data.summary.currentPlan)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-[22px] bg-white/6 px-4 py-3 text-sm text-white/72">
                  {renderMembershipMeta(data.summary, t, language)}
                </div>
                <div className="mt-4 text-sm text-white/65">
                  {data.summary.pointsToCashRate
                    ? t('points.page.rateMeta', {
                      rate: formatPoints(data.summary.pointsToCashRate, language),
                    })
                    : t('points.page.rateUnavailable')}
                </div>
                <div className="mt-4 inline-flex items-center rounded-full bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/80">
                  {isMembershipView ? t('points.page.membershipPrimaryHint') : t('points.page.walletPrimaryHint')}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3 xl:grid-cols-1">
            <PointsStatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label={t('points.page.earnedThisMonth')}
              value={`+${formatPoints(data.summary.earnedThisMonth, language)}`}
              tone="positive"
            />
            <PointsStatCard
              icon={<TrendingDown className="h-5 w-5" />}
              label={t('points.page.spentThisMonth')}
              value={`-${formatPoints(data.summary.spentThisMonth, language)}`}
              tone="negative"
            />
            <PointsStatCard
              icon={<Wallet className="h-5 w-5" />}
              label={t('points.page.rateTitle')}
              value={data.summary.pointsToCashRate
                ? String(
                  t('points.page.rateValue', {
                    rate: formatPoints(data.summary.pointsToCashRate, language),
                  })
                )
                : t('points.page.rateUnavailable')}
            />
          </div>
        </section>

        <PointsTransactionList
          transactions={transactions}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      </div>

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
