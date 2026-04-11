import assert from 'node:assert/strict';
import type { Skill } from '@sdkwork/claw-types';
import {
  buildInstalledSkillCardStatusLabel,
  buildInstalledSkillInformation,
} from './marketInstalledSkillPresentation.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const copy = {
  installedLabel: 'Installed',
  unknownSourceLabel: 'Unknown source',
  fieldLabels: {
    status: 'Runtime status',
    source: 'Source',
    scope: 'Scope',
    missingRequirements: 'Missing requirements',
  },
  statusLabels: {
    enabled: 'Enabled',
    disabled: 'Disabled',
    blocked: 'Blocked',
  },
  compatibilityLabels: {
    compatible: 'Compatible',
    attention: 'Needs attention',
    blocked: 'Blocked',
  },
  scopeLabels: {
    workspace: 'Workspace',
    managed: 'Managed',
    bundled: 'Bundled',
    unknown: 'Unknown',
  },
  formatMissingRequirements: (count: number) => `${count} missing`,
} as const;

function createSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'skill-1',
    name: 'Skill One',
    description: 'Skill description',
    author: 'SDKWork',
    rating: 4.8,
    downloads: 42,
    category: 'Development',
    ...overrides,
  };
}

runTest('installed skill presentation falls back cleanly when runtime asset metadata is missing', () => {
  const skill = createSkill();

  assert.equal(buildInstalledSkillCardStatusLabel(skill, copy), 'Installed');
  assert.deepEqual(buildInstalledSkillInformation(skill, copy), {
    compatibilityValue: null,
    rows: [],
  });
});

runTest('installed skill presentation exposes disabled runtime metadata and missing requirements', () => {
  const skill = createSkill({
    instanceAsset: {
      source: 'clawhub',
      scope: 'workspace',
      status: 'disabled',
      compatibility: 'attention',
      bundled: false,
      missingRequirementCount: 2,
    },
  });

  assert.equal(buildInstalledSkillCardStatusLabel(skill, copy), 'Installed · Disabled');
  assert.deepEqual(buildInstalledSkillInformation(skill, copy), {
    compatibilityValue: 'Needs attention',
    rows: [
      {
        id: 'status',
        label: 'Runtime status',
        value: 'Disabled',
      },
      {
        id: 'source',
        label: 'Source',
        value: 'clawhub',
      },
      {
        id: 'scope',
        label: 'Scope',
        value: 'Workspace',
      },
      {
        id: 'missingRequirements',
        label: 'Missing requirements',
        value: '2 missing',
      },
    ],
  });
});

runTest('installed skill presentation promotes runtime attention to the card badge when the skill is enabled', () => {
  const skill = createSkill({
    instanceAsset: {
      source: 'unknown',
      scope: 'managed',
      status: 'enabled',
      compatibility: 'attention',
      bundled: false,
      missingRequirementCount: 1,
    },
  });

  assert.equal(buildInstalledSkillCardStatusLabel(skill, copy), 'Installed · Needs attention');
  assert.deepEqual(buildInstalledSkillInformation(skill, copy), {
    compatibilityValue: 'Needs attention',
    rows: [
      {
        id: 'status',
        label: 'Runtime status',
        value: 'Enabled',
      },
      {
        id: 'source',
        label: 'Source',
        value: 'Unknown source',
      },
      {
        id: 'scope',
        label: 'Scope',
        value: 'Managed',
      },
      {
        id: 'missingRequirements',
        label: 'Missing requirements',
        value: '1 missing',
      },
    ],
  });
});
