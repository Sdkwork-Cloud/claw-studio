import { getI18n } from 'react-i18next';
import {
  localizedText,
  normalizeLanguage,
  resolveLocalizedText,
  type LocalizedText,
} from '@sdkwork/claw-i18n';
import type { Review, Skill, SkillPack } from '@sdkwork/claw-types';

type SkillSeed = Omit<Skill, 'description' | 'readme'> & {
  description: LocalizedText;
  readme: LocalizedText;
};

type SkillPackSeed = Omit<SkillPack, 'description' | 'skills'> & {
  description: LocalizedText;
  skills: SkillSeed[];
};

function resolveCurrentLanguage() {
  return normalizeLanguage(getI18n()?.resolvedLanguage ?? getI18n()?.language);
}

function cloneSkill(skill: SkillSeed): Skill {
  const language = resolveCurrentLanguage();
  return {
    ...skill,
    description: resolveLocalizedText(skill.description, language),
    readme: resolveLocalizedText(skill.readme, language),
  };
}

function clonePack(pack: SkillPackSeed): SkillPack {
  const language = resolveCurrentLanguage();
  return {
    ...pack,
    description: resolveLocalizedText(pack.description, language),
    skills: pack.skills.map(cloneSkill),
  };
}

const FALLBACK_SKILLS_SOURCE: SkillSeed[] = [
  {
    id: 'skill-system-monitor',
    name: 'System Monitor',
    description: localizedText(
      'Monitor CPU, RAM, and network usage in real time.',
      '\u5b9e\u65f6\u76d1\u63a7 CPU\u3001\u5185\u5b58\u548c\u7f51\u7edc\u4f7f\u7528\u60c5\u51b5\u3002',
    ),
    readme: localizedText(
      '# System Monitor\n\nTrack CPU, memory, network, and latency metrics for your local and remote instances.',
      '# System Monitor\n\n\u8ddf\u8e2a\u672c\u5730\u548c\u8fdc\u7a0b\u5b9e\u4f8b\u7684 CPU\u3001\u5185\u5b58\u3001\u7f51\u7edc\u4e0e\u5ef6\u8fdf\u6307\u6807\u3002',
    ),
    author: 'SDKWork',
    version: '1.4.0',
    icon: 'Cpu',
    category: 'System',
    downloads: 12500,
    rating: 4.9,
    size: '2.4 MB',
  },
  {
    id: 'skill-code-formatter',
    name: 'Code Formatter',
    description: localizedText(
      'Format codebases across TypeScript, Rust, and Python projects.',
      '\u4e3a TypeScript\u3001Rust \u548c Python \u9879\u76ee\u7edf\u4e00\u683c\u5f0f\u5316\u4ee3\u7801\u3002',
    ),
    readme: localizedText(
      '# Code Formatter\n\nApply opinionated formatting presets and automate repository-wide cleanup.',
      '# Code Formatter\n\n\u5e94\u7528\u7edf\u4e00\u7684\u683c\u5f0f\u5316\u89c4\u5219\uff0c\u5e76\u81ea\u52a8\u5b8c\u6210\u4ed3\u5e93\u7ea7\u6e05\u7406\u3002',
    ),
    author: 'SDKWork',
    version: '2.1.3',
    icon: 'Code',
    category: 'Development',
    downloads: 9400,
    rating: 4.7,
    size: '1.3 MB',
  },
  {
    id: 'skill-prompt-lab',
    name: 'Prompt Lab',
    description: localizedText(
      'Prototype, compare, and refine prompt workflows for multiple models.',
      '\u4e3a\u591a\u6a21\u578b\u539f\u578b\u5316\u3001\u6bd4\u8f83\u548c\u6253\u78e8\u63d0\u793a\u8bcd\u5de5\u4f5c\u6d41\u3002',
    ),
    readme: localizedText(
      '# Prompt Lab\n\nBuild prompt experiments, compare outputs, and capture reusable prompt snippets.',
      '# Prompt Lab\n\n\u6784\u5efa\u63d0\u793a\u8bcd\u5b9e\u9a8c\u3001\u6bd4\u8f83\u8f93\u51fa\u7ed3\u679c\uff0c\u5e76\u6c89\u6dc0\u53ef\u590d\u7528\u7684\u63d0\u793a\u7247\u6bb5\u3002',
    ),
    author: 'SDKWork',
    version: '0.9.8',
    icon: 'Sparkles',
    category: 'AI Models',
    downloads: 7100,
    rating: 4.8,
    size: '3.1 MB',
  },
  {
    id: 'skill-api-inspector',
    name: 'API Inspector',
    description: localizedText(
      'Inspect HTTP requests, headers, payloads, and response timings.',
      '\u68c0\u67e5 HTTP \u8bf7\u6c42\u3001\u8bf7\u6c42\u5934\u3001\u8f7d\u8377\u548c\u54cd\u5e94\u8017\u65f6\u3002',
    ),
    readme: localizedText(
      '# API Inspector\n\nTrace REST calls, inspect payloads, and replay requests against local endpoints.',
      '# API Inspector\n\n\u8ddf\u8e2a REST \u8c03\u7528\u3001\u68c0\u67e5\u8bf7\u6c42\u8f7d\u8377\uff0c\u5e76\u5bf9\u672c\u5730\u7aef\u70b9\u91cd\u653e\u8bf7\u6c42\u3002',
    ),
    author: 'SDKWork',
    version: '1.2.4',
    icon: 'Terminal',
    category: 'Utilities',
    downloads: 5600,
    rating: 4.6,
    size: '1.8 MB',
  },
  {
    id: 'skill-team-notes',
    name: 'Team Notes',
    description: localizedText(
      'Capture operational notes, runbooks, and handoff context per instance.',
      '\u8bb0\u5f55\u6bcf\u4e2a\u5b9e\u4f8b\u7684\u8fd0\u7ef4\u7b14\u8bb0\u3001\u64cd\u4f5c\u624b\u518c\u548c\u4ea4\u63a5\u4e0a\u4e0b\u6587\u3002',
    ),
    readme: localizedText(
      '# Team Notes\n\nStore operational notes, handoff summaries, and per-instance annotations in one place.',
      '# Team Notes\n\n\u5728\u4e00\u4e2a\u5730\u65b9\u5b58\u50a8\u8fd0\u7ef4\u7b14\u8bb0\u3001\u4ea4\u63a5\u6458\u8981\u548c\u5b9e\u4f8b\u6ce8\u91ca\u3002',
    ),
    author: 'SDKWork',
    version: '1.0.2',
    icon: 'NotebookPen',
    category: 'Productivity',
    downloads: 4300,
    rating: 4.5,
    size: '1.0 MB',
  },
];

