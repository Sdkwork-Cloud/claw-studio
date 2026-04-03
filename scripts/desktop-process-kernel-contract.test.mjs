import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const failures = [];

function readText(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return '';
  }

  return readFileSync(absolutePath, 'utf8');
}

function assertPath(relativePath, label) {
  if (!existsSync(path.join(rootDir, relativePath))) {
    failures.push(`Missing ${label}: ${relativePath}`);
  }
}

function assertIncludes(relativePath, expectedText, label) {
  const content = readText(relativePath);
  if (!content.includes(expectedText)) {
    failures.push(`Missing ${label} in ${relativePath}: expected "${expectedText}"`);
  }
}

function assertMatches(relativePath, expectedPattern, label) {
  const content = readText(relativePath);
  if (!expectedPattern.test(content)) {
    failures.push(
      `Missing ${label} in ${relativePath}: expected pattern "${expectedPattern.source}"`,
    );
  }
}

assertPath(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs',
  'desktop process service facade module',
);
assertPath(
  'packages/sdkwork-claw-desktop/src-tauri/src/commands/process_commands.rs',
  'desktop process command module',
);
assertPath(
  'packages/sdkwork-claw-desktop/src-tauri/src/commands/job_commands.rs',
  'desktop job command module',
);
assertPath(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process/profiles.rs',
  'desktop process profiles module',
);
assertPath(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process/requests.rs',
  'desktop process request module',
);
assertPath(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process/runtime.rs',
  'desktop process runtime module',
);

assertIncludes(
  'package.json',
  '"check:desktop-process"',
  'desktop process verification script',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs',
  'mod profiles;',
  'process profiles module declaration',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs',
  'mod requests;',
  'process requests module declaration',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs',
  'mod runtime;',
  'process runtime module declaration',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs',
  'pub use self::requests::ProcessRequest;',
  'process request public re-export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs',
  'pub use self::runtime::{ProcessEventSink, ProcessOutputEvent, ProcessOutputStream, ProcessResult};',
  'process runtime public re-exports',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs',
  'pub fn run_profile_and_emit_with_started',
  'process facade profile execution method',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs',
  'pub fn resolve_profile',
  'process facade profile resolution method',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process/profiles.rs',
  'pub struct ProcessProfile',
  'process profile type',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process/requests.rs',
  'ValidatedProcessRequest',
  'validated process request type',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process/runtime.rs',
  'struct ProcessRuntime',
  'process runtime coordinator',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/commands/process_commands.rs',
  '.run_capture_and_emit(',
  'process command remains facade-based',
);
assertMatches(
  'packages/sdkwork-claw-desktop/src-tauri/src/commands/job_commands.rs',
  /\.submit_process_and_emit\(\s*state\.context\.services\.process\.clone\(\),\s*&profile_id,\s*app,\s*\)/,
  'job command remains process-service based',
);

if (failures.length > 0) {
  console.error('desktop process kernel contract failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('desktop process kernel contract passed');
