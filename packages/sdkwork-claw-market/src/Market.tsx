import { lazy } from 'react';

const MarketPage = lazy(() =>
  import('./pages/Market').then((module) => ({
    default: module.Market,
  })),
);

export function Market() {
  return <MarketPage />;
}
