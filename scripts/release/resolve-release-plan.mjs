#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_RELEASE_PROFILE_ID,
  buildDesktopReleaseMatrix,
  resolveReleaseProfile,
} from './release-profiles.mjs';

const __filename = fileURLToPath(import.meta.url);

export function createReleasePlan({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseTag = '',
  gitRef = '',
} = {}) {
  const profile = resolveReleaseProfile(profileId);
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const normalizedGitRef = String(gitRef ?? '').trim()
    || (normalizedReleaseTag ? `refs/tags/${normalizedReleaseTag}` : '');

  if (!normalizedReleaseTag) {
    throw new Error('releaseTag is required to resolve a release plan.');
  }

  return {
    profileId: profile.id,
    productName: profile.productName,
    releaseTag: normalizedReleaseTag,
    gitRef: normalizedGitRef,
    releaseName: `${profile.productName} ${normalizedReleaseTag}`,
    release: {
      ...profile.release,
    },
    desktopMatrix: buildDesktopReleaseMatrix(profile.id),
  };
}

function parseArgs(argv) {
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    releaseTag: '',
    gitRef: '',
    githubOutput: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--profile') {
      options.profileId = next ?? DEFAULT_RELEASE_PROFILE_ID;
      index += 1;
      continue;
    }

    if (token === '--release-tag') {
      options.releaseTag = next ?? '';
      index += 1;
      continue;
    }

    if (token === '--git-ref') {
      options.gitRef = next ?? '';
      index += 1;
      continue;
    }

    if (token === '--github-output') {
      options.githubOutput = true;
    }
  }

  return options;
}

function writeGitHubOutput(plan) {
  const githubOutputPath = String(process.env.GITHUB_OUTPUT ?? '').trim();
  if (!githubOutputPath) {
    throw new Error('GITHUB_OUTPUT is required when --github-output is set.');
  }

  const outputLines = [
    `profile_id=${plan.profileId}`,
    `product_name=${plan.productName}`,
    `release_tag=${plan.releaseTag}`,
    `git_ref=${plan.gitRef}`,
    `release_name=${plan.releaseName}`,
    `manifest_file_name=${plan.release.manifestFileName}`,
    `global_checksums_file_name=${plan.release.globalChecksumsFileName}`,
    `desktop_matrix=${JSON.stringify(plan.desktopMatrix)}`,
  ];
  fs.appendFileSync(githubOutputPath, `${outputLines.join('\n')}\n`, 'utf8');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = createReleasePlan(options);

  if (options.githubOutput) {
    writeGitHubOutput(plan);
    return;
  }

  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
