import assert from 'node:assert/strict';
import {
  getChatSessionDisplayTitle,
  normalizeChatSessionTitle,
} from './chatSessionTitlePresentation.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('normalizeChatSessionTitle collapses whitespace and trims the title', () => {
  assert.equal(
    normalizeChatSessionTitle('  Review\n\nOpenClaw install flow   on macOS and Windows\t '),
    'Review OpenClaw install flow on macOS and Windows',
  );
});

await runTest('getChatSessionDisplayTitle prefers the first user message when the stored title is still the default', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'New Conversation',
      messages: [
        {
          role: 'user',
          content: '  Compare Gemini CLI and Claude Code router mapping strategy  ',
        },
      ],
      lastMessagePreview: undefined,
    }),
    'Compare Gemini CLI and Claude Code router mapping strategy',
  );
});

await runTest('getChatSessionDisplayTitle falls back to a readable preview instead of an opaque session key', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'claw-studio:instance-a:session-1',
      messages: [],
      lastMessagePreview: '  Investigate the latest billing sync failure and summarize the root cause  ',
    }),
    'Investigate the latest billing sync failure and summarize the root cause',
  );
});

await runTest('getChatSessionDisplayTitle prefers the first user message over weak technical runtime labels', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'openclaw-tui',
      messages: [
        {
          role: 'user',
          content: '  Draft a human-friendly install checklist for Windows, macOS, and Linux  ',
        },
      ],
      lastMessagePreview: 'Follow-up preview that should not win',
    }),
    'Draft a human-friendly install checklist for Windows, macOS, and Linux',
  );
});

await runTest('getChatSessionDisplayTitle falls back to preview content when the explicit title is a generic main session label', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'main',
      messages: [],
      lastMessagePreview: '  Summarize the first user request instead of showing a runtime slot name  ',
    }),
    'Summarize the first user request instead of showing a runtime slot name',
  );
});

await runTest('getChatSessionDisplayTitle hides machine session ids when no readable content exists', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'agent:research:main',
      messages: [],
      lastMessagePreview: undefined,
    }),
    'New Conversation',
  );
});
