import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function extractDesktopLockImporter() {
  const lockSource = read('pnpm-lock.yaml').replace(/\r\n/g, '\n');
  const match = lockSource.match(
    /packages\/sdkwork-claw-desktop:\r?\n([\s\S]*?)(?:\r?\n  packages\/|\r?\npackages:|\r?\nimporters:|$)/,
  );

  if (!match) {
    throw new Error('Unable to locate the packages/sdkwork-claw-desktop importer in pnpm-lock.yaml');
  }

  return match[1];
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
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

async function runAsyncTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-claw-web stays a Vite-only host without a business runtime server', () => {
  const pkg = readJson<{
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>(
    'packages/sdkwork-claw-web/package.json',
  );

  assert.equal(
    pkg.scripts?.dev,
    'node ../../scripts/run-vite-host.mjs serve --host 0.0.0.0 --port 3001 --mode development',
  );
  assert.equal(pkg.dependencies?.express, undefined);
  assert.equal(pkg.dependencies?.['sql.js'], undefined);
  assert.equal(pkg.devDependencies?.tsx, undefined);
  assert.equal(exists('packages/sdkwork-claw-web/server.ts'), false);
});

runTest('sdkwork-claw-web bootstraps shell runtime before mounting the React tree', () => {
  const mainSource = read('packages/sdkwork-claw-web/src/main.tsx');

  assert.match(mainSource, /bootstrapShellRuntime/);
  assert.doesNotMatch(mainSource, /@sdkwork\/claw-i18n/);
  assert.match(
    mainSource,
    /await bootstrapShellRuntime\([\s\S]*?\);[\s\S]*createRoot\(document\.getElementById\('root'\)!\)\.render/,
  );
});

runTest('built-in OpenClaw hosts derive a real version label instead of the bundled placeholder', () => {
  const webStudioSource = read('packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts');
  const desktopStudioSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs',
  );

  assert.doesNotMatch(webStudioSource, /version:\s*'bundled'/);
  assert.match(webStudioSource, /version:\s*DEFAULT_BUNDLED_OPENCLAW_VERSION/);
  assert.doesNotMatch(
    desktopStudioSource,
    /\.unwrap_or_else\(\|\| "bundled"\.to_string\(\)\)/,
  );
  assert.match(desktopStudioSource, /resolve_built_in_openclaw_display_version/);
});

runTest('sdkwork-claw-desktop contains the Tauri runtime package surface', () => {
  const pkg = readJson<{
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
  }>(
    'packages/sdkwork-claw-desktop/package.json',
  );
  const desktopLockImporter = extractDesktopLockImporter();

  assert.ok(exists('packages/sdkwork-claw-desktop/.env.example'));
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/Cargo.toml'));
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json'));
  assert.equal(
    pkg.scripts?.['dev:tauri'],
    'node ../../scripts/run-vite-host.mjs serve --host 127.0.0.1 --port 1426 --strictPort',
  );
  assert.equal(pkg.dependencies?.['@sdkwork/claw-core'], undefined);
  assert.doesNotMatch(desktopLockImporter, /'@sdkwork\/claw-core':/);
});

runTest('sdkwork-claw-server and sdkwork-claw-host-core expose the shared server host foundation', () => {
  const serverPackage = readJson<{
    dependencies?: Record<string, string>;
  }>('packages/sdkwork-claw-server/package.json');
  const hostCorePackage = readJson<{
    name?: string;
  }>('packages/sdkwork-claw-host-core/package.json');

  assert.ok(exists('packages/sdkwork-claw-server/src-host/Cargo.toml'));
  assert.ok(exists('packages/sdkwork-claw-host-core/src-host/Cargo.toml'));
  assert.equal(serverPackage.dependencies?.['@sdkwork/claw-host-core'], 'workspace:*');
  assert.equal(hostCorePackage.name, '@sdkwork/claw-host-core');
});

runTest('shared host runtime contracts freeze endpoint governance and canonical OpenClaw manage resources', () => {
  const manageContractSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/contracts/manage.ts',
  );
  const internalContractSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/contracts/internal.ts',
  );
  const runtimeContractSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts',
  );
  const platformIndexSource = read('packages/sdkwork-claw-infrastructure/src/platform/index.ts');
  const serverBrowserBridgeSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts',
  );

  assert.match(manageContractSource, /export interface ManageHostEndpointRecord/);
  assert.match(manageContractSource, /requestedPort:\s*number/);
  assert.match(manageContractSource, /activePort:\s*number\s*\|\s*null/);
  assert.match(manageContractSource, /getHostEndpoints\(\): Promise<ManageHostEndpointRecord\[]>/);
  assert.match(manageContractSource, /getOpenClawRuntime\(\)/);
  assert.match(manageContractSource, /getOpenClawGateway\(\)/);
  assert.match(manageContractSource, /invokeOpenClawGateway\(/);
  assert.match(internalContractSource, /export type HostPlatformStateStoreProjectionMode/);
  assert.match(internalContractSource, /projectionMode:\s*HostPlatformStateStoreProjectionMode/);
  assert.match(internalContractSource, /'metadataOnly'/);
  assert.match(runtimeContractSource, /export interface RuntimeStartupContext/);
  assert.match(runtimeContractSource, /hostMode:/);
  assert.match(runtimeContractSource, /distributionFamily:/);
  assert.match(runtimeContractSource, /deploymentFamily:/);
  assert.match(runtimeContractSource, /acceleratorProfile\?:/);
  assert.match(platformIndexSource, /ManageHostEndpointRecord/);
  assert.match(platformIndexSource, /RuntimeStartupContext/);
  assert.match(serverBrowserBridgeSource, /desktopCombined/);
  assert.match(serverBrowserBridgeSource, /hostedBrowser:\s*true/);
  assert.match(serverBrowserBridgeSource, /browserBaseUrl/);
  assert.match(serverBrowserBridgeSource, /distributionFamily:\s*config\.distributionFamily/);
  assert.match(serverBrowserBridgeSource, /deploymentFamily:\s*config\.deploymentFamily/);
  assert.match(serverBrowserBridgeSource, /acceleratorProfile:\s*config\.acceleratorProfile/);
});

