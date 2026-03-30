import type {
  AgentWorkbenchSkill,
  AgentWorkbenchSkillScope,
} from '../services';

export interface OpenClawSkillGroup {
  scope: AgentWorkbenchSkillScope;
  skills: AgentWorkbenchSkill[];
}

export interface OpenClawSkillHealth {
  ready: number;
  needsSetup: number;
  blocked: number;
  disabled: number;
}

export interface OpenClawSkillSelectionSummary {
  usesAllowlist: boolean;
  configuredSkillNames: string[];
  visibleSkillNames: string[];
  visibleEnabledSkillNames: string[];
  visibleEnabledSkillCount: number;
  visibleTotalSkillCount: number;
}

export interface OpenClawSkillConfigEnvEntry {
  id: string;
  key: string;
  value: string;
}

export interface OpenClawSkillConfigDraft {
  enabled: boolean;
  apiKey: string;
  envEntries: OpenClawSkillConfigEnvEntry[];
}

const skillScopeOrder: AgentWorkbenchSkillScope[] = [
  'workspace',
  'managed',
  'bundled',
  'unknown',
];

function getSkillDisplayStateRank(skill: AgentWorkbenchSkill) {
  if (skill.disabled) {
    return 3;
  }
  if (skill.blockedByAllowlist) {
    return 2;
  }
  if (!skill.eligible) {
    return 1;
  }
  return 0;
}

function sortSkillsForDisplay(skills: AgentWorkbenchSkill[]) {
  return [...skills].sort((left, right) => {
    const stateDelta = getSkillDisplayStateRank(left) - getSkillDisplayStateRank(right);
    if (stateDelta !== 0) {
      return stateDelta;
    }

    return left.name.localeCompare(right.name);
  });
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function normalizeSkillNames(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function buildSkillSearchHaystack(skill: AgentWorkbenchSkill) {
  return [
    skill.name,
    skill.description,
    skill.skillKey,
    skill.source,
    skill.primaryEnv,
    skill.scope,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase();
}

export function filterOpenClawSkills(
  skills: AgentWorkbenchSkill[],
  query: string,
) {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return skills;
  }

  return skills.filter((skill) => buildSkillSearchHaystack(skill).includes(normalizedQuery));
}

export function buildOpenClawSkillGroups(
  skills: AgentWorkbenchSkill[],
): OpenClawSkillGroup[] {
  return skillScopeOrder
    .map((scope) => ({
      scope,
      skills: sortSkillsForDisplay(skills.filter((skill) => skill.scope === scope)),
    }))
    .filter((group) => group.skills.length > 0);
}

export function buildOpenClawSkillHealth(
  skills: AgentWorkbenchSkill[],
): OpenClawSkillHealth {
  return {
    ready: skills.filter((skill) => !skill.disabled && !skill.blockedByAllowlist && skill.eligible).length,
    needsSetup: skills.filter((skill) => !skill.disabled && !skill.blockedByAllowlist && !skill.eligible).length,
    blocked: skills.filter((skill) => !skill.disabled && skill.blockedByAllowlist).length,
    disabled: skills.filter((skill) => skill.disabled).length,
  };
}

export function buildOpenClawSkillSelectionSummary(
  skills: AgentWorkbenchSkill[],
  configuredSkillNames?: string[],
): OpenClawSkillSelectionSummary {
  const visibleSkillNames = normalizeSkillNames(skills.map((skill) => skill.name));
  const usesAllowlist = configuredSkillNames !== undefined;
  const normalizedConfiguredSkillNames = usesAllowlist
    ? normalizeSkillNames(configuredSkillNames)
    : [];
  const configuredSkillNameSet = new Set(normalizedConfiguredSkillNames);
  const visibleEnabledSkillNames = usesAllowlist
    ? visibleSkillNames.filter((skillName) => configuredSkillNameSet.has(skillName))
    : visibleSkillNames;

  return {
    usesAllowlist,
    configuredSkillNames: normalizedConfiguredSkillNames,
    visibleSkillNames,
    visibleEnabledSkillNames,
    visibleEnabledSkillCount: visibleEnabledSkillNames.length,
    visibleTotalSkillCount: visibleSkillNames.length,
  };
}

export function isOpenClawSkillEnabledForAgent(
  skillName: string,
  summary: OpenClawSkillSelectionSummary,
) {
  const normalizedSkillName = skillName.trim();
  if (!normalizedSkillName) {
    return false;
  }

  if (!summary.usesAllowlist) {
    return true;
  }

  return summary.configuredSkillNames.includes(normalizedSkillName);
}

export function buildNextOpenClawSkillSelection(
  summary: OpenClawSkillSelectionSummary,
  skillName: string,
  enabled: boolean,
) {
  const normalizedSkillName = skillName.trim();
  if (!normalizedSkillName) {
    return summary.usesAllowlist ? [...summary.configuredSkillNames] : null;
  }

  if (!summary.usesAllowlist) {
    return enabled
      ? null
      : summary.visibleSkillNames.filter((visibleSkillName) => visibleSkillName !== normalizedSkillName);
  }

  if (enabled) {
    return summary.configuredSkillNames.includes(normalizedSkillName)
      ? [...summary.configuredSkillNames]
      : [...summary.configuredSkillNames, normalizedSkillName];
  }

  return summary.configuredSkillNames.filter(
    (configuredSkillName) => configuredSkillName !== normalizedSkillName,
  );
}

export function createOpenClawSkillEnvEntry(
  seed: string | number,
  key = '',
  value = '',
): OpenClawSkillConfigEnvEntry {
  return {
    id: `skill-env-${seed}`,
    key,
    value,
  };
}

export function buildOpenClawSkillConfigDraft(
  skill: AgentWorkbenchSkill,
): OpenClawSkillConfigDraft {
  const envEntries = Object.entries(skill.configEntry.env)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value], index) => createOpenClawSkillEnvEntry(index, key, value));

  return {
    enabled: !skill.disabled,
    apiKey: skill.configEntry.apiKey,
    envEntries: envEntries.length > 0 ? envEntries : [createOpenClawSkillEnvEntry(0)],
  };
}

export function normalizeOpenClawSkillEnvEntries(
  entries: OpenClawSkillConfigEnvEntry[],
) {
  const normalized: Record<string, string> = {};

  entries.forEach((entry) => {
    const key = entry.key.trim();
    const value = entry.value.trim();
    if (!key || !value) {
      return;
    }

    normalized[key] = value;
  });

  return normalized;
}
