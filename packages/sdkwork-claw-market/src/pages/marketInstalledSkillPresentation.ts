import type {
  Skill,
  SkillInstanceAssetCompatibility,
  SkillInstanceAssetScope,
  SkillInstanceAssetStatus,
} from '@sdkwork/claw-types';

export interface InstalledSkillPresentationCopy {
  installedLabel: string;
  unknownSourceLabel: string;
  fieldLabels: {
    status: string;
    source: string;
    scope: string;
    missingRequirements: string;
  };
  statusLabels: Record<SkillInstanceAssetStatus, string>;
  compatibilityLabels: Record<SkillInstanceAssetCompatibility, string>;
  scopeLabels: Record<SkillInstanceAssetScope, string>;
  formatMissingRequirements: (count: number) => string;
}

export interface InstalledSkillInformationRow {
  id: 'status' | 'source' | 'scope' | 'missingRequirements';
  label: string;
  value: string;
}

export interface InstalledSkillInformation {
  compatibilityValue: string | null;
  rows: InstalledSkillInformationRow[];
}

function getAsset(skill: Skill) {
  return skill.instanceAsset;
}

function getSourceLabel(skill: Skill, copy: InstalledSkillPresentationCopy) {
  const source = getAsset(skill)?.source?.trim();
  if (!source || source.toLowerCase() === 'unknown') {
    return copy.unknownSourceLabel;
  }

  return source;
}

export function buildInstalledSkillCardStatusLabel(
  skill: Skill,
  copy: InstalledSkillPresentationCopy,
) {
  const asset = getAsset(skill);
  if (!asset) {
    return copy.installedLabel;
  }

  if (asset.status !== 'enabled') {
    return `${copy.installedLabel} · ${copy.statusLabels[asset.status]}`;
  }

  if (asset.compatibility !== 'compatible') {
    return `${copy.installedLabel} · ${copy.compatibilityLabels[asset.compatibility]}`;
  }

  return copy.installedLabel;
}

export function buildInstalledSkillInformation(
  skill: Skill,
  copy: InstalledSkillPresentationCopy,
): InstalledSkillInformation {
  const asset = getAsset(skill);
  if (!asset) {
    return {
      compatibilityValue: null,
      rows: [],
    };
  }

  const rows: InstalledSkillInformationRow[] = [
    {
      id: 'status',
      label: copy.fieldLabels.status,
      value: copy.statusLabels[asset.status],
    },
    {
      id: 'source',
      label: copy.fieldLabels.source,
      value: getSourceLabel(skill, copy),
    },
    {
      id: 'scope',
      label: copy.fieldLabels.scope,
      value: copy.scopeLabels[asset.scope],
    },
  ];

  if (asset.missingRequirementCount > 0) {
    rows.push({
      id: 'missingRequirements',
      label: copy.fieldLabels.missingRequirements,
      value: copy.formatMissingRequirements(asset.missingRequirementCount),
    });
  }

  return {
    compatibilityValue: copy.compatibilityLabels[asset.compatibility],
    rows,
  };
}

export function createInstalledSkillPresentationCopy(
  t: (key: string, options?: Record<string, unknown>) => string,
): InstalledSkillPresentationCopy {
  return {
    installedLabel: t('market.labels.installed'),
    unknownSourceLabel: t('market.installedSkill.unknownSource'),
    fieldLabels: {
      status: t('market.installedSkill.fieldLabels.status'),
      source: t('market.installedSkill.fieldLabels.source'),
      scope: t('market.installedSkill.fieldLabels.scope'),
      missingRequirements: t('market.installedSkill.fieldLabels.missingRequirements'),
    },
    statusLabels: {
      enabled: t('market.installedSkill.status.enabled'),
      disabled: t('market.installedSkill.status.disabled'),
      blocked: t('market.installedSkill.status.blocked'),
    },
    compatibilityLabels: {
      compatible: t('market.installedSkill.compatibility.compatible'),
      attention: t('market.installedSkill.compatibility.attention'),
      blocked: t('market.installedSkill.compatibility.blocked'),
    },
    scopeLabels: {
      workspace: t('market.installedSkill.scope.workspace'),
      managed: t('market.installedSkill.scope.managed'),
      bundled: t('market.installedSkill.scope.bundled'),
      unknown: t('market.installedSkill.scope.unknown'),
    },
    formatMissingRequirements: (count) =>
      t('market.installedSkill.missingRequirementsValue', { count }),
  };
}
