import assert from 'node:assert/strict';
import { resolveOpenClawInstanceAuthToken } from './openClawInstanceAuthToken.ts';

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

await runTest('prefers the managed openclaw config token over a stale instance token', async () => {
  const token = await resolveOpenClawInstanceAuthToken(
    {
      id: 'local-built-in',
      runtimeKind: 'openclaw',
      config: {
        authToken: ' stale-instance-token ',
      },
    } as never,
    {
      async getInstanceDetail() {
        return {
          dataAccess: {
            routes: [
              {
                scope: 'config',
                mode: 'managedFile',
                target: '/tmp/openclaw.json',
                authoritative: true,
              },
            ],
          },
        } as never;
      },
      resolveInstanceConfigPath(detail) {
        return detail.dataAccess?.routes?.[0]?.target ?? null;
      },
      async readConfigSnapshot() {
        return {
          root: {
            gateway: {
              auth: {
                token: ' managed-token ',
              },
            },
          },
        } as never;
      },
    },
  );

  assert.equal(token, 'managed-token');
});

await runTest('falls back to the instance token when managed config token is absent', async () => {
  const token = await resolveOpenClawInstanceAuthToken(
    {
      id: 'local-built-in',
      runtimeKind: 'openclaw',
      config: {
        authToken: ' persisted-instance-token ',
      },
    } as never,
    {
      async getInstanceDetail() {
        return {
          dataAccess: {
            routes: [
              {
                scope: 'config',
                mode: 'managedFile',
                target: '/tmp/openclaw.json',
                authoritative: true,
              },
            ],
          },
        } as never;
      },
      resolveInstanceConfigPath(detail) {
        return detail.dataAccess?.routes?.[0]?.target ?? null;
      },
      async readConfigSnapshot() {
        return {
          root: {
            gateway: {
              port: 18_789,
            },
          },
        } as never;
      },
    },
  );

  assert.equal(token, 'persisted-instance-token');
});
