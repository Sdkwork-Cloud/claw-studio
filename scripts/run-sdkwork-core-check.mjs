import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'scripts/sdkwork-core-contract.test.ts',
  'packages/sdkwork-claw-core/src/lib/llmService.test.ts',
  'packages/sdkwork-claw-core/src/services/accountService.test.ts',
  'packages/sdkwork-claw-core/src/services/communityService.test.ts',
  'packages/sdkwork-claw-core/src/services/openClawAgentCatalogService.test.ts',
  'packages/sdkwork-claw-core/src/services/taskService.test.ts',
  'packages/sdkwork-claw-core/src/services/settingsService.test.ts',
]);
