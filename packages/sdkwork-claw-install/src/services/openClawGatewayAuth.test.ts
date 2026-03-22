import assert from 'node:assert/strict';
import { resolveSyncedOpenClawAuthToken } from './openClawGatewayAuth.ts';

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

await runTest('prefers the gateway auth token declared in the managed openclaw config root', () => {
  const authToken = resolveSyncedOpenClawAuthToken({
    root: {
      gateway: {
        auth: {
          token: ' gateway-token-from-config ',
        },
      },
    },
    existingAuthToken: null,
  });

  assert.equal(authToken, 'gateway-token-from-config');
});

await runTest('falls back to the previously synced instance auth token when the config root has no token', () => {
  const authToken = resolveSyncedOpenClawAuthToken({
    root: {
      gateway: {
        port: 28789,
      },
    },
    existingAuthToken: ' persisted-instance-token ',
  });

  assert.equal(authToken, 'persisted-instance-token');
});

await runTest('returns null when neither the config root nor the existing instance exposes a usable token', () => {
  const authToken = resolveSyncedOpenClawAuthToken({
    root: {
      gateway: {
        auth: {
          token: '   ',
        },
      },
    },
    existingAuthToken: '   ',
  });

  assert.equal(authToken, null);
});
