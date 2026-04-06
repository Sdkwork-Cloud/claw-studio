import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'scripts/sdkwork-chat-contract.test.ts',
  'packages/sdkwork-claw-chat/src/services/chatService.test.ts',
  'packages/sdkwork-claw-chat/src/services/instanceEffectiveModelCatalogService.test.ts',
  'packages/sdkwork-claw-chat/src/runtime/openClawGatewayConnectionsPolicy.test.ts',
  'packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClientRegistry.test.ts',
  'packages/sdkwork-claw-chat/src/store/chatStoreAuthority.test.ts',
  'packages/sdkwork-claw-chat/src/store/studioConversationGateway.test.ts',
]);
