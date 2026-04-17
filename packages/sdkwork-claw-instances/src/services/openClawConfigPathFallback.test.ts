import assert from 'node:assert/strict';

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

await runTest('resolveFallbackInstanceConfigPath prefers managed config routes over artifacts', () => {
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
  'resolveFallbackInstanceConfigPath canonicalizes built-in managed OpenClaw config routes when legacy targets drift',
  () => {
    assert.equal(
      configPathFallbackModule?.resolveFallbackInstanceConfigPath({
        instance: {
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          isBuiltIn: true,
          config: {
            workspacePath: 'C:/Users/admin/.sdkwork/crawstudio/.openclaw/workspace',
          },
        },
        dataAccess: {
          routes: [
            {
              scope: 'config',
              mode: 'managedFile',
              target:
                'C:/ProgramData/SdkWork/CrawStudio/state/kernels/openclaw/managed-config/openclaw.json',
            },
          ],
        },
      } as any),
      'C:/Users/admin/.sdkwork/crawstudio/.openclaw/openclaw.json',
    );
  },
);
