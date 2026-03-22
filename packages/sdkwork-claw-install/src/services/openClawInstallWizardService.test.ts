import assert from 'node:assert/strict';
import type { ProxyProvider } from '@sdkwork/claw-types';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createProvider(overrides: Partial<ProxyProvider> = {}): ProxyProvider {
  return {
    id: 'provider-test',
    channelId: 'openai',
    name: 'OpenAI Router',
    apiKey: 'sk-router-live-123',
    groupId: 'team-ops',
    usage: {
      requestCount: 1200,
      tokenCount: 480000,
      spendUsd: 12.5,
      period: '30d',
    },
    expiresAt: null,
    status: 'active',
    createdAt: '2026-03-18T08:00:00.000Z',
    baseUrl: 'https://router.example.com/v1',
    models: [
      {
        id: 'gpt-4.1',
        name: 'GPT-4.1',
      },
      {
        id: 'o4-mini',
        name: 'o4-mini',
      },
      {
        id: 'text-embedding-3-small',
        name: 'Text Embedding 3 Small',
      },
    ],
    notes: 'OpenClaw wizard test fixture.',
    ...overrides,
  };
}

await runTest('openClawInstallWizardService filters only providers compatible with OpenClaw bootstrap', async () => {
  const { filterOpenClawCompatibleProviders } = await import('./openClawInstallWizardService.ts');

  const providers = [
    createProvider({ id: 'provider-openai', channelId: 'openai' }),
    createProvider({ id: 'provider-anthropic', channelId: 'anthropic' }),
    createProvider({ id: 'provider-google', channelId: 'google' }),
    createProvider({ id: 'provider-meta', channelId: 'meta' }),
  ];

  const compatibleProviders = filterOpenClawCompatibleProviders(providers);

  assert.deepEqual(
    compatibleProviders.map((provider) => provider.id),
    ['provider-openai', 'provider-anthropic'],
  );
});

await runTest('openClawInstallWizardService infers primary, reasoning, and embedding model selections', async () => {
  const { buildOpenClawModelSelection } = await import('./openClawInstallWizardService.ts');

  const selection = buildOpenClawModelSelection(
    createProvider({
      channelId: 'moonshot',
      models: [
        {
          id: 'kimi-k2-0905-preview',
          name: 'Kimi K2 Preview',
        },
        {
          id: 'kimi-thinking',
          name: 'Kimi Thinking',
        },
        {
          id: 'text-embedding-3-small',
          name: 'Text Embedding 3 Small',
        },
      ],
    }),
  );

  assert.deepEqual(selection, {
    defaultModelId: 'kimi-k2-0905-preview',
    reasoningModelId: 'kimi-thinking',
    embeddingModelId: 'text-embedding-3-small',
  });
});

await runTest('openClawInstallWizardService blocks the install step when dependency blockers remain', async () => {
  const { buildOpenClawWizardSteps } = await import('./openClawInstallWizardService.ts');

  const steps = buildOpenClawWizardSteps({
    assessmentStatus: 'blocked',
    dependenciesReviewed: false,
    installStatus: 'idle',
    configurationStatus: 'idle',
    initializationStatus: 'idle',
  });

  assert.equal(steps[0]?.id, 'dependencies');
  assert.equal(steps[0]?.status, 'blocked');
  assert.equal(steps[1]?.id, 'install');
  assert.equal(steps[1]?.status, 'pending');
});

await runTest('openClawInstallWizardService treats an existing local install as a completed install step', async () => {
  const { buildOpenClawWizardSteps } = await import('./openClawInstallWizardService.ts');

  const steps = buildOpenClawWizardSteps({
    assessmentStatus: 'ready',
    dependenciesReviewed: true,
    installStatus: 'idle',
    configurationStatus: 'idle',
    initializationStatus: 'idle',
    hasExistingInstall: true,
  });

  assert.equal(steps[0]?.id, 'dependencies');
  assert.equal(steps[0]?.status, 'completed');
  assert.equal(steps[1]?.id, 'install');
  assert.equal(steps[1]?.status, 'completed');
  assert.equal(steps[2]?.id, 'configure');
  assert.equal(steps[2]?.status, 'ready');
});

await runTest('openClawInstallWizardService marks the flow ready to use when install, configuration, and initialization are complete', async () => {
  const {
    buildOpenClawVerificationSummary,
    buildOpenClawWizardSteps,
  } = await import('./openClawInstallWizardService.ts');

  const steps = buildOpenClawWizardSteps({
    assessmentStatus: 'ready',
    dependenciesReviewed: true,
    installStatus: 'success',
    configurationStatus: 'success',
    initializationStatus: 'success',
  });
  const summary = buildOpenClawVerificationSummary({
    installSucceeded: true,
    gatewayReachable: true,
    hasReadyProvider: true,
    selectedChannelCount: 2,
    configuredChannelCount: 2,
    selectedSkillCount: 4,
    initializedSkillCount: 4,
  });

  assert.deepEqual(
    steps.map((step) => [step.id, step.status]),
    [
      ['dependencies', 'completed'],
      ['install', 'completed'],
      ['configure', 'completed'],
      ['initialize', 'completed'],
      ['verify', 'completed'],
    ],
  );
  assert.equal(summary.status, 'success');
  assert.equal(summary.isReadyToUse, true);
});

await runTest('openClawInstallWizardService reports follow-up needed when install succeeds without a ready provider', async () => {
  const { buildOpenClawVerificationSummary } = await import('./openClawInstallWizardService.ts');

  const summary = buildOpenClawVerificationSummary({
    installSucceeded: true,
    gatewayReachable: true,
    hasReadyProvider: false,
    selectedChannelCount: 1,
    configuredChannelCount: 1,
    selectedSkillCount: 2,
    initializedSkillCount: 2,
  });

  assert.equal(summary.status, 'warning');
  assert.equal(summary.isReadyToUse, false);
  assert.equal(summary.items.find((item) => item.id === 'provider')?.status, 'warning');
});

await runTest('openClawInstallWizardService blocks the ready state until the synchronized gateway is reachable', async () => {
  const { buildOpenClawVerificationSummary } = await import('./openClawInstallWizardService.ts');

  const summary = buildOpenClawVerificationSummary({
    installSucceeded: true,
    gatewayReachable: false,
    hasReadyProvider: true,
    selectedChannelCount: 2,
    configuredChannelCount: 2,
    selectedSkillCount: 3,
    initializedSkillCount: 3,
  });

  assert.equal(summary.status, 'warning');
  assert.equal(summary.isReadyToUse, false);
  assert.equal(summary.items.find((item) => item.id === 'gateway')?.status, 'warning');
});
