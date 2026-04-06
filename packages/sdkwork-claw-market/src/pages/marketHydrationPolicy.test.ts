import assert from 'node:assert/strict';

import {
  shouldBlockSkillDetailForLoading,
  shouldBlockSkillPackDetailForLoading,
  shouldLoadMarketInstanceCatalog,
  shouldLoadMarketInstalledSkills,
} from './marketHydrationPolicy.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('market instance catalog stays idle on skills tab until an install flow needs it', () => {
  assert.equal(
    shouldLoadMarketInstanceCatalog({
      activeTab: 'skills',
      isInstallSkillModalOpen: false,
      isInstallPackModalOpen: false,
    }),
    false,
  );
  assert.equal(
    shouldLoadMarketInstanceCatalog({
      activeTab: 'skills',
      isInstallSkillModalOpen: true,
      isInstallPackModalOpen: false,
    }),
    true,
  );
});

runTest('market instance catalog loads for my skills and pack installs', () => {
  assert.equal(
    shouldLoadMarketInstanceCatalog({
      activeTab: 'mySkills',
      isInstallSkillModalOpen: false,
      isInstallPackModalOpen: false,
    }),
    true,
  );
  assert.equal(
    shouldLoadMarketInstanceCatalog({
      activeTab: 'packages',
      isInstallSkillModalOpen: false,
      isInstallPackModalOpen: true,
    }),
    true,
  );
});

runTest('market installed skills only load on my skills tab with an active instance', () => {
  assert.equal(
    shouldLoadMarketInstalledSkills({
      activeTab: 'skills',
      activeInstanceId: 'instance-a',
    }),
    false,
  );
  assert.equal(
    shouldLoadMarketInstalledSkills({
      activeTab: 'mySkills',
      activeInstanceId: null,
    }),
    false,
  );
  assert.equal(
    shouldLoadMarketInstalledSkills({
      activeTab: 'mySkills',
      activeInstanceId: 'instance-a',
    }),
    true,
  );
});

runTest('skill detail blocks only on the skill payload and not on instance catalog loading', () => {
  assert.equal(
    shouldBlockSkillDetailForLoading({
      isLoadingSkill: true,
      isLoadingInstances: false,
    }),
    true,
  );
  assert.equal(
    shouldBlockSkillDetailForLoading({
      isLoadingSkill: false,
      isLoadingInstances: true,
    }),
    false,
  );
});

runTest('skill pack detail blocks only on the pack payload and not on instance catalog loading', () => {
  assert.equal(
    shouldBlockSkillPackDetailForLoading({
      isLoadingPack: true,
      isLoadingInstances: false,
    }),
    true,
  );
  assert.equal(
    shouldBlockSkillPackDetailForLoading({
      isLoadingPack: false,
      isLoadingInstances: true,
    }),
    false,
  );
});
