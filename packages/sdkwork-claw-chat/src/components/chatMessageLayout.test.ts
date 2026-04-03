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

const source = readFileSync(new URL('./ChatMessage.tsx', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../pages/Chat.tsx', import.meta.url), 'utf8');

await runTest(
  'ChatMessage does not reserve a grouped top action row when headers are hidden',
  () => {
    assert.doesNotMatch(source, /!\s*showHeader\s*&&\s*messageActions\s*\?/);
  },
);

await runTest(
  'ChatMessage renders tool invocations as compact inline links instead of stacked cards',
  () => {
    assert.match(source, /const\s+ToolLinksPanel\s*=\s*memo/);
    assert.doesNotMatch(source, /const\s+ToolCardsPanel\s*=\s*memo/);
    assert.match(source, /hover:underline/);
    assert.doesNotMatch(
      source,
      /details\s+className="mb-4\s+overflow-hidden\s+rounded-2xl\s+border\s+border-zinc-200\/80\s+bg-white\/70\s+shadow-sm\s+backdrop-blur-sm\s+dark:border-zinc-800\/80\s+dark:bg-zinc-900\/60"/,
    );
    assert.doesNotMatch(
      source,
      /expandedTool\s*\?\s*\(\s*<div\s+className="rounded-xl\s+border\s+border-zinc-200\/70\s+bg-zinc-50\/85/,
    );
    assert.doesNotMatch(
      source,
      /:\s*isTool\s*\?\s*'w-full\s+rounded-2xl\s+border\s+border-zinc-200\/80\s+bg-white\/65/,
    );
  },
);

await runTest(
  'ChatMessage uses a wider avatar-free layout with tighter message padding',
  () => {
    assert.match(
      source,
      /group mx-auto flex w-full max-w-6xl px-4 sm:px-6 lg:px-8 transition-all duration-300/,
    );
    assert.match(
      source,
      /rounded-br-md bg-zinc-100 px-4 py-2\.5 text-zinc-900 sm:max-w-\[95%\] dark:bg-zinc-800 dark:text-zinc-100/,
    );
    assert.match(
      source,
      /:\s*isTool\s*\?\s*'w-full px-0 py-0\.5 text-zinc-900 dark:text-zinc-100'\s*:\s*'w-full px-0 py-0\.5 text-zinc-900 dark:text-zinc-100'/,
    );
    assert.doesNotMatch(source, /showAvatar\?: boolean;/);
    assert.doesNotMatch(source, /reserveAvatarSpace\?: boolean;/);
    assert.doesNotMatch(source, /justify-start pr-4 sm:pr-12 lg:pr-24/);
    assert.doesNotMatch(source, /<Bot className=/);
  },
);

await runTest(
  'ChatMessage keeps markdown, code blocks, and tool links on a tighter vertical rhythm',
  () => {
    assert.match(
      source,
      /relative mb-4 mt-3 min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-\[#1E1E1E\]/,
    );
    assert.match(
      source,
      /prose-headings:font-semibold prose-headings:tracking-tight prose-headings:mb-2 prose-headings:mt-4 prose-a:text-primary-500 hover:prose-a:text-primary-600/,
    );
    assert.match(
      source,
      /prose-code:before:content-none prose-code:after:content-none prose-p:my-2\.5 prose-p:leading-relaxed prose-pre:my-3 prose-pre:bg-transparent prose-pre:p-0 prose-ul:my-2\.5 prose-ol:my-2\.5/,
    );
    assert.match(source, /attachments\.length > 0 \? \(\s*<div className="mb-3 grid gap-3 sm:grid-cols-2">/);
    assert.match(source, /reasoning \? \(\s*<details className="mb-3 overflow-hidden rounded-2xl border/);
    assert.match(source, /<div className=\{hasRenderableContent \? 'mt-2\.5' : null\}>/);
  },
);

await runTest(
  'Chat page stops reserving avatar-driven message and footer offsets',
  () => {
    assert.doesNotMatch(pageSource, /showAvatar=\{isFirstInGroup\}/);
    assert.doesNotMatch(pageSource, /reserveAvatarSpace=\{!isFirstInGroup\}/);
    assert.match(
      pageSource,
      /mx-auto flex w-full max-w-6xl px-4 text-\[10px\] tracking-normal text-zinc-400 sm:px-6 lg:px-8 dark:text-zinc-500/,
    );
    assert.match(
      pageSource,
      /style=\{\{\s*paddingBottom: messageListBottomPadding,\s*\}\}/,
    );
    assert.match(
      pageSource,
      /<div key=\{groupKey\} className="space-y-2 sm:space-y-2\.5">/,
    );
    assert.match(
      pageSource,
      /pointer-events-auto mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8/,
    );
    assert.doesNotMatch(pageSource, /ml-11 sm:ml-14/);
  },
);

await runTest(
  'Chat page measures the composer height so the latest message stays above the input overlay',
  () => {
    assert.match(pageSource, /const composerSurfaceRef = useRef<HTMLDivElement \| null>\(null\);/);
    assert.match(pageSource, /const \[composerSurfaceHeight, setComposerSurfaceHeight\] = useState\(0\);/);
    assert.match(pageSource, /const messageListBottomPadding = `calc\(\$\{composerSurfaceHeight \+ 32\}px \+ env\(safe-area-inset-bottom\)\)`;/);
    assert.match(pageSource, /const emptyStateBottomPadding = `calc\(\$\{composerSurfaceHeight \+ 52\}px \+ env\(safe-area-inset-bottom\)\)`;/);
    assert.match(pageSource, /new ResizeObserver\(\(\[entry\]\) => \{/);
    assert.match(pageSource, /ref=\{composerSurfaceRef\}/);
    assert.doesNotMatch(pageSource, /pb-36 sm:pb-40/);
  },
);

await runTest(
  'ChatInput removes the footer disclaimer so the composer ends with the input surface',
  () => {
    const chatInputSource = readFileSync(new URL('./ChatInput.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(chatInputSource, /chat\.input\.disclaimer/);
    assert.doesNotMatch(chatInputSource, /AI models can make mistakes/);
  },
);

await runTest(
  'Chat page renders footer metadata as subdued inline text instead of badge-heavy chrome',
  () => {
    assert.match(
      pageSource,
      /flex min-w-0 max-w-full flex-wrap items-center gap-x-1\.5 gap-y-0\.5/,
    );
    assert.match(
      pageSource,
      /<span className="truncate font-medium text-zinc-500 dark:text-zinc-400">/,
    );
    assert.match(
      pageSource,
      /<span className="shrink-0 text-zinc-300 dark:text-zinc-600">\/<\/span>/,
    );
    assert.match(
      pageSource,
      /<span className="truncate text-zinc-400 dark:text-zinc-500">\s*\{footerPresentation\.modelLabel\}\s*<\/span>/,
    );
    assert.doesNotMatch(
      pageSource,
      /rounded-full border border-zinc-200 bg-white\/80 px-2 py-0\.5 text-\[10px\] font-semibold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900\/70 dark:text-zinc-300/,
    );
  },
);
