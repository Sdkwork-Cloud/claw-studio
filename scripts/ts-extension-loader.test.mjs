import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = path.resolve(import.meta.dirname, 'ts-extension-loader.mjs');
const loader = await import(pathToFileURL(modulePath).href);

assert.equal(typeof loader.resolveSharedSdkSourceAliasPath, 'function');
assert.equal(typeof loader.resolveWorkspacePackageSourceAliasPath, 'function');

const workspaceRoot = path.resolve(import.meta.dirname, '..');

assert.equal(
  loader.resolveSharedSdkSourceAliasPath('@sdkwork/app-sdk', { SDKWORK_SHARED_SDK_MODE: 'source' }),
  path.resolve(
    workspaceRoot,
    '../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript/src/index.ts',
  ),
  'source mode must redirect @sdkwork/app-sdk to the sibling SDK source entry',
);

assert.equal(
  loader.resolveSharedSdkSourceAliasPath('@sdkwork/sdk-common/http', { SDKWORK_SHARED_SDK_MODE: 'source' }),
  path.resolve(
    workspaceRoot,
    '../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript/src/http/index.ts',
  ),
  'source mode must redirect @sdkwork/sdk-common subpaths to sibling source entries',
);

assert.equal(
  loader.resolveSharedSdkSourceAliasPath('@sdkwork/app-sdk', { SDKWORK_SHARED_SDK_MODE: 'git' }),
  null,
  'git mode must keep installed package resolution instead of forcing source aliases',
);

assert.equal(
  loader.resolveSharedSdkSourceAliasPath('@sdkwork/unknown-package', { SDKWORK_SHARED_SDK_MODE: 'source' }),
  null,
  'non-shared-sdk packages must not be remapped by the loader',
);

assert.equal(
  loader.resolveWorkspacePackageSourceAliasPath('@sdkwork/claw-infrastructure'),
  path.resolve(
    workspaceRoot,
    'packages/sdkwork-claw-infrastructure/src/index.ts',
  ),
  'workspace package resolution must map @sdkwork/claw-* packages to their source entry',
);

assert.equal(
  loader.resolveWorkspacePackageSourceAliasPath('@sdkwork/core-pc-react'),
  path.resolve(
    workspaceRoot,
    '../sdkwork-core/sdkwork-core-pc-react/src/index.ts',
  ),
  'workspace package resolution must map sibling workspace package roots to their source entry',
);

assert.equal(
  loader.resolveWorkspacePackageSourceAliasPath('@sdkwork/core-pc-react/app'),
  path.resolve(
    workspaceRoot,
    '../sdkwork-core/sdkwork-core-pc-react/src/app/index.ts',
  ),
  'workspace package resolution must map sibling workspace package subpaths to their source entry',
);

console.log('ok - ts extension loader remaps shared SDK packages to source entries in source mode');
