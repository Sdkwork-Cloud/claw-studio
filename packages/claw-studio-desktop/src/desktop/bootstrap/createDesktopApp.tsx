import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRoot } from '@sdkwork/claw-studio-shell';
import { DesktopProviders } from '../providers/DesktopProviders';

export function createDesktopApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <DesktopProviders>
        <AppRoot />
      </DesktopProviders>
    </StrictMode>,
  );
}
