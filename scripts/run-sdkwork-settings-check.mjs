import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-claw-settings/src/kernelCenterView.test.ts',
  'packages/sdkwork-claw-settings/src/services/settingsService.test.ts',
  'packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts',
  'scripts/sdkwork-settings-contract.test.ts',
]);
