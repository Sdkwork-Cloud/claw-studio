import releaseConfig from '../../../config/openclaw-release.json' with { type: 'json' };

export interface OpenClawReleaseMetadata {
  stableVersion: string;
  nodeVersion: string;
  packageName: string;
}

const metadata = releaseConfig as OpenClawReleaseMetadata;

export const OPENCLAW_RELEASE: Readonly<OpenClawReleaseMetadata> = Object.freeze({
  stableVersion: metadata.stableVersion,
  nodeVersion: metadata.nodeVersion,
  packageName: metadata.packageName,
});

export const DEFAULT_BUNDLED_OPENCLAW_VERSION = OPENCLAW_RELEASE.stableVersion;
export const DEFAULT_BUNDLED_OPENCLAW_NODE_VERSION = OPENCLAW_RELEASE.nodeVersion;
export const DEFAULT_BUNDLED_OPENCLAW_PACKAGE_NAME = OPENCLAW_RELEASE.packageName;
