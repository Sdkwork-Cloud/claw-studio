import { cnManifest } from '../../manifests/cn';

export function createCnDistributionProvider() {
  return {
    manifest: cnManifest,
  };
}
