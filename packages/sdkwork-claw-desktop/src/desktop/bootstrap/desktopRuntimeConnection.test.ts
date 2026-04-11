import assert from 'node:assert/strict';
import {
  connectDesktopRuntimeDuringStartup,
  type DesktopRuntimeConnectionFailureContext,
  type DesktopRuntimeConnectionOptions,
  type DesktopRuntimeConnectionReadyContext,
} from './desktopRuntimeConnection.ts';

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve());
}

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

function createConnectionOptions(
  overrides: Partial<DesktopRuntimeConnectionOptions> = {},
): DesktopRuntimeConnectionOptions {
  return {
    isTauriRuntime: () => true,
    getAppInfo: async () =>
      ({
        name: 'Claw Studio',
        version: '0.1.0',
        target: 'x86_64-pc-windows-msvc',
        kind: 'desktop',
      }) as any,
    getAppPaths: async () =>
      ({
        dataDir: 'D:/data',
        logsDir: 'D:/logs',
        machineLogsDir: 'D:/machine-logs',
        mainLogFile: 'D:/logs/main.log',
      }) as any,
    probeHostedRuntimeReadiness: async () =>
      ({
        descriptor: {
          mode: 'desktopCombined',
          lifecycle: 'ready',
          apiBasePath: '/claw/api/v1',
          manageBasePath: '/claw/manage/v1',
          internalBasePath: '/claw/internal/v1',
          browserBaseUrl: 'http://127.0.0.1:1420',
        },
        hostPlatformStatus: {
          mode: 'desktopCombined',
          lifecycle: 'ready',
        },
        hostEndpoints: [],
        openClawRuntime: {
          lifecycle: 'running',
        },
        openClawGateway: {
          lifecycle: 'running',
        },
        instances: [],
        evidence: {
          ready: true,
        },
      }) as any,
    captureLocalAiProxyEvidence: async () =>
      ({
        lifecycle: 'running',
        messageCaptureEnabled: false,
        observabilityDbPath: 'D:/proxy/obs.db',
        snapshotPath: 'D:/proxy/snapshot.json',
        logPath: 'D:/proxy/proxy.log',
      }) as any,
    onBaseContext: async () => {},
    onReadinessReady: async () => {},
    onReadinessFailed: async () => {},
    log: () => {},
    ...overrides,
  };
}

await runTest(
  'connectDesktopRuntimeDuringStartup resolves after desktop metadata and leaves readiness probing in the background',
  async () => {
    const events: string[] = [];
    let resolveReadiness: (() => void) | undefined;
    let readyPayload: DesktopRuntimeConnectionReadyContext | null = null;
    let connectResolved = false;

    const connectPromise = connectDesktopRuntimeDuringStartup(
      createConnectionOptions({
        getAppInfo: async () => {
          events.push('getAppInfo');
          return {
            name: 'Claw Studio',
            version: '0.1.0',
            target: 'x86_64-pc-windows-msvc',
            kind: 'desktop',
          } as any;
        },
        getAppPaths: async () => {
          events.push('getAppPaths');
          return {
            dataDir: 'D:/data',
            logsDir: 'D:/logs',
            machineLogsDir: 'D:/machine-logs',
            mainLogFile: 'D:/logs/main.log',
          } as any;
        },
        probeHostedRuntimeReadiness: async () => {
          events.push('probeReadiness');
          await new Promise<void>((resolve) => {
            resolveReadiness = resolve;
          });
          return {
            descriptor: {
              mode: 'desktopCombined',
              lifecycle: 'ready',
              apiBasePath: '/claw/api/v1',
              manageBasePath: '/claw/manage/v1',
              internalBasePath: '/claw/internal/v1',
              browserBaseUrl: 'http://127.0.0.1:1420',
            },
            hostPlatformStatus: {
              mode: 'desktopCombined',
              lifecycle: 'ready',
            },
            hostEndpoints: [],
            openClawRuntime: {
              lifecycle: 'running',
            },
            openClawGateway: {
              lifecycle: 'running',
            },
            instances: [],
            evidence: {
              ready: true,
            },
          } as any;
        },
        onBaseContext: async () => {
          events.push('onBaseContext');
        },
        onReadinessReady: async (payload) => {
          events.push('onReadinessReady');
          readyPayload = payload;
        },
      }),
    ).then(() => {
      connectResolved = true;
    });

    await flushMicrotasks();

    assert.equal(connectResolved, true);
    assert.deepEqual(events, ['getAppInfo', 'getAppPaths', 'onBaseContext', 'probeReadiness']);
    assert.equal(readyPayload === null, true);
    assert.ok(resolveReadiness, 'expected readiness probe to remain pending in the background');

    resolveReadiness();
    await connectPromise;
    await flushMicrotasks();

    assert.equal(events.includes('onReadinessReady'), true);
    const resolvedReadyPayload = readyPayload as DesktopRuntimeConnectionReadyContext | null;
    assert.ok(resolvedReadyPayload, 'expected readiness payload after the background probe completed');
    assert.equal(resolvedReadyPayload.readinessSnapshot.evidence.ready, true);
    assert.equal(resolvedReadyPayload.localAiProxy?.lifecycle, 'running');
  },
);

await runTest(
  'connectDesktopRuntimeDuringStartup keeps startup alive when hosted runtime readiness fails after metadata connection',
  async () => {
    const events: string[] = [];
    let rejectReadiness: ((error: Error) => void) | undefined;
    let failurePayload: DesktopRuntimeConnectionFailureContext | null = null;

    const connectPromise = connectDesktopRuntimeDuringStartup(
      createConnectionOptions({
        probeHostedRuntimeReadiness: () => {
          events.push('probeReadiness');
          return new Promise<any>((_resolve, reject) => {
            rejectReadiness = (error: Error) => reject(error);
          });
        },
        onBaseContext: async () => {
          events.push('onBaseContext');
        },
        onReadinessFailed: async (payload) => {
          events.push('onReadinessFailed');
          failurePayload = payload;
        },
      }),
    );

    await connectPromise;
    await flushMicrotasks();

    assert.deepEqual(events, ['onBaseContext', 'probeReadiness']);
    assert.ok(rejectReadiness, 'expected readiness probe failure hook to be available');

    rejectReadiness(new Error('runtime readiness failed'));
    await flushMicrotasks();

    assert.equal(events.includes('onReadinessFailed'), true);
    const resolvedFailurePayload = failurePayload as DesktopRuntimeConnectionFailureContext | null;
    assert.ok(resolvedFailurePayload, 'expected failure payload after the background probe rejected');
    assert.equal(
      resolvedFailurePayload.error instanceof Error ? resolvedFailurePayload.error.message : null,
      'runtime readiness failed',
    );
    assert.equal(resolvedFailurePayload.localAiProxy?.logPath, 'D:/proxy/proxy.log');
  },
);

await runTest(
  'connectDesktopRuntimeDuringStartup still fails fast when the desktop bridge metadata probe returns an empty app payload',
  async () => {
    await assert.rejects(
      () =>
        connectDesktopRuntimeDuringStartup(
          createConnectionOptions({
            getAppInfo: async () => null,
          }),
        ),
      /The desktop runtime did not respond during startup\./,
    );
  },
);
