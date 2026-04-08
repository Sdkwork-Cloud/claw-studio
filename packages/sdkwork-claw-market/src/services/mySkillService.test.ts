import assert from 'node:assert/strict';
import type { Skill } from '@sdkwork/claw-types';
import { createMySkillService, type CreateMySkillServiceOptions } from './mySkillService.ts';

type RemoveSkillInput = Parameters<
  NonNullable<CreateMySkillServiceOptions['agentSkillManagementService']>['removeSkill']
>[0];
type SetSkillEnabledInput = Parameters<
  NonNullable<CreateMySkillServiceOptions['agentSkillManagementService']>['setSkillEnabled']
>[0];

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

function createSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: '7',
    skillKey: 'github-pr-assistant',
    name: 'GitHub PR Assistant',
    description: 'Review pull requests faster.',
    author: 'SDKWork',
    rating: 4.8,
    downloads: 3200,
    category: 'Development',
    icon: undefined,
    version: '1.2.0',
    size: undefined,
    updatedAt: undefined,
    readme: undefined,
    repositoryUrl: undefined,
    homepageUrl: undefined,
    documentationUrl: undefined,
    ...overrides,
  };
}

await runTest(
  'mySkillService reads installed skills from the default agent workbench instead of studio mock data',
  async () => {
    const service = createMySkillService({
      instanceWorkbenchService: {
        getInstanceWorkbench: async () =>
          ({
            agents: [
              {
                agent: { id: 'agent-default' },
                isDefault: true,
              },
            ],
          }) as any,
      },
      agentWorkbenchService: {
        getAgentWorkbench: async () =>
          ({
            skills: [
              {
                id: '7',
                skillKey: 'github-pr-assistant',
                name: 'GitHub PR Assistant',
                description: 'Review pull requests faster.',
                author: 'SDKWork',
                rating: 4.8,
                downloads: 3200,
                category: 'Development',
                version: '1.2.0',
                scope: 'workspace',
                homepage: 'https://clawhub.sdkwork.com/skills/github-pr-assistant',
                installOptions: [],
                missing: {
                  bins: [],
                  anyBins: [],
                  env: [],
                  config: [],
                },
              },
            ],
          }) as any,
      },
      agentSkillManagementService: {
        removeSkill: async () => undefined,
        setSkillEnabled: async () => undefined,
      },
    });

    const skills = await service.getMySkills('instance-1');

    assert.deepEqual(
      skills,
      [createSkill({ homepageUrl: 'https://clawhub.sdkwork.com/skills/github-pr-assistant' })],
    );
  },
);

await runTest(
  'mySkillService removes workspace skills directly and disables managed skills as fallback',
  async () => {
    const removeCalls: RemoveSkillInput[] = [];
    const disableCalls: SetSkillEnabledInput[] = [];
    const service = createMySkillService({
      instanceWorkbenchService: {
        getInstanceWorkbench: async () =>
          ({
            agents: [
              {
                agent: { id: 'agent-default' },
                isDefault: true,
              },
            ],
          }) as any,
      },
      agentWorkbenchService: {
        getAgentWorkbench: async () =>
          ({
            skills: [
              {
                ...createSkill(),
                scope: 'workspace',
                filePath: 'D:/OpenClaw/.openclaw/workspace/skills/github-pr-assistant/index.ts',
                baseDir: 'D:/OpenClaw/.openclaw/workspace/skills/github-pr-assistant',
                installOptions: [],
                missing: {
                  bins: [],
                  anyBins: [],
                  env: [],
                  config: [],
                },
              },
              {
                ...createSkill({
                  id: '8',
                  skillKey: 'workflow-guard',
                  name: 'Workflow Guard',
                }),
                scope: 'managed',
                installOptions: [],
                missing: {
                  bins: [],
                  anyBins: [],
                  env: [],
                  config: [],
                },
              },
            ],
          }) as any,
      },
      agentSkillManagementService: {
        removeSkill: async (input) => {
          removeCalls.push(input);
        },
        setSkillEnabled: async (input) => {
          disableCalls.push(input);
        },
      },
    });

    await service.uninstallSkill('instance-1', '7');
    await service.uninstallSkill('instance-1', '8');

    assert.deepEqual(removeCalls, [
      {
        instanceId: 'instance-1',
        skillKey: 'github-pr-assistant',
        scope: 'workspace',
        workspacePath: undefined,
        baseDir: 'D:/OpenClaw/.openclaw/workspace/skills/github-pr-assistant',
        filePath: 'D:/OpenClaw/.openclaw/workspace/skills/github-pr-assistant/index.ts',
      },
    ]);
    assert.deepEqual(disableCalls, [
      {
        instanceId: 'instance-1',
        skillKey: 'workflow-guard',
        enabled: false,
      },
    ]);
  },
);
