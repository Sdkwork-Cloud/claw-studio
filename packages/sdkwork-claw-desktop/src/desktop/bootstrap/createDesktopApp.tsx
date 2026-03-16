import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRoot } from '@sdkwork/claw-shell';
import { DesktopProviders } from '../providers/DesktopProviders';
import { configureDesktopPlatformBridge } from '../tauriBridge';

export function createDesktopApp() {
  configureDesktopPlatformBridge();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <DesktopProviders>
        <AppRoot />
      </DesktopProviders>
    </StrictMode>,
  );
}
