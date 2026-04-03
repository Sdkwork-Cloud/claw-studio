import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const failures = [];

function readJson(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return null;
  }

  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    failures.push(
      `Invalid JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function assertPath(relativePath, label) {
  if (!existsSync(path.join(rootDir, relativePath))) {
    failures.push(`Missing ${label}: ${relativePath}`);
  }
}

function assertIncludes(relativePath, expectedText, label) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return;
  }

  const source = readFileSync(absolutePath, 'utf8');
  if (!source.includes(expectedText)) {
    failures.push(`Missing ${label} in ${relativePath}: expected "${expectedText}"`);
  }
}

assertPath('packages/sdkwork-claw-server/package.json', 'server package');
assertPath('packages/sdkwork-claw-server/.env.example', 'server env example');
assertPath('packages/sdkwork-claw-server/src/index.ts', 'server TypeScript entry');
assertPath('packages/sdkwork-claw-server/src-host/Cargo.toml', 'server Cargo manifest');
assertPath('packages/sdkwork-claw-server/src-host/src/main.rs', 'server Rust entry');
assertPath('packages/sdkwork-claw-server/src-host/src/bootstrap.rs', 'server bootstrap module');
assertPath('packages/sdkwork-claw-server/src-host/src/http/mod.rs', 'server http module');
assertPath('packages/sdkwork-claw-server/src-host/src/http/router.rs', 'server router module');
assertPath(
  'packages/sdkwork-claw-server/src-host/src/http/error_response.rs',
  'server error response module',
);
assertPath('packages/sdkwork-claw-server/src-host/src/http/routes/health.rs', 'server health route');
assertPath(
  'packages/sdkwork-claw-server/src-host/src/http/routes/api_public.rs',
  'server public api route',
);
assertPath(
  'packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs',
  'server internal node-session route',
);
assertPath(
  'packages/sdkwork-claw-server/src-host/src/http/routes/manage_rollouts.rs',
  'server manage rollout route',
);
assertPath(
  'packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs',
  'server openapi route',
);
assertPath(
  'packages/sdkwork-claw-server/src-host/src/http/static_assets.rs',
  'server static asset mount module',
);

const rootPackage = readJson('package.json');
const serverPackage = readJson('packages/sdkwork-claw-server/package.json');

if (rootPackage?.scripts?.['server:dev'] !== 'pnpm --dir packages/sdkwork-claw-server dev') {
  failures.push('Root package server:dev script must delegate to the server package dev entry.');
}
if (rootPackage?.scripts?.['server:build'] !== 'node scripts/run-claw-server-build.mjs') {
  failures.push('Root package server:build script must use the shared server build helper.');
}
if (serverPackage?.scripts?.dev !== 'cargo run --manifest-path src-host/Cargo.toml') {
  failures.push('Server package dev script must run the native Rust host entry.');
}
if (serverPackage?.scripts?.build !== 'node ../../scripts/run-claw-server-build.mjs') {
  failures.push('Server package build script must use the shared server build helper.');
}

assertIncludes(
  'packages/sdkwork-claw-server/.env.example',
  'CLAW_SERVER_HOST=',
  'server env example host variable',
);
assertIncludes(
  'packages/sdkwork-claw-server/.env.example',
  'CLAW_SERVER_PORT=',
  'server env example port variable',
);
assertIncludes(
  'packages/sdkwork-claw-server/.env.example',
  'CLAW_SERVER_DATA_DIR=',
  'server env example data dir variable',
);
assertIncludes(
  'packages/sdkwork-claw-server/.env.example',
  'CLAW_SERVER_WEB_DIST=',
  'server env example web dist variable',
);

assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/mod.rs',
  'pub mod error_response;',
  'server error response module export',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/mod.rs',
  'pub mod api_public;',
  'server public api route export',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/mod.rs',
  'pub mod openapi;',
  'server openapi route export',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/bootstrap.rs',
  'CLAW_SERVER_WEB_DIST',
  'server web dist environment support',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/main.rs',
  'build_router',
  'server router bootstrap usage',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/router.rs',
  'state.web_dist_dir',
  'server router uses configurable web dist path',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/router.rs',
  '.nest("/claw/health"',
  'server router health route mount',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/router.rs',
  '.nest("/claw/api/v1"',
  'server router public api route mount',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/router.rs',
  '.nest("/claw/openapi"',
  'server router openapi route mount',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/router.rs',
  '.nest("/claw/internal/v1"',
  'server router internal route mount',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/router.rs',
  '.nest("/claw/manage/v1"',
  'server router manage route mount',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/routes/api_public.rs',
  '/claw/openapi/v1.json',
  'server public api discovery openapi link',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs',
  '"/claw/api/v1/discovery"',
  'server openapi document public api path',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs',
  '"/claw/manage/v1/rollouts"',
  'server openapi document manage rollout path',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs',
  '"/claw/internal/v1/node-sessions"',
  'server openapi document internal node-session path',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs',
  'envelope_error_response',
  'server internal routes use shared error envelopes',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/routes/manage_rollouts.rs',
  'categorized_error_response',
  'server manage routes use shared error envelopes',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/static_assets.rs',
  'sdkwork-claw-host-mode',
  'server static assets inject host mode metadata',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/static_assets.rs',
  'sdkwork-claw-manage-base-path',
  'server static assets inject manage base path metadata',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/http/static_assets.rs',
  'sdkwork-claw-internal-base-path',
  'server static assets inject internal base path metadata',
);
assertIncludes(
  'packages/sdkwork-claw-server/src-host/src/main.rs',
  'build_server_state',
  'server state bootstrap usage',
);

if (failures.length > 0) {
  console.error('Server platform foundation check failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Server platform foundation check passed.');
