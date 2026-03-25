import { lazy } from 'react';

const ClawMallPage = lazy(() =>
  import('./pages/mall/ClawMall').then((module) => ({
    default: module.ClawMall,
  })),
);

export function ClawMall() {
  return <ClawMallPage />;
}
