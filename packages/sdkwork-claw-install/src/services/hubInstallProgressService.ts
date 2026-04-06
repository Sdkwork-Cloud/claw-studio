import type {
  HubInstallArtifactReport,
  HubInstallProgressEvent,
  HubInstallResult,
  HubInstallStageReport,
} from '@sdkwork/claw-infrastructure';

type HubInstallProgressEntryStatus = 'running' | 'success' | 'error';

export interface HubInstallProgressStageEntry {
  stage: string;
  totalSteps: number;
  failedSteps: number;
  status: HubInstallProgressEntryStatus;
}

export interface HubInstallProgressArtifactEntry {
  artifactId: string;
  artifactType: string;
  status: HubInstallProgressEntryStatus;
}

export interface HubInstallProgressState {
  currentStage: string | null;
  activeStepId: string | null;
  activeStepDescription: string | null;
  lastCommand: string | null;
  stages: HubInstallProgressStageEntry[];
  artifacts: HubInstallProgressArtifactEntry[];
  totalStageCount: number;
  completedStageCount: number;
  failedStageCount: number;
  totalArtifactCount: number;
  completedArtifactCount: number;
  failedArtifactCount: number;
}

function summarizeProgressState(input: {
  currentStage: string | null;
  activeStepId: string | null;
  activeStepDescription: string | null;
  lastCommand: string | null;
  stages: HubInstallProgressStageEntry[];
  artifacts: HubInstallProgressArtifactEntry[];
}): HubInstallProgressState {
  return {
    ...input,
    totalStageCount: input.stages.length,
    completedStageCount: input.stages.filter((stage) => stage.status === 'success').length,
    failedStageCount: input.stages.filter((stage) => stage.status === 'error').length,
    totalArtifactCount: input.artifacts.length,
    completedArtifactCount: input.artifacts.filter((artifact) => artifact.status === 'success')
      .length,
    failedArtifactCount: input.artifacts.filter((artifact) => artifact.status === 'error').length,
  };
}

function upsertStage(
  stages: HubInstallProgressStageEntry[],
  update: HubInstallProgressStageEntry,
): HubInstallProgressStageEntry[] {
  const index = stages.findIndex((stage) => stage.stage === update.stage);
  if (index === -1) {
    return [...stages, update];
  }

  return stages.map((stage, stageIndex) => (stageIndex === index ? update : stage));
}

function upsertArtifact(
  artifacts: HubInstallProgressArtifactEntry[],
  update: HubInstallProgressArtifactEntry,
): HubInstallProgressArtifactEntry[] {
  const index = artifacts.findIndex((artifact) => artifact.artifactId === update.artifactId);
  if (index === -1) {
    return [...artifacts, update];
  }

  return artifacts.map((artifact, artifactIndex) => (artifactIndex === index ? update : artifact));
}

function applyStageReport(
  stages: HubInstallProgressStageEntry[],
  report: HubInstallStageReport,
): HubInstallProgressStageEntry[] {
  return upsertStage(stages, {
    stage: report.stage,
    totalSteps: report.totalSteps,
    failedSteps: report.failedSteps,
    status: report.success ? 'success' : 'error',
  });
}

function applyArtifactReport(
  artifacts: HubInstallProgressArtifactEntry[],
  report: HubInstallArtifactReport,
): HubInstallProgressArtifactEntry[] {
  return upsertArtifact(artifacts, {
    artifactId: report.artifactId,
    artifactType: report.artifactType,
    status: report.success ? 'success' : 'error',
  });
}

export function createHubInstallProgressState(): HubInstallProgressState {
  return summarizeProgressState({
    currentStage: null,
    activeStepId: null,
    activeStepDescription: null,
    lastCommand: null,
    stages: [],
    artifacts: [],
  });
}

export function reduceHubInstallProgressEvent(
  state: HubInstallProgressState,
  event: HubInstallProgressEvent,
): HubInstallProgressState {
  if (event.type === 'stageStarted') {
    return summarizeProgressState({
      ...state,
      currentStage: event.stage,
      stages: upsertStage(state.stages, {
        stage: event.stage,
        totalSteps: event.totalSteps,
        failedSteps: 0,
        status: 'running',
      }),
    });
  }

  if (event.type === 'stageCompleted') {
    return summarizeProgressState({
      ...state,
      currentStage: event.stage,
      stages: upsertStage(state.stages, {
        stage: event.stage,
        totalSteps: event.totalSteps,
        failedSteps: event.failedSteps,
        status: event.success ? 'success' : 'error',
      }),
    });
  }

  if (event.type === 'artifactStarted') {
    return summarizeProgressState({
      ...state,
      artifacts: upsertArtifact(state.artifacts, {
        artifactId: event.artifactId,
        artifactType: event.artifactType,
        status: 'running',
      }),
    });
  }

  if (event.type === 'artifactCompleted') {
    return summarizeProgressState({
      ...state,
      artifacts: upsertArtifact(state.artifacts, {
        artifactId: event.artifactId,
        artifactType: event.artifactType,
        status: event.success ? 'success' : 'error',
      }),
    });
  }

  if (event.type === 'stepStarted') {
    return summarizeProgressState({
      ...state,
      activeStepId: event.stepId,
      activeStepDescription: event.description,
    });
  }

  if (event.type === 'stepCommandStarted') {
    return summarizeProgressState({
      ...state,
      activeStepId: event.stepId,
      lastCommand: event.commandLine,
    });
  }

  if (event.type === 'stepCompleted') {
    return summarizeProgressState({
      ...state,
      activeStepId: event.stepId === state.activeStepId ? null : state.activeStepId,
    });
  }

  return state;
}

export function applyHubInstallResultToProgressState(
  state: HubInstallProgressState,
  result: {
    stageReports: HubInstallResult['stageReports'];
    artifactReports?: HubInstallResult['artifactReports'];
  },
): HubInstallProgressState {
  const stages = result.stageReports.reduce(applyStageReport, state.stages);
  const artifacts = (result.artifactReports ?? []).reduce(applyArtifactReport, state.artifacts);
  const currentStage =
    result.stageReports[result.stageReports.length - 1]?.stage ?? state.currentStage;

  return summarizeProgressState({
    ...state,
    currentStage,
    stages,
    artifacts,
  });
}

export function formatHubInstallProgressEvent(
  t: (key: string) => string,
  event: HubInstallProgressEvent,
) {
  if (event.type === 'dependencyStarted') {
    return event.description || event.target || event.dependencyId;
  }

  if (event.type === 'dependencyCompleted') {
    const label = event.target || event.dependencyId;
    if (event.skipped) {
      return `${label}: ${t('install.page.modal.progress.stepSkipped')}`;
    }

    if (!event.success) {
      return `${label}: ${t('install.page.modal.progress.stepFailed')}`;
    }

    return `${label}: ${humanizeHubInstallProgressLabel(event.statusAfter) || event.statusAfter}`;
  }

  if (event.type === 'stepStarted') {
    return event.description;
  }

  if (event.type === 'stepCommandStarted') {
    return event.commandLine;
  }

  if (event.type === 'stepLogChunk') {
    return event.chunk;
  }

  if (event.type === 'artifactCompleted' && !event.success) {
    return t('install.page.modal.progress.downloadFailed');
  }

  if (event.type === 'stepCompleted' && event.skipped) {
    return t('install.page.modal.progress.stepSkipped');
  }

  if (event.type === 'stepCompleted' && !event.success) {
    return t('install.page.modal.progress.stepFailed');
  }

  return '';
}

export function humanizeHubInstallProgressLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[_-]+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
