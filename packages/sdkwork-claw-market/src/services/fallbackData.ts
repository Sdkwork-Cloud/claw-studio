import type { Review, Skill, SkillPack } from '@sdkwork/claw-types';

const FALLBACK_SKILLS_SOURCE: Skill[] = [
  {
    id: 'skill-system-monitor',
    name: 'System Monitor',
    description: 'Monitor CPU, RAM, and network usage in real time.',
    readme:
      '# System Monitor\n\nTrack CPU, memory, network, and latency metrics for your local and remote instances.',
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
    description: 'Format codebases across TypeScript, Rust, and Python projects.',
    readme:
      '# Code Formatter\n\nApply opinionated formatting presets and automate repository-wide cleanup.',
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
    description: 'Prototype, compare, and refine prompt workflows for multiple models.',
    readme:
      '# Prompt Lab\n\nBuild prompt experiments, compare outputs, and capture reusable prompt snippets.',
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
    description: 'Inspect HTTP requests, headers, payloads, and response timings.',
    readme:
      '# API Inspector\n\nTrace REST calls, inspect payloads, and replay requests against local endpoints.',
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
    description: 'Capture operational notes, runbooks, and handoff context per instance.',
    readme:
      '# Team Notes\n\nStore operational notes, handoff summaries, and per-instance annotations in one place.',
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

const FALLBACK_PACKS_SOURCE: SkillPack[] = [
  {
    id: 'pack-starter-stack',
    name: 'Starter Stack',
    description: 'A balanced starter environment for monitoring, formatting, and prompt iteration.',
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
    description: 'Essential tooling for debugging APIs, monitoring systems, and capturing runbooks.',
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

function cloneSkill(skill: Skill): Skill {
  return { ...skill };
}

function clonePack(pack: SkillPack): SkillPack {
  return {
    ...pack,
    skills: pack.skills.map(cloneSkill),
  };
}

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
