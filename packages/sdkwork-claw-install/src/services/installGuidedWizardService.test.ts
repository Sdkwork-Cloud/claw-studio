import assert from 'node:assert/strict';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('installGuidedWizardService exposes the canonical 5-step guided install metadata', async () => {
  const { GUIDED_WIZARD_STEPS } = await import('./installGuidedWizardService.ts');

  assert.deepEqual(
    GUIDED_WIZARD_STEPS.map((step) => [step.id, step.titleKey]),
    [
      ['dependencies', 'install.page.guided.steps.dependencies.title'],
      ['install', 'install.page.guided.steps.install.title'],
      ['configure', 'install.page.guided.steps.configure.title'],
      ['initialize', 'install.page.guided.steps.initialize.title'],
      ['success', 'install.page.guided.steps.success.title'],
    ],
  );
});

await runTest('installGuidedWizardService advances success only after configuration and initialization complete', async () => {
  const { buildGuidedWizardSteps } = await import('./installGuidedWizardService.ts');

  const incomplete = buildGuidedWizardSteps({
    assessmentStatus: 'ready',
    dependenciesStatus: 'success',
    installStatus: 'success',
    configurationStatus: 'success',
    initializationStatus: 'idle',
  });

  const complete = buildGuidedWizardSteps({
    assessmentStatus: 'ready',
    dependenciesStatus: 'success',
    installStatus: 'success',
    configurationStatus: 'success',
    initializationStatus: 'success',
  });

  assert.equal(incomplete.find((step) => step.id === 'initialize')?.status, 'ready');
  assert.equal(incomplete.find((step) => step.id === 'success')?.status, 'pending');
  assert.equal(complete.find((step) => step.id === 'initialize')?.status, 'completed');
  assert.equal(complete.find((step) => step.id === 'success')?.status, 'ready');
});

await runTest('installGuidedWizardService blocks install when dependency inspection still reports blockers', async () => {
  const { buildGuidedWizardSteps } = await import('./installGuidedWizardService.ts');

  const blocked = buildGuidedWizardSteps({
    assessmentStatus: 'blocked',
    dependenciesStatus: 'idle',
    installStatus: 'idle',
    configurationStatus: 'idle',
    initializationStatus: 'idle',
  });

  assert.equal(blocked[0]?.id, 'dependencies');
  assert.equal(blocked[0]?.status, 'blocked');
  assert.equal(blocked[1]?.id, 'install');
  assert.equal(blocked[1]?.status, 'pending');
});
