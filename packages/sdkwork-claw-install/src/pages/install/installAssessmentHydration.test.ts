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

await runTest('selectInstallAssessmentPriorityIds keeps recommended, detected, and first choice in stable order', async () => {
  const { selectInstallAssessmentPriorityIds } = await import('./installAssessmentHydration.ts');

  const result = selectInstallAssessmentPriorityIds({
    installChoiceIds: ['docker', 'wsl', 'npm'],
    recommendedMethodId: 'wsl',
    detectedInstallChoiceId: 'docker',
  });

  assert.deepEqual(result, ['wsl', 'docker']);
});

await runTest('selectInstallAssessmentPriorityIds falls back to the first available choice and removes duplicates', async () => {
  const { selectInstallAssessmentPriorityIds } = await import('./installAssessmentHydration.ts');

  const result = selectInstallAssessmentPriorityIds({
    installChoiceIds: ['npm', 'docker'],
    recommendedMethodId: 'npm',
    detectedInstallChoiceId: 'npm',
  });

  assert.deepEqual(result, ['npm']);
});

await runTest('selectInstallAssessmentPriorityIds ignores unknown targets and returns an empty list for no choices', async () => {
  const { selectInstallAssessmentPriorityIds } = await import('./installAssessmentHydration.ts');

  const result = selectInstallAssessmentPriorityIds({
    installChoiceIds: [],
    recommendedMethodId: 'wsl',
    detectedInstallChoiceId: 'docker',
  });

  assert.deepEqual(result, []);
});

await runTest('createInitialInstallAssessmentState marks priority choices as loading and deferred choices as idle', async () => {
  const { createInitialInstallAssessmentState } = await import('./installAssessmentHydration.ts');

  const result = createInitialInstallAssessmentState({
    installChoiceIds: ['wsl', 'docker', 'npm'],
    priorityChoiceIds: ['docker', 'wsl'],
    createIdleState: () => 'idle',
    createLoadingState: () => 'loading',
  });

  assert.deepEqual(result, {
    wsl: 'loading',
    docker: 'loading',
    npm: 'idle',
  });
});

await runTest('hydrateInstallAssessmentBatches groups priority and deferred assessment updates into batched patches', async () => {
  const { hydrateInstallAssessmentBatches } = await import('./installAssessmentHydration.ts');

  const batches: Array<Record<string, string>> = [];
  const inspectedIds: string[] = [];

  for await (const batch of hydrateInstallAssessmentBatches({
    priorityChoices: [{ id: 'wsl' }, { id: 'docker' }],
    deferredChoices: [{ id: 'npm' }, { id: 'pnpm' }, { id: 'source' }],
    inspectChoice: async (choice) => {
      inspectedIds.push(choice.id);
      return [choice.id, `${choice.id}-ready`] as const;
    },
    createDeferredLoadingState: () => 'loading',
    deferredResultBatchSize: 2,
    waitBeforeDeferredHydration: async () => {},
  })) {
    batches.push(batch);
  }

  assert.deepEqual(inspectedIds, ['wsl', 'docker', 'npm', 'pnpm', 'source']);
  assert.deepEqual(batches, [
    {
      wsl: 'wsl-ready',
      docker: 'docker-ready',
    },
    {
      npm: 'loading',
      pnpm: 'loading',
      source: 'loading',
    },
    {
      npm: 'npm-ready',
      pnpm: 'pnpm-ready',
    },
    {
      source: 'source-ready',
    },
  ]);
});
