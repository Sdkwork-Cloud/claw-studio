export type MarketHydrationTab = 'skills' | 'packages' | 'mySkills';

export function shouldLoadMarketInstanceCatalog(input: {
  activeTab: MarketHydrationTab;
  isInstallSkillModalOpen: boolean;
  isInstallPackModalOpen: boolean;
}) {
  return (
    input.activeTab === 'mySkills' ||
    input.isInstallSkillModalOpen ||
    input.isInstallPackModalOpen
  );
}

export function shouldLoadMarketInstalledSkills(input: {
  activeTab: MarketHydrationTab;
  activeInstanceId?: string | null;
}) {
  return input.activeTab === 'mySkills' && Boolean(input.activeInstanceId);
}

export function shouldBlockSkillDetailForLoading(input: {
  isLoadingSkill: boolean;
  isLoadingInstances: boolean;
}) {
  return input.isLoadingSkill;
}

export function shouldBlockSkillPackDetailForLoading(input: {
  isLoadingPack: boolean;
  isLoadingInstances: boolean;
}) {
  return input.isLoadingPack;
}
