import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('tauriBridge exposes the desktop bridge without legacy router runtime hooks', () => {
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
  assert.doesNotMatch(tauriBridgeSource, /export async function installApiRouterClientSetup/);
  assert.doesNotMatch(tauriBridgeSource, /export async function getApiRouterRuntimeStatus/);
  assert.doesNotMatch(tauriBridgeSource, /export async function ensureApiRouterRuntimeStarted/);
  assert.doesNotMatch(tauriBridgeSource, /export async function getApiRouterAdminBootstrapSession/);
  assert.match(tauriBridgeSource, /export async function getDesktopKernelStatus/);
  assert.match(tauriBridgeSource, /export async function ensureDesktopKernelRunning/);
  assert.match(tauriBridgeSource, /export async function restartDesktopKernel/);
  assert.match(tauriBridgeSource, /export async function invokeOpenClawGateway/);
  assert.match(tauriBridgeSource, /invokeOpenClawGateway:\s*\(instanceId,\s*request,\s*options\)\s*=>/);
  assert.match(tauriBridgeSource, /getStatus:\s*getDesktopKernelStatus/);
  assert.match(tauriBridgeSource, /ensureRunning:\s*ensureDesktopKernelRunning/);
  assert.match(tauriBridgeSource, /restart:\s*restartDesktopKernel/);
  assert.doesNotMatch(tauriBridgeSource, /installApiRouterClientSetup:/);
  assert.doesNotMatch(tauriBridgeSource, /ensureApiRouterRuntimeStarted:/);
  assert.doesNotMatch(tauriBridgeSource, /getApiRouterAdminBootstrapSession:/);
  assert.doesNotMatch(tauriBridgeSource, /getApiRouterRuntimeStatus:/);
  assert.doesNotMatch(desktopProvidersSource, /DesktopAuthSessionBridge/);
});
