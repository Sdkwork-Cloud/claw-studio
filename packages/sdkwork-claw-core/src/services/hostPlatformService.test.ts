import assert from 'node:assert/strict';
import type {
  HostPlatformStatusRecord,
  InternalNodeSessionRecord,
} from '@sdkwork/claw-infrastructure';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createHostStatus(
  overrides: Partial<HostPlatformStatusRecord> = {},
): HostPlatformStatusRecord {
  return {
    mode: 'desktopCombined',
    lifecycle: 'ready',
    hostId: 'desktop-combined',
    displayName: 'Desktop Combined Host',
    version: '0.1.0',
    desiredStateProjectionVersion: 'phase1',
    rolloutEngineVersion: 'phase1',
    manageBasePath: '/claw/manage/v1',
    internalBasePath: '/claw/internal/v1',
    capabilityKeys: ['nodeSessions', 'rollouts'],
    updatedAt: 1_743_200_000_000,
    ...overrides,
  };
}

function createNodeSession(
  overrides: Partial<InternalNodeSessionRecord> = {},
): InternalNodeSessionRecord {
  return {
    sessionId: 'desktop-combined-local-built-in',
    nodeId: 'local-built-in',
    state: 'admitted',
    compatibilityState: 'compatible',
    desiredStateRevision: 7,
    desiredStateHash: 'rev-7',
    lastSeenAt: 1_743_200_000_123,
    ...overrides,
  };
}

await runTest(
  'hostPlatformService exposes host status snapshots and node sessions through the internal platform bridge',
  async () => {
    const { createHostPlatformService } = await import('./hostPlatformService.ts');

    const service = createHostPlatformService({
      getInternalPlatform: () => ({
        getHostPlatformStatus: async () => createHostStatus(),
        listNodeSessions: async () => [
          createNodeSession(),
          createNodeSession({
            sessionId: 'remote-managed-session',
            nodeId: 'managed-remote',
            compatibilityState: 'blocked',
            state: 'blocked',
            desiredStateRevision: null,
            desiredStateHash: null,
          }),
        ],
      }),
    });

    const status = await service.getStatus();
    const sessions = await service.listNodeSessions();

    assert.equal(status.mode, 'desktopCombined');
    assert.equal(status.lifecycle, 'ready');
    assert.equal(status.capabilityCount, 2);
    assert.equal(status.isReady, true);
    assert.deepEqual(status.capabilityKeys, ['nodeSessions', 'rollouts']);
    assert.equal(sessions[0]?.desiredStateRevision, 7);
    assert.equal(sessions[1]?.compatibilityState, 'blocked');
  },
);
