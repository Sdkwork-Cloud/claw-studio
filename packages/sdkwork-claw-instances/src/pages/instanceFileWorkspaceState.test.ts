import assert from 'node:assert/strict';
import { activateWorkbenchFile, syncWorkbenchFileSelection } from './instanceFileWorkspaceState.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const files = [
  {
    id: 'agent-main:AGENTS.md',
    name: 'AGENTS.md',
    path: '/workspace/main/AGENTS.md',
  },
  {
    id: 'agent-main:MEMORY.md',
    name: 'MEMORY.md',
    path: '/workspace/main/MEMORY.md',
  },
  {
    id: 'agent-main:BOOT.md',
    name: 'BOOT.md',
    path: '/workspace/main/BOOT.md',
  },
];

runTest('syncWorkbenchFileSelection keeps the visible selection attached to an open tab', () => {
  const next = syncWorkbenchFileSelection(files, [], 'agent-main:MEMORY.md');

  assert.deepEqual(next.openFileIds, ['agent-main:MEMORY.md']);
  assert.equal(next.selectedFileId, 'agent-main:MEMORY.md');
});

runTest('syncWorkbenchFileSelection falls back to the first visible file on first load', () => {
  const next = syncWorkbenchFileSelection(files, [], null);

  assert.deepEqual(next.openFileIds, ['agent-main:AGENTS.md']);
  assert.equal(next.selectedFileId, 'agent-main:AGENTS.md');
});

runTest('syncWorkbenchFileSelection drops hidden files and keeps selection aligned with remaining tabs', () => {
  const next = syncWorkbenchFileSelection(files.slice(0, 2), ['agent-main:BOOT.md', 'agent-main:MEMORY.md'], 'agent-main:BOOT.md');

  assert.deepEqual(next.openFileIds, ['agent-main:MEMORY.md']);
  assert.equal(next.selectedFileId, 'agent-main:MEMORY.md');
});

runTest('activateWorkbenchFile reuses an open tab and always points selection to the clicked file', () => {
  const next = activateWorkbenchFile(['agent-main:AGENTS.md', 'agent-main:MEMORY.md'], 'agent-main:AGENTS.md');

  assert.deepEqual(next.openFileIds, ['agent-main:AGENTS.md', 'agent-main:MEMORY.md']);
  assert.equal(next.selectedFileId, 'agent-main:AGENTS.md');
});

runTest('activateWorkbenchFile opens missing files exactly once before selecting them', () => {
  const next = activateWorkbenchFile(['agent-main:AGENTS.md'], 'agent-main:BOOT.md');

  assert.deepEqual(next.openFileIds, ['agent-main:AGENTS.md', 'agent-main:BOOT.md']);
  assert.equal(next.selectedFileId, 'agent-main:BOOT.md');
});

runTest('explorer and tab activation keep the displayed file aligned across a real click sequence', () => {
  const initial = syncWorkbenchFileSelection(files, [], null);
  const fromExplorer = activateWorkbenchFile(initial.openFileIds, 'agent-main:MEMORY.md');
  const fromTab = activateWorkbenchFile(fromExplorer.openFileIds, 'agent-main:AGENTS.md');
  const afterRefresh = syncWorkbenchFileSelection(files, fromTab.openFileIds, fromTab.selectedFileId);

  assert.deepEqual(initial.openFileIds, ['agent-main:AGENTS.md']);
  assert.equal(initial.selectedFileId, 'agent-main:AGENTS.md');
  assert.deepEqual(fromExplorer.openFileIds, ['agent-main:AGENTS.md', 'agent-main:MEMORY.md']);
  assert.equal(fromExplorer.selectedFileId, 'agent-main:MEMORY.md');
  assert.deepEqual(fromTab.openFileIds, ['agent-main:AGENTS.md', 'agent-main:MEMORY.md']);
  assert.equal(fromTab.selectedFileId, 'agent-main:AGENTS.md');
  assert.deepEqual(afterRefresh.openFileIds, ['agent-main:AGENTS.md', 'agent-main:MEMORY.md']);
  assert.equal(afterRefresh.selectedFileId, 'agent-main:AGENTS.md');
});
