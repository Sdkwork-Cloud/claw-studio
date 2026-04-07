import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'scripts/sdkwork-chat-contract.test.ts',
  'packages/sdkwork-claw-chat/src/services/chatService.test.ts',
  'packages/sdkwork-claw-chat/src/services/chatThinkingLevelOptions.test.ts',
  'packages/sdkwork-claw-chat/src/services/instanceEffectiveModelCatalogService.test.ts',
  'packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.test.ts',
  'packages/sdkwork-claw-chat/src/runtime/openClawGatewayConnectionsPolicy.test.ts',
  'packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClientRegistry.test.ts',
  'packages/sdkwork-claw-chat/src/store/chatStoreAuthority.test.ts',
  'packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts',
  'packages/sdkwork-claw-chat/src/store/studioConversationGateway.test.ts',
]);
