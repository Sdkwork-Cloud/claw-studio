import assert from 'node:assert/strict';
import {
  resolveOpenClawMessagePresentation,
} from './openClawMessagePresentation.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'resolveOpenClawMessagePresentation strips assistant-only scaffolding and keeps visible text blocks',
  () => {
    assert.deepEqual(
      resolveOpenClawMessagePresentation({
        role: 'assistant',
        content: [
          {
            type: 'thinking',
            thinking: 'Plan A',
          },
          {
            type: 'text',
            text: [
              '<relevant-memories>',
              'internal memory',
              '</relevant-memories>',
              '<thinking>hidden chain of thought</thinking>',
              'Visible answer',
            ].join('\n'),
          },
        ],
      }),
      {
        role: 'assistant',
        text: 'Visible answer',
        reasoning: 'Plan A',
        toolCards: [],
      },
    );
  },
);

await runTest(
  'resolveOpenClawMessagePresentation turns tool payloads into user-friendly cards instead of raw json text',
  () => {
    assert.deepEqual(
      resolveOpenClawMessagePresentation({
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'Bash',
            input: {
              command: 'ls -la',
            },
          },
          {
            type: 'tool_result',
            name: 'Bash',
            text: '{"files":["a.txt","b.txt"]}',
          },
        ],
      }),
      {
        role: 'tool',
        text: '',
        reasoning: null,
        toolCards: [
          {
            kind: 'call',
            name: 'Bash',
            detail: 'ls -la',
          },
          {
            kind: 'result',
            name: 'Bash',
            preview: undefined,
          },
        ],
      },
    );
  },
);

await runTest(
  'resolveOpenClawMessagePresentation extracts sender labels from inbound metadata when the gateway payload omits a top-level sender label',
  () => {
    assert.deepEqual(
      resolveOpenClawMessagePresentation({
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Sender (untrusted metadata):',
              '```json',
              '{"label":"Iris","id":"user-1"}',
              '```',
              '',
              'Conversation info (untrusted metadata):',
              '```json',
              '{"sender":"Iris"}',
              '```',
              '',
              'Hello from the external channel',
            ].join('\n'),
          },
        ],
      }),
      {
        role: 'user',
        text: 'Hello from the external channel',
        reasoning: null,
        senderLabel: 'Iris',
        toolCards: [],
      },
    );
  },
);
