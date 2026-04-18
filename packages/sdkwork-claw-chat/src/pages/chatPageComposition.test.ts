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
  'Chat page re-hydrates the active instance when the same instance route authority changes',
  () => {
    assert.match(
      pageSource,
      /import \{[\s\S]*resolveChatInstanceHydrationKey,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      pageSource,
      /const lastResolvedRouteHydrationKeyRef = useRef<string \| null>\(null\);/,
    );
    assert.match(
      pageSource,
      /const nextHydrationKey = resolveChatInstanceHydrationKey\(\{\s*activeInstanceId,\s*routeMode,\s*\}\);/,
    );
    assert.match(
      pageSource,
      /if \(lastResolvedRouteHydrationKeyRef\.current === nextHydrationKey\) \{\s*return;\s*\}/,
    );
    assert.match(
      pageSource,
      /const hadResolvedHydrationKey = lastResolvedRouteHydrationKeyRef\.current !== null;/,
    );
    assert.match(
      pageSource,
      /lastResolvedRouteHydrationKeyRef\.current = nextHydrationKey;/,
    );
    assert.match(
      pageSource,
      /if \(!nextHydrationKey \|\| !hadResolvedHydrationKey\) \{\s*return;\s*\}/,
    );
    assert.match(
      pageSource,
      /void hydrateInstance\(activeInstanceId\);/,
    );
  },
);

