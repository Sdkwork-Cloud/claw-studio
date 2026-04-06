import assert from 'node:assert/strict';
import type { HubInstallResult } from '@sdkwork/claw-infrastructure';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'hubInstallProgressService summarizes live stage, step, command, and artifact progress',
  async () => {
    const {
      createHubInstallProgressState,
      reduceHubInstallProgressEvent,
    } = await import('./hubInstallProgressService.ts');

    const events = [
      {
        type: 'stageStarted',
        stage: 'dependencies',
        totalSteps: 2,
      } as const,
      {
        type: 'stepStarted',
        stepId: 'ensure-node',
        description: 'Ensure Node.js',
      } as const,
      {
        type: 'stepCommandStarted',
        stepId: 'ensure-node',
        commandLine: 'winget install OpenJS.NodeJS.LTS',
      } as const,
      {
        type: 'artifactStarted',
        artifactId: 'nodejs',
        artifactType: 'package',
      } as const,
      {
        type: 'artifactCompleted',
        artifactId: 'nodejs',
        artifactType: 'package',
        success: true,
      } as const,
      {
        type: 'stageCompleted',
        stage: 'dependencies',
        success: true,
        totalSteps: 2,
        failedSteps: 0,
      } as const,
    ];

    const state = events.reduce(reduceHubInstallProgressEvent, createHubInstallProgressState());

    assert.equal(state.currentStage, 'dependencies');
    assert.equal(state.activeStepDescription, 'Ensure Node.js');
    assert.equal(state.lastCommand, 'winget install OpenJS.NodeJS.LTS');
    assert.equal(state.completedArtifactCount, 1);
    assert.equal(state.failedArtifactCount, 0);
    assert.equal(state.completedStageCount, 1);
    assert.equal(state.failedStageCount, 0);
  },
);

await runTest(
  'hubInstallProgressService merges final result reports so post-run summaries stay accurate',
  async () => {
    const {
      applyHubInstallResultToProgressState,
      createHubInstallProgressState,
      reduceHubInstallProgressEvent,
    } = await import('./hubInstallProgressService.ts');

    const liveState = reduceHubInstallProgressEvent(createHubInstallProgressState(), {
      type: 'stageStarted',
      stage: 'install',
      totalSteps: 3,
    });
    const result: HubInstallResult = {
      registryName: 'official',
      registrySource: 'local',
      softwareName: 'openclaw-npm',
      manifestSource: 'manifest',
      manifestName: 'OpenClaw Install (npm)',
      success: false,
      durationMs: 12000,
      platform: 'windows',
      effectiveRuntimePlatform: 'windows',
      resolvedInstallScope: 'user',
      resolvedInstallRoot: 'C:\\Users\\admin\\AppData\\Local\\Programs\\openclaw',
      resolvedWorkRoot: 'C:\\Users\\admin\\workspace\\openclaw',
      resolvedBinDir: 'C:\\Users\\admin\\AppData\\Local\\Programs\\openclaw\\bin',
      resolvedDataRoot: 'C:\\Users\\admin\\AppData\\Roaming\\openclaw',
      installControlLevel: 'partial',
      stageReports: [
        {
          stage: 'dependencies',
          success: true,
          durationMs: 3000,
          totalSteps: 2,
          failedSteps: 0,
        },
        {
          stage: 'install',
          success: false,
          durationMs: 9000,
          totalSteps: 3,
          failedSteps: 1,
        },
      ],
      artifactReports: [
        {
          artifactId: 'nodejs',
          artifactType: 'package',
          success: true,
          durationMs: 2500,
          detail: 'Installed Node.js',
        },
        {
          artifactId: 'openclaw',
          artifactType: 'package',
          success: false,
          durationMs: 9000,
          detail: 'OpenClaw install failed',
        },
      ],
    };

    const finalState = applyHubInstallResultToProgressState(liveState, result);

    assert.equal(finalState.completedStageCount, 1);
    assert.equal(finalState.failedStageCount, 1);
    assert.equal(finalState.completedArtifactCount, 1);
    assert.equal(finalState.failedArtifactCount, 1);
    assert.equal(finalState.currentStage, 'install');
  },
);

await runTest(
  'hubInstallProgressService formats dependency install events for focused remediation runs',
  async () => {
    const { formatHubInstallProgressEvent } = await import('./hubInstallProgressService.ts');

    const t = (key: string) => key;
    const started = formatHubInstallProgressEvent(t, {
      type: 'dependencyStarted',
      dependencyId: 'node',
      target: 'node',
      description: 'Node.js runtime',
    });
    const completed = formatHubInstallProgressEvent(t, {
      type: 'dependencyCompleted',
      dependencyId: 'node',
      target: 'node',
      success: true,
      skipped: false,
      statusAfter: 'available',
    });

    assert.match(started, /Node\.js runtime|node/i);
    assert.match(completed, /node/i);
  },
);
