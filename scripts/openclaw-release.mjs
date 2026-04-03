import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const releaseConfigPath = path.join(rootDir, 'config', 'openclaw-release.json');

export function loadOpenClawReleaseConfig({
  readFileImpl = (filePath) => fs.readFileSync(filePath, 'utf8'),
} = {}) {
  return JSON.parse(readFileImpl(releaseConfigPath));
}

const releaseConfig = loadOpenClawReleaseConfig();

export const OPENCLAW_RELEASE = Object.freeze({
  stableVersion: String(releaseConfig.stableVersion ?? '').trim(),
  nodeVersion: String(releaseConfig.nodeVersion ?? '').trim(),
  packageName: String(releaseConfig.packageName ?? '').trim(),
});

if (!OPENCLAW_RELEASE.stableVersion) {
  throw new Error(`openclaw release config missing stableVersion: ${releaseConfigPath}`);
}
if (!OPENCLAW_RELEASE.nodeVersion) {
  throw new Error(`openclaw release config missing nodeVersion: ${releaseConfigPath}`);
}
if (!OPENCLAW_RELEASE.packageName) {
  throw new Error(`openclaw release config missing packageName: ${releaseConfigPath}`);
}

export const DEFAULT_OPENCLAW_VERSION =
  process.env.OPENCLAW_VERSION ?? OPENCLAW_RELEASE.stableVersion;
export const DEFAULT_NODE_VERSION =
  process.env.OPENCLAW_NODE_VERSION ?? OPENCLAW_RELEASE.nodeVersion;
export const DEFAULT_OPENCLAW_PACKAGE =
  process.env.OPENCLAW_PACKAGE_NAME ?? OPENCLAW_RELEASE.packageName;
