import { spawnSync } from 'node:child_process';

const commands = [
  ['node', ['--experimental-strip-types', 'scripts/sdkwork-core-contract.test.ts']],
  ['node', ['--experimental-strip-types', 'packages/sdkwork-claw-core/src/lib/llmService.test.ts']],
  ['node', ['--experimental-strip-types', 'packages/sdkwork-claw-core/src/services/accountService.test.ts']],
  ['node', ['--experimental-strip-types', 'packages/sdkwork-claw-core/src/services/communityService.test.ts']],
  ['node', ['--experimental-strip-types', 'packages/sdkwork-claw-core/src/services/openClawAgentCatalogService.test.ts']],
  ['node', ['--experimental-strip-types', 'packages/sdkwork-claw-core/src/services/settingsService.test.ts']],
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
