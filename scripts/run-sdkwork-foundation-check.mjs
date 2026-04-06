import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts',
  'packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.test.ts',
]);