runTest('desktop and server hosts keep OpenClaw detail parity for built-in, local-external, and remote shapes', () => {
  const desktopStudioSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs',
  );
  const serverStudioSource = read(
    'packages/sdkwork-claw-host-studio/src-host/src/lib.rs',
  );

  assert.match(desktopStudioSource, /fn build_console_access\(/);
  assert.match(
    desktopStudioSource,
    /built_in_instance_detail_exposes_console_access_with_auto_login_url/,
  );
  assert.match(
    desktopStudioSource,
    /local_external_openclaw_detail_reports_ansible_install_method_from_profile_record/,
  );
  assert.match(
    desktopStudioSource,
    /remote_openclaw_instance_detail_does_not_reuse_built_in_local_workbench/,
  );

  assert.match(serverStudioSource, /"consoleAccess": console_access\.unwrap_or\(Value::Null\)/);
  assert.match(
    serverStudioSource,
    /fn build_console_access\(instance: &Value, workbench: Option<&Value>\) -> Option<Value>/,
  );
  assert.match(serverStudioSource, /"exposure": endpoint_exposure_for_instance\(instance\)/);
  assert.match(serverStudioSource, /"auth": endpoint_auth_for_instance\(instance\)/);
  assert.match(
    serverStudioSource,
    /let status = if url\.is_some\(\) \{\s*"ready"\s*\} else \{\s*"configurationRequired"\s*\};/,
  );
  assert.match(serverStudioSource, /let explicit_base_url_override = !built_in/);
  assert.match(serverStudioSource, /let explicit_websocket_url_override = !built_in/);
  assert.match(
    serverStudioSource,
    /default_provider_built_in_openclaw_detail_omits_console_access_without_live_runtime_authority/,
  );
  assert.match(
    serverStudioSource,
    /default_provider_built_in_openclaw_detail_exposes_bundled_console_access_when_control_plane_publishes_runtime_endpoints/,
  );
  assert.match(
    serverStudioSource,
    /default_provider_local_external_openclaw_detail_exposes_console_access_without_workbench/,
  );
  assert.match(
    serverStudioSource,
    /default_provider_remote_openclaw_detail_hides_console_launch_while_runtime_is_offline/,
  );
  assert.match(
    serverStudioSource,
    /default_provider_remote_openclaw_detail_exposes_console_launch_when_runtime_is_online/,
  );
  assert.match(
    serverStudioSource,
    /default_provider_remote_openclaw_detail_downgrades_blank_base_url_endpoint_status/,
  );
  assert.match(
    serverStudioSource,
    /default_provider_does_not_project_built_in_managed_workbench_when_control_plane_is_inactive/,
  );
  assert.match(
    serverStudioSource,
    /fn parse_workbench_openclaw_config_root\(workbench: Option<&Value>\) -> Option<Value>/,
  );
});

