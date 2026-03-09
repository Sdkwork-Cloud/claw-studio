import { useEffect, type ReactNode } from 'react';
import type { DistributionId } from '@sdkwork/claw-studio-distribution';
import { getDistributionManifest } from '@sdkwork/claw-studio-distribution';
import { configureDesktopPlatformBridge } from '../tauriBridge';

function resolveDistributionId(): DistributionId {
  const distribution = import.meta.env.VITE_DISTRIBUTION_ID;
  return distribution === 'cn' ? 'cn' : 'global';
}

export function DesktopProviders({ children }: { children: ReactNode }) {
  const manifest = getDistributionManifest(resolveDistributionId());

  useEffect(() => {
    configureDesktopPlatformBridge();
    document.documentElement.setAttribute('data-distribution', manifest.id);
    document.title = manifest.appName;
  }, [manifest.appName, manifest.id]);

  return <>{children}</>;
}
