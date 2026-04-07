import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-claw-commons/src/components/cronTasksManagerData.test.ts',
  'packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts',
]);