const SKILL_LOOKUP = new Map(FALLBACK_SKILLS_SOURCE.map((skill) => [skill.id, skill]));

const FALLBACK_PACKS_SOURCE: SkillPackSeed[] = [
  {
    id: 'pack-starter-stack',
    name: 'Starter Stack',
    description: localizedText(
      'A balanced starter environment for monitoring, formatting, and prompt iteration.',
      '\u4e00\u4e2a\u517c\u987e\u76d1\u63a7\u3001\u683c\u5f0f\u5316\u4e0e\u63d0\u793a\u8bcd\u8fed\u4ee3\u7684\u5747\u8861\u8d77\u6b65\u73af\u5883\u3002',
    ),
    author: 'SDKWork',
    rating: 4.9,
    downloads: 18400,
    category: 'Productivity',
    skills: [
      SKILL_LOOKUP.get('skill-system-monitor')!,
      SKILL_LOOKUP.get('skill-code-formatter')!,
      SKILL_LOOKUP.get('skill-prompt-lab')!,
    ],
  },
  {
    id: 'pack-dev-ops',
    name: 'Developer Ops Pack',
    description: localizedText(
      'Essential tooling for debugging APIs, monitoring systems, and capturing runbooks.',
      '\u9002\u7528\u4e8e API \u8c03\u8bd5\u3001\u7cfb\u7edf\u76d1\u63a7\u548c\u8fd0\u7ef4\u624b\u518c\u6c89\u6dc0\u7684\u57fa\u7840\u5de5\u5177\u5305\u3002',
    ),
    author: 'SDKWork',
    rating: 4.7,
    downloads: 12600,
    category: 'Development',
    skills: [
      SKILL_LOOKUP.get('skill-system-monitor')!,
      SKILL_LOOKUP.get('skill-api-inspector')!,
      SKILL_LOOKUP.get('skill-team-notes')!,
    ],
  },
];

