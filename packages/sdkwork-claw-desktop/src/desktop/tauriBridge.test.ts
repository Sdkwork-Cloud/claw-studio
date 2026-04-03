import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('tauriBridge removes api-router runtime bootstrap helpers while keeping desktop runtime helpers', () => {
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
  assert.doesNotMatch(tauriBridgeSource, /export async function getApiRouterRuntimeStatus/);
  assert.doesNotMatch(tauriBridgeSource, /export async function ensureApiRouterRuntimeStarted/);
  assert.doesNotMatch(tauriBridgeSource, /export async function getApiRouterAdminBootstrapSession/);
  assert.match(tauriBridgeSource, /export async function getDesktopKernelStatus/);
  assert.match(tauriBridgeSource, /export async function ensureDesktopKernelRunning/);
  assert.match(tauriBridgeSource, /export async function restartDesktopKernel/);
  assert.match(tauriBridgeSource, /export async function testLocalAiProxyRoute/);
  assert.match(tauriBridgeSource, /export async function listLocalAiProxyRequestLogs/);
  assert.match(tauriBridgeSource, /export async function listLocalAiProxyMessageLogs/);
  assert.match(tauriBridgeSource, /export async function updateLocalAiProxyMessageCapture/);
  assert.match(tauriBridgeSource, /export async function invokeOpenClawGateway/);
  assert.match(tauriBridgeSource, /invokeOpenClawGateway:\s*\(instanceId,\s*request,\s*options\)\s*=>/);
  assert.match(tauriBridgeSource, /getStatus:\s*getDesktopKernelStatus/);
  assert.match(tauriBridgeSource, /ensureRunning:\s*ensureDesktopKernelRunning/);
  assert.match(tauriBridgeSource, /restart:\s*restartDesktopKernel/);
  assert.match(tauriBridgeSource, /testLocalAiProxyRoute:\s*\(routeId\)\s*=>\s*testLocalAiProxyRoute\(routeId\)/);
  assert.match(tauriBridgeSource, /listLocalAiProxyRequestLogs:\s*\(query\)\s*=>\s*listLocalAiProxyRequestLogs\(query\)/);
  assert.match(tauriBridgeSource, /listLocalAiProxyMessageLogs:\s*\(query\)\s*=>\s*listLocalAiProxyMessageLogs\(query\)/);
  assert.match(tauriBridgeSource, /updateLocalAiProxyMessageCapture:\s*\(enabled\)\s*=>\s*updateLocalAiProxyMessageCapture\(enabled\)/);
  assert.match(tauriBridgeSource, /DESKTOP_COMMANDS\.testLocalAiProxyRoute/);
  assert.match(tauriBridgeSource, /DESKTOP_COMMANDS\.listLocalAiProxyRequestLogs/);
  assert.match(tauriBridgeSource, /DESKTOP_COMMANDS\.listLocalAiProxyMessageLogs/);
  assert.match(tauriBridgeSource, /DESKTOP_COMMANDS\.updateLocalAiProxyMessageCapture/);
  assert.doesNotMatch(desktopProvidersSource, /DesktopAuthSessionBridge/);
});

