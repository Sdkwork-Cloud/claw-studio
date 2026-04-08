import { createElement, lazy } from 'react';

const InstanceDetailPage = lazy(() =>
  import('./pages/InstanceDetail').then((module) => ({
    default: module.InstanceDetail,
  })),
);

export function InstanceDetail() {
  return createElement(InstanceDetailPage);
}