const FALLBACK_REVIEWS_SOURCE: Record<string, Review[]> = {
  'skill-system-monitor': [
    {
      id: 'review-system-monitor-1',
      user: 'ops-lead',
      user_name: 'Ops Lead',
      rating: 5,
      comment: 'Excellent visibility into local instance health and resource spikes.',
      date: '2026-02-12',
      created_at: '2026-02-12T10:00:00.000Z',
    },
  ],
  'skill-prompt-lab': [
    {
      id: 'review-prompt-lab-1',
      user: 'ai-pm',
      user_name: 'AI PM',
      rating: 5,
      comment: 'The fastest way to iterate on multi-model prompt workflows.',
      date: '2026-01-20',
      created_at: '2026-01-20T08:30:00.000Z',
    },
  ],
};

const fallbackInstallations = new Map<string, string[]>([
  ['builtin-instance', ['skill-system-monitor', 'skill-code-formatter']],
  ['local-built-in', ['skill-system-monitor', 'skill-code-formatter']],
  ['inst-1', ['skill-system-monitor', 'skill-code-formatter']],
]);

function cloneReview(review: Review): Review {
  return { ...review };
}

export function getFallbackSkills(): Skill[] {
  return FALLBACK_SKILLS_SOURCE.map(cloneSkill);
}

export function getFallbackSkill(id: string): Skill | undefined {
  const skill = SKILL_LOOKUP.get(id);
  return skill ? cloneSkill(skill) : undefined;
}

export function getFallbackPacks(): SkillPack[] {
  return FALLBACK_PACKS_SOURCE.map(clonePack);
}

export function getFallbackPack(id: string): SkillPack | undefined {
  const pack = FALLBACK_PACKS_SOURCE.find((item) => item.id === id);
  return pack ? clonePack(pack) : undefined;
}

export function getFallbackReviews(skillId: string): Review[] {
  return (FALLBACK_REVIEWS_SOURCE[skillId] || []).map(cloneReview);
}

export function getFallbackInstalledSkills(instanceId: string): Skill[] {
  const skillIds = fallbackInstallations.get(instanceId) || [];
  return skillIds
    .map((skillId) => getFallbackSkill(skillId))
    .filter((skill): skill is Skill => Boolean(skill));
}

export function addFallbackInstalledSkills(instanceId: string, skillIds: string[]) {
  const currentSkillIds = new Set(fallbackInstallations.get(instanceId) || []);
  skillIds.forEach((skillId) => currentSkillIds.add(skillId));
  fallbackInstallations.set(instanceId, [...currentSkillIds]);
}

export function removeFallbackInstalledSkill(instanceId: string, skillId: string) {
  const nextSkillIds = (fallbackInstallations.get(instanceId) || []).filter(
    (currentSkillId) => currentSkillId !== skillId,
  );
  fallbackInstallations.set(instanceId, nextSkillIds);
}

export function snapshotFallbackInstallations(): Record<string, Skill[]> {
  return Object.fromEntries(
    [...fallbackInstallations.keys()].map((instanceId) => [
      instanceId,
      getFallbackInstalledSkills(instanceId),
    ]),
  );
}
