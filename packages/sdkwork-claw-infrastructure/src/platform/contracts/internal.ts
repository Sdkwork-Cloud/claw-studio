export type HostPlatformMode = 'web' | 'desktopCombined' | 'server';

export type HostPlatformLifecycle =
  | 'inactive'
  | 'starting'
  | 'ready'
  | 'degraded'
  | 'stopping'
  | 'stopped';

export interface HostPlatformStatusRecord {
  mode: HostPlatformMode;
  lifecycle: HostPlatformLifecycle;
  hostId: string;
  displayName: string;
  version: string;
  desiredStateProjectionVersion: string;
  rolloutEngineVersion: string;
  manageBasePath: string;
  internalBasePath: string;
  capabilityKeys: string[];
  updatedAt: number;
}

export type InternalNodeSessionState =
  | 'pending'
  | 'admitted'
  | 'degraded'
  | 'blocked'
  | 'closing'
  | 'closed';

export type InternalNodeCompatibilityState = 'compatible' | 'degraded' | 'blocked';

export interface InternalNodeSessionRecord {
  sessionId: string;
  nodeId: string;
  state: InternalNodeSessionState;
  compatibilityState: InternalNodeCompatibilityState;
  desiredStateRevision?: number | null;
  desiredStateHash?: string | null;
  lastSeenAt: number;
}

export interface InternalErrorEnvelope {
  error: {
    code: string;
    category: string;
    retryable: boolean;
    resolution: string;
  };
}

export interface InternalPlatformAPI {
  getHostPlatformStatus(): Promise<HostPlatformStatusRecord>;
  listNodeSessions(): Promise<InternalNodeSessionRecord[]>;
}