await runTest(
  'Chat page wires OpenClaw session controls through the context drawer',
  () => {
    assert.match(
      pageSource,
      /import \{[\s\S]*resolveKernelChatSessionState,[\s\S]*resolveChatRuntimeState,[\s\S]*resolveChatThinkingLevelDefaultOption,\s*resolveChatThinkingLevelOptions,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      pageSource,
      /setGatewaySessionThinkingLevel,\s*setGatewaySessionFastMode,\s*setGatewaySessionVerboseLevel,\s*setGatewaySessionReasoningLevel,\s*\}\s*=\s*useChatStore\(\);/s,
    );
    assert.match(
      pageSource,
      /const activeKernelSessionState = resolveKernelChatSessionState\(activeSession\);/,
    );
    assert.match(
      pageSource,
      /const activeThinkingLevel = isOpenClawGateway \? activeKernelSessionState\.thinkingLevel : null;/,
    );
    assert.match(
      pageSource,
      /const activeFastMode =\s*isOpenClawGateway\s*\?\s*activeKernelSessionState\.fastMode === true\s*\?\s*'on'\s*:\s*activeKernelSessionState\.fastMode === false\s*\?\s*'off'\s*:\s*null\s*:\s*null;/s,
    );
    assert.match(
      pageSource,
      /const activeVerboseLevel = isOpenClawGateway \? activeKernelSessionState\.verboseLevel : null;/,
    );
    assert.match(
      pageSource,
      /const activeReasoningLevel = isOpenClawGateway \? activeKernelSessionState\.reasoningLevel : null;/,
    );
    assert.match(
      pageSource,
      /const activeThinkingModelId =\s*isOpenClawGateway\s*\?\s*activeKernelSessionState\.model \|\| activeKernelSessionState\.defaultModel \|\| activeModel\?\.id \|\| null\s*:\s*null;/s,
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

await runTest(
  'Chat page derives chat generation run state from the kernel session authority',
  () => {
    assert.match(
      pageSource,
      /const\s*\{\s*isActiveSessionGenerating,\s*isComposerLocked,\s*stopSessionId\s*\}\s*=\s*resolveChatGenerationViewState\(\{\s*effectiveActiveSessionId,\s*pendingSendSessionId,\s*activeSessionRunId:\s*activeKernelSessionState\.activeRunId,\s*runningSessionId,\s*\}\);/s,
    );
    assert.doesNotMatch(
      pageSource,
      /resolveChatGenerationViewState\(\{[\s\S]*activeSessionRunId:\s*activeSession\?\.runId\s*\?\?\s*null[\s\S]*\}\)/s,
    );
  },
);

await runTest(
  'Chat page resolves message display state through the kernel message authority',
  () => {
    assert.match(
      pageSource,
      /import \{[\s\S]*resolveKernelChatMessageState,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      pageSource,
      /const activeMessageStates = useMemo\(\s*\(\) => activeMessages\.map\(\(message\) => resolveKernelChatMessageState\(message\)\),\s*\[activeMessages\],\s*\);/s,
    );
    assert.match(
      pageSource,
      /const activeMessageGroups = useMemo\(\s*\(\) => groupChatMessagesForDisplay\(activeMessageStates\),\s*\[activeMessageStates\],\s*\);/s,
    );
    assert.doesNotMatch(
      pageSource,
      /const activeMessageGroups = useMemo\(\s*\(\) => groupChatMessagesForDisplay\(activeMessages\),\s*\[activeMessages\],\s*\);/s,
    );
  },
);

await runTest(
  'Chat page only loads the OpenClaw agent catalog when the active adapter resolves to a gateway kernel chat path',
  () => {
    assert.match(
      pageSource,
      /queryKey: \['chat', 'openclaw-agent-catalog', activeInstanceId\],\s*enabled: Boolean\(activeInstanceId && isOpenClawGateway\),/s,
    );
  },
);

await runTest(
  'Chat page derives blocked and gateway chat state from adapter capabilities instead of raw route literals',
  () => {
    assert.match(
      pageSource,
      /const activeAdapterCapabilities =\s*activeInstanceId \? instanceChatAdapterCapabilitiesById\[activeInstanceId\] \?\? null : null;/,
    );
    assert.match(
      pageSource,
      /const adapterRuntimeState = resolveChatRuntimeState\(\{\s*activeInstanceId,\s*routeMode,\s*adapterCapabilities: activeAdapterCapabilities,\s*sessionState: null,\s*\}\);/s,
    );
    assert.match(pageSource, /const isChatSupportedRoute = adapterRuntimeState\.isChatAvailable;/);
    assert.match(pageSource, /const isOpenClawGateway = adapterRuntimeState\.isOpenClawGateway;/);
    assert.match(
      pageSource,
      /const chatRuntimeState = resolveChatRuntimeState\(\{\s*activeInstanceId,\s*routeMode,\s*adapterCapabilities: activeAdapterCapabilities,\s*sessionState: activeKernelSessionState,\s*\}\);/s,
    );
    assert.match(pageSource, /const isUnsupportedRoute = chatRuntimeState\.isBlocked;/);
    assert.doesNotMatch(pageSource, /const isUnsupportedRoute = routeMode === 'unsupported';/);
    assert.doesNotMatch(pageSource, /const isChatSupportedRoute = !isUnsupportedRoute;/);
    assert.doesNotMatch(pageSource, /const isOpenClawGateway = routeMode === 'instanceOpenClawGatewayWs';/);
    assert.match(
      pageSource,
      /shouldLoadChatSkills\(\{\s*isRouteSupported: isChatSupportedRoute,\s*isSessionContextDrawerOpen,\s*selectedSkillId,\s*\}\)/s,
    );
    assert.match(
      pageSource,
      /shouldLoadChatDirectAgents\(\{\s*activeInstanceId,\s*isRouteSupported: isChatSupportedRoute,\s*isOpenClawGateway,\s*isSessionContextDrawerOpen,\s*selectedAgentId,\s*\}\)/s,
    );
    assert.match(
      pageSource,
      /resolveChatSessionViewState\(\{\s*sessions: instanceSessions,\s*activeSessionId,\s*isChatSupported: isChatSupportedRoute,\s*isOpenClawGateway,\s*openClawAgentId: effectiveGatewayAgentId,\s*\}\)/s,
    );
    assert.match(
      pageSource,
      /const sessionRouteLabel = t\(chatRuntimeState\.routeLabelKey\);/,
    );
    assert.match(
      pageSource,
      /if\s*\(\s*!activeModel\s*\|\|\s*!activeChannel\s*\|\|\s*!isChatSupportedRoute\s*\|\|\s*isBusy\s*\|\|\s*\(activeInstanceId && !routeMode\)\s*\)\s*\{/,
    );
    assert.match(pageSource, /showAgentSection=\{isChatSupportedRoute\}/);
    assert.match(pageSource, /showSkillSection=\{isChatSupportedRoute\}/);
    assert.match(pageSource, /isChatSupported=\{isChatSupportedRoute\}/);
  },
);

await runTest(
  'Chat page derives gateway running state from the current selectable session scope instead of any hidden instance session',
  () => {
    assert.match(
      pageSource,
      /import \{[\s\S]*resolveChatRunningSessionId,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      pageSource,
      /const runningSessionId = resolveChatRunningSessionId\(\{\s*isOpenClawGateway,\s*selectableSessions: selectableInstanceSessions,\s*\}\);/s,
    );
    assert.doesNotMatch(
      pageSource,
      /instanceSessions\.find\(\(session\) => Boolean\(session\.runId\)\)\?\.id \?\? null/,
    );
  },
);
