import assert from 'node:assert/strict';
import type { HubInstallAssessmentResult } from '@sdkwork/claw-infrastructure';
import type { InstallChoiceAssessmentState } from './installRecommendationService.ts';

type AssessmentOverrides = Omit<Partial<HubInstallAssessmentResult>, 'runtime'> & {
  runtime?: Partial<HubInstallAssessmentResult['runtime']>;
};

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createAssessment(
  overrides: AssessmentOverrides = {},
): InstallChoiceAssessmentState {
  const runtimeOverrides = overrides.runtime ?? {};
  const { runtime: _runtime, ...assessmentOverrides } = overrides;

  return {
    status: 'success',
    result: {
      registryName: 'official',
      registrySource: 'local',
      softwareName: 'openclaw',
      manifestSource: 'manifest',
      manifestName: 'OpenClaw',
      ready: true,
      requiresElevatedSetup: false,
      platform: 'windows',
      effectiveRuntimePlatform: 'windows',
      resolvedInstallScope: 'user',
      resolvedInstallRoot: 'C:/Users/admin/AppData/Local/Programs/openclaw',
      resolvedWorkRoot: 'C:/Users/admin/workspace/openclaw',
      resolvedBinDir: 'C:/Users/admin/AppData/Local/Programs/openclaw/bin',
      resolvedDataRoot: 'C:/Users/admin/AppData/Roaming/openclaw',
      installControlLevel: 'partial',
      installStatus: null,
      issues: [],
      dependencies: [],
      recommendations: [],
      dataItems: [],
      migrationStrategies: [],
      runtime: {
        hostPlatform: 'windows',
        requestedRuntimePlatform: 'windows',
        effectiveRuntimePlatform: 'windows',
        availableWslDistributions: [],
        wslAvailable: false,
        hostDockerAvailable: false,
        wslDockerAvailable: false,
        commandAvailability: {},
        ...runtimeOverrides,
      },
      ...assessmentOverrides,
    },
  };
}

await runTest(
  'installRecommendationService prefers WSL on Windows when the WSL profile is actionable',
  async () => {
    const { buildInstallRecommendationSummary } = await import('./installRecommendationService.ts');

    const summary = buildInstallRecommendationSummary({
      hostOs: 'windows',
      arch: 'x64',
      productPreferredChoiceId: 'wsl',
      choices: [
        {
          id: 'wsl',
          softwareName: 'openclaw-wsl',
          assessment: createAssessment({
            runtime: {
              effectiveRuntimePlatform: 'wsl',
              wslAvailable: true,
              hostDockerAvailable: true,
              wslDockerAvailable: true,
              commandAvailability: {
                node: true,
              },
            },
          }),
        },
        {
          id: 'docker',
          softwareName: 'openclaw-docker',
          assessment: createAssessment({
            runtime: {
              effectiveRuntimePlatform: 'windows',
              wslAvailable: true,
              hostDockerAvailable: true,
              wslDockerAvailable: true,
              commandAvailability: {},
            },
          }),
        },
        {
          id: 'npm',
          softwareName: 'openclaw-npm',
          assessment: createAssessment({
            runtime: {
              effectiveRuntimePlatform: 'windows',
              wslAvailable: true,
              hostDockerAvailable: true,
              wslDockerAvailable: true,
              commandAvailability: {
                node: true,
                npm: true,
              },
            },
          }),
        },
      ],
    });

    assert.equal(summary.primaryChoice?.id, 'wsl');
    assert.equal(summary.primaryChoice?.state, 'ready');
    assert.equal(summary.readyChoiceCount, 3);
  },
);

