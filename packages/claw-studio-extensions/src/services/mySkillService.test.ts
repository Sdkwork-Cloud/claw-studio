import assert from 'node:assert/strict';
import { createMySkillService } from './mySkillService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('getList returns the seeded skills for an instance', async () => {
  const service = createMySkillService();

  const page = await service.getList('inst-1');

  assert.equal(page.total, 2);
  assert.equal(page.items[0]?.id, 'skill-1');
});

await runTest('uninstallSkill removes the skill from the instance collection', async () => {
  const service = createMySkillService();

  await service.uninstallSkill('inst-1', 'skill-1');
  const skills = await service.getMySkills('inst-1');

  assert.equal(skills.some((skill) => skill.id === 'skill-1'), false);
});
