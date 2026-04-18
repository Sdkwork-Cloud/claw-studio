import assert from 'node:assert/strict';
import { OPENCLAW_BUILT_IN_COMPAT_TEST_PATHS } from './openClawBuiltInCompatTestFixture.ts';

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

let configPathFallbackModule:
  | typeof import('./openClawConfigPathFallback.ts')
  | undefined;

try {
  configPathFallbackModule = await import('./openClawConfigPathFallback.ts');
} catch {
  configPathFallbackModule = undefined;
}

await runTest('openClawConfigPathFallback exposes a shared fallback path resolver', () => {
  assert.ok(configPathFallbackModule, 'Expected openClawConfigPathFallback.ts to exist');
  assert.equal(
    typeof configPathFallbackModule?.resolveFallbackInstanceConfigPath,
    'function',
  );
});

await runTest('resolveFallbackInstanceConfigPath prefers config routes over artifacts', () => {
  assert.equal(
    configPathFallbackModule?.resolveFallbackInstanceConfigPath({
      dataAccess: {
        routes: [
          {
            scope: 'config',
            mode: 'managedFile',
            target: '/workspace/main/openclaw.json',
          },
        ],
      },
      artifacts: [
        {
          kind: 'configFile',
          location: '/tmp/stale-openclaw.json',
        },
      ],
    } as any),
    '/workspace/main/openclaw.json',
  );
});

await runTest(
  'resolveFallbackInstanceConfigPath falls back to config artifacts only when no config route exists',
  () => {
    assert.equal(
      configPathFallbackModule?.resolveFallbackInstanceConfigPath({
        dataAccess: {
          routes: [],
        },
        artifacts: [
          {
            kind: 'configFile',
            location: '/workspace/external/openclaw.json',
          },
        ],
      } as any),
      '/workspace/external/openclaw.json',
    );

    assert.equal(
      configPathFallbackModule?.resolveFallbackInstanceConfigPath({
        dataAccess: {
          routes: [
            {
              scope: 'config',
              mode: 'metadataOnly',
              target: '/workspace/metadata-only/openclaw.json',
            },
          ],
        },
        artifacts: [
          {
            kind: 'configFile',
            location: '/workspace/external/openclaw.json',
          },
        ],
      } as any),
      null,
    );
  },
);

await runTest(
  'resolveFallbackInstanceConfigPath canonicalizes built-in OpenClaw config routes when legacy targets drift',
  () => {
    assert.equal(
      configPathFallbackModule?.resolveFallbackInstanceConfigPath({
        instance: {
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          isBuiltIn: true,
          config: {
            workspacePath: OPENCLAW_BUILT_IN_COMPAT_TEST_PATHS.canonicalWorkspacePath,
          },
        },
        dataAccess: {
          routes: [
            {
              scope: 'config',
              mode: 'managedFile',
              target: OPENCLAW_BUILT_IN_COMPAT_TEST_PATHS.legacyConfigPath,
            },
          ],
        },
      } as any),
      OPENCLAW_BUILT_IN_COMPAT_TEST_PATHS.canonicalConfigPath,
    );
  },
);
