import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  remapWorktreeWorkspaceImport,
  resolveWorkspacePackageAliases,
  resolveWorkspacePackageEntry,
  shouldEnableWorktreeWorkspaceResolver,
  shouldAttemptWorkspaceResolverRemap,
} from './viteWorkspaceResolver.ts';

const packagesRoot = path.resolve(process.cwd(), 'packages');
const currentWorkspaceRoot = path.resolve(process.cwd());
const worktreeRoot = path.resolve(
  currentWorkspaceRoot,
  '.worktrees/codex-openclaw-gateway-webchat',
);

test('resolveWorkspacePackageEntry maps @sdkwork workspace packages into the current workspace', () => {
  assert.equal(
    resolveWorkspacePackageEntry('@sdkwork/claw-infrastructure', packagesRoot),
    path.resolve(packagesRoot, 'sdkwork-claw-infrastructure/src/index.ts'),
  );
  assert.equal(
    resolveWorkspacePackageEntry('@sdkwork/claw-i18n', packagesRoot),
    path.resolve(packagesRoot, 'sdkwork-claw-i18n/src/index.ts'),
  );
  assert.equal(
    resolveWorkspacePackageEntry('@sdkwork/core-pc-react', packagesRoot),
    path.resolve(packagesRoot, '../../sdkwork-core/sdkwork-core-pc-react/src/index.ts'),
  );
  assert.equal(
    resolveWorkspacePackageEntry('@sdkwork/core-pc-react/app', packagesRoot),
    path.resolve(packagesRoot, '../../sdkwork-core/sdkwork-core-pc-react/src/app/index.ts'),
  );
  assert.equal(resolveWorkspacePackageEntry('react', packagesRoot), null);
});

test('resolveWorkspacePackageAliases creates direct aliases for local @sdkwork/claw-* packages', () => {
  const aliases = resolveWorkspacePackageAliases(packagesRoot);
  const infrastructureAlias = aliases.find((entry) => entry.find === '@sdkwork/claw-infrastructure');
  const i18nAlias = aliases.find((entry) => entry.find === '@sdkwork/claw-i18n');
  const corePcReactRootAlias = aliases.find((entry) => entry.find === '@sdkwork/core-pc-react');
  const corePcReactAppAlias = aliases.find((entry) => entry.find === '@sdkwork/core-pc-react/app');
  const corePcReactEnvAlias = aliases.find((entry) => entry.find === '@sdkwork/core-pc-react/env');
  const corePcReactRuntimeAlias = aliases.find((entry) => entry.find === '@sdkwork/core-pc-react/runtime');

  assert.ok(infrastructureAlias);
  assert.equal(
    infrastructureAlias?.replacement,
    path.resolve(packagesRoot, 'sdkwork-claw-infrastructure/src/index.ts'),
  );
  assert.ok(i18nAlias);
  assert.equal(
    i18nAlias?.replacement,
    path.resolve(packagesRoot, 'sdkwork-claw-i18n/src/index.ts'),
  );
  assert.ok(corePcReactAppAlias);
  assert.equal(
    corePcReactAppAlias?.replacement,
    path.resolve(packagesRoot, '../../sdkwork-core/sdkwork-core-pc-react/src/app/index.ts'),
  );
  assert.ok(corePcReactRootAlias);
  assert.ok(corePcReactEnvAlias);
  assert.ok(corePcReactRuntimeAlias);
  assert.ok(aliases.indexOf(corePcReactAppAlias) < aliases.indexOf(corePcReactRootAlias));
  assert.ok(aliases.indexOf(corePcReactEnvAlias) < aliases.indexOf(corePcReactRootAlias));
  assert.ok(aliases.indexOf(corePcReactRuntimeAlias) < aliases.indexOf(corePcReactRootAlias));
  assert.equal(
    aliases.some((entry) => entry.find === '@sdkwork/app-sdk'),
    false,
  );
});

test('remapWorktreeWorkspaceImport remaps absolute worktree package paths into the current workspace', () => {
  const worktreeSource = path.resolve(
    worktreeRoot,
    'packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts',
  );

  assert.equal(
    remapWorktreeWorkspaceImport(worktreeSource, undefined, packagesRoot),
    path.resolve(packagesRoot, 'sdkwork-claw-infrastructure/src/platform/webStudio.ts'),
  );
});

test('remapWorktreeWorkspaceImport remaps relative imports when the importer comes from a worktree package', () => {
  const worktreeImporter = path.resolve(
    worktreeRoot,
    'packages/sdkwork-claw-infrastructure/src/services/fileDialogService.ts',
  );

  assert.equal(
    remapWorktreeWorkspaceImport('../platform/index.ts', worktreeImporter, packagesRoot),
    path.resolve(packagesRoot, 'sdkwork-claw-infrastructure/src/platform/index.ts'),
  );
});

test('remapWorktreeWorkspaceImport preserves Vite /@fs/ prefixes and query suffixes', () => {
  const worktreeSource = path.resolve(
    worktreeRoot,
    'packages/sdkwork-claw-i18n/src/index.ts',
  ).replace(/\\/g, '/');

  assert.equal(
    remapWorktreeWorkspaceImport(`/@fs/${worktreeSource}?v=worktree`, undefined, packagesRoot),
    `${path.resolve(packagesRoot, 'sdkwork-claw-i18n/src/index.ts')}?v=worktree`,
  );
});

test('shouldAttemptWorkspaceResolverRemap fast-rejects imports that cannot target the workspace remap paths', () => {
  const worktreeImporter = path.resolve(
    worktreeRoot,
    'packages/sdkwork-claw-infrastructure/src/services/fileDialogService.ts',
  );

  assert.equal(shouldAttemptWorkspaceResolverRemap('react', undefined), false);
  assert.equal(shouldAttemptWorkspaceResolverRemap('@radix-ui/react-dialog', undefined), false);
  assert.equal(shouldAttemptWorkspaceResolverRemap('@sdkwork/claw-infrastructure', undefined), false);
  assert.equal(
    shouldAttemptWorkspaceResolverRemap(
      path.resolve(worktreeRoot, 'packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts'),
      undefined,
    ),
    true,
  );
  assert.equal(
    shouldAttemptWorkspaceResolverRemap('../platform/index.ts', worktreeImporter),
    true,
  );
  assert.equal(
    shouldAttemptWorkspaceResolverRemap('../platform/index.ts', path.resolve(packagesRoot, 'sdkwork-claw-web/src/App.tsx')),
    false,
  );
});

test('shouldEnableWorktreeWorkspaceResolver only enables the worktree remap plugin when the workspace or env requires it', () => {
  assert.equal(
    shouldEnableWorktreeWorkspaceResolver(currentWorkspaceRoot, {}),
    false,
  );
  assert.equal(
    shouldEnableWorktreeWorkspaceResolver(worktreeRoot, {}),
    true,
  );
  assert.equal(
    shouldEnableWorktreeWorkspaceResolver(currentWorkspaceRoot, {
      SDKWORK_ENABLE_WORKTREE_RESOLVER: 'true',
    }),
    true,
  );
  assert.equal(
    shouldEnableWorktreeWorkspaceResolver(worktreeRoot, {
      SDKWORK_ENABLE_WORKTREE_RESOLVER: 'false',
    }),
    false,
  );
});