runTest('desktop bundled OpenClaw runtime reuses host-core port allocation instead of ad hoc loopback scanning', () => {
  const desktopRuntimeSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs',
  );

  assert.match(desktopRuntimeSource, /sdkwork_claw_host_core::port_allocator::/);
  assert.match(desktopRuntimeSource, /allocate_tcp_listener/);
  assert.match(desktopRuntimeSource, /PortAllocationRequest/);
  assert.match(desktopRuntimeSource, /PortRange::new/);
  assert.doesNotMatch(desktopRuntimeSource, /fn find_available_gateway_port\(/);
  assert.doesNotMatch(desktopRuntimeSource, /fn is_loopback_port_available\(/);
});

runTest('sdkwork-claw-desktop bootstraps shell runtime before mounting the React tree', () => {
  const createDesktopAppSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/createDesktopApp.tsx',
  );
  const desktopBootstrapAppSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  );
  const desktopHostedBridgeSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.ts',
  );
  const desktopBootstrapRuntimeSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopBootstrapRuntime.ts',
  );
  const desktopRuntimeConnectionSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopRuntimeConnection.ts',
  );
  const desktopBackgroundRuntimeReadinessToastSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopBackgroundRuntimeReadinessToast.ts',
  );
  const desktopStartupEvidenceSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopStartupEvidence.ts',
  );
  const connectDesktopRuntimeBody = desktopBootstrapAppSource.match(
    /const connectDesktopRuntime = useEffectEvent\(async \(\) => \{([\s\S]*?)\n  }\);/,
  )?.[1];

  assert.match(createDesktopAppSource, /<DesktopBootstrapApp/);
  assert.match(desktopBootstrapAppSource, /bootstrapShellRuntime/);
  assert.match(desktopBootstrapAppSource, /ROUTE_PATHS/);
  assert.match(desktopBootstrapAppSource, /getAppInfo/);
  assert.match(desktopBootstrapAppSource, /getAppPaths/);
  assert.match(desktopBootstrapAppSource, /writeTextFile/);
  assert.match(desktopBootstrapAppSource, /toast/);
  assert.match(desktopBootstrapAppSource, /BACKGROUND_RUNTIME_READINESS_TOAST_ID/);
  assert.match(desktopBootstrapAppSource, /runDesktopBootstrapSequence/);
  assert.match(desktopBootstrapAppSource, /DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH/);
  assert.match(
    desktopStartupEvidenceSource,
    /export const DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH =\s*'diagnostics\/desktop-startup-evidence\.json';/,
  );
  assert.match(desktopStartupEvidenceSource, /sanitizeDesktopStartupDescriptor/);
  assert.doesNotMatch(desktopStartupEvidenceSource, /browserSessionToken:/);
  assert.match(desktopHostedBridgeSource, /export interface DesktopHostedRuntimeReadinessEvidence/);
  assert.match(desktopHostedBridgeSource, /buildDesktopHostedRuntimeReadinessEvidence/);
  assert.match(desktopHostedBridgeSource, /gatewayWebsocketReady:/);
  assert.match(desktopHostedBridgeSource, /gatewayWebsocketProbeSupported:/);
  assert.match(desktopHostedBridgeSource, /gatewayWebsocketDialable:/);
  assert.match(desktopHostedBridgeSource, /gatewayInvokeCapabilityAvailable:/);
  assert.match(desktopHostedBridgeSource, /builtInInstanceReady:/);
  assert.match(desktopHostedBridgeSource, /ready:/);
  assert.doesNotMatch(desktopBootstrapAppSource, /@sdkwork\/claw-i18n/);
  assert.ok(connectDesktopRuntimeBody);
  assert.match(desktopBootstrapAppSource, /connectDesktopRuntimeDuringStartup/);
  assert.match(
    desktopBackgroundRuntimeReadinessToastSource,
    /export const BACKGROUND_RUNTIME_READINESS_TOAST_ID = 'desktop-background-runtime-readiness';/,
  );
  assert.match(
    desktopBackgroundRuntimeReadinessToastSource,
    /export function resolveBackgroundRuntimeReadinessToastResetPlan\([\s\S]*lastShownSignature:\s*string,[\s\S]*options\?:\s*ResolveBackgroundRuntimeReadinessToastResetPlanOptions,/,
  );
  assert.match(
    desktopBackgroundRuntimeReadinessToastSource,
    /dismissToastId:\s*options\?\.dismissToast \?\? true \? BACKGROUND_RUNTIME_READINESS_TOAST_ID : null/,
  );
  assert.match(
    desktopBackgroundRuntimeReadinessToastSource,
    /toastId:\s*BACKGROUND_RUNTIME_READINESS_TOAST_ID/,
  );
  assert.match(connectDesktopRuntimeBody, /connectDesktopRuntimeDuringStartup\(\{/);
  assert.match(connectDesktopRuntimeBody, /const runId = bootRunIdRef\.current;/);
  assert.match(connectDesktopRuntimeBody, /const isCurrentRun = \(\) => bootRunIdRef\.current === runId;/);
  assert.match(connectDesktopRuntimeBody, /getAppInfo,/);
  assert.match(connectDesktopRuntimeBody, /getAppPaths,/);
  assert.match(
    connectDesktopRuntimeBody,
    /const captureLocalAiProxyEvidence = async \(captureRunId = runId\) => \{/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /const kernelInfo = await getDesktopKernelInfo\(\);/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /const localAiProxy = kernelInfo\?\.localAiProxy \?\? null;/,
  );
  assert.doesNotMatch(
    connectDesktopRuntimeBody,
    /kernelInfo\?\.(?!localAiProxy\b)/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /captureLocalAiProxyEvidence:\s*\(\)\s*=>\s*captureLocalAiProxyEvidence\(runId\),/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /onReadinessReady:\s*async\s*\(\{\s*appInfo,\s*appPaths,\s*readinessSnapshot,\s*localAiProxy\s*\}\)\s*=>\s*\{/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /if \(!isCurrentRun\(\)\) \{\s*logStartup\(\s*'warn',\s*'Ignoring stale hosted runtime readiness success from a previous bootstrap run\.'/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /onReadinessFailed:\s*async\s*\(\{\s*appInfo,\s*appPaths,\s*error,\s*localAiProxy\s*\}\)\s*=>\s*\{/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /if \(!isCurrentRun\(\)\) \{\s*logStartup\(\s*'warn',\s*'Ignoring stale hosted runtime readiness failure from a previous bootstrap run\.'/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /setBackgroundRuntimeReadinessNotification\(\{\s*runId,\s*message:/,
  );
  assert.doesNotMatch(
    connectDesktopRuntimeBody,
    /hostEndpoints\[0\]/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /hostEndpointId:\s*readinessSnapshot\.evidence\.manageEndpointId/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /hostEndpointRequestedPort:\s*readinessSnapshot\.evidence\.manageEndpointRequestedPort/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /hostEndpointActivePort:\s*readinessSnapshot\.evidence\.manageEndpointActivePort/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /hostEndpointBaseUrl:\s*readinessSnapshot\.evidence\.manageBaseUrl/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /builtInInstanceRuntimeKind:\s*builtInInstance\?\.runtimeKind\s*\?\?\s*null/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /builtInInstanceDeploymentMode:\s*builtInInstance\?\.deploymentMode\s*\?\?\s*null/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /builtInInstanceTransportKind:\s*builtInInstance\?\.transportKind\s*\?\?\s*null/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /builtInInstanceStatus:\s*builtInInstance\?\.status\s*\?\?\s*null/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /isDesktopHostedRuntimeReadinessError\(/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /Hosted desktop runtime readiness probe failed in the background\./,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /phase:\s*'runtime-ready'/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /phase:\s*'runtime-readiness-failed'/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /readinessEvidence:\s*readinessError\.snapshot\.evidence/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /runtimeReadinessFailureRef\.current = true/,
  );
  assert.match(
    desktopRuntimeConnectionSource,
    /await Promise\.all\(\[\s*options\.getAppInfo\(\),\s*options\.getAppPaths\(\),\s*\]\)/,
  );
  assert.match(
    desktopRuntimeConnectionSource,
    /Hosted runtime readiness will continue in the background\./,
  );
  assert.match(
    desktopRuntimeConnectionSource,
    /const readinessTask = \(\s*async \(\) => \{/,
  );
  assert.match(
    desktopRuntimeConnectionSource,
    /void readinessTask\.catch\(/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /runDesktopBootstrapSequence\(\{[\s\S]*pathname:\s*window\.location\.pathname[\s\S]*revealStartupWindow[\s\S]*connectDesktopRuntime[\s\S]*bootstrapShellRuntime:\s*async \(\) => \{[\s\S]*await bootstrapShellRuntime\(\);[\s\S]*resolveSidebarStartupRoute[\s\S]*listSidebarRoutePrefetchPaths[\s\S]*prefetchSidebarRoute[\s\S]*prefetchSidebarRoutes[\s\S]*actions:\s*bootstrapStateActions[\s\S]*\}\);/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /if \(!runtimeReadinessFailureRef\.current\) \{\s*void persistStartupEvidence\(\{\s*status:\s*'passed',\s*phase:\s*'shell-mounted'/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /const \[backgroundRuntimeReadinessNotification,\s*setBackgroundRuntimeReadinessNotification\]\s*=\s*[\s\S]*?useState/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /const clearBackgroundRuntimeReadinessFailureState = useEffectEvent\(\(options\?: \{\s*dismissToast\?: boolean;\s*}\) => \{/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /const resetPlan = resolveBackgroundRuntimeReadinessToastResetPlan\(\s*backgroundRuntimeReadinessNotificationSignatureRef\.current,\s*options,\s*\);/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /if \(resetPlan\?\.dismissToastId\) \{\s*toast\.dismiss\(resetPlan\.dismissToastId\);/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /const retryToastId = BACKGROUND_RUNTIME_READINESS_TOAST_ID;/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /clearFailureState:\s*\(\)\s*=>\s*\{\s*clearBackgroundRuntimeReadinessFailureState\(\{\s*dismissToast:\s*false\s*}\);/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /toast\.error\([\s\S]*id:\s*toastPlan\.toastId,/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /toast\.loading\([\s\S]*id:\s*retryToastId,/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /toast\.success\([\s\S]*id:\s*retryToastId,/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /toast\.error\([\s\S]*id:\s*retryToastId,/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /openDesktopShellRoute\(`\$\{ROUTE_PATHS\.INSTANCES\}\/\$\{BUILT_IN_OPENCLAW_INSTANCE_ID\}`\);/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /window\.history\.pushState\(\{\}, '', pathname\);/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /window\.dispatchEvent\(new PopStateEvent\('popstate'\)\);/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /writeTextFile\(\s*DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH/,
  );
  assert.match(
    desktopBootstrapRuntimeSource,
    /await options\.revealStartupWindow\(\);[\s\S]*await options\.connectDesktopRuntime\(\);[\s\S]*const startupRoute = options\.resolveSidebarStartupRoute\(options\.pathname\);[\s\S]*options\.prefetchSidebarRoute\(startupRoute\);[\s\S]*await options\.bootstrapShellRuntime\(\);[\s\S]*options\.actions\.setShouldRenderShell\(true\)/,
  );
  assert.match(
    desktopBootstrapRuntimeSource,
    /let warmSidebarRoutesHandle: number \| null = null;/,
  );
  assert.match(
    desktopBootstrapRuntimeSource,
    /warmSidebarRoutesHandle = options\.scheduleTask\(\(\) => \{[\s\S]*listSidebarRoutePrefetchPaths\(\)[\s\S]*filter\(\(path\) => path !== startupRoute\)/,
  );
  assert.match(
    desktopBootstrapRuntimeSource,
    /const clearWarmSidebarRoutesTask = \(\) => \{[\s\S]*options\.clearScheduledTask\(warmSidebarRoutesHandle\);/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /shouldRenderShell \? \([\s\S]*<DesktopProviders>[\s\S]*<AppProviders onLanguagePreferenceChange=\{handleLanguagePreferenceChange\}>[\s\S]*<DesktopTrayRouteBridge \/>[\s\S]*<MainLayout \/>/,
  );
});

runTest('desktop hosted readiness probe validates live OpenClaw authority instead of route presence alone', () => {
  const desktopHostedBridgeSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.ts',
  );
  const desktopBootstrapAppSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  );
  const internalRouteSource = read(
    'packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs',
  );

  assert.match(desktopHostedBridgeSource, /manage\.getOpenClawRuntime\(\)/);
  assert.match(desktopHostedBridgeSource, /manage\.getOpenClawGateway\(\)/);
  assert.match(
    desktopHostedBridgeSource,
    /manage\.openclaw\.gateway\.invoke/,
  );
  assert.match(desktopHostedBridgeSource, /local-built-in/);
  assert.match(
    desktopHostedBridgeSource,
    /Desktop hosted runtime did not expose the built-in OpenClaw instance baseUrl\./,
  );
  assert.match(
    desktopHostedBridgeSource,
    /Desktop hosted runtime did not expose the built-in OpenClaw instance websocketUrl\./,
  );
  assert.match(
    desktopHostedBridgeSource,
    /Desktop hosted runtime did not accept a WebSocket connection on the managed OpenClaw gateway yet\./,
  );
  assert.match(desktopBootstrapAppSource, /openClawRuntimeLifecycle:/);
  assert.match(desktopBootstrapAppSource, /openClawGatewayLifecycle:/);
  assert.match(internalRouteSource, /resolve_host_platform_lifecycle/);
  assert.doesNotMatch(
    internalRouteSource,
    /lifecycle:\s*"ready"\.to_string\(\),/,
  );
});

runTest('managed OpenClaw config workbench uses gateway authority when the runtime is online while keeping file fallback for offline desktop flows', () => {
  const instanceServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts',
  );
  const instanceServiceSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceService.ts',
  );

  assert.match(
    instanceServiceCoreSource,
    /private async withManagedOpenClawGatewayProbe<TResult>\([\s\S]*shouldProbeOpenClawGateway\(detail\)[\s\S]*const optimisticProbe = !hasReadyOpenClawGateway\(detail\);/,
  );
  assert.match(
    instanceServiceCoreSource,
    /async getManagedOpenClawConfigDocument\(id: string\): Promise<string> \{[\s\S]*withManagedOpenClawGatewayProbe\([\s\S]*openClawGatewayClient\.getConfig\(id\)[\s\S]*serializeOpenClawConfigDocument\(/,
  );
  assert.match(
    instanceServiceCoreSource,
    /async updateManagedOpenClawConfigDocument\(id: string, raw: string\): Promise<void> \{[\s\S]*withManagedOpenClawGatewayProbe\([\s\S]*openClawGatewayClient\.getConfig\(id\)[\s\S]*openClawGatewayClient\.setConfig\(id,\s*\{[\s\S]*baseHash: snapshot\.baseHash[\s\S]*\}\)/,
  );
  assert.match(
    instanceServiceCoreSource,
    /openClawConfigService\.readConfigDocument\(\s*managedConfig\.configPath/,
  );
  assert.match(
    instanceServiceCoreSource,
    /openClawConfigService\.writeConfigDocument\(\s*managedConfig\.configPath,\s*raw/,
  );
  assert.match(
    instanceServiceSource,
    /setConfig:\s*\(instanceId,\s*args\)\s*=> openClawGatewayClient\.setConfig\(instanceId,\s*args\)/,
  );
});

runTest('hosted conversation snapshots do not override managed OpenClaw runtime authority when the built-in runtime is unavailable', () => {
  const serverStudioSource = read(
    'packages/sdkwork-claw-host-studio/src-host/src/lib.rs',
  );
  const studioConversationGatewaySource = read(
    'packages/sdkwork-claw-chat/src/store/studioConversationGateway.ts',
  );
  const authoritativeRouteSource = read(
    'packages/sdkwork-claw-chat/src/services/store/authoritativeInstanceChatRoute.ts',
  );

  assert.match(
    serverStudioSource,
    /does not expose a managed workbench/,
  );
  assert.match(
    studioConversationGatewaySource,
    /resolveAuthoritativeInstanceChatRoute/,
  );
  assert.match(
    authoritativeRouteSource,
    /studio\.getInstanceDetail\(instanceId\)\.catch\(\(\) => null\)/,
  );
  assert.match(
    authoritativeRouteSource,
    /detail\?\.instance\s*\?\?\s*\(await studio\.getInstance\(instanceId\)\)/,
  );
  assert.match(
    studioConversationGatewaySource,
    /return \[\];/,
  );
  assert.doesNotMatch(
    studioConversationGatewaySource,
    /export async function listInstanceConversations\(instanceId: string\): Promise<ChatSession\[]> \{\s*const records = await studio\.listConversations\(instanceId\);/,
  );
});

runTest('server readiness and public workbench routes stay bound to live runtime authority', () => {
  const healthRouteSource = read(
    'packages/sdkwork-claw-server/src-host/src/http/routes/health.rs',
  );
  const apiPublicSource = read(
    'packages/sdkwork-claw-server/src-host/src/http/routes/api_public.rs',
  );
  const serverMainSource = read(
    'packages/sdkwork-claw-server/src-host/src/main.rs',
  );

  assert.match(
    healthRouteSource,
    /manage_openclaw_provider[\s\S]*get_runtime\(updated_at\)/,
  );
  assert.match(
    healthRouteSource,
    /manage_openclaw_provider[\s\S]*get_gateway\(updated_at\)/,
  );
  assert.match(
    healthRouteSource,
    /StatusCode::SERVICE_UNAVAILABLE/,
  );
  assert.match(
    apiPublicSource,
    /studio_public_api_workbench_unavailable/,
  );
  assert.match(
    apiPublicSource,
    /does not expose a managed workbench/,
  );
  assert.match(
    serverMainSource,
    /public_studio_workbench_mutation_routes_reject_built_in_mutations_without_live_runtime_authority/,
  );
});

runTest('sdkwork hosts persist app language through a host callback while the shared runtime bridge exposes the desktop command', () => {
  const shellProvidersSource = read(
    'packages/sdkwork-claw-shell/src/application/providers/AppProviders.tsx',
  );
  const shellLanguageManagerSource = read(
    'packages/sdkwork-claw-shell/src/application/providers/LanguageManager.tsx',
  );
  const desktopBootstrapAppSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  );
  const desktopBridgeSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  );
  const webRuntimeSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/webRuntime.ts',
  );
  const runtimeContractSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts',
  );

  assert.match(runtimeContractSource, /setAppLanguage\(language: RuntimeLanguagePreference\)/);
  assert.match(shellProvidersSource, /onLanguagePreferenceChange\?:/);
  assert.match(shellLanguageManagerSource, /onLanguagePreferenceChange\?:/);
  assert.match(shellLanguageManagerSource, /onLanguagePreferenceChange\?\.\(languagePreference\)/);
  assert.doesNotMatch(shellLanguageManagerSource, /getRuntimePlatform\(\)\.setAppLanguage\(languagePreference\)/);
  assert.match(
    desktopBootstrapAppSource,
    /import \{[\s\S]*getAppInfo,[\s\S]*probeDesktopHostedRuntimeReadiness,[\s\S]*setAppLanguage,[\s\S]*\} from '\.\.\/tauriBridge';/,
  );
  assert.match(desktopBootstrapAppSource, /const handleLanguagePreferenceChange = useEffectEvent\(/);
  assert.match(desktopBootstrapAppSource, /void setAppLanguage\(languagePreference\);/);
  assert.match(desktopBridgeSource, /export async function setAppLanguage/);
  assert.match(desktopBridgeSource, /DESKTOP_COMMANDS\.setAppLanguage/);
  assert.match(
    desktopBridgeSource,
    /export async function probeDesktopHostedRuntimeReadiness\(\s*options\?: \{/,
  );
  assert.match(
    desktopBridgeSource,
    /retryDesktopHostRuntimeOperation\(\{[\s\S]*probeStaticDesktopHostedRuntimeReadiness\(/,
  );
  assert.match(webRuntimeSource, /async setAppLanguage\(_language: RuntimeLanguagePreference\): Promise<void> \{\}/);
});

runTest('sdkwork-claw-desktop wires hub-installer execution through a real Tauri command and progress event', () => {
  const bridgeSource = read('packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts');
  const catalogSource = read('packages/sdkwork-claw-desktop/src/desktop/catalog.ts');
  const commandsMod = read('packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs');
  const bootstrap = read('packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs');
  const tauriConfig = read('packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json');

  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/src/commands/run_hub_install.rs'));
  assert.ok(
    exists(
      'packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/software-registry.yaml',
    ),
  );
  assert.doesNotMatch(
    bridgeSource,
    /Desktop installer runtime is not enabled in the base Tauri foundation\./,
  );
  assert.match(catalogSource, /runHubInstall:\s*'run_hub_install'/);
  assert.match(catalogSource, /hubInstallProgress:\s*'hub-installer:progress'/);
  assert.match(
    bridgeSource,
    /invokeDesktopCommand<HubInstallResult>\(\s*DESKTOP_COMMANDS\.runHubInstall,\s*\{\s*request\s*\}/,
  );
  assert.match(bridgeSource, /subscribeHubInstallProgress/);
  assert.match(commandsMod, /pub mod run_hub_install;/);
  assert.match(
    bootstrap,
    /commands::run_hub_install::run_hub_install/,
  );
  assert.match(tauriConfig, /vendor\/hub-installer\/registry/);
});

runTest('sdkwork-claw-desktop keeps browser mocks out of desktop business bridges', () => {
  const bridgeSource = read('packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts');
  const componentsBridgeSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/componentsBridge.ts',
  );

  assert.doesNotMatch(bridgeSource, /WebKernelPlatform/);
  assert.doesNotMatch(bridgeSource, /WebStoragePlatform/);
  assert.doesNotMatch(bridgeSource, /WebStudioPlatform/);
  assert.doesNotMatch(
    bridgeSource,
    /studioListInstances[\s\S]*webStudioPlatform\.listInstances/,
  );
  assert.doesNotMatch(
    bridgeSource,
    /storageGetText[\s\S]*webStoragePlatform\.getText/,
  );
  assert.doesNotMatch(
    bridgeSource,
    /ensureDesktopKernelRunning[\s\S]*webKernelPlatform\.ensureRunning/,
  );
  assert.doesNotMatch(
    componentsBridgeSource,
    /webComponentPlatform\.(listComponents|controlComponent)/,
  );
});

runTest('sdkwork-claw-desktop seeds a real bundled OpenClaw version in runtime defaults', () => {
  const componentDefaultsSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/components.rs',
  );
  const componentResourcesSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/components.rs',
  );

  assert.match(
    componentDefaultsSource,
    /PackagedComponentDefinition\s*\{\s*id:\s*"openclaw"\.to_string\(\),[\s\S]*?bundled_version:\s*bundled_openclaw_version\(\)\.to_string\(\)/,
  );
  assert.doesNotMatch(componentResourcesSource, /source_component_resource_dir\(\)/);
});

await runAsyncTest('sdkwork-claw-desktop recognizes Tauri v2 runtimes even when withGlobalTauri is disabled', async () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousIsTauri = (globalThis as { isTauri?: unknown }).isTauri;
  const runtimeModule = await import('../packages/sdkwork-claw-desktop/src/desktop/runtime.ts');

  try {
    (globalThis as { window?: unknown }).window = {
      __TAURI_INTERNALS__: {
        invoke() {},
        transformCallback() {
          return 1;
        },
        unregisterCallback() {},
        convertFileSrc() {
          return '';
        },
      },
    };
    delete (globalThis as { isTauri?: unknown }).isTauri;

    assert.equal(
      runtimeModule.isTauriRuntime(),
      true,
      'expected the desktop runtime probe to recognize __TAURI_INTERNALS__',
    );

    (globalThis as { window?: unknown }).window = {};

    assert.equal(
      runtimeModule.isTauriRuntime(),
      false,
      'expected plain web previews without Tauri globals to stay on the web fallback',
    );
  } finally {
    if (typeof previousWindow === 'undefined') {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }

    if (typeof previousIsTauri === 'undefined') {
      delete (globalThis as { isTauri?: unknown }).isTauri;
    } else {
      (globalThis as { isTauri?: unknown }).isTauri = previousIsTauri;
    }
  }
});

await runAsyncTest('sdkwork-claw-desktop waits for a late Tauri runtime before invoking the desktop bridge', async () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousIsTauri = (globalThis as { isTauri?: unknown }).isTauri;
  const runtimeModule = await import('../packages/sdkwork-claw-desktop/src/desktop/runtime.ts');
  let installHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    let desktopCalls = 0;
    (globalThis as { window?: unknown }).window = {};
    delete (globalThis as { isTauri?: unknown }).isTauri;

    installHandle = setTimeout(() => {
      const runtimeWindow = ((globalThis as { window?: Record<string, unknown> }).window ??
        {}) as Record<string, unknown>;
      runtimeWindow.__TAURI_INTERNALS__ = {
        invoke(command: string) {
          desktopCalls += 1;
          assert.equal(command, 'studio_list_instances');
          return Promise.resolve([
            {
              id: 'local-built-in',
              name: 'Local Built-In',
              description: 'Bundled local OpenClaw runtime managed by Claw Studio.',
              runtimeKind: 'openclaw',
              deploymentMode: 'local-managed',
              transportKind: 'openclawGatewayWs',
              status: 'online',
              isBuiltIn: true,
              isDefault: true,
              iconType: 'server',
              version: 'bundled',
              typeLabel: 'Built-In OpenClaw',
              host: '127.0.0.1',
              port: 18796,
              baseUrl: 'http://127.0.0.1:18796',
              websocketUrl: 'ws://127.0.0.1:18796',
              cpu: 0,
              memory: 0,
              totalMemory: 'Unknown',
              uptime: '-',
              capabilities: ['chat', 'health'],
              storage: {
                profileId: 'default-local',
                provider: 'localFile',
                namespace: 'claw-studio',
                database: null,
                connectionHint: null,
                endpoint: null,
              },
              config: {
                port: '18796',
                sandbox: true,
                autoUpdate: true,
                logLevel: 'info',
                corsOrigins: '*',
                workspacePath: null,
                baseUrl: 'http://127.0.0.1:18796',
                websocketUrl: 'ws://127.0.0.1:18796',
                authToken: 'studio-token',
              },
              createdAt: 1,
              updatedAt: 1,
              lastSeenAt: 1,
            },
          ]);
        },
      };
      (globalThis as { window?: unknown }).window = runtimeWindow;
    }, 15);

    const instances = await runtimeModule.invokeDesktopCommand<any[]>(
      'studio_list_instances',
      undefined,
      { operation: 'studio.listInstances' },
    );

    assert.equal(desktopCalls, 1);
    assert.equal(instances[0]?.port, 18796);
    assert.equal(instances[0]?.websocketUrl, 'ws://127.0.0.1:18796');
    assert.equal(instances[0]?.config.authToken, 'studio-token');
  } finally {
    if (installHandle) {
      clearTimeout(installHandle);
    }

    if (typeof previousWindow === 'undefined') {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }

    if (typeof previousIsTauri === 'undefined') {
      delete (globalThis as { isTauri?: unknown }).isTauri;
    } else {
      (globalThis as { isTauri?: unknown }).isTauri = previousIsTauri;
    }
  }
});

await runAsyncTest('sdkwork-claw-desktop strict desktop bridge rejects when Tauri runtime is unavailable', async () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousIsTauri = (globalThis as { isTauri?: unknown }).isTauri;
  const runtimeModule = await import('../packages/sdkwork-claw-desktop/src/desktop/runtime.ts');

  try {
    (globalThis as { window?: unknown }).window = {};
    delete (globalThis as { isTauri?: unknown }).isTauri;

    await assert.rejects(
      runtimeModule.runDesktopOnly('studio.listInstances', async () => []),
      (error: unknown) => {
        assert.equal(error instanceof runtimeModule.DesktopBridgeError, true);
        assert.equal(
          (error as InstanceType<typeof runtimeModule.DesktopBridgeError>).operation,
          'studio.listInstances',
        );
        assert.equal(
          (error as InstanceType<typeof runtimeModule.DesktopBridgeError>).runtime,
          'web',
        );
        assert.match(
          (error as InstanceType<typeof runtimeModule.DesktopBridgeError>).message,
          /Tauri runtime is unavailable/,
        );
        return true;
      },
    );

    await assert.rejects(
      runtimeModule.runDesktopOnly('storage.getText', async () => ({
        profileId: 'default-local',
        namespace: 'claw-studio',
        key: 'openclaw-version',
        value: null,
      })),
      (error: unknown) => {
        assert.equal(error instanceof runtimeModule.DesktopBridgeError, true);
        assert.equal(
          (error as InstanceType<typeof runtimeModule.DesktopBridgeError>).operation,
          'storage.getText',
        );
        return true;
      },
    );

    await assert.rejects(
      runtimeModule.runDesktopOnly('components.list', async () => ({
        defaultStartupComponentIds: [],
        components: [],
      })),
      (error: unknown) => {
        assert.equal(error instanceof runtimeModule.DesktopBridgeError, true);
        assert.equal(
          (error as InstanceType<typeof runtimeModule.DesktopBridgeError>).operation,
          'components.list',
        );
        return true;
      },
    );
  } finally {
    if (typeof previousWindow === 'undefined') {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }

    if (typeof previousIsTauri === 'undefined') {
      delete (globalThis as { isTauri?: unknown }).isTauri;
    } else {
      (globalThis as { isTauri?: unknown }).isTauri = previousIsTauri;
    }
  }
});

await runAsyncTest('sdkwork-claw-infrastructure shares the configured platform bridge across duplicate module instances', async () => {
  const registryUrl = pathToFileURL(
    path.join(root, 'packages/sdkwork-claw-infrastructure/src/platform/registry.ts'),
  ).href;
  const registryCopyA = await import(`${registryUrl}?bridge-copy=a`);
  const registryCopyB = await import(`${registryUrl}?bridge-copy=b`);
  const originalBridge = registryCopyA.getPlatformBridge();
  const sharedInstaller = {
    async listHubInstallCatalog() {
      return [];
    },
    async inspectHubInstall() {
      return {
        ready: true,
        installStatus: 'not-installed',
        issues: [],
        dependencies: [],
        installations: [],
      };
    },
    async runHubDependencyInstall() {
      return { success: true, dependencyReports: [] };
    },
    async runHubInstall() {
      return { success: true, summary: '', stageReports: [], artifactReports: [] };
    },
    async runHubUninstall() {
      return { success: true, targetReports: [] };
    },
    async subscribeHubInstallProgress() {
      return () => {};
    },
  };

  try {
    registryCopyA.configurePlatformBridge({
      installer: sharedInstaller,
    });

    assert.equal(
      registryCopyB.getInstallerPlatform(),
      sharedInstaller,
      'expected duplicate infrastructure module instances to observe the same installer bridge',
    );
  } finally {
    registryCopyA.configurePlatformBridge(originalBridge);
  }
});
