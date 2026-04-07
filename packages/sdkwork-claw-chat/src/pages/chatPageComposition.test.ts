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

await runTest(
  'Chat page wires OpenClaw session controls through the context drawer',
  () => {
    assert.match(
      pageSource,
      /import \{\s*resolveChatThinkingLevelDefaultOption,\s*resolveChatThinkingLevelOptions,\s*\} from '\.\.\/services';/,
    );
    assert.match(
      pageSource,
      /setGatewaySessionThinkingLevel,\s*setGatewaySessionFastMode,\s*setGatewaySessionVerboseLevel,\s*setGatewaySessionReasoningLevel,\s*\}\s*=\s*useChatStore\(\);/s,
    );
    assert.match(
      pageSource,
      /const activeThinkingLevel = isOpenClawGateway \? activeSession\?\.thinkingLevel \?\? null : null;/,
    );
    assert.match(
      pageSource,
      /const activeFastMode =\s*isOpenClawGateway\s*\?\s*activeSession\?\.fastMode === true\s*\?\s*'on'\s*:\s*activeSession\?\.fastMode === false\s*\?\s*'off'\s*:\s*null\s*:\s*null;/s,
    );
    assert.match(
      pageSource,
      /const activeVerboseLevel = isOpenClawGateway \? activeSession\?\.verboseLevel \?\? null : null;/,
    );
    assert.match(
      pageSource,
      /const activeReasoningLevel = isOpenClawGateway \? activeSession\?\.reasoningLevel \?\? null : null;/,
    );
    assert.match(
      pageSource,
      /const activeThinkingModelId =\s*isOpenClawGateway \? sessionSelectedModelId \|\| activeModel\?\.id \|\| null : null;/s,
    );
    assert.match(
      pageSource,
      /const thinkingLevelOptions = resolveChatThinkingLevelOptions\(activeThinkingModelId\)\.map\(\(value\) => \(\{\s*value,\s*label: t\(`chat\.page\.thinkingLevels\.\$\{value\}`\),\s*\}\)\);/s,
    );
    assert.match(
      pageSource,
      /const resolvedThinkingLevelDefault = resolveChatThinkingLevelDefaultOption\(activeThinkingModelId\);/,
    );
    assert.match(
      pageSource,
      /const thinkingLevelDefaultLabel = resolvedThinkingLevelDefault\s*\?\s*t\('chat\.page\.thinkingLevelDefaultResolved',\s*\{\s*level: t\(`chat\.page\.thinkingLevels\.\$\{resolvedThinkingLevelDefault\}`\),\s*\}\)\s*:\s*t\('chat\.page\.thinkingLevelDefault'\);/s,
    );
    assert.match(
      pageSource,
      /const sessionControlInheritLabel = t\('chat\.page\.sessionControlInherit'\);/,
    );
    assert.match(
      pageSource,
      /const fastModeOptions = \[\s*\{\s*value: 'off',\s*label: t\('chat\.page\.fastModes\.off'\),\s*\},\s*\{\s*value: 'on',\s*label: t\('chat\.page\.fastModes\.on'\),\s*\},\s*\];/s,
    );
    assert.match(
      pageSource,
      /const verboseLevelOptions = \[\s*\{\s*value: 'off',\s*label: t\('chat\.page\.verboseLevels\.off'\),\s*\},\s*\{\s*value: 'on',\s*label: t\('chat\.page\.verboseLevels\.on'\),\s*\},\s*\{\s*value: 'full',\s*label: t\('chat\.page\.verboseLevels\.full'\),\s*\},\s*\];/s,
    );
    assert.match(
      pageSource,
      /const reasoningLevelOptions = \[\s*\{\s*value: 'off',\s*label: t\('chat\.page\.reasoningLevels\.off'\),\s*\},\s*\{\s*value: 'on',\s*label: t\('chat\.page\.reasoningLevels\.on'\),\s*\},\s*\{\s*value: 'stream',\s*label: t\('chat\.page\.reasoningLevels\.stream'\),\s*\},\s*\];/s,
    );
    assert.match(
      pageSource,
      /currentThinkingLevel=\{activeThinkingLevel\}/,
    );
    assert.match(
      pageSource,
      /thinkingLevelDefaultLabel=\{thinkingLevelDefaultLabel\}/,
    );
    assert.match(
      pageSource,
      /thinkingLevelOptions=\{thinkingLevelOptions\}/,
    );
    assert.match(
      pageSource,
      /onSelectThinkingLevel=\{isOpenClawGateway\s*\?\s*\(thinkingLevel\) => \{\s*if \(!activeInstanceId \|\| !activeSession\) \{\s*return;\s*\}\s*void setGatewaySessionThinkingLevel\(\{\s*instanceId: activeInstanceId,\s*sessionId: activeSession\.id,\s*thinkingLevel,\s*\}\)\.catch\(\(error\) => \{\s*console\.error\('Failed to update OpenClaw session thinking level:', error\);/s,
    );
    assert.match(
      pageSource,
      /currentFastMode=\{activeFastMode\}/,
    );
    assert.match(
      pageSource,
      /fastModeDefaultLabel=\{sessionControlInheritLabel\}/,
    );
    assert.match(
      pageSource,
      /fastModeOptions=\{fastModeOptions\}/,
    );
    assert.match(
      pageSource,
      /onSelectFastMode=\{isOpenClawGateway\s*\?\s*\(fastMode\) => \{\s*if \(!activeInstanceId \|\| !activeSession\) \{\s*return;\s*\}\s*void setGatewaySessionFastMode\(\{\s*instanceId: activeInstanceId,\s*sessionId: activeSession\.id,\s*fastMode: fastMode === null \? null : fastMode === 'on',\s*\}\)\.catch\(\(error\) => \{\s*console\.error\('Failed to update OpenClaw session fast mode:', error\);/s,
    );
    assert.match(
      pageSource,
      /currentVerboseLevel=\{activeVerboseLevel\}/,
    );
    assert.match(
      pageSource,
      /verboseLevelDefaultLabel=\{sessionControlInheritLabel\}/,
    );
    assert.match(
      pageSource,
      /verboseLevelOptions=\{verboseLevelOptions\}/,
    );
    assert.match(
      pageSource,
      /onSelectVerboseLevel=\{isOpenClawGateway\s*\?\s*\(verboseLevel\) => \{\s*if \(!activeInstanceId \|\| !activeSession\) \{\s*return;\s*\}\s*void setGatewaySessionVerboseLevel\(\{\s*instanceId: activeInstanceId,\s*sessionId: activeSession\.id,\s*verboseLevel,\s*\}\)\.catch\(\(error\) => \{\s*console\.error\('Failed to update OpenClaw session verbose level:', error\);/s,
    );
    assert.match(
      pageSource,
      /currentReasoningLevel=\{activeReasoningLevel\}/,
    );
    assert.match(
      pageSource,
      /reasoningLevelDefaultLabel=\{sessionControlInheritLabel\}/,
    );
    assert.match(
      pageSource,
      /reasoningLevelOptions=\{reasoningLevelOptions\}/,
    );
    assert.match(
      pageSource,
      /onSelectReasoningLevel=\{isOpenClawGateway\s*\?\s*\(reasoningLevel\) => \{\s*if \(!activeInstanceId \|\| !activeSession\) \{\s*return;\s*\}\s*void setGatewaySessionReasoningLevel\(\{\s*instanceId: activeInstanceId,\s*sessionId: activeSession\.id,\s*reasoningLevel,\s*\}\)\.catch\(\(error\) => \{\s*console\.error\('Failed to update OpenClaw session reasoning level:', error\);/s,
    );
  },
);
