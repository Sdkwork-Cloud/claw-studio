import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

const source = readFileSync(new URL('../pages/Chat.tsx', import.meta.url), 'utf8');

await runTest(
  'Chat header uses a denser title-first layout with inline status text',
  () => {
    assert.match(
      source,
      /className="z-10 flex min-h-\[3\.75rem\] flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white\/80 px-3 py-2\.5 backdrop-blur-xl sm:px-4 lg:px-6 dark:border-zinc-800 dark:bg-zinc-900\/80"/,
    );
    assert.match(
      source,
      /className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3"/,
    );
    assert.match(
      source,
      /className="flex min-w-0 items-center gap-2"/,
    );
    assert.match(
      source,
      /'inline-flex shrink-0 items-center gap-1\.5 text-\[11px\] font-medium'/,
    );
    assert.match(
      source,
      /className="mt-0\.5 flex min-w-0 flex-wrap items-center gap-x-1\.5 gap-y-0\.5 text-\[11px\] text-zinc-500 dark:text-zinc-400"/,
    );
    assert.doesNotMatch(
      source,
      /'inline-flex shrink-0 items-center gap-1\.5 rounded-full border px-2\.5 py-1 text-\[11px\] font-semibold'/,
    );
  },
);
