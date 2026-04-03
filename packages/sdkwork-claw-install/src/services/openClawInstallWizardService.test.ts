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

await runTest(
  'openClawInstallWizardService keeps native gemini and synthesized local proxy routes compatible with OpenClaw bootstrap',
  async () => {
  const { filterOpenClawCompatibleProviders } = await import('./openClawInstallWizardService.ts');

  const providers = [
    createProvider({ id: 'provider-openai', channelId: 'openai' }),
    createProvider({ id: 'provider-anthropic', channelId: 'anthropic' }),
    createProvider({ id: 'provider-google', channelId: 'google', clientProtocol: 'gemini' }),
    createProvider({
      id: 'provider-sdkwork-gemini',
      channelId: 'sdkwork',
      name: 'SDKWork Gemini Default',
      clientProtocol: 'gemini',
      managedBy: 'system-default',
    }),
    createProvider({ id: 'provider-meta', channelId: 'meta' }),
  ];

  const compatibleProviders = filterOpenClawCompatibleProviders(providers);

  assert.deepEqual(
    compatibleProviders.map((provider) => provider.id),
    [
      'provider-openai',
      'provider-anthropic',
      'provider-google',
      'provider-sdkwork-gemini',
      'provider-meta',
    ],
  );
});

await runTest(
  'openClawInstallWizardService keeps broader OpenAI-compatible provider families compatible with OpenClaw bootstrap',
  async () => {
    const { filterOpenClawCompatibleProviders } = await import('./openClawInstallWizardService.ts');

    const providers = [
      createProvider({ id: 'provider-meta', channelId: 'meta' }),
      createProvider({ id: 'provider-mistral', channelId: 'mistral' }),
      createProvider({ id: 'provider-cohere', channelId: 'cohere' }),
      createProvider({ id: 'provider-amazon-nova', channelId: 'amazon-nova' }),
      createProvider({ id: 'provider-zhipu', channelId: 'zhipu' }),
      createProvider({ id: 'provider-doubao', channelId: 'doubao' }),
      createProvider({ id: 'provider-baichuan', channelId: 'baichuan' }),
      createProvider({ id: 'provider-yi', channelId: 'yi' }),
    ];

    assert.deepEqual(
      filterOpenClawCompatibleProviders(providers).map((provider) => provider.id),
      [
        'provider-meta',
        'provider-mistral',
        'provider-cohere',
        'provider-amazon-nova',
        'provider-zhipu',
        'provider-doubao',
        'provider-baichuan',
        'provider-yi',
      ],
    );
  },
);

await runTest(
  'openClawInstallWizardService sorts providers by status, default priority, ownership, and protocol preference',
  async () => {
    const { sortOpenClawBootstrapProviders } = await import('./openClawInstallWizardService.ts');

    const providers = [
      createProvider({
        id: 'provider-system-anthropic',
        channelId: 'sdkwork',
        name: 'SDKWork Anthropic Default',
        status: 'active',
        isDefault: true,
        managedBy: 'system-default',
        clientProtocol: 'anthropic',
      }),
      createProvider({
        id: 'provider-user-openai',
        channelId: 'openai',
        name: 'OpenAI Production',
        status: 'active',
        isDefault: true,
        managedBy: 'user',
        clientProtocol: 'openai-compatible',
      }),
      createProvider({
        id: 'provider-system-openai',
        channelId: 'sdkwork',
        name: 'SDKWork Default',
        status: 'active',
        isDefault: true,
        managedBy: 'system-default',
        clientProtocol: 'openai-compatible',
      }),
      createProvider({
        id: 'provider-disabled-qwen',
        channelId: 'qwen',
        name: 'Qwen Backup',
        status: 'disabled',
        isDefault: false,
        managedBy: 'user',
        clientProtocol: 'openai-compatible',
      }),
      createProvider({
        id: 'provider-system-gemini',
        channelId: 'sdkwork',
        name: 'SDKWork Gemini Default',
        status: 'active',
        isDefault: true,
        managedBy: 'system-default',
        clientProtocol: 'gemini',
      }),
    ];

    assert.deepEqual(
      sortOpenClawBootstrapProviders(providers).map((provider) => provider.id),
      [
        'provider-user-openai',
        'provider-system-openai',
        'provider-system-anthropic',
        'provider-system-gemini',
        'provider-disabled-qwen',
      ],
    );
  },
);

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
