import { lazy } from 'react';

const AppStorePage = lazy(() =>
  import('./pages/apps/AppStore').then((module) => ({
    default: module.AppStore,
  })),
);

export function AppStore() {
  return <AppStorePage />;
}
