import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-claw-core/src/services/pointsWalletService.test.ts',
  'scripts/sdkwork-points-contract.test.ts',
]);
