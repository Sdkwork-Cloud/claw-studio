import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function resolveTsxCliPath() {
  const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm');
  const candidates = fs
    .readdirSync(pnpmDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('tsx@'))
    .map((entry) => path.join(pnpmDir, entry.name, 'node_modules', 'tsx', 'dist', 'cli.mjs'))
    .filter((candidate) => fs.existsSync(candidate));

  if (candidates.length === 0) {
    throw new Error('Unable to locate the tsx CLI under node_modules/.pnpm.');
  }

  return candidates.sort().at(-1);
}

const tsxCliPath = resolveTsxCliPath();

const commands = [
  [process.execPath, [tsxCliPath, 'scripts/sdkwork-core-contract.test.ts']],
  [process.execPath, [tsxCliPath, 'packages/sdkwork-claw-core/src/lib/llmService.test.ts']],
  [process.execPath, [tsxCliPath, 'packages/sdkwork-claw-core/src/services/accountService.test.ts']],
  [process.execPath, [tsxCliPath, 'packages/sdkwork-claw-core/src/services/communityService.test.ts']],
  [process.execPath, [tsxCliPath, 'packages/sdkwork-claw-core/src/services/openClawAgentCatalogService.test.ts']],
  [process.execPath, [tsxCliPath, 'packages/sdkwork-claw-core/src/services/settingsService.test.ts']],
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
