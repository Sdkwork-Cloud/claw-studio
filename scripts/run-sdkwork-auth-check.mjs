import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-claw-auth/src/components/auth/authConfig.test.ts',
  'packages/sdkwork-claw-core/src/services/appAuthService.test.ts',
  'packages/sdkwork-claw-core/src/stores/useAuthStore.test.ts',
  'scripts/sdkwork-auth-contract.test.ts',
]);
