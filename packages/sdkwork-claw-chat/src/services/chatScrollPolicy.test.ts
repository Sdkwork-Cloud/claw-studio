import assert from 'node:assert/strict';
import {
  isChatViewportNearBottom,
  resolveChatAutoScrollDecision,
} from './chatScrollPolicy.ts';

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

await runTest(
  'isChatViewportNearBottom uses the same strict 450px threshold as openclaw control ui',
  () => {
    assert.equal(
      isChatViewportNearBottom({
        scrollHeight: 2_000,
        scrollTop: 1_151,
        clientHeight: 400,
      }),
      true,
    );
    assert.equal(
      isChatViewportNearBottom({
        scrollHeight: 2_000,
        scrollTop: 1_150,
        clientHeight: 400,
      }),
      false,
    );
  },
);

await runTest(
  'resolveChatAutoScrollDecision respects explicit user scroll-up after the initial auto-scroll',
  () => {
    assert.deepEqual(
      resolveChatAutoScrollDecision({
        force: true,
        hasAutoScrolled: true,
        userNearBottom: false,
        scrollHeight: 2_000,
        scrollTop: 500,
        clientHeight: 400,
      }),
      {
        shouldScroll: false,
        showJumpToLatest: true,
        nextHasAutoScrolled: true,
        effectiveForce: false,
      },
    );
  },
);

await runTest(
  'resolveChatAutoScrollDecision forces the initial scroll for a new session load',
  () => {
    assert.deepEqual(
      resolveChatAutoScrollDecision({
        force: true,
        hasAutoScrolled: false,
        userNearBottom: false,
        scrollHeight: 2_000,
        scrollTop: 500,
        clientHeight: 400,
      }),
      {
        shouldScroll: true,
        showJumpToLatest: false,
        nextHasAutoScrolled: true,
        effectiveForce: true,
      },
    );
  },
);

await runTest(
  'resolveChatAutoScrollDecision keeps streaming pinned when the viewport is already near the bottom',
  () => {
    assert.deepEqual(
      resolveChatAutoScrollDecision({
        force: false,
        hasAutoScrolled: true,
        userNearBottom: false,
        scrollHeight: 2_000,
        scrollTop: 1_250,
        clientHeight: 400,
      }),
      {
        shouldScroll: true,
        showJumpToLatest: false,
        nextHasAutoScrolled: true,
        effectiveForce: false,
      },
    );
  },
);
