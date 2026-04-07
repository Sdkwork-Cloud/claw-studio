import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts',
  'packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.test.ts',
  'packages/sdkwork-claw-instances/src/services/instanceFileWorkbench.test.ts',
  'packages/sdkwork-claw-instances/src/services/instanceMemoryWorkbenchPresentation.test.ts',
  'packages/sdkwork-claw-instances/src/services/openClawProviderRequestDraft.test.ts',
  'packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.test.ts',
  'packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.test.ts',
]);
