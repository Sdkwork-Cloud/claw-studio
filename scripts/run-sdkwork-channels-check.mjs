import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-claw-channels/src/pages/channels/channelInstanceResolver.test.ts',
  'packages/sdkwork-claw-channels/src/services/channelService.test.ts',
]);
