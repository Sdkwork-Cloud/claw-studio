import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-claw-apps/src/services/appStoreService.test.ts',
  'packages/sdkwork-claw-apps/src/pages/apps/appCatalogPresentation.test.ts',
]);
