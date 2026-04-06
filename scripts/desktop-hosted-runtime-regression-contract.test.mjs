import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(
  readFileSync(path.join(rootDir, 'package.json'), 'utf8'),
);
const desktopCheckScript = packageJson.scripts?.['check:desktop'] ?? '';

assert.match(
  desktopCheckScript,
  /packages\/sdkwork-claw-desktop\/src\/desktop\/desktopHostedBridge\.test\.ts/,
  'check:desktop must execute the desktop hosted bridge regression suite',
);
assert.match(
  desktopCheckScript,
  /packages\/sdkwork-claw-desktop\/src\/desktop\/desktopHostRuntimeResolver\.test\.ts/,
  'check:desktop must execute the desktop host runtime resolver regression suite',
);
assert.match(
  desktopCheckScript,
  /packages\/sdkwork-claw-desktop\/src\/desktop\/bootstrap\/DesktopBootstrapApp\.test\.ts/,
  'check:desktop must execute the desktop bootstrap readiness regression suite',
);
assert.doesNotMatch(
  desktopCheckScript,
  /node --test .*desktopHostRuntimeResolver\.test\.ts/,
  'desktop host runtime resolver regressions must run without node --test subprocess spawning',
);
assert.doesNotMatch(
  desktopCheckScript,
  /node --test .*DesktopBootstrapApp\.test\.ts/,
  'desktop bootstrap regressions must run without node --test subprocess spawning',
);

console.log(
  'ok - desktop hosted runtime regressions are wired into the mandatory desktop check',
);
