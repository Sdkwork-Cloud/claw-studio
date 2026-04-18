import assert from 'node:assert/strict';

import { resolveChatRuntimeState } from './chatRuntimeState.ts';

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

await runTest(
  'resolveChatRuntimeState keeps gateway identity from adapter capabilities even when the route is temporarily blocked',
  () => {
    assert.deepEqual(
      resolveChatRuntimeState({
        activeInstanceId: 'instance-openclaw',
        routeMode: 'unsupported',
        adapterCapabilities: {
          adapterId: 'openclawGateway',
          authorityKind: 'gateway',
          supported: true,
          durable: true,
          writable: true,
          supportsStreaming: true,
          supportsRuns: true,
          supportsAgentProfiles: true,
          supportsSessionMutation: true,
          reason: null,
        },
        sessionState: {
          authorityKind: 'gateway',
        },
      }),
      {
        hasResolvedContext: true,
        authorityKind: 'gateway',
        isBlocked: true,
        isChatAvailable: false,
        isOpenClawGateway: true,
        routeLabelKey: 'chat.page.route.unsupported',
      },
    );
  },
);

await runTest(
  'resolveChatRuntimeState treats transport-backed http kernels as direct chat when the adapter is supported',
  () => {
    assert.deepEqual(
      resolveChatRuntimeState({
        activeInstanceId: 'instance-http',
        routeMode: 'instanceOpenAiHttp',
        adapterCapabilities: {
          adapterId: 'transportBacked',
          authorityKind: 'http',
          supported: true,
          durable: false,
          writable: true,
          supportsStreaming: true,
          supportsRuns: true,
          supportsAgentProfiles: false,
          supportsSessionMutation: true,
          reason: null,
        },
        sessionState: {
          authorityKind: 'http',
        },
      }),
      {
        hasResolvedContext: true,
        authorityKind: 'http',
        isBlocked: false,
        isChatAvailable: true,
        isOpenClawGateway: false,
        routeLabelKey: 'chat.page.route.direct',
      },
    );
  },
);
