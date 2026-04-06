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

const pageSource = readFileSync(new URL('./Chat.tsx', import.meta.url), 'utf8');
let autoScrollHookSource = '';
try {
  autoScrollHookSource = readFileSync(new URL('./useChatAutoScroll.ts', import.meta.url), 'utf8');
} catch {
  autoScrollHookSource = '';
}

await runTest(
  'Chat page delegates auto-scroll state and DOM coordination to a dedicated hook',
  () => {
    assert.match(pageSource, /import \{ useChatAutoScroll \} from '\.\/useChatAutoScroll';/);
    assert.match(
      pageSource,
      /const\s*\{\s*messagesScrollContainerRef,\s*showJumpToLatest,\s*handleMessageListScroll,\s*jumpToLatest,\s*\}\s*=\s*useChatAutoScroll\(\{\s*sessionId:\s*effectiveActiveSessionId,\s*messages:\s*activeMessages,\s*isBusy,\s*\}\);/s,
    );
    assert.doesNotMatch(pageSource, /const clearChatScrollRetry = \(\) =>/);
    assert.doesNotMatch(pageSource, /const scrollChatToLatest = \(force = false\) =>/);
    assert.doesNotMatch(pageSource, /const jumpToLatest = \(\) =>/);
    assert.doesNotMatch(
      pageSource,
      /const handleMessageListScroll = \(event: React\.UIEvent<HTMLDivElement>\) =>/,
    );
    assert.match(autoScrollHookSource, /export function useChatAutoScroll/);
    assert.match(autoScrollHookSource, /resolveChatAutoScrollDecision/);
    assert.match(autoScrollHookSource, /isChatViewportNearBottom/);
  },
);

await runTest(
  'Chat page resolves channel and model selection through a dedicated service',
  () => {
    assert.match(
      pageSource,
      /import \{\s*resolveChatPageModelSelection\s*\} from '\.\.\/services';/,
    );
    assert.match(
      pageSource,
      /const\s*\{\s*channels,\s*activeChannel,\s*activeModel\s*\}\s*=\s*resolveChatPageModelSelection\(/,
    );
    assert.doesNotMatch(pageSource, /function createFallbackGatewayChannel/);
    assert.doesNotMatch(pageSource, /const preferredModelId = sessionSelectedModelId \|\| activeModelId \|\| '';/);
    assert.doesNotMatch(pageSource, /const channelFromPreferredModel = preferredModelId/);
  },
);
