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

const result = spawnSync(process.execPath, [tsxCliPath, 'scripts/sdkwork-chat-contract.test.ts'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
