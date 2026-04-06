import assert from 'node:assert/strict';
import {
  detectChatJsonBlock,
  presentChatToolCardsSummary,
} from './chatMessageStructuredContent.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('detectChatJsonBlock formats object payloads and exposes key summaries', () => {
  assert.deepEqual(
    detectChatJsonBlock('{"status":"ok","files":["a.ts","b.ts"]}'),
    {
      kind: 'object',
      pretty: '{\n  "status": "ok",\n  "files": [\n    "a.ts",\n    "b.ts"\n  ]\n}',
      keyCount: 2,
      keys: ['status', 'files'],
    },
  );
});

await runTest('detectChatJsonBlock formats arrays and reports the item count', () => {
  assert.deepEqual(
    detectChatJsonBlock('[{"id":1},{"id":2},{"id":3}]'),
    {
      kind: 'array',
      pretty: '[\n  {\n    "id": 1\n  },\n  {\n    "id": 2\n  },\n  {\n    "id": 3\n  }\n]',
      itemCount: 3,
    },
  );
});

await runTest('detectChatJsonBlock ignores plain text and oversize payloads', () => {
  assert.equal(detectChatJsonBlock('plain text response'), null);
  assert.equal(
    detectChatJsonBlock(`{"payload":"${'x'.repeat(20_001)}"}`),
    null,
  );
});

await runTest('presentChatToolCardsSummary compacts tool names for collapsed summaries', () => {
  assert.deepEqual(
    presentChatToolCardsSummary({
      toolCards: [
        { kind: 'call', name: 'Bash' },
        { kind: 'result', name: 'Bash' },
        { kind: 'call', name: 'Read' },
        { kind: 'result', name: 'Write' },
      ],
      previewText: '',
    }),
    {
      totalCount: 4,
      visibleNames: ['Bash', 'Read'],
      hiddenCount: 1,
      previewText: null,
    },
  );
});

await runTest('presentChatToolCardsSummary falls back to a sanitized preview when no tool names are usable', () => {
  assert.deepEqual(
    presentChatToolCardsSummary({
      toolCards: [
        { kind: 'call', name: '   ' },
      ],
      previewText: '  tool output with\nmultiple   spaces  ',
    }),
    {
      totalCount: 1,
      visibleNames: [],
      hiddenCount: 0,
      previewText: 'tool output with multiple spaces',
    },
  );
});
