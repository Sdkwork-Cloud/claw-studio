import type { ReactNode } from 'react';
import { CircleUserRound, Coins, Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AuthUser } from '@sdkwork/claw-core';
import { cn } from '@sdkwork/claw-ui';
import type { AccountMenuAction, AccountMenuSection } from './accountMenuModel';

interface AccountMenuContentProps {
  isAuthenticated: boolean;
  user: AuthUser | null;
  membershipLabel: string;
  pointsLabel: string;
  sections: AccountMenuSection[];
  onAction: (action: AccountMenuAction) => void;
  variant?: 'header' | 'sidebar';
}

function SummaryPill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-zinc-200">
      {icon}
      {children}
    </span>
  );
}

export function AccountMenuContent({
  isAuthenticated,
  user,
  membershipLabel,
  pointsLabel,
  sections,
  onAction,
  variant = 'header',
}: AccountMenuContentProps) {
  const { t } = useTranslation();
  const menuWidthClassName = variant === 'header' ? 'w-[21rem]' : 'w-full';

  return (
    <div
      role="menu"
      aria-label={t('sidebar.userMenu.open')}
      className={cn('rounded-[1.75rem] border border-white/10 bg-zinc-950/96 p-2 shadow-[0_20px_48px_rgba(9,9,11,0.34)] backdrop-blur-xl', menuWidthClassName)}
    >
      <div className="mb-2 rounded-[1.4rem] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[1.15rem] bg-primary-500/15 text-sm font-bold text-primary-100">
            {isAuthenticated && user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="h-full w-full object-cover"
              />
            ) : isAuthenticated ? (
              user?.initials
            ) : (
              <CircleUserRound className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              {isAuthenticated ? user?.displayName : t('sidebar.userMenu.guest')}
            </div>
            <div className="truncate text-xs text-zinc-400">
              {isAuthenticated ? user?.email : t('sidebar.userMenu.loginHint')}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <SummaryPill icon={<Crown className="h-3.5 w-3.5 text-amber-300" />}>
            {membershipLabel}
          </SummaryPill>
          <SummaryPill icon={<Coins className="h-3.5 w-3.5 text-emerald-300" />}>
            {pointsLabel}
          </SummaryPill>
        </div>
      </div>

      {sections.map((section, sectionIndex) => (
        <div
          key={section.id}
          className={cn(sectionIndex > 0 ? 'mt-1 border-t border-white/6 pt-1.5' : '')}
        >
          {section.actions.map((action) => {
            const toneClassName = action.tone === 'danger'
              ? 'text-rose-300 hover:bg-rose-500/10 hover:text-rose-200'
              : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white';

            return (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                onClick={() => onAction(action)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors',
                  toneClassName,
                )}
              >
                <action.icon className={cn('h-4 w-4', action.tone === 'danger' ? 'text-current' : 'text-zinc-500')} />
                <span>{t(action.labelKey)}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
