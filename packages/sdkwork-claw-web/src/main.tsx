import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapShellRuntime } from '@sdkwork/claw-shell';
import App from './App';

async function mountApp() {
  await bootstrapShellRuntime();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void mountApp();
