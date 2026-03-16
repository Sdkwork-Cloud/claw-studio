import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-claw-shell keeps the V5 route shell surface for staged integrations', () => {
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');

  assert.doesNotMatch(routesSource, /FeaturePlaceholder/);
  assert.match(routesSource, /CodeBox integration coming soon\./);
  assert.match(routesSource, /Api Router integration coming soon\./);
});

runTest('sdkwork-claw-shell keeps the dual-host provider stack', () => {
  const providersSource = read('packages/sdkwork-claw-shell/src/application/providers/AppProviders.tsx');

  assert.match(providersSource, /QueryClientProvider/);
  assert.match(providersSource, /BrowserRouter as Router/);
  assert.match(providersSource, /Toaster/);
  assert.match(providersSource, /ensureI18n/);
});
