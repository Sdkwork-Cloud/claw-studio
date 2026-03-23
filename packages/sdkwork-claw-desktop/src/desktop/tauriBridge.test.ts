import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('tauriBridge keeps api-router bootstrap session support without desktop auth sync helpers', () => {
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const desktopProvidersSource = fs.readFileSync(
    path.join(import.meta.dirname, 'providers', 'DesktopProviders.tsx'),
    'utf8',
  );

  assert.doesNotMatch(tauriBridgeSource, /export async function syncDesktopAuthSession/);
  assert.doesNotMatch(tauriBridgeSource, /export async function clearDesktopAuthSession/);
  assert.match(tauriBridgeSource, /export async function getApiRouterAdminBootstrapSession/);
  assert.doesNotMatch(desktopProvidersSource, /DesktopAuthSessionBridge/);
});
