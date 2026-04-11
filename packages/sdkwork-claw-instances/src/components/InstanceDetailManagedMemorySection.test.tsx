import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InstanceDetailManagedMemorySection } from './InstanceDetailManagedMemorySection.tsx';

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

await runTest(
  'InstanceDetailManagedMemorySection composes the dreaming workspace from page-owned state instead of requiring prebuilt section props',
  () => {
    const markup = renderToStaticMarkup(
      <InstanceDetailManagedMemorySection
        isLoading={false}
        emptyState={<div>empty-memory</div>}
        loadingLabel="loading"
        workbench={{
          memories: [
            {
              id: 'memory-1',
              title: 'Dream diary',
              updatedAt: '2026-04-09T10:30:00.000Z',
            },
          ],
        } as any}
        memoryWorkbenchState={{
          isEmpty: false,
          hasMemoryEntries: true,
          dreamDiaryEntries: [{ updatedAt: '2026-04-09T10:30:00.000Z' }],
        }}
        managedDreamingConfig={{ enabled: true } as any}
        dreamingDraft={{
          enabled: true,
          frequency: 'daily',
          model: '',
          systemPrompt: '',
          prompt: '',
          retentionDays: '',
          maxMemories: '',
          summaryModel: '',
        } as any}
        dreamingError={null}
        isSavingDreaming={false}
        canEditManagedDreaming
        formatWorkbenchLabel={(value) => `label:${value}`}
        getDangerBadge={(status) => `danger:${status}`}
        getStatusBadge={(status) => `status:${status}`}
        t={(key) => key}
        onDreamingDraftChange={() => undefined}
        onSaveDreamingConfig={() => undefined}
      />,
    );

    assert.match(markup, /data-slot="instance-detail-memory"/);
    assert.match(markup, /instances\.detail\.instanceWorkbench\.dreaming\.title/);
    assert.match(markup, /2026-04-09T10:30:00\.000Z/);
    assert.doesNotMatch(markup, /empty-memory/);
  },
);
