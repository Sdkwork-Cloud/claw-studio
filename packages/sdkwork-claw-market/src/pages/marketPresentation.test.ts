import assert from 'node:assert/strict';
import type { Skill, SkillPack } from '@sdkwork/claw-types';
import {
  createCategoryIds,
  createMySkillsCatalog,
  createPackCatalog,
  createSkillCatalog,
} from './marketPresentation.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'skill-default',
    name: 'Default Skill',
    description: 'A well crafted skill card.',
    author: 'SDKWork',
    rating: 4.8,
    downloads: 2000,
    category: 'Productivity',
    version: '1.0.0',
    ...overrides,
  };
}

function createPack(overrides: Partial<SkillPack> = {}): SkillPack {
  return {
    id: 'pack-default',
    name: 'Default Pack',
    description: 'A curated skill pack.',
    author: 'SDKWork',
    rating: 4.8,
    downloads: 3000,
    category: 'Productivity',
    skills: [createSkill()],
    ...overrides,
  };
}

await runTest('createCategoryIds preserves preferred order and appends unexpected categories', () => {
  const categories = createCategoryIds([
    createSkill({ id: 'skill-dev', category: 'Development' }),
    createSkill({ id: 'skill-ai', category: 'AI Models' }),
    createSkill({ id: 'skill-custom', category: 'Education' }),
  ]);

  assert.deepEqual(categories, ['All', 'Development', 'AI Models', 'Education']);
});

await runTest('createSkillCatalog filters by keyword and sorts stronger matches first', () => {
  const skills = [
    createSkill({
      id: 'skill-github',
      name: 'GitHub PR Assistant',
      description: 'Review pull requests and track issues.',
      category: 'Development',
      rating: 4.9,
      downloads: 6800,
    }),
    createSkill({
      id: 'skill-workflows',
      name: 'GitHub Workflow Guard',
      description: 'Watch workflow failures across repositories.',
      category: 'Development',
      rating: 4.9,
      downloads: 4200,
    }),
    createSkill({
      id: 'skill-writing',
      name: 'Writing Coach',
      description: 'Improve long-form copy.',
      category: 'Productivity',
      rating: 4.7,
      downloads: 9900,
    }),
  ];

  const catalog = createSkillCatalog({
    skills,
    keyword: 'github',
    activeCategory: 'All',
  });

  assert.deepEqual(catalog.skills.map((skill) => skill.id), [
    'skill-github',
    'skill-workflows',
  ]);
});

await runTest('createSkillCatalog filters by active category and exposes category ids', () => {
  const skills = [
    createSkill({
      id: 'skill-dev',
      name: 'CLI Guard',
      category: 'Development',
    }),
    createSkill({
      id: 'skill-system',
      name: 'Uptime Watch',
      category: 'System',
    }),
  ];

  const catalog = createSkillCatalog({
    skills,
    keyword: '',
    activeCategory: 'System',
  });

  assert.deepEqual(catalog.categories, ['All', 'Development', 'System']);
  assert.deepEqual(catalog.skills.map((skill) => skill.id), ['skill-system']);
});

await runTest('createPackCatalog matches keyword against pack details and included skill names', () => {
  const packs = [
    createPack({
      id: 'pack-dev',
      name: 'Developer Pack',
      description: 'GitHub and issue tracking starter set.',
      category: 'Development',
      skills: [
        createSkill({ id: 'skill-pr', name: 'PR Assistant' }),
        createSkill({ id: 'skill-debug', name: 'Debug Console' }),
      ],
    }),
    createPack({
      id: 'pack-marketing',
      name: 'Marketing Pack',
      description: 'Campaign planning and writing.',
      category: 'Productivity',
      skills: [createSkill({ id: 'skill-copy', name: 'Copy Lab' })],
    }),
  ];

  const catalog = createPackCatalog({
    packs,
    keyword: 'debug',
    activeCategory: 'All',
  });

  assert.deepEqual(catalog.packs.map((pack) => pack.id), ['pack-dev']);
});

await runTest('createPackCatalog filters pack categories independently', () => {
  const packs = [
    createPack({
      id: 'pack-dev',
      name: 'Developer Pack',
      category: 'Development',
    }),
    createPack({
      id: 'pack-productivity',
      name: 'Focus Pack',
      category: 'Productivity',
    }),
  ];

  const catalog = createPackCatalog({
    packs,
    keyword: '',
    activeCategory: 'Productivity',
  });

  assert.deepEqual(catalog.categories, ['All', 'Productivity', 'Development']);
  assert.deepEqual(catalog.packs.map((pack) => pack.id), ['pack-productivity']);
});

await runTest('createMySkillsCatalog filters installed skills independently from the public catalog', () => {
  const installedSkills = [
    createSkill({
      id: 'skill-system',
      name: 'Server Maintainer',
      description: 'Handle system checks.',
      category: 'System',
      downloads: 1200,
    }),
    createSkill({
      id: 'skill-productivity',
      name: 'Meeting Scribe',
      description: 'Capture notes and summaries.',
      category: 'Productivity',
      downloads: 6400,
    }),
  ];

  const catalog = createMySkillsCatalog({
    skills: installedSkills,
    keyword: 'notes',
    activeCategory: 'Productivity',
  });

  assert.deepEqual(catalog.skills.map((skill) => skill.id), ['skill-productivity']);
});

await runTest('createMySkillsCatalog exposes categories for installed skills', () => {
  const installedSkills = [
    createSkill({
      id: 'skill-system',
      name: 'Server Maintainer',
      category: 'System',
    }),
    createSkill({
      id: 'skill-productivity',
      name: 'Meeting Scribe',
      category: 'Productivity',
    }),
  ];

  const catalog = createMySkillsCatalog({
    skills: installedSkills,
    keyword: '',
    activeCategory: 'All',
  });

  assert.deepEqual(catalog.categories, ['All', 'Productivity', 'System']);
  assert.deepEqual(catalog.skills.map((skill) => skill.id), [
    'skill-productivity',
    'skill-system',
  ]);
});
