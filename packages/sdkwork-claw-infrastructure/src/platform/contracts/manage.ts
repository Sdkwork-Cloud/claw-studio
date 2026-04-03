import type { RuntimeKernelPreflightOutcome } from './kernel.ts';

export type ManageRolloutPhase =
  | 'draft'
  | 'previewing'
  | 'awaitingApproval'
  | 'ready'
  | 'promoting'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface PreviewRolloutRequest {
  rolloutId: string;
  forceRecompute?: boolean;
  includeTargets?: boolean;
}

export interface ManageRolloutRecord {
  id: string;
  phase: ManageRolloutPhase;
  attempt: number;
  targetCount: number;
  updatedAt: number;
}

export interface ManageRolloutListResult {
  items: ManageRolloutRecord[];
  total: number;
}

export interface ManageRolloutTargetPreviewRecord {
  nodeId: string;
  preflightOutcome: RuntimeKernelPreflightOutcome;
  blockedReason?: string | null;
  desiredStateRevision?: number | null;
  desiredStateHash?: string | null;
  waveId?: string | null;
}

export interface ManageRolloutPreviewSummary {
  totalTargets: number;
  admissibleTargets: number;
  degradedTargets: number;
  blockedTargets: number;
  predictedWaveCount: number;
}

export interface ManageRolloutCandidateRevisionSummary {
  totalTargets: number;
  minDesiredStateRevision?: number | null;
  maxDesiredStateRevision?: number | null;
}

export interface ManageRolloutPreview {
  rolloutId: string;
  phase: Extract<ManageRolloutPhase, 'previewing' | 'awaitingApproval' | 'ready' | 'failed'>;
  attempt: number;
  summary: ManageRolloutPreviewSummary;
  targets: ManageRolloutTargetPreviewRecord[];
  candidateRevisionSummary?: ManageRolloutCandidateRevisionSummary | null;
  generatedAt: number;
}

export interface ManagePlatformAPI {
  listRollouts(): Promise<ManageRolloutListResult>;
  previewRollout(input: PreviewRolloutRequest): Promise<ManageRolloutPreview>;
  startRollout(rolloutId: string): Promise<ManageRolloutRecord>;
}
