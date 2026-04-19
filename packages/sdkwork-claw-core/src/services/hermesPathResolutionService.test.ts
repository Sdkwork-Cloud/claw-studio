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

let pathResolutionServiceModule:
  | typeof import('./hermesPathResolutionService.ts')
  | undefined;

try {
  pathResolutionServiceModule = await import('./hermesPathResolutionService.ts');
} catch {
  pathResolutionServiceModule = undefined;
}

await runTest(
  'hermesPathResolutionService exposes config-file rooted path resolvers',
  () => {
    assert.ok(pathResolutionServiceModule, 'Expected hermesPathResolutionService.ts to exist');
    assert.equal(
      typeof pathResolutionServiceModule?.resolveHermesStateRootFromConfigFile,
      'function',
    );
    assert.equal(
      typeof pathResolutionServiceModule?.resolveHermesUserRootFromConfigFile,
      'function',
    );
    assert.equal(
      typeof pathResolutionServiceModule?.resolveHermesUserPathFromConfigFile,
      'function',
    );
  },
);

await runTest(
  'hermesPathResolutionService resolves built-in state roots, user roots, and relative user paths from canonical config files',
  () => {
    assert.equal(
      pathResolutionServiceModule?.resolveHermesStateRootFromConfigFile(
        'D:/Hermes/.hermes/hermes.json',
      ),
      'D:/Hermes/.hermes',
    );
    assert.equal(
      pathResolutionServiceModule?.resolveHermesUserRootFromConfigFile(
        'D:/Hermes/.hermes/hermes.json',
      ),
      'D:/Hermes',
    );
    assert.equal(
      pathResolutionServiceModule?.resolveHermesUserPathFromConfigFile(
        'D:/Hermes/.hermes/hermes.json',
        '~/workspace',
      ),
      'D:/Hermes/workspace',
    );
    assert.equal(
      pathResolutionServiceModule?.resolveHermesUserPathFromConfigFile(
        'D:/Hermes/.hermes/hermes.json',
        './agents/research',
      ),
      'D:/Hermes/.hermes/agents/research',
    );
  },
);

await runTest(
  'hermesPathResolutionService resolves legacy config-root layouts back to the data root for relative paths',
  () => {
    assert.equal(
      pathResolutionServiceModule?.resolveHermesStateRootFromConfigFile(
        'D:/Hermes/data/config/hermes.json',
      ),
      'D:/Hermes/data',
    );
    assert.equal(
      pathResolutionServiceModule?.resolveHermesUserRootFromConfigFile(
        'D:/Hermes/data/config/hermes.json',
      ),
      'D:/Hermes',
    );
    assert.equal(
      pathResolutionServiceModule?.resolveHermesUserPathFromConfigFile(
        'D:/Hermes/data/config/hermes.json',
        'workspace',
      ),
      'D:/Hermes/data/workspace',
    );
  },
);
