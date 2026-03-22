import assert from 'node:assert/strict';
import {
  resolveChatBootstrapAction,
  resolveOpenClawCreateSessionTarget,
} from './chatSessionBootstrap.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest('chat bootstrap waits for instance route resolution before auto-creating a session', () => {
  assert.deepEqual(
    resolveChatBootstrapAction({
      activeInstanceId: 'instance-openclaw',
      routeMode: undefined,
      syncState: 'idle',
      hasActiveModel: true,
      activeSessionId: null,
      sessionIds: [],
    }),
    { type: 'wait' },
  );
});

await runTest('chat bootstrap auto-creates only for ready non-gateway instance routes', () => {
  assert.deepEqual(
    resolveChatBootstrapAction({
      activeInstanceId: 'instance-http',
      routeMode: 'instanceOpenAiHttp',
      syncState: 'idle',
      hasActiveModel: true,
      activeSessionId: null,
      sessionIds: [],
    }),
    { type: 'create' },
  );

  assert.deepEqual(
    resolveChatBootstrapAction({
      activeInstanceId: 'instance-openclaw',
      routeMode: 'instanceOpenClawGatewayWs',
      syncState: 'idle',
      hasActiveModel: true,
      activeSessionId: null,
      sessionIds: [],
    }),
    { type: 'idle' },
  );
});

await runTest('chat bootstrap selects the first session when the active session is missing', () => {
  assert.deepEqual(
    resolveChatBootstrapAction({
      activeInstanceId: 'instance-openclaw',
      routeMode: 'instanceOpenClawGatewayWs',
      syncState: 'idle',
      hasActiveModel: true,
      activeSessionId: 'missing-session',
      sessionIds: ['session-a', 'session-b'],
    }),
    { type: 'select', sessionId: 'session-a' },
  );
});

await runTest('openclaw create-session bootstrap reuses hydrated remote sessions instead of minting drafts', () => {
  assert.deepEqual(
    resolveOpenClawCreateSessionTarget({
      activeSessionId: 'remote-session',
      sessions: [{ id: 'remote-session' }, { id: 'draft-session', isDraft: true }],
    }),
    { type: 'reuse', sessionId: 'remote-session' },
  );

  assert.deepEqual(
    resolveOpenClawCreateSessionTarget({
      activeSessionId: null,
      sessions: [{ id: 'remote-session' }],
    }),
    { type: 'reuse', sessionId: 'remote-session' },
  );

  assert.deepEqual(
    resolveOpenClawCreateSessionTarget({
      activeSessionId: null,
      sessions: [],
    }),
    { type: 'draft' },
  );
});