test('tauriBridge exposes manage rollout and internal host platform contract surfaces', () => {
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const catalogSource = fs.readFileSync(
    path.join(import.meta.dirname, 'catalog.ts'),
    'utf8',
  );
  const infrastructureRoot = path.resolve(import.meta.dirname, '../../../sdkwork-claw-infrastructure/src');
  const manageContractSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/contracts/manage.ts'),
    'utf8',
  );
  const internalContractSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/contracts/internal.ts'),
    'utf8',
  );
  const registrySource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/registry.ts'),
    'utf8',
  );
  const platformIndexSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/index.ts'),
    'utf8',
  );

  assert.match(manageContractSource, /export interface ManageRolloutRecord/);
  assert.match(manageContractSource, /listRollouts\(\): Promise<ManageRolloutListResult>/);
  assert.match(manageContractSource, /export interface ManageRolloutPreview/);
  assert.match(manageContractSource, /previewRollout\(input: PreviewRolloutRequest\)/);
  assert.match(manageContractSource, /startRollout\(rolloutId: string\)/);
  assert.match(internalContractSource, /export interface HostPlatformStatusRecord/);
  assert.match(internalContractSource, /listNodeSessions\(\): Promise<InternalNodeSessionRecord\[]>/);
  assert.match(internalContractSource, /export interface InternalErrorEnvelope/);
  assert.match(internalContractSource, /getHostPlatformStatus\(\): Promise<HostPlatformStatusRecord>/);
  assert.match(catalogSource, /listRollouts:\s*'manage_list_rollouts'/);
  assert.match(catalogSource, /previewRollout:\s*'manage_preview_rollout'/);
  assert.match(catalogSource, /startRollout:\s*'manage_start_rollout'/);
  assert.match(catalogSource, /getHostPlatformStatus:\s*'internal_get_host_platform_status'/);
  assert.match(catalogSource, /listNodeSessions:\s*'internal_list_node_sessions'/);
  assert.match(tauriBridgeSource, /export async function listRollouts/);
  assert.match(tauriBridgeSource, /export async function previewRollout/);
  assert.match(tauriBridgeSource, /export async function startRollout/);
  assert.match(tauriBridgeSource, /export async function getHostPlatformStatus/);
  assert.match(tauriBridgeSource, /export async function listNodeSessions/);
  assert.match(
    tauriBridgeSource,
    /manage:\s*\{[\s\S]*listRollouts:\s*\(\)\s*=>\s*listRollouts\(\),[\s\S]*previewRollout:\s*\(input\)\s*=>\s*previewRollout\(input\),[\s\S]*startRollout:\s*\(rolloutId\)\s*=>\s*startRollout\(rolloutId\)/,
  );
  assert.match(
    tauriBridgeSource,
    /internal:\s*\{[\s\S]*getHostPlatformStatus:\s*\(\)\s*=>\s*getHostPlatformStatus\(\),[\s\S]*listNodeSessions:\s*\(\)\s*=>\s*listNodeSessions\(\)/,
  );
  assert.match(registrySource, /manage:\s*ManagePlatformAPI;/);
  assert.match(registrySource, /internal:\s*InternalPlatformAPI;/);
  assert.match(registrySource, /export const manage:\s*ManagePlatformAPI/);
  assert.match(registrySource, /export const internal:\s*InternalPlatformAPI/);
  assert.match(platformIndexSource, /ManagePlatformAPI/);
  assert.match(platformIndexSource, /InternalPlatformAPI/);
});

test('tauriBridge routes combined host status and rollout preview through desktop commands backed by host-core wiring', async () => {
  const desktopRoot = path.resolve(import.meta.dirname, '../../');
  const cargoSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/Cargo.toml'),
    'utf8',
  );
  const bootstrapSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/app/bootstrap.rs'),
    'utf8',
  );
  const studioCommandsSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/commands/studio_commands.rs'),
    'utf8',
  );
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );

  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<HostPlatformStatusRecord>\(\s*DESKTOP_COMMANDS\.getHostPlatformStatus,[\s\S]*operation:\s*'internal\.getHostPlatformStatus'/,
  );
  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<ManageRolloutPreview>\(\s*DESKTOP_COMMANDS\.previewRollout,\s*\{\s*input\s*\},[\s\S]*operation:\s*'manage\.previewRollout'/,
  );
  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<ManageRolloutRecord>\(\s*DESKTOP_COMMANDS\.startRollout,\s*\{\s*rolloutId\s*\},[\s\S]*operation:\s*'manage\.startRollout'/,
  );
  assert.match(
    cargoSource,
    /sdkwork-claw-host-core\s*=\s*\{\s*path\s*=\s*"\.\.\/\.\.\/sdkwork-claw-host-core\/src-host"\s*\}/,
  );
  assert.match(studioCommandsSource, /pub async fn get_host_platform_status/);
  assert.match(studioCommandsSource, /pub async fn list_rollouts/);
  assert.match(studioCommandsSource, /pub async fn preview_rollout/);
  assert.match(studioCommandsSource, /pub async fn start_rollout/);
  assert.match(studioCommandsSource, /pub async fn list_node_sessions/);
  assert.match(bootstrapSource, /commands::studio_commands::get_host_platform_status/);
  assert.match(bootstrapSource, /commands::studio_commands::list_rollouts/);
  assert.match(bootstrapSource, /commands::studio_commands::preview_rollout/);
  assert.match(bootstrapSource, /commands::studio_commands::start_rollout/);
  assert.match(bootstrapSource, /commands::studio_commands::list_node_sessions/);
});
