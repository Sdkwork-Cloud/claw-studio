import { globalManifest } from '../../manifests/global';

export function createGlobalDistributionProvider() {
  return {
    manifest: globalManifest,
  };
}
