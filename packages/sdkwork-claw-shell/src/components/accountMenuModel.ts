import type { ElementType } from 'react';
import {
  CircleUserRound,
  Coins,
  Crown,
  FileText,
  LogIn,
  LogOut,
  MessageSquareMore,
  Settings2,
} from 'lucide-react';

export const MOBILE_APP_DOWNLOAD_URL = 'https://clawstudio.sdkwork.com/download/app/mobile';

export type AccountMenuSectionId = 'primary' | 'secondary';
export type PointsViewRoute = 'membership' | 'wallet';
export type AccountMenuActionId =
  | 'membership-center'
  | 'points-center'
  | 'profile'
  | 'settings'
  | 'feedback'
  | 'docs'
  | 'sign-out'
  | 'login';

export interface AccountMenuAction {
  id: AccountMenuActionId;
  icon: ElementType;
  labelKey: string;
  to?: string;
  tone?: 'default' | 'danger';
}

export interface AccountMenuSection {
  id: AccountMenuSectionId;
  actions: AccountMenuAction[];
}

export function resolvePointsViewPath(view: PointsViewRoute): string {
  return `/points?view=${view}`;
}

export function buildAuthenticatedAccountMenuSections(): AccountMenuSection[] {
  return [
    {
      id: 'primary',
      actions: [
        {
          id: 'membership-center',
          icon: Crown,
          labelKey: 'headerAccountMenu.membershipCenter',
          to: resolvePointsViewPath('membership'),
        },
        {
          id: 'points-center',
          icon: Coins,
          labelKey: 'headerAccountMenu.pointsCenter',
          to: resolvePointsViewPath('wallet'),
        },
        {
          id: 'profile',
          icon: CircleUserRound,
          labelKey: 'headerAccountMenu.userInfo',
          to: '/settings?tab=account',
        },
        {
          id: 'settings',
          icon: Settings2,
          labelKey: 'headerAccountMenu.settings',
          to: '/settings',
        },
        {
          id: 'feedback',
          icon: MessageSquareMore,
          labelKey: 'headerAccountMenu.feedback',
          to: '/settings?tab=feedback',
        },
      ],
    },
    {
      id: 'secondary',
      actions: [
        {
          id: 'docs',
          icon: FileText,
          labelKey: 'headerAccountMenu.docs',
          to: '/docs',
        },
        {
          id: 'sign-out',
          icon: LogOut,
          labelKey: 'sidebar.userMenu.logout',
          tone: 'danger',
        },
      ],
    },
  ];
}

export function buildGuestAccountMenuSections(loginTarget: string): AccountMenuSection[] {
  return [
    {
      id: 'primary',
      actions: [
        {
          id: 'login',
          icon: LogIn,
          labelKey: 'sidebar.userMenu.login',
          to: loginTarget,
        },
        {
          id: 'settings',
          icon: Settings2,
          labelKey: 'headerAccountMenu.settings',
          to: '/settings',
        },
      ],
    },
    {
      id: 'secondary',
      actions: [
        {
          id: 'docs',
          icon: FileText,
          labelKey: 'headerAccountMenu.docs',
          to: '/docs',
        },
      ],
    },
  ];
}
