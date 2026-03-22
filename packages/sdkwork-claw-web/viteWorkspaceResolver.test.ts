import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  remapWorktreeWorkspaceImport,
  resolveWorkspacePackageEntry,
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
  assert.equal(resolveWorkspacePackageEntry('react', packagesRoot), null);
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
