import assert from 'node:assert/strict';
import type { AgentWorkbenchSkill } from '../services/agentWorkbenchService.ts';
import {
  buildNextOpenClawSkillSelection,
  buildOpenClawSkillConfigDraft,
  buildOpenClawSkillGroups,
  buildOpenClawSkillHealth,
  buildOpenClawSkillSelectionSummary,
  normalizeOpenClawSkillEnvEntries,
} from './openClawSkillWorkspaceModel.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

function createSkill(overrides: Partial<AgentWorkbenchSkill> = {}): AgentWorkbenchSkill {
  return {
    id: overrides.id || 'calendar',
    skillKey: overrides.skillKey || overrides.id || 'calendar',
    name: overrides.name || 'Calendar Assistant',
    description: overrides.description || 'Calendar sync and scheduling',
    author: overrides.author || 'OpenClaw',
    rating: overrides.rating ?? 0,
    downloads: overrides.downloads ?? 0,
    category: overrides.category || 'Automation',
    source: overrides.source || 'workspace',
    scope: overrides.scope || 'workspace',
    bundled: overrides.bundled ?? false,
    eligible: overrides.eligible ?? true,
    disabled: overrides.disabled ?? false,
    blockedByAllowlist: overrides.blockedByAllowlist ?? false,
    primaryEnv: overrides.primaryEnv || 'CALENDAR_TOKEN',
    homepage: overrides.homepage,
    filePath: overrides.filePath,
    baseDir: overrides.baseDir,
    installOptions: overrides.installOptions || [],
    missing: overrides.missing || {
      bins: [],
      anyBins: [],
      env: [],
      config: [],
      os: [],
    },
    configEntry: overrides.configEntry || {
      apiKey: '',
      env: {},
      hasEntry: false,
    },
    configChecks: overrides.configChecks || [],
    version: overrides.version,
    size: overrides.size,
    updatedAt: overrides.updatedAt,
    readme: overrides.readme,
    always: overrides.always ?? false,
    emoji: overrides.emoji,
  };
}

await runTest(
  'openClawSkillWorkspaceModel groups skills by scope and preserves workspace-first order',
  () => {
    const groups = buildOpenClawSkillGroups([
      createSkill({
        id: 'shared-disabled',
        name: 'Shared Disabled',
        scope: 'managed',
        source: 'managed',
        disabled: true,
      }),
      createSkill({
        id: 'shared-ready',
        name: 'Shared Ready',
        scope: 'managed',
        source: 'managed',
        eligible: true,
      }),
      createSkill({
        id: 'shared-blocked',
        name: 'Shared Blocked',
        scope: 'managed',
        source: 'managed',
        eligible: false,
        blockedByAllowlist: true,
      }),
      createSkill({ id: 'calendar', scope: 'workspace', source: 'workspace' }),
      createSkill({ id: 'browser', scope: 'bundled', source: 'bundled', bundled: true }),
    ]);

    assert.deepEqual(
      groups.map((group) => ({
        scope: group.scope,
        skillIds: group.skills.map((skill) => skill.id),
      })),
      [
        { scope: 'workspace', skillIds: ['calendar'] },
        { scope: 'managed', skillIds: ['shared-ready', 'shared-blocked', 'shared-disabled'] },
        { scope: 'bundled', skillIds: ['browser'] },
      ],
    );
  },
);

await runTest(
  'openClawSkillWorkspaceModel summarizes skill health counts from readiness and disabled state',
  () => {
    const summary = buildOpenClawSkillHealth([
      createSkill({ id: 'ready-one', eligible: true, disabled: false }),
      createSkill({ id: 'needs-setup', eligible: false, disabled: false }),
      createSkill({
        id: 'blocked-one',
        eligible: false,
        disabled: false,
        blockedByAllowlist: true,
      }),
      createSkill({ id: 'disabled-one', eligible: true, disabled: true }),
    ]);

    assert.deepEqual(summary, {
      ready: 1,
      needsSetup: 1,
      blocked: 1,
      disabled: 1,
    });
  },
);

