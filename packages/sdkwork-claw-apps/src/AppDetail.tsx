import { lazy } from 'react';

const AppDetailPage = lazy(() =>
  import('./pages/apps/AppDetail').then((module) => ({
    default: module.AppDetail,
  })),
);

export function AppDetail() {
  return <AppDetailPage />;
}