await runTest(
  'installRecommendationService falls back to Docker on Windows when WSL is blocked',
  async () => {
    const { buildInstallRecommendationSummary } = await import('./installRecommendationService.ts');

    const summary = buildInstallRecommendationSummary({
      hostOs: 'windows',
      arch: 'x64',
      productPreferredChoiceId: 'wsl',
      choices: [
        {
          id: 'wsl',
          softwareName: 'openclaw-wsl',
          assessment: createAssessment({
            ready: false,
            issues: [
              {
                severity: 'error',
                code: 'WSL_MISSING',
                message: 'WSL is not ready.',
              },
            ],
            runtime: {
              effectiveRuntimePlatform: 'wsl',
              wslAvailable: false,
              hostDockerAvailable: true,
              wslDockerAvailable: false,
              commandAvailability: {},
            },
          }),
        },
        {
          id: 'docker',
          softwareName: 'openclaw-docker',
          assessment: createAssessment({
            runtime: {
              effectiveRuntimePlatform: 'windows',
              wslAvailable: false,
              hostDockerAvailable: true,
              wslDockerAvailable: false,
              commandAvailability: {},
            },
          }),
        },
        {
          id: 'npm',
          softwareName: 'openclaw-npm',
          assessment: createAssessment({
            ready: false,
            issues: [
              {
                severity: 'error',
                code: 'NODE_MISSING',
                message: 'Node.js is missing.',
              },
            ],
            runtime: {
              effectiveRuntimePlatform: 'windows',
              wslAvailable: false,
              hostDockerAvailable: true,
              wslDockerAvailable: false,
              commandAvailability: {
                node: false,
                npm: false,
              },
            },
          }),
        },
      ],
    });

    assert.equal(summary.primaryChoice?.id, 'docker');
    assert.equal(summary.primaryChoice?.state, 'ready');
    assert.deepEqual(
      summary.recoveryChoices.map((choice) => choice.id),
      ['wsl', 'npm'],
    );
  },
);

await runTest(
  'installRecommendationService prefers package-manager installs on macOS when they are ready',
  async () => {
    const { buildInstallRecommendationSummary } = await import('./installRecommendationService.ts');

    const summary = buildInstallRecommendationSummary({
      hostOs: 'macos',
      arch: 'arm64',
      productPreferredChoiceId: 'npm',
      choices: [
        {
          id: 'docker',
          softwareName: 'openclaw-docker',
          assessment: createAssessment({
            runtime: {
              effectiveRuntimePlatform: 'macos',
              wslAvailable: false,
              hostDockerAvailable: true,
              wslDockerAvailable: false,
              commandAvailability: {},
            },
          }),
        },
        {
          id: 'npm',
          softwareName: 'openclaw-npm',
          assessment: createAssessment({
            runtime: {
              effectiveRuntimePlatform: 'macos',
              wslAvailable: false,
              hostDockerAvailable: true,
              wslDockerAvailable: false,
              commandAvailability: {
                node: true,
                npm: true,
              },
            },
          }),
        },
      ],
    });

    assert.equal(summary.primaryChoice?.id, 'npm');
    assert.equal(summary.platformSignals.nodeAvailable, true);
  },
);

await runTest(
  'installRecommendationService keeps source as the primary path for single-path source workflows',
  async () => {
    const { buildInstallRecommendationSummary } = await import('./installRecommendationService.ts');

    const summary = buildInstallRecommendationSummary({
      hostOs: 'linux',
      arch: 'x64',
      productPreferredChoiceId: 'source',
      choices: [
        {
          id: 'source',
          softwareName: 'openclaw-source',
          assessment: createAssessment({
            runtime: {
              effectiveRuntimePlatform: 'ubuntu',
              wslAvailable: false,
              hostDockerAvailable: false,
              wslDockerAvailable: false,
              commandAvailability: {
                git: true,
                cargo: true,
              },
            },
          }),
        },
      ],
    });

    assert.equal(summary.primaryChoice?.id, 'source');
    assert.equal(summary.primaryChoice?.recommendationReason, 'singlePath');
  },
);

await runTest(
  'installRecommendationService sorts blocked choices behind actionable choices even when they are the default preference',
  async () => {
    const { buildInstallRecommendationSummary } = await import('./installRecommendationService.ts');

    const summary = buildInstallRecommendationSummary({
      hostOs: 'linux',
      arch: 'x64',
      productPreferredChoiceId: 'npm',
      choices: [
        {
          id: 'npm',
          softwareName: 'openclaw-npm',
          assessment: createAssessment({
            ready: false,
            issues: [
              {
                severity: 'error',
                code: 'NODE_MISSING',
                message: 'Node.js is missing.',
              },
            ],
            runtime: {
              effectiveRuntimePlatform: 'ubuntu',
              wslAvailable: false,
              hostDockerAvailable: true,
              wslDockerAvailable: false,
              commandAvailability: {
                node: false,
                npm: false,
              },
            },
          }),
        },
        {
          id: 'docker',
          softwareName: 'openclaw-docker',
          assessment: createAssessment({
            runtime: {
              effectiveRuntimePlatform: 'ubuntu',
              wslAvailable: false,
              hostDockerAvailable: true,
              wslDockerAvailable: false,
              commandAvailability: {},
            },
          }),
        },
      ],
    });

    assert.equal(summary.primaryChoice?.id, 'docker');
    assert.equal(summary.fixFirstChoiceCount, 1);
    assert.equal(summary.secondaryChoices.length, 0);
  },
);
