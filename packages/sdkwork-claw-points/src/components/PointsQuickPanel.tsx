import { ArrowRight, Coins, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@sdkwork/claw-i18n';
import type { PointsSummary, PointsTransaction } from '../services';
import {
  formatCurrencyCny,
  formatPoints,
  getCurrentPlanTitle,
  getTransactionCopy,
} from './pointsCopy';

interface PointsQuickPanelProps {
  summary: PointsSummary;
  recentTransactions: PointsTransaction[];
  onRecharge: () => void;
  onOpenPage: () => void;
  onUpgrade: () => void;
}

export function PointsQuickPanel({
  summary,
  recentTransactions,
  onRecharge,
  onOpenPage,
  onUpgrade,
}: PointsQuickPanelProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;

  return (
    <div className="w-[min(24rem,calc(100vw-1rem))] rounded-[28px] border border-zinc-200/80 bg-white/96 p-4 shadow-[0_24px_72px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/96">
      <div className="rounded-[24px] bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_36%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.92))] p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/65">
              {t('points.quickPanel.eyebrow')}
            </div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">
              {formatPoints(summary.balancePoints, language)}
            </div>
            <div className="mt-1 text-sm text-white/72">
              {summary.isAuthenticated
                ? t('points.quickPanel.pointsAvailable')
                : t('points.quickPanel.guestHint')}
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sky-200">
            <Coins className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/8 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
              {t('points.quickPanel.currentPlan')}
            </div>
            <div className="mt-1 text-sm font-semibold text-white">
              {getCurrentPlanTitle(t, summary.currentPlan)}
            </div>
          </div>
          <div className="rounded-2xl bg-white/8 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
              {t('points.quickPanel.thisMonth')}
            </div>
            <div className="mt-1 text-sm font-semibold text-white">
              +{formatPoints(summary.earnedThisMonth, language)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onRecharge}
          className="rounded-[22px] border border-primary-200 bg-primary-50 px-4 py-3 text-left transition-colors hover:bg-primary-100 dark:border-primary-500/20 dark:bg-primary-500/10 dark:hover:bg-primary-500/15"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-700 dark:text-primary-300">
            <Sparkles className="h-4 w-4" />
            {t('points.quickPanel.recharge')}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {summary.isAuthenticated
              ? t('points.quickPanel.rechargeHint')
              : t('points.quickPanel.authRequired')}
          </div>
        </button>
        <button
          type="button"
          onClick={onUpgrade}
          className="rounded-[22px] border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {t('points.quickPanel.upgrade')}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {summary.isAuthenticated
              ? t('points.quickPanel.upgradeHint')
              : t('points.quickPanel.authRequired')}
          </div>
        </button>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {t('points.quickPanel.recentRecords')}
          </div>
          <button
            type="button"
            onClick={onOpenPage}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-300"
          >
            {t('points.quickPanel.openCenter')}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="mt-3 rounded-[22px] border border-dashed border-zinc-200/80 bg-zinc-50/90 px-4 py-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
            {t('points.quickPanel.noRecords')}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {recentTransactions.map((transaction) => {
              const copy = getTransactionCopy(t, transaction);
              return (
                <div
                  key={transaction.id}
                  className="rounded-[22px] border border-zinc-200/70 bg-zinc-50/90 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {copy.title}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {copy.description}
                      </div>
                    </div>
                    <div
                      className={`shrink-0 text-sm font-semibold ${
                        transaction.direction === 'earned'
                          ? 'text-emerald-600 dark:text-emerald-300'
                          : 'text-zinc-950 dark:text-zinc-50'
                      }`}
                    >
                      {transaction.direction === 'earned' ? '+' : '-'}
                      {formatPoints(transaction.points, language)}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
                    <span>
                      {formatDate(transaction.createdAt, language, {
                        dateStyle: 'medium',
                      })}
                    </span>
                    {transaction.cashAmountCny !== undefined ? (
                      <span>{formatCurrencyCny(transaction.cashAmountCny, language)}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
