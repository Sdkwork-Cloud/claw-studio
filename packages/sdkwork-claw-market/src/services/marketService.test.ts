import assert from 'node:assert/strict';
import type { Skill, SkillPack } from '@sdkwork/claw-types';
import { createMarketService, type InstallSkillInput } from './marketService.ts';

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
    version: '1.2.0',
    ...overrides,
  };
}

function createPack(overrides: Partial<SkillPack> = {}): SkillPack {
  return {
    id: '11',
    packageKey: 'developer-pack',
    name: 'Developer Pack',
    description: 'A curated pack for developers.',
    author: 'SDKWork',
    rating: 4.9,
    downloads: 5600,
    category: 'Development',
    skills: [createSkill()],
    ...overrides,
  };
}

await runTest(
  'marketService delegates ClawHub catalog reads to the shared claw core sdk wrapper',
  async () => {
    const skillQueries: Array<Record<string, unknown> | undefined> = [];
    const packQueries: Array<Record<string, unknown> | undefined> = [];
    const service = createMarketService({
      clawHubService: {
        listCategories: async () => [{ id: '1', code: 'development', name: 'Development' }],
        listSkills: async (params) => {
          skillQueries.push(params as Record<string, unknown> | undefined);
          return [createSkill()];
        },
        getSkill: async (id) => createSkill({ id }),
        listReviews: async () => [],
        listPackages: async (params) => {
          packQueries.push(params as Record<string, unknown> | undefined);
          return [createPack()];
        },
        getPackage: async (id) => createPack({ id }),
      },
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
      agentSkillManagementService: {
        installSkill: async () => undefined,
      },
    });

    assert.deepEqual(await service.getCategories(), [
      { id: '1', code: 'development', name: 'Development' },
    ]);
    assert.equal((await service.getSkills({ categoryId: '1', keyword: 'github' }))[0]?.id, '7');
    assert.equal((await service.getSkill('7')).id, '7');
    assert.equal((await service.getPacks({ categoryId: '1', keyword: 'developer' }))[0]?.id, '11');
    assert.equal((await service.getPack('11')).id, '11');
    assert.deepEqual(await service.getSkillReviews('7'), []);
    assert.deepEqual(skillQueries, [{ categoryId: '1', keyword: 'github' }]);
    assert.deepEqual(packQueries, [{ categoryId: '1', keyword: 'developer' }]);
  },
);

await runTest(
  'marketService installs skills and selected pack items through native agent skill management using ClawHub slugs',
  async () => {
    const installCalls: InstallSkillInput[] = [];
    const service = createMarketService({
      clawHubService: {
        listCategories: async () => [],
        listSkills: async () => [],
        getSkill: async () => createSkill(),
        listReviews: async () => [],
        listPackages: async () => [],
        getPackage: async () =>
          createPack({
            skills: [
              createSkill(),
              createSkill({
                id: '8',
                skillKey: 'workflow-guard',
                name: 'Workflow Guard',
              }),
            ],
          }),
      },
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
      agentSkillManagementService: {
        installSkill: async (input) => {
          installCalls.push(input);
        },
      },
    });

    await service.installSkill('instance-1', '7');
    await service.installPackWithSkills('instance-1', '11', ['8']);

    assert.equal(installCalls.length, 2);
    assert.deepEqual(installCalls[0], {
      instanceId: 'instance-1',
      agentId: 'agent-default',
      isDefaultAgent: true,
      slug: 'github-pr-assistant',
      version: '1.2.0',
    });
    assert.deepEqual(installCalls[1], {
      instanceId: 'instance-1',
      agentId: 'agent-default',
      isDefaultAgent: true,
      slug: 'workflow-guard',
      version: '1.2.0',
    });
  },
);

await runTest(
  'marketService exports catalog items through the live download helper without simulated progress timers',
  async () => {
    const downloadCalls: Array<{
      filename: string;
      payloadId: string;
      progressValues: number[];
    }> = [];

    const service = createMarketService({
      clawHubService: {
        listCategories: async () => [],
        listSkills: async () => [],
        getSkill: async () => createSkill(),
        listReviews: async () => [],
        listPackages: async () => [],
        getPackage: async () => createPack(),
      },
      downloadCatalogAsset: async (filename, payload, onProgress) => {
        onProgress(100);
        downloadCalls.push({
          filename,
          payloadId: (payload as Skill | SkillPack).id,
          progressValues: [100],
        });
      },
    });

    const skillProgress: number[] = [];
    const packProgress: number[] = [];

    await service.downloadSkillLocal(createSkill({ id: 'skill-42' }), (progress) => {
      skillProgress.push(progress);
    });
    await service.downloadPackLocal(createPack({ id: 'pack-9' }), (progress) => {
      packProgress.push(progress);
    });

    assert.deepEqual(downloadCalls, [
      {
        filename: 'skill-42-skill.json',
        payloadId: 'skill-42',
        progressValues: [100],
      },
      {
        filename: 'pack-9-pack.json',
        payloadId: 'pack-9',
        progressValues: [100],
      },
    ]);
    assert.deepEqual(skillProgress, [100]);
    assert.deepEqual(packProgress, [100]);
  },
);