await runTest(
  'openClawSkillWorkspaceModel builds a draft from persisted apiKey and env configuration',
  () => {
    const draft = buildOpenClawSkillConfigDraft(
      createSkill({
        id: 'calendar',
        disabled: true,
        configEntry: {
          apiKey: 'primary-secret',
          env: {
            CALENDAR_TOKEN: 'token-value',
            CALENDAR_REGION: 'cn-hz',
          },
          hasEntry: true,
        },
      }),
    );

    assert.equal(draft.enabled, false);
    assert.equal(draft.apiKey, 'primary-secret');
    assert.deepEqual(
      draft.envEntries.map((entry) => ({ key: entry.key, value: entry.value })),
      [
        { key: 'CALENDAR_REGION', value: 'cn-hz' },
        { key: 'CALENDAR_TOKEN', value: 'token-value' },
      ],
    );
  },
);

await runTest(
  'openClawSkillWorkspaceModel removes blank env rows before saving',
  () => {
    const env = normalizeOpenClawSkillEnvEntries([
      { id: 'one', key: 'CALENDAR_TOKEN', value: 'token-value' },
      { id: 'two', key: '  ', value: 'ignored' },
      { id: 'three', key: 'CALENDAR_REGION', value: 'cn-hz' },
      { id: 'four', key: 'CALENDAR_REGION', value: 'ap-sg' },
      { id: 'five', key: 'CALENDAR_EMPTY', value: ' ' },
    ]);

    assert.deepEqual(env, {
      CALENDAR_TOKEN: 'token-value',
      CALENDAR_REGION: 'ap-sg',
    });
  },
);

await runTest(
  'openClawSkillWorkspaceModel summarizes per-agent skill allowlists without hiding built-in skills',
  () => {
    const summary = buildOpenClawSkillSelectionSummary(
      [
        createSkill({ id: 'workspace-calendar', name: 'Calendar', scope: 'workspace' }),
        createSkill({ id: 'bundled-browser', name: 'Browser', scope: 'bundled', bundled: true }),
        createSkill({ id: 'managed-search', name: 'Search', scope: 'managed', source: 'managed' }),
      ],
      ['Browser', 'Stale Skill'],
    );

    assert.equal(summary.usesAllowlist, true);
    assert.deepEqual(summary.configuredSkillNames, ['Browser', 'Stale Skill']);
    assert.deepEqual(summary.visibleSkillNames, ['Calendar', 'Browser', 'Search']);
    assert.deepEqual(summary.visibleEnabledSkillNames, ['Browser']);
    assert.equal(summary.visibleEnabledSkillCount, 1);
    assert.equal(summary.visibleTotalSkillCount, 3);
  },
);

await runTest(
  'openClawSkillWorkspaceModel creates or updates a per-agent allowlist while preserving unrelated configured skill names',
  () => {
    const summary = buildOpenClawSkillSelectionSummary(
      [
        createSkill({ id: 'workspace-calendar', name: 'Calendar', scope: 'workspace' }),
        createSkill({ id: 'bundled-browser', name: 'Browser', scope: 'bundled', bundled: true }),
        createSkill({ id: 'managed-search', name: 'Search', scope: 'managed', source: 'managed' }),
      ],
      ['Browser', 'Stale Skill'],
    );

    assert.deepEqual(buildNextOpenClawSkillSelection(summary, 'Calendar', true), [
      'Browser',
      'Stale Skill',
      'Calendar',
    ]);
    assert.deepEqual(buildNextOpenClawSkillSelection(summary, 'Browser', false), [
      'Stale Skill',
    ]);

    const allSkillsSummary = buildOpenClawSkillSelectionSummary(
      [
        createSkill({ id: 'workspace-calendar', name: 'Calendar', scope: 'workspace' }),
        createSkill({ id: 'bundled-browser', name: 'Browser', scope: 'bundled', bundled: true }),
      ],
      undefined,
    );

    assert.deepEqual(buildNextOpenClawSkillSelection(allSkillsSummary, 'Browser', false), [
      'Calendar',
    ]);
  },
);
