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

const source = readFileSync(new URL('./ChatSidebar.tsx', import.meta.url), 'utf8');

await runTest(
  'ChatSidebar uses a title-first session list with subdued metadata',
  () => {
    assert.match(
      source,
      /<h3 className="mb-1\.5 px-3 text-\[10px\] font-medium uppercase tracking-\[0\.14em\] text-zinc-400 dark:text-zinc-500">/,
    );
    assert.match(
      source,
      /'group relative flex cursor-pointer items-start rounded-xl px-3 py-2\.5 transition-all'/,
    );
    assert.match(
      source,
      /<div className="flex min-w-0 flex-1 flex-col gap-0\.5 overflow-hidden">/,
    );
    assert.match(
      source,
      /<div className="flex min-w-0 items-center gap-1\.5">/,
    );
    assert.match(
      source,
      /<span className="min-w-0 flex-1 truncate text-\[13px\] font-medium leading-5">/,
    );
    assert.match(
      source,
      /<span className="shrink-0 text-\[10px\] font-medium tabular-nums text-zinc-400 dark:text-zinc-500">\s*\{presentation\.relativeTimeLabel\}\s*<\/span>/,
    );
    assert.match(
      source,
      /<div className="truncate text-\[11px\] leading-5 text-zinc-400 dark:text-zinc-500">\s*\{presentation\.preview\}\s*<\/div>/,
    );
    assert.match(
      source,
      /className="ml-2 mt-0\.5 shrink-0 rounded-md p-1 opacity-100 transition-opacity hover:bg-zinc-200 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-zinc-700"/,
    );
    assert.doesNotMatch(
      source,
      /<MessageSquare\s+className=\{cn\(\s*'mt-0\.5 h-4 w-4 shrink-0'/,
    );
    assert.doesNotMatch(
      source,
      /<div className="mt-0\.5 flex min-w-0 items-center gap-1\.5 text-\[11px\] leading-5 text-zinc-400 dark:text-zinc-500">/,
    );
  },
);
