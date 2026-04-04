import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
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

runTest('sdkwork-claw-agent stays local and exposes a dedicated market surface', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-agent/package.json',
  );
  const indexSource = read('packages/sdkwork-claw-agent/src/index.ts');
  const entrySource = read('packages/sdkwork-claw-agent/src/AgentMarket.tsx');
  const pageSource = read('packages/sdkwork-claw-agent/src/pages/AgentMarket.tsx');
  const servicesIndexSource = read('packages/sdkwork-claw-agent/src/services/index.ts');

  assert.ok(exists('packages/sdkwork-claw-agent/src/AgentMarket.tsx'));
  assert.ok(exists('packages/sdkwork-claw-agent/src/pages/AgentMarket.tsx'));
  assert.ok(exists('packages/sdkwork-claw-agent/src/services/agentCatalog.ts'));
  assert.ok(exists('packages/sdkwork-claw-agent/src/services/agentCatalog.test.ts'));
  assert.ok(exists('packages/sdkwork-claw-agent/src/services/agentInstallService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-agent']);
  assert.equal(pkg.dependencies?.['@sdkwork/claw-core'], 'workspace:*');
  assert.equal(pkg.dependencies?.['@sdkwork/claw-infrastructure'], 'workspace:*');
  assert.equal(pkg.dependencies?.['@sdkwork/claw-types'], 'workspace:*');
  assert.match(indexSource, /\.\/AgentMarket/);
  assert.match(indexSource, /\.\/services/);
  assert.match(entrySource, /lazy\(\(\) =>/);
  assert.match(entrySource, /\.\/pages\/AgentMarket/);
  assert.match(servicesIndexSource, /\.\/agentCatalog\.ts/);
  assert.match(servicesIndexSource, /\.\/agentInstallService\.ts/);
  assert.match(pageSource, /agentInstallService\.listInstallTargets/);
  assert.match(pageSource, /createAgentMarketCatalog/);
  assert.match(pageSource, /useSearchParams/);
  assert.match(pageSource, /instanceId/);
  assert.match(pageSource, /resolvePreferredTargetId/);
  assert.match(pageSource, /sortTargetsForTemplate/);
  assert.match(pageSource, /catalog\.categories\.map/);
  assert.match(pageSource, /agentMarket\.searchPlaceholder/);
  assert.doesNotMatch(pageSource, /agentMarket\.hero\./);
  assert.doesNotMatch(pageSource, /agentMarket\.metrics\./);
  assert.doesNotMatch(pageSource, /MetricCard/);
  assert.doesNotMatch(pageSource, /agentMarket\.section\.title/);
  assert.doesNotMatch(pageSource, /agentMarket\.section\.description/);
  assert.match(pageSource, /agentMarket\.actions\.installToInstance/);
  assert.match(pageSource, /agentMarket\.categories\.\$\{template\.category\}/);
  assert.match(pageSource, /agentMarket\.templates\.\$\{template\.id\}\.name/);
  assert.match(pageSource, /agentMarket\.templates\.\$\{template\.id\}\.summary/);
  assert.match(pageSource, /agentMarket\.templates\.\$\{template\.id\}\.description/);
  assert.match(pageSource, /agentMarket\.templates\.\$\{template\.id\}\.focus/);
  assert.match(pageSource, /agentMarket\.templates\.\$\{template\.id\}\.capabilities\.\$\{index\}/);
  assert.match(pageSource, /agentMarket\.labels\.installed/);
  assert.match(pageSource, /agentMarket\.labels\.builtIn/);
  assert.match(pageSource, /type: target\.typeLabel/);
  assert.match(pageSource, /agentMarket\.error\.title/);
  assert.match(pageSource, /agentMarket\.error\.description/);
  assert.match(pageSource, /agentMarket\.error\.retry/);
});

runTest('sdkwork-claw-agent installs standard OpenClaw agent workspaces and enables multi-agent collaboration', () => {
  const catalogSource = read('packages/sdkwork-claw-agent/src/services/agentCatalog.ts');
  const installServiceSource = read('packages/sdkwork-claw-agent/src/services/agentInstallService.ts');

  assert.match(catalogSource, /'AGENTS\.md'/);
  assert.match(catalogSource, /'BOOT\.md'/);
  assert.match(catalogSource, /'SOUL\.md'/);
  assert.match(catalogSource, /'TOOLS\.md'/);
  assert.match(catalogSource, /'IDENTITY\.md'/);
  assert.match(catalogSource, /'USER\.md'/);
  assert.match(catalogSource, /'HEARTBEAT\.md'/);
  assert.match(catalogSource, /'BOOTSTRAP\.md'/);
  assert.match(catalogSource, /'MEMORY\.md'/);
  assert.match(catalogSource, /memory\/YYYY-MM-DD\.md/);
  assert.match(catalogSource, /skip heartbeat API calls/);
  assert.doesNotMatch(catalogSource, /HEARTBEAT_OK/);
  assert.match(installServiceSource, /studio\.listInstances/);
  assert.match(installServiceSource, /openClawConfigService\.resolveInstanceConfigPath/);
  assert.match(installServiceSource, /openClawConfigService\.resolveAgentPaths/);
  assert.match(installServiceSource, /Promise\.allSettled/);
  assert.match(installServiceSource, /buildAgentWorkspaceFiles/);
  assert.match(installServiceSource, /ensureAgentWorkspaceSkeleton/);
  assert.match(installServiceSource, /buildCoordinatorWorkspaceFiles/);
  assert.match(installServiceSource, /isBuiltIn/);
  assert.match(installServiceSource, /openClawConfigService\.saveAgent/);
  assert.match(installServiceSource, /openClawConfigService\.configureMultiAgentSupport/);
  assert.match(installServiceSource, /coordinatorAgentId: 'main'/);
  assert.match(installServiceSource, /maxConcurrent: 4/);
  assert.match(installServiceSource, /maxSpawnDepth: 2/);
  assert.match(installServiceSource, /maxChildrenPerAgent: 5/);
  assert.doesNotMatch(installServiceSource, /fetch\(/);
  assert.doesNotMatch(installServiceSource, /axios\./);
});

runTest('sdkwork-claw-agent parity checks use a dedicated tsx runner for OpenClaw install flows', () => {
  const workspacePackageJson = read('package.json');
  const installServiceTestSource = read(
    'packages/sdkwork-claw-agent/src/services/agentInstallService.test.ts',
  );

  assert.match(installServiceTestSource, /@sdkwork\/claw-core/);
  assert.match(
    workspacePackageJson,
    /"check:sdkwork-agent"\s*:\s*"node scripts\/run-sdkwork-agent-check\.mjs"/,
  );
  assert.ok(exists('scripts/run-sdkwork-agent-check.mjs'));
});
