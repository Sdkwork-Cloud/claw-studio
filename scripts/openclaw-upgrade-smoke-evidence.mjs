#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  smokeDesktopInstallers,
} from './release/smoke-desktop-installers.mjs';
import {
  smokeDesktopPackagedLaunch,
} from './release/smoke-desktop-packaged-launch.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const DEFAULT_RELEASE_ASSETS_DIR = path.join(rootDir, 'artifacts', 'release');

function createPhase(id, status, detail, extra = {}) {
  return {
    id,
    status,
    detail,
    ...extra,
  };
}

function pushBlocker(blockers, message) {
  if (!blockers.includes(message)) {
    blockers.push(message);
  }
}

function normalizeOptionalValue(value) {
  const normalized = String(value ?? '').trim();
  return normalized || '';
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

export async function buildOpenClawUpgradeSmokeEvidence({
  workspaceRootDir = rootDir,
  releaseAssetsDir = path.join(workspaceRootDir, 'artifacts', 'release'),
  platform = process.platform,
  arch = process.arch,
  target = '',
  smokeDesktopInstallersFn = smokeDesktopInstallers,
  smokeDesktopPackagedLaunchFn = smokeDesktopPackagedLaunch,
} = {}) {
  const blockers = [];
  const phases = [];

  let installerSmoke = null;
  try {
    installerSmoke = await smokeDesktopInstallersFn({
      releaseAssetsDir,
      platform,
      arch,
      target,
    });
    phases.push(
      createPhase(
        'installer-smoke',
        'passed',
        'desktop installer smoke passed',
        {
          installerSmoke,
        },
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pushBlocker(blockers, message);
    phases.push(
      createPhase(
        'installer-smoke',
        'failed',
        'desktop installer smoke failed',
        {
          error: message,
        },
      ),
    );
  }

  let packagedLaunchSmoke = null;
  try {
    packagedLaunchSmoke = await smokeDesktopPackagedLaunchFn({
      releaseAssetsDir,
      platform,
      arch,
      target,
    });
    phases.push(
      createPhase(
        'packaged-launch-smoke',
        'passed',
        'desktop packaged launch smoke passed',
        {
          packagedLaunchSmoke,
        },
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pushBlocker(blockers, message);
    phases.push(
      createPhase(
        'packaged-launch-smoke',
        'failed',
        'desktop packaged launch smoke failed',
        {
          error: message,
        },
      ),
    );
  }

  const smokeReady = blockers.length === 0;
  phases.push(
    createPhase(
      'smoke-readiness',
      smokeReady ? 'passed' : 'failed',
      smokeReady
        ? 'desktop OpenClaw upgrade smoke evidence is complete'
        : 'desktop OpenClaw upgrade smoke evidence is incomplete',
    ),
  );

  return {
    workspaceRootDir,
    releaseAssetsDir: path.resolve(releaseAssetsDir),
    platform,
    arch,
    target: normalizeOptionalValue(target) || null,
    smokeReady,
    blockers,
    phases,
    installerSmoke,
    packagedLaunchSmoke,
  };
}

export function parseArgs(argv) {
  const options = {
    releaseAssetsDir: DEFAULT_RELEASE_ASSETS_DIR,
    platform: process.platform,
    arch: process.arch,
    target: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--release-assets-dir') {
      options.releaseAssetsDir = path.resolve(readOptionValue(argv, index, current));
      index += 1;
      continue;
    }
    if (current === '--platform') {
      options.platform = readOptionValue(argv, index, current);
      index += 1;
      continue;
    }
    if (current === '--arch') {
      options.arch = readOptionValue(argv, index, current);
      index += 1;
      continue;
    }
    if (current === '--target') {
      options.target = readOptionValue(argv, index, current);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${current}`);
  }

  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await buildOpenClawUpgradeSmokeEvidence(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.smokeReady) {
    process.exitCode = 1;
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
