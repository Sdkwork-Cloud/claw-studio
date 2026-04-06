import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-claw-shell/src/components/chatCronActivityNotificationRuntime.test.ts',
  'packages/sdkwork-claw-shell/src/application/layouts/chatRuntimeWarmersPolicy.test.ts',
  'packages/sdkwork-claw-shell/src/application/bootstrap/bootstrapShellRuntime.test.ts',
]);
