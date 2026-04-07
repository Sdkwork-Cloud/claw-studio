import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDesktopStartupEvidenceDocument,
  DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH,
  sanitizeDesktopStartupDescriptor,
  serializeDesktopStartupEvidence,
} from './desktopStartupEvidence.ts';

test('desktop startup evidence sanitizes the embedded host descriptor and excludes the browser session token', () => {
  const descriptor = sanitizeDesktopStartupDescriptor({
    mode: 'desktopCombined',
    lifecycle: 'ready',
    apiBasePath: '/claw/api/v1',
    manageBasePath: '/claw/manage/v1',
    internalBasePath: '/claw/internal/v1',
    browserBaseUrl: 'http://127.0.0.1:18797',
    browserSessionToken: 'secret-session-token',
    lastError: null,
    endpointId: 'desktop-host',
    requestedPort: 18797,
    activePort: 18797,
    loopbackOnly: true,
    dynamicPort: false,
    stateStoreDriver: 'sqlite',
    stateStoreProfileId: 'default-local',
    runtimeDataDir: 'C:/Users/admin/AppData/Claw/data/desktop-host',
    webDistDir: 'C:/Program Files/Claw Studio/resources/web-dist',
  });

  assert.deepEqual(descriptor, {
    mode: 'desktopCombined',
    lifecycle: 'ready',
    apiBasePath: '/claw/api/v1',
    manageBasePath: '/claw/manage/v1',
    internalBasePath: '/claw/internal/v1',
    browserBaseUrl: 'http://127.0.0.1:18797',
    lastError: null,
    endpointId: 'desktop-host',
    requestedPort: 18797,
    activePort: 18797,
    loopbackOnly: true,
    dynamicPort: false,
    stateStoreDriver: 'sqlite',
    stateStoreProfileId: 'default-local',
    runtimeDataDir: 'C:/Users/admin/AppData/Claw/data/desktop-host',
    webDistDir: 'C:/Program Files/Claw Studio/resources/web-dist',
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(descriptor ?? {}, 'browserSessionToken'),
    false,
  );
});

test('desktop startup evidence builds a passed launch document with a sanitized built-in instance projection', () => {
  const document = buildDesktopStartupEvidenceDocument({
    status: 'passed',
    phase: 'shell-mounted',
    runId: 7,
    durationMs: 842,
    recordedAt: '2026-04-06T10:00:00.000Z',
    appInfo: {
      name: 'Claw Studio',
      version: '0.1.0',
      target: 'x86_64-pc-windows-msvc',
    },
    appPaths: {
      dataDir: 'C:/Users/admin/AppData/Claw/data',
      logsDir: 'C:/Users/admin/AppData/Claw/logs',
      machineLogsDir: 'C:/ProgramData/Claw/logs',
      mainLogFile: 'C:/ProgramData/Claw/logs/app/app.log',
    } as never,
    readinessSnapshot: {
      descriptor: {
        mode: 'desktopCombined',
        lifecycle: 'ready',
        apiBasePath: '/claw/api/v1',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        browserBaseUrl: 'http://127.0.0.1:18797',
        browserSessionToken: 'secret-session-token',
        endpointId: 'desktop-host',
        requestedPort: 18797,
        activePort: 18797,
        loopbackOnly: true,
        dynamicPort: false,
        stateStoreDriver: 'sqlite',
        stateStoreProfileId: 'default-local',
        runtimeDataDir: 'C:/Users/admin/AppData/Claw/data/desktop-host',
        webDistDir: 'C:/Program Files/Claw Studio/resources/web-dist',
      },
      hostPlatformStatus: {
        mode: 'desktopCombined',
        lifecycle: 'ready',
      },
      hostEndpoints: [
        {
          endpointId: 'desktop-host',
          requestedPort: 18797,
          activePort: 18797,
          baseUrl: 'http://127.0.0.1:18797',
        },
      ],
      openClawRuntime: {
        lifecycle: 'ready',
        endpointId: 'desktop-host',
        activePort: 18797,
        baseUrl: 'http://127.0.0.1:18797',
        websocketUrl: 'ws://127.0.0.1:18797/ws',
      },
      openClawGateway: {
        lifecycle: 'ready',
        endpointId: 'desktop-host',
        activePort: 18797,
        baseUrl: 'http://127.0.0.1:18797',
        websocketUrl: 'ws://127.0.0.1:18797/ws',
      },
      instances: [
        {
          id: 'local-built-in',
          name: 'Local Built-In',
          version: '2026.4.2',
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18797',
          websocketUrl: 'ws://127.0.0.1:18797/ws',
          isBuiltIn: true,
          isDefault: true,
          config: {
            authToken: 'sensitive-token',
          },
        },
      ],
      evidence: {
        descriptorBrowserBaseUrl: 'http://127.0.0.1:18797',
        descriptorEndpointId: 'desktop-host',
        descriptorActivePort: 18797,
        hostLifecycle: 'ready',
        hostLifecycleReady: true,
        gatewayInvokeCapabilitySupported: true,
        gatewayInvokeCapabilityAvailable: true,
        hostEndpointCount: 1,
        manageEndpointId: 'desktop-host',
        manageEndpointRequestedPort: 18797,
        manageEndpointActivePort: 18797,
        manageBaseUrl: 'http://127.0.0.1:18797',
        manageEndpointPublished: true,
        manageEndpointMatchesDescriptor: true,
        manageEndpointIdMatchesDescriptor: true,
        manageEndpointActivePortMatchesDescriptor: true,
        openClawRuntimeLifecycle: 'ready',
        openClawRuntimeEndpointId: 'desktop-host',
        openClawRuntimeActivePort: 18797,
        openClawRuntimeBaseUrl: 'http://127.0.0.1:18797',
        openClawRuntimeWebsocketUrl: 'ws://127.0.0.1:18797/ws',
        openClawRuntimeReady: true,
        openClawRuntimeUrlsPublished: true,
        openClawGatewayLifecycle: 'ready',
        openClawGatewayEndpointId: 'desktop-host',
        openClawGatewayActivePort: 18797,
        openClawGatewayBaseUrl: 'http://127.0.0.1:18797',
        openClawGatewayWebsocketUrl: 'ws://127.0.0.1:18797/ws',
        openClawGatewayReady: true,
        openClawGatewayUrlsPublished: true,
        runtimeAndGatewayBaseUrlMatch: true,
        runtimeAndGatewayWebsocketUrlMatch: true,
        runtimeAndGatewayEndpointIdMatch: true,
        runtimeAndGatewayActivePortMatch: true,
        gatewayWebsocketReady: true,
        gatewayWebsocketProbeSupported: true,
        gatewayWebsocketDialable: true,
        builtInInstanceId: 'local-built-in',
        builtInInstanceRuntimeKind: 'openclaw',
        builtInInstanceDeploymentMode: 'local-managed',
        builtInInstanceTransportKind: 'openclawGatewayWs',
        builtInInstanceStatus: 'online',
        builtInInstanceBaseUrl: 'http://127.0.0.1:18797',
        builtInInstanceWebsocketUrl: 'ws://127.0.0.1:18797/ws',
        builtInInstancePublished: true,
        builtInInstanceRuntimeKindMatchesManagedOpenClaw: true,
        builtInInstanceDeploymentModeMatchesManagedOpenClaw: true,
        builtInInstanceTransportKindMatchesManagedOpenClaw: true,
        builtInInstanceOnline: true,
        builtInInstanceUrlsPublished: true,
        builtInInstanceBaseUrlMatchesGateway: true,
        builtInInstanceWebsocketUrlMatchesGateway: true,
        builtInInstanceReady: true,
        ready: true,
      },
    } as never,
  });

  assert.equal(document.version, 1);
  assert.equal(document.status, 'passed');
  assert.equal(document.phase, 'shell-mounted');
  assert.equal(document.runId, 7);
  assert.equal(document.durationMs, 842);
  assert.equal(document.paths?.dataDir, 'C:/Users/admin/AppData/Claw/data');
  assert.equal(document.descriptor?.browserBaseUrl, 'http://127.0.0.1:18797');
  assert.equal(
    Object.prototype.hasOwnProperty.call(document.descriptor ?? {}, 'browserSessionToken'),
    false,
  );
  assert.equal(document.builtInInstance?.id, 'local-built-in');
  assert.equal(document.builtInInstance?.status, 'online');
  assert.equal(
    Object.prototype.hasOwnProperty.call(document.builtInInstance ?? {}, 'config'),
    false,
  );

  const serialized = serializeDesktopStartupEvidence(document);
  assert.match(serialized, /"phase": "shell-mounted"/);
  assert.doesNotMatch(serialized, /browserSessionToken/);
  assert.doesNotMatch(serialized, /authToken/);
  assert.equal(
    DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH,
    'diagnostics/desktop-startup-evidence.json',
  );
});

test('desktop startup evidence builds a failed launch document with summarized error cause', () => {
  const error = new Error('gateway websocket did not become dialable');
  error.cause = new Error('socket timeout');

  const document = buildDesktopStartupEvidenceDocument({
    status: 'failed',
    phase: 'runtime-readiness-failed',
    runId: 4,
    durationMs: 1234,
    recordedAt: '2026-04-06T10:05:00.000Z',
    error,
  });

  assert.deepEqual(document.error, {
    message: 'gateway websocket did not become dialable',
    cause: 'socket timeout',
  });
  assert.equal(document.descriptor, null);
  assert.equal(document.builtInInstance, null);
});
