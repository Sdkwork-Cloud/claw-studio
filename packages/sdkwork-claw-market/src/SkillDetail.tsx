import { lazy } from 'react';

const SkillDetailPage = lazy(() =>
  import('./pages/SkillDetail').then((module) => ({
    default: module.SkillDetail,
  })),
);

export function SkillDetail() {
  return <SkillDetailPage />;
}
