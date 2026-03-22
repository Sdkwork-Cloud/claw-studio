import { lazy } from 'react';

const SkillPackDetailPage = lazy(() =>
  import('./pages/SkillPackDetail').then((module) => ({
    default: module.SkillPackDetail,
  })),
);

export function SkillPackDetail() {
  return <SkillPackDetailPage />;
}
