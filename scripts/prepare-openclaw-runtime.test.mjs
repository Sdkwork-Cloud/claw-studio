import { readlinkSync, symlinkSync } from 'node:fs';
import { copyFile, cp, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildOpenClawPackageInstallArgs,
  buildOpenClawManifest,
  copyDirectoryWithWindowsFallback,
  DEFAULT_OPENCLAW_VERSION,
  DEFAULT_RESOURCE_DIR,
  inspectPreparedOpenClawRuntime,
  prunePreparedOpenClawRuntimeArtifacts,
  prepareOpenClawRuntime,
  prepareOpenClawRuntimeFromStagedDirs,
  prepareOpenClawRuntimeFromSource,
  removeDirectoryWithRetries,
  refreshCachedOpenClawRuntimeArtifacts,
  resolveNodeArchiveExtractionCommand,
  resolveBundledNpmCommand,
  resolveDefaultOpenClawPrepareCacheDir,
  resolveOpenClawPrepareCachePaths,
  resolveOpenClawTarget,
  resolveRequestedOpenClawTarget,
  shouldRetryDirectoryCleanup,
  shouldSyncBundledResourceMirror,
  shouldReusePreparedOpenClawRuntime,
  applyOpenClawRuntimeBootstrapHotfixes,
} from './prepare-openclaw-runtime.mjs';

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'prepare-openclaw-runtime-test-'));
const actualNodeVersion = process.version.replace(/^v/i, '');
const expectedOpenClawVersion = '2026.3.28';
const requiredWorkspaceTemplates = [
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'HEARTBEAT.md',
  'BOOTSTRAP.md',
];
const freshControlUiBundleFixture =
  'var yo=`openclaw.control.settings.v1:`,bo=`openclaw.control.settings.v1`,xo=`openclaw.control.token.v1`,So=`openclaw.control.token.v1:`;function Ao(){return pe()}function jo(e){return e}function Mo(e){return`${So}${jo(e)}`}function Po(e){try{let t=Ao();return t?(t.removeItem(xo),(t.getItem(Mo(e))??``).trim()):``}catch{return``}}function Io(){let{pageUrl:e,effectiveUrl:t}=ko(),n=fe(),r={gatewayUrl:t,token:Po(t),sessionKey:`main`,lastActiveSessionKey:`main`};return r}function XT(e){let t=e,n=e.client,r=qT({gatewayUrl:e.settings.gatewayUrl,serverVersion:e.serverVersion}),i=new bn({url:e.settings.gatewayUrl,token:e.settings.token.trim()?e.settings.token:void 0,password:e.password.trim()?e.password:void 0,clientName:`openclaw-control-ui`,clientVersion:r})}var nE=`/__openclaw/control-ui-config.json`;async function rE(e){if(typeof window>`u`||typeof fetch!=`function`)return;let t=ro(e.basePath??``),n=t?`${t}${nE}`:nE;try{let t=await fetch(n,{method:`GET`,headers:{Accept:`application/json`},credentials:`same-origin`});if(!t.ok)return;let r=await t.json(),i=PT({agentId:r.assistantAgentId??null,name:r.assistantName,avatar:r.assistantAvatar??null});e.assistantName=i.name,e.assistantAvatar=i.avatar,e.assistantAgentId=i.agentId??null,e.serverVersion=r.serverVersion??null}catch{}}';
const brokenPatchedControlUiBundleFixture =
  'var yo=`openclaw.control.settings.v1:`,bo=`openclaw.control.settings.v1`,xo=`openclaw.control.token.v1`,So=`openclaw.control.token.v1:`;function Ao(){return pe()}function jo(e){return e}function Mo(e){return`${So}${jo(e)}`}function Po(e){try{let t=Ao();return t?(t.removeItem(xo),(t.getItem(Mo(e))??``).trim()):``}catch{return``}}function Io(){let{pageUrl:e,effectiveUrl:t}=ko(),n=fe(),r={gatewayUrl:t,token:Po(t),sessionKey:`main`,lastActiveSessionKey:`main`};return r}function XT(e){let t=e,n=e.client,r=qT({gatewayUrl:e.settings.gatewayUrl,serverVersion:e.serverVersion}),i=new bn({url:e.settings.gatewayUrl,token:(()=>{let t=bo(e.settings.gatewayUrl);return t||(e.settings.token.trim()?e.settings.token:void 0)})(),password:e.password.trim()?e.password:void 0,clientName:`openclaw-control-ui`,clientVersion:r})}var nE=`/__openclaw/control-ui-config.json`;async function rE(e){if(typeof window>`u`||typeof fetch!=`function`)return;let t=ro(e.basePath??``),n=t?`${t}${nE}`:nE;try{let t=await fetch(n,{method:`GET`,headers:{Accept:`application/json`},credentials:`same-origin`});if(!t.ok)return;let r=await t.json(),i=PT({agentId:r.assistantAgentId??null,name:r.assistantName,avatar:r.assistantAvatar??null});e.assistantName=i.name,e.assistantAvatar=i.avatar,e.assistantAgentId=i.agentId??null,(()=>{let o=typeof r.gatewayAuthToken===`string`?r.gatewayAuthToken.trim():``;o&&o!==e.settings.token&&(e.settings.token=o,e.applySettings({...e.settings,token:o}))})(),e.serverVersion=r.serverVersion??null}catch{}}';
const missingPatternControlUiBundleFixture =
  'function XT(e){return new bn({url:e.settings.gatewayUrl,token:e.settings.token.trim()?e.settings.token:void 0,password:e.password.trim()?e.password:void 0,clientName:`openclaw-control-ui`})}async function rE(e){return e}';

try {
  if (DEFAULT_OPENCLAW_VERSION !== expectedOpenClawVersion) {
    throw new Error(
      `Expected DEFAULT_OPENCLAW_VERSION=${expectedOpenClawVersion}, received ${DEFAULT_OPENCLAW_VERSION}`,
    );
  }

  if (!shouldSyncBundledResourceMirror({ resourceDir: DEFAULT_RESOURCE_DIR })) {
    throw new Error('Expected the default bundled resource directory to keep syncing the Windows mirror');
  }

  if (shouldSyncBundledResourceMirror({ resourceDir: path.join(tempRoot, 'isolated-resource-runtime') })) {
    throw new Error('Expected temporary bundled resource directories to avoid mutating the shared Windows mirror');
  }

  const sourceRuntimeDir = path.join(tempRoot, 'source-runtime');
  const resourceDir = path.join(tempRoot, 'resource-runtime');
  const target = resolveOpenClawTarget('win32', 'x64');
  const manifest = buildOpenClawManifest({
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });
  const nodePath = path.join(sourceRuntimeDir, manifest.nodeRelativePath.replace(/^runtime[\\/]/, ''));
  const cliPath = path.join(sourceRuntimeDir, manifest.cliRelativePath.replace(/^runtime[\\/]/, ''));
  const openclawPackageJsonPath = path.join(
    sourceRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'package.json',
  );
  const axiosPackageJsonPath = path.join(
    sourceRuntimeDir,
    'package',
    'node_modules',
    'axios',
    'package.json',
  );
  const yamlDirectivesPath = path.join(
    sourceRuntimeDir,
    'package',
    'node_modules',
    'yaml',
    'dist',
    'doc',
    'directives.js',
  );
  const yamlDocumentPath = path.join(
    sourceRuntimeDir,
    'package',
    'node_modules',
    'yaml',
    'dist',
    'doc',
    'Document.js',
  );
  const sourceTemplateDir = path.join(
    sourceRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'docs',
    'reference',
    'templates',
  );
  const sourceGatewayCliBundlePath = path.join(
    sourceRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'dist',
    'gateway-cli-test.js',
  );
  const sourceControlUiBundlePath = path.join(
    sourceRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'dist',
    'control-ui',
    'assets',
    'index-test.js',
  );

  await mkdir(path.dirname(nodePath), { recursive: true });
  await mkdir(path.dirname(cliPath), { recursive: true });
  await mkdir(path.dirname(openclawPackageJsonPath), { recursive: true });
  await mkdir(path.dirname(axiosPackageJsonPath), { recursive: true });
  await mkdir(path.dirname(yamlDirectivesPath), { recursive: true });
  await mkdir(path.dirname(sourceGatewayCliBundlePath), { recursive: true });
  await mkdir(path.dirname(sourceControlUiBundlePath), { recursive: true });
  await mkdir(sourceTemplateDir, { recursive: true });
  await copyFile(process.execPath, nodePath);
  await writeFile(cliPath, 'console.log("openclaw");');
  await writeFile(
    openclawPackageJsonPath,
    `${JSON.stringify({ name: 'openclaw', version: expectedOpenClawVersion }, null, 2)}\n`,
  );
  await writeFile(
    axiosPackageJsonPath,
    `${JSON.stringify({ name: 'axios', version: '1.7.4' }, null, 2)}\n`,
  );
  await writeFile(yamlDirectivesPath, 'export const directives = [];\n');
  await writeFile(yamlDocumentPath, 'export default class Document {}\n');
  await writeFile(
    sourceGatewayCliBundlePath,
    'sendJson$2(res, 200, {assistantName: identity.name,assistantAvatar: avatarValue ?? identity.avatar,assistantAgentId: identity.agentId,serverVersion: resolveRuntimeServiceVersion(process.env)});',
  );
  await writeFile(
    sourceControlUiBundlePath,
    freshControlUiBundleFixture,
  );
  for (const templateName of requiredWorkspaceTemplates) {
    await writeFile(path.join(sourceTemplateDir, templateName), `# ${templateName}\n`);
  }

  const hotfixRuntimeRoot = path.join(tempRoot, 'hotfix-runtime-root');
  const hotfixGatewayCliPath = path.join(
    hotfixRuntimeRoot,
    'package',
    'node_modules',
    'openclaw',
    'dist',
    'gateway-cli-test.js',
  );
  const hotfixControlUiPath = path.join(
    hotfixRuntimeRoot,
    'package',
    'node_modules',
    'openclaw',
    'dist',
    'control-ui',
    'assets',
    'index-test.js',
  );
  await mkdir(path.dirname(hotfixGatewayCliPath), { recursive: true });
  await mkdir(path.dirname(hotfixControlUiPath), { recursive: true });
  await writeFile(
    hotfixGatewayCliPath,
    'sendJson$2(res, 200, {assistantName: identity.name,assistantAvatar: avatarValue ?? identity.avatar,assistantAgentId: identity.agentId,serverVersion: resolveRuntimeServiceVersion(process.env)});',
  );
  await writeFile(
    hotfixControlUiPath,
    freshControlUiBundleFixture,
  );

  await applyOpenClawRuntimeBootstrapHotfixes(hotfixRuntimeRoot);

  const hotfixGatewayCli = await readFile(hotfixGatewayCliPath, 'utf8');
  if (!hotfixGatewayCli.includes('gatewayAuthToken')) {
    throw new Error('Expected gateway bundle hotfix to include gatewayAuthToken in control-ui-config payload');
  }

  const hotfixControlUi = await readFile(hotfixControlUiPath, 'utf8');
  if (!hotfixControlUi.includes('gatewayAuthToken')) {
    throw new Error('Expected control-ui hotfix to hydrate the gateway auth token before connect');
  }
  if (!hotfixControlUi.includes('__OPENCLAW_CONTROL_UI_BOOTSTRAP__')) {
    throw new Error('Expected control-ui hotfix to prefer the synchronous bootstrap token source');
  }
  const bootstrapPoIndex = hotfixControlUi.indexOf('function Po(e){let t=typeof globalThis');
  const fallbackPoIndex = hotfixControlUi.indexOf('try{let t=Ao();return t?');
  if (bootstrapPoIndex < 0 || fallbackPoIndex < 0 || bootstrapPoIndex > fallbackPoIndex) {
    throw new Error('Expected control-ui hotfix to read the bootstrap token before localStorage');
  }
  if (!hotfixControlUi.includes('token:(()=>{let t=Po(e.settings.gatewayUrl);return t||(e.settings.token.trim()?e.settings.token:void 0)})()')) {
    throw new Error('Expected control-ui hotfix to prefer bootstrap-backed token reads during connect');
  }

  const missingPatternRuntimeRoot = path.join(tempRoot, 'missing-pattern-runtime-root');
  const missingPatternGatewayCliPath = path.join(
    missingPatternRuntimeRoot,
    'package',
    'node_modules',
    'openclaw',
    'dist',
    'gateway-cli-missing.js',
  );
  const missingPatternControlUiPath = path.join(
    missingPatternRuntimeRoot,
    'package',
    'node_modules',
    'openclaw',
    'dist',
    'control-ui',
    'assets',
    'index-missing.js',
  );
  await mkdir(path.dirname(missingPatternGatewayCliPath), { recursive: true });
  await mkdir(path.dirname(missingPatternControlUiPath), { recursive: true });
  await writeFile(
    missingPatternGatewayCliPath,
    'sendJson$2(res, 200, {assistantName: identity.name,assistantAvatar: avatarValue ?? identity.avatar,assistantAgentId: identity.agentId,serverVersion: resolveRuntimeServiceVersion(process.env)});',
  );
  await writeFile(
    missingPatternControlUiPath,
    missingPatternControlUiBundleFixture,
  );

  const repairBrokenPatternRuntimeRoot = path.join(tempRoot, 'repair-broken-pattern-runtime-root');
  const repairBrokenGatewayCliPath = path.join(
    repairBrokenPatternRuntimeRoot,
    'package',
    'node_modules',
    'openclaw',
    'dist',
    'gateway-cli-broken.js',
  );
  const repairBrokenControlUiPath = path.join(
    repairBrokenPatternRuntimeRoot,
    'package',
    'node_modules',
    'openclaw',
    'dist',
    'control-ui',
    'assets',
    'index-broken.js',
  );
  await mkdir(path.dirname(repairBrokenGatewayCliPath), { recursive: true });
  await mkdir(path.dirname(repairBrokenControlUiPath), { recursive: true });
  await writeFile(
    repairBrokenGatewayCliPath,
    'sendJson$2(res, 200, {assistantName: identity.name,assistantAvatar: avatarValue ?? identity.avatar,assistantAgentId: identity.agentId,serverVersion: resolveRuntimeServiceVersion(process.env)});',
  );
  await writeFile(
    repairBrokenControlUiPath,
    brokenPatchedControlUiBundleFixture,
  );

  await applyOpenClawRuntimeBootstrapHotfixes(repairBrokenPatternRuntimeRoot);

  const repairedBrokenControlUi = await readFile(repairBrokenControlUiPath, 'utf8');
  if (repairedBrokenControlUi.includes('bo(e.settings.gatewayUrl)')) {
    throw new Error('Expected hotfix repair to replace the broken bo(...) token bootstrap patch');
  }
  if (!repairedBrokenControlUi.includes('Po(e.settings.gatewayUrl)')) {
    throw new Error('Expected hotfix repair to restore the Po(...) token bootstrap helper');
  }

  let missingPatternError = null;
  try {
    await applyOpenClawRuntimeBootstrapHotfixes(missingPatternRuntimeRoot);
  } catch (error) {
    missingPatternError = error;
  }

  if (!(missingPatternError instanceof Error)) {
    throw new Error('Expected OpenClaw bootstrap hotfixes to fail when a required bundle pattern is missing');
  }
  if (!missingPatternError.message.includes('OpenClaw runtime hotfix pattern was not found')) {
    throw new Error(`Unexpected missing-pattern hotfix error: ${missingPatternError.message}`);
  }

  const result = await prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir,
    resourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });

  await stat(path.join(resourceDir, 'runtime'));
  await stat(path.join(resourceDir, 'manifest.json'));
  await stat(path.join(resourceDir, 'runtime', 'package', 'node_modules', 'yaml', 'dist', 'doc', 'directives.js'));
  await stat(path.join(resourceDir, 'runtime', 'package', 'node_modules', 'yaml', 'dist', 'doc', 'Document.js'));
  for (const templateName of requiredWorkspaceTemplates) {
    await stat(
      path.join(
        resourceDir,
        'runtime',
        'package',
        'node_modules',
        'openclaw',
        'docs',
        'reference',
        'templates',
        templateName,
      ),
    );
  }

  const copiedManifest = JSON.parse(await readFile(path.join(resourceDir, 'manifest.json'), 'utf8'));
  if (copiedManifest.runtimeId !== 'openclaw') {
    throw new Error(`Expected runtimeId=openclaw, received ${copiedManifest.runtimeId}`);
  }

  if (copiedManifest.openclawVersion !== expectedOpenClawVersion) {
    throw new Error(`Expected openclawVersion=${expectedOpenClawVersion}, received ${copiedManifest.openclawVersion}`);
  }

  if (result.manifest.cliRelativePath !== 'runtime/package/node_modules/openclaw/openclaw.mjs') {
    throw new Error(`Unexpected cliRelativePath ${result.manifest.cliRelativePath}`);
  }

  const windowsNpm = resolveBundledNpmCommand('C:\\runtime\\node', 'win32');
  if (!windowsNpm.command.toLowerCase().endsWith('cmd.exe')) {
    throw new Error(`Expected Windows command processor path, received ${windowsNpm.command}`);
  }
  if (
    windowsNpm.args.length < 4 ||
    windowsNpm.args[0] !== '/d' ||
    windowsNpm.args[1] !== '/s' ||
    windowsNpm.args[2] !== '/c' ||
    windowsNpm.args[3].toLowerCase() !== 'c:\\runtime\\node\\npm.cmd'
  ) {
    throw new Error(`Expected bundled Windows npm.cmd invocation, received ${windowsNpm.args.join(' ')}`);
  }

  const linuxNpm = resolveBundledNpmCommand('/runtime/node', 'linux');
  if (linuxNpm.command.replaceAll('\\', '/') !== '/runtime/node/bin/npm') {
    throw new Error(`Expected bundled Unix npm path, received ${linuxNpm.command}`);
  }
  if (linuxNpm.args.length !== 0) {
    throw new Error(`Expected no extra Unix npm arguments, received ${linuxNpm.args.join(' ')}`);
  }

  const bundledInstallArgs = buildOpenClawPackageInstallArgs('openclaw@2026.3.28');
  if (!bundledInstallArgs.includes('--omit=peer')) {
    throw new Error(`Expected bundled install args to omit peer dependencies, received ${bundledInstallArgs.join(' ')}`);
  }
  if (!bundledInstallArgs.includes('--ignore-scripts')) {
    throw new Error(`Expected bundled install args to ignore lifecycle scripts, received ${bundledInstallArgs.join(' ')}`);
  }
  if (bundledInstallArgs.includes('--omit=optional')) {
    throw new Error(`Expected bundled install args to keep optional dependencies, received ${bundledInstallArgs.join(' ')}`);
  }
  if (bundledInstallArgs[bundledInstallArgs.length - 1] !== 'openclaw@2026.3.28') {
    throw new Error(`Expected install spec to stay at the end of the install args, received ${bundledInstallArgs.join(' ')}`);
  }

  const requestedWindowsTarget = resolveRequestedOpenClawTarget({
    env: {
      SDKWORK_DESKTOP_TARGET: 'x86_64-pc-windows-msvc',
      SDKWORK_DESKTOP_TARGET_PLATFORM: 'windows',
      SDKWORK_DESKTOP_TARGET_ARCH: 'x64',
    },
  });
  if (requestedWindowsTarget.platformId !== 'windows' || requestedWindowsTarget.archId !== 'x64') {
    throw new Error(
      `Expected release env target resolution to return windows-x64, received ${requestedWindowsTarget.platformId}-${requestedWindowsTarget.archId}`,
    );
  }

  const windowsCacheDir = resolveDefaultOpenClawPrepareCacheDir({
    workspaceRootDir: 'C:\\workspaces\\claw-studio',
    platform: 'win32',
    localAppData: 'C:\\Users\\admin\\AppData\\Local',
    homeDir: 'C:\\Users\\admin',
  });
  if (windowsCacheDir.toLowerCase() !== 'c:\\.sdkwork-bc\\claw-studio\\openclaw-cache') {
    throw new Error(`Expected short Windows cache dir, received ${windowsCacheDir}`);
  }

  const stagedNodeDir = path.join(tempRoot, 'staged-node');
  const stagedPackageDir = path.join(tempRoot, 'staged-package');
  const stagedNodePath = path.join(stagedNodeDir, 'node.exe');
  const stagedCliPath = path.join(stagedPackageDir, 'node_modules', 'openclaw', 'openclaw.mjs');
  const stagedAxiosPackageJsonPath = path.join(
    stagedPackageDir,
    'node_modules',
    'axios',
    'package.json',
  );
  const stagedYamlDirectivesPath = path.join(
    stagedPackageDir,
    'node_modules',
    'yaml',
    'dist',
    'doc',
    'directives.js',
  );
  const stagedYamlDocumentPath = path.join(
    stagedPackageDir,
    'node_modules',
    'yaml',
    'dist',
    'doc',
    'Document.js',
  );
  const stagedTemplateDir = path.join(
    stagedPackageDir,
    'node_modules',
    'openclaw',
    'docs',
    'reference',
    'templates',
  );
  const stagedGatewayCliBundlePath = path.join(
    stagedPackageDir,
    'node_modules',
    'openclaw',
    'dist',
    'gateway-cli-test.js',
  );
  const stagedControlUiBundlePath = path.join(
    stagedPackageDir,
    'node_modules',
    'openclaw',
    'dist',
    'control-ui',
    'assets',
    'index-test.js',
  );
  const stagedResourceDir = path.join(tempRoot, 'staged-resource-runtime');

  await mkdir(path.dirname(stagedNodePath), { recursive: true });
  await mkdir(path.dirname(stagedCliPath), { recursive: true });
  await mkdir(path.dirname(stagedAxiosPackageJsonPath), { recursive: true });
  await mkdir(path.dirname(stagedYamlDirectivesPath), { recursive: true });
  await mkdir(path.dirname(stagedGatewayCliBundlePath), { recursive: true });
  await mkdir(path.dirname(stagedControlUiBundlePath), { recursive: true });
  await mkdir(stagedTemplateDir, { recursive: true });
  await writeFile(stagedNodePath, 'node');
  await writeFile(stagedCliPath, 'console.log(\"openclaw\");');
  await writeFile(
    stagedAxiosPackageJsonPath,
    `${JSON.stringify({ name: 'axios', version: '1.7.4' }, null, 2)}\n`,
  );
  await writeFile(stagedYamlDirectivesPath, 'export const directives = [];\n');
  await writeFile(stagedYamlDocumentPath, 'export default class Document {}\n');
  await writeFile(
    stagedGatewayCliBundlePath,
    'sendJson$2(res, 200, {assistantName: identity.name,assistantAvatar: avatarValue ?? identity.avatar,assistantAgentId: identity.agentId,serverVersion: resolveRuntimeServiceVersion(process.env)});',
  );
  await writeFile(
    stagedControlUiBundlePath,
    freshControlUiBundleFixture,
  );
  for (const templateName of requiredWorkspaceTemplates) {
    await writeFile(path.join(stagedTemplateDir, templateName), `# ${templateName}\n`);
  }

  await prepareOpenClawRuntimeFromStagedDirs({
    nodeSourceDir: stagedNodeDir,
    packageSourceDir: stagedPackageDir,
    resourceDir: stagedResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });

  await stat(path.join(stagedResourceDir, 'runtime', 'node', 'node.exe'));
  await stat(path.join(stagedResourceDir, 'runtime', 'package', 'node_modules', 'openclaw', 'openclaw.mjs'));
  for (const templateName of requiredWorkspaceTemplates) {
    await stat(
      path.join(
        stagedResourceDir,
        'runtime',
        'package',
        'node_modules',
        'openclaw',
        'docs',
        'reference',
        'templates',
        templateName,
      ),
    );
  }

  const reusableResourceDir = path.join(tempRoot, 'reusable-resource-runtime');
  await prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir,
    resourceDir: reusableResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });

  const inspection = await inspectPreparedOpenClawRuntime({
    resourceDir: reusableResourceDir,
    manifest,
  });
  if (!inspection.reusable) {
    throw new Error(`Expected prepared runtime inspection to be reusable, received ${inspection.reason}`);
  }

  const missingTemplateResourceDir = path.join(tempRoot, 'missing-template-resource-runtime');
  await prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir,
    resourceDir: missingTemplateResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });
  await rm(
    path.join(
      missingTemplateResourceDir,
      'runtime',
      'package',
      'node_modules',
      'openclaw',
      'docs',
      'reference',
      'templates',
      'AGENTS.md',
    ),
  );

  const missingTemplateInspection = await inspectPreparedOpenClawRuntime({
    resourceDir: missingTemplateResourceDir,
    manifest,
  });
  if (missingTemplateInspection.reusable) {
    throw new Error('Expected prepared runtime inspection to reject missing workspace templates');
  }

  const versionMismatchResourceDir = path.join(tempRoot, 'version-mismatch-resource-runtime');
  await prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir,
    resourceDir: versionMismatchResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });
  await writeFile(
    path.join(
      versionMismatchResourceDir,
      'runtime',
      'package',
      'node_modules',
      'openclaw',
      'package.json',
    ),
    `${JSON.stringify({ name: 'openclaw', version: '2026.3.24' }, null, 2)}\n`,
  );

  const versionMismatchInspection = await inspectPreparedOpenClawRuntime({
    resourceDir: versionMismatchResourceDir,
    manifest,
  });
  if (versionMismatchInspection.reusable) {
    throw new Error('Expected prepared runtime inspection to reject stale OpenClaw package versions');
  }
  if (versionMismatchInspection.reason !== 'openclaw-version-mismatch') {
    throw new Error(
      `Expected openclaw-version-mismatch, received ${versionMismatchInspection.reason}`,
    );
  }

  if (shouldReusePreparedOpenClawRuntime({ inspection, forcePrepare: true })) {
    throw new Error('Expected forcePrepare=true to disable reuse of an otherwise valid prepared runtime');
  }

  const sentinelPath = path.join(reusableResourceDir, 'runtime', 'package', 'sentinel.txt');
  await writeFile(sentinelPath, 'keep');

  const reused = await prepareOpenClawRuntime({
    resourceDir: reusableResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    openclawPackage: 'openclaw',
    forcePrepare: false,
    fetchImpl: async () => {
      throw new Error('prepareOpenClawRuntime should have reused the existing runtime instead of downloading Node');
    },
    target,
  });

  if (reused.strategy !== 'reused-existing') {
    throw new Error(`Expected an existing runtime reuse strategy, received ${reused.strategy}`);
  }

  const sentinelValue = await readFile(sentinelPath, 'utf8');
  if (sentinelValue !== 'keep') {
    throw new Error(`Expected runtime reuse to preserve existing files, received ${sentinelValue}`);
  }

  const reusableHotfixResourceDir = path.join(tempRoot, 'reusable-hotfix-resource-runtime');
  const reusableHotfixRuntimeDir = path.join(reusableHotfixResourceDir, 'runtime');
  await copyDirectoryWithWindowsFallback(sourceRuntimeDir, reusableHotfixRuntimeDir);
  const reusableHotfixGatewayCliPath = path.join(
    reusableHotfixRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'dist',
    'gateway-cli-test.js',
  );
  const reusableHotfixControlUiPath = path.join(
    reusableHotfixRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'dist',
    'control-ui',
    'assets',
    'index-test.js',
  );
  await mkdir(path.dirname(reusableHotfixGatewayCliPath), { recursive: true });
  await mkdir(path.dirname(reusableHotfixControlUiPath), { recursive: true });
  await writeFile(
    reusableHotfixGatewayCliPath,
    'sendJson$2(res, 200, {assistantName: identity.name,assistantAvatar: avatarValue ?? identity.avatar,assistantAgentId: identity.agentId,serverVersion: resolveRuntimeServiceVersion(process.env)});',
  );
  await writeFile(
    reusableHotfixControlUiPath,
    freshControlUiBundleFixture,
  );
  await writeFile(
    path.join(reusableHotfixResourceDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  const reusableHotfix = await prepareOpenClawRuntime({
    resourceDir: reusableHotfixResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    openclawPackage: 'openclaw',
    forcePrepare: false,
    fetchImpl: async () => {
      throw new Error('prepareOpenClawRuntime should have reused the existing runtime instead of downloading Node');
    },
    target,
  });

  if (reusableHotfix.strategy !== 'reused-existing') {
    throw new Error(`Expected a reused-existing strategy for hotfix validation, received ${reusableHotfix.strategy}`);
  }

  const reusableHotfixControlUi = await readFile(reusableHotfixControlUiPath, 'utf8');
  if (!reusableHotfixControlUi.includes('gatewayAuthToken')) {
    throw new Error('Expected reused runtime hotfix to hydrate the gateway auth token before connect');
  }
  if (!reusableHotfixControlUi.includes('__OPENCLAW_CONTROL_UI_BOOTSTRAP__')) {
    throw new Error('Expected reused runtime hotfix to prefer the synchronous bootstrap token source');
  }
  if (!reusableHotfixControlUi.includes('Po(e.settings.gatewayUrl)')) {
    throw new Error('Expected reused runtime hotfix to keep the repaired Po(...) connect token bootstrap');
  }

  const repairableResourceDir = path.join(tempRoot, 'repairable-resource-runtime');
  const repairManifest = buildOpenClawManifest({
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: actualNodeVersion,
    target,
  });
  await prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir,
    resourceDir: repairableResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: actualNodeVersion,
    target,
  });
  await rm(path.join(repairableResourceDir, 'manifest.json'));

  const repairInspection = await inspectPreparedOpenClawRuntime({
    resourceDir: repairableResourceDir,
    manifest: repairManifest,
  });
  if (!repairInspection.reusable) {
    throw new Error(
      `Expected repaired runtime inspection to be reusable before manifest repair, received ${JSON.stringify(repairInspection)}`,
    );
  }

  await rm(path.join(repairableResourceDir, 'manifest.json'));

  const repaired = await prepareOpenClawRuntime({
    resourceDir: repairableResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: actualNodeVersion,
    openclawPackage: 'openclaw',
    forcePrepare: false,
    fetchImpl: async () => {
      throw new Error('prepareOpenClawRuntime should have repaired the missing manifest instead of downloading Node');
    },
    target,
  });

  if (repaired.strategy !== 'repaired-existing-manifest') {
    throw new Error(`Expected a repaired-existing-manifest strategy, received ${repaired.strategy}`);
  }

  const repairedManifest = JSON.parse(
    await readFile(path.join(repairableResourceDir, 'manifest.json'), 'utf8'),
  );
  if (repairedManifest.openclawVersion !== expectedOpenClawVersion) {
    throw new Error(
      `Expected repaired manifest to restore openclawVersion=${expectedOpenClawVersion}, received ${repairedManifest.openclawVersion}`,
    );
  }

  const cacheDir = path.join(tempRoot, 'persistent-cache');
  const cachePaths = resolveOpenClawPrepareCachePaths({
    cacheDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });
  await mkdir(path.dirname(cachePaths.cachedArchivePath), { recursive: true });
  await writeFile(cachePaths.cachedArchivePath, 'cached-archive');
  await cp(path.join(sourceRuntimeDir, 'node'), cachePaths.nodeCacheDir, { recursive: true });
  await cp(path.join(sourceRuntimeDir, 'package'), cachePaths.packageCacheDir, { recursive: true });

  const cachePreparedResourceDir = path.join(tempRoot, 'cache-prepared-resource-runtime');
  const cached = await prepareOpenClawRuntime({
    resourceDir: cachePreparedResourceDir,
    cacheDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    openclawPackage: 'openclaw',
    forcePrepare: false,
    fetchImpl: async () => {
      throw new Error('prepareOpenClawRuntime should have reused cached artifacts instead of downloading Node');
    },
    target,
  });

  if (cached.strategy !== 'prepared-cache') {
    throw new Error(`Expected a prepared-cache strategy, received ${cached.strategy}`);
  }

  await stat(path.join(cachePreparedResourceDir, 'runtime', 'node', 'node.exe'));
  await stat(
    path.join(
      cachePreparedResourceDir,
      'runtime',
      'package',
      'node_modules',
      'openclaw',
      'openclaw.mjs',
    ),
  );

  const windowsExtractor = resolveNodeArchiveExtractionCommand({
    archivePath: 'C:\\temp\\node-v22.16.0-win-x64.zip',
    extractRoot: 'C:\\temp\\extract-root',
    target,
    hasTarCommand: true,
  });
  if (windowsExtractor.command.toLowerCase() !== 'tar') {
    throw new Error(`Expected Windows zip extraction to prefer tar, received ${windowsExtractor.command}`);
  }

  if (!shouldRetryDirectoryCleanup(Object.assign(new Error('directory not empty'), { code: 'ENOTEMPTY' }))) {
    throw new Error('Expected ENOTEMPTY cleanup failures to be retried');
  }

  if (shouldRetryDirectoryCleanup(Object.assign(new Error('missing'), { code: 'ENOENT' }))) {
    throw new Error('Expected ENOENT cleanup failures to skip retries');
  }

  let transientCleanupAttempts = 0;
  await removeDirectoryWithRetries(path.join(tempRoot, 'transient-cleanup'), {
    retryCount: 3,
    retryDelayMs: 0,
    logger: () => {},
    removeImpl: async () => {
      transientCleanupAttempts += 1;
      if (transientCleanupAttempts === 1) {
        throw Object.assign(new Error('directory not empty'), { code: 'ENOTEMPTY' });
      }
    },
  });

  if (transientCleanupAttempts !== 2) {
    throw new Error(`Expected transient cleanup to retry once, received ${transientCleanupAttempts} attempts`);
  }

  let fatalCleanupAttempts = 0;
  let fatalCleanupError;
  try {
    await removeDirectoryWithRetries(path.join(tempRoot, 'fatal-cleanup'), {
      retryCount: 3,
      retryDelayMs: 0,
      logger: () => {},
      removeImpl: async () => {
        fatalCleanupAttempts += 1;
        throw Object.assign(new Error('bad cleanup'), { code: 'EINVAL' });
      },
    });
    throw new Error('Expected invalid cleanup failures to surface without retries');
  } catch (error) {
    fatalCleanupError = error;
  }

  if (fatalCleanupAttempts !== 1) {
    throw new Error(`Expected fatal cleanup failures to avoid retries, received ${fatalCleanupAttempts} attempts`);
  }

  if (!(fatalCleanupError instanceof Error) || fatalCleanupError.message !== 'bad cleanup') {
    throw new Error(`Expected fatal cleanup error to be preserved, received ${String(fatalCleanupError)}`);
  }

  const aliasedNodeCacheDir = path.join(tempRoot, 'aliased-node-cache');
  const aliasedPackageSourceDir = path.join(tempRoot, 'aliased-package-source');
  const aliasedPackageCacheDir = path.join(tempRoot, 'aliased-package-cache');
  const aliasedNodeExecutable = path.join(aliasedNodeCacheDir, 'node.exe');
  const aliasedPackageJson = path.join(aliasedPackageSourceDir, 'package.json');

  await mkdir(path.dirname(aliasedNodeExecutable), { recursive: true });
  await mkdir(path.dirname(aliasedPackageJson), { recursive: true });
  await writeFile(aliasedNodeExecutable, 'node');
  await writeFile(aliasedPackageJson, '{"name":"openclaw-runtime-cache"}\n');

  await refreshCachedOpenClawRuntimeArtifacts({
    nodeSourceDir: aliasedNodeCacheDir,
    packageSourceDir: aliasedPackageSourceDir,
    cachePaths: {
      nodeCacheDir: aliasedNodeCacheDir,
      packageCacheDir: aliasedPackageCacheDir,
    },
  });

  await stat(aliasedNodeExecutable);
  await stat(path.join(aliasedPackageCacheDir, 'package.json'));

  let fallbackCopyAttempts = 0;
  await copyDirectoryWithWindowsFallback('C:\\temp\\source-package', 'C:\\temp\\target-package', {
    platform: 'win32',
    copyImpl: async () => {
      throw Object.assign(new Error('copy failed'), { code: 'ENOENT' });
    },
    robocopyImpl: async (sourceDir, targetDir) => {
      fallbackCopyAttempts += 1;
      if (sourceDir !== 'C:\\temp\\source-package' || targetDir !== 'C:\\temp\\target-package') {
        throw new Error(`Expected Windows fallback copy paths to be preserved, received ${sourceDir} -> ${targetDir}`);
      }
    },
  });

  if (fallbackCopyAttempts !== 1) {
    throw new Error(`Expected Windows fallback copy to run once, received ${fallbackCopyAttempts}`);
  }

  let nonWindowsCopyError;
  try {
    await copyDirectoryWithWindowsFallback('/tmp/source-package', '/tmp/target-package', {
      platform: 'linux',
      copyImpl: async () => {
        throw Object.assign(new Error('copy failed'), { code: 'ENOENT' });
      },
      robocopyImpl: async () => {
        throw new Error('Non-Windows copies should not invoke robocopy fallback');
      },
    });
    throw new Error('Expected non-Windows copy failures to surface without fallback');
  } catch (error) {
    nonWindowsCopyError = error;
  }

  if (!(nonWindowsCopyError instanceof Error) || nonWindowsCopyError.message !== 'copy failed') {
    throw new Error(`Expected non-Windows copy failure to be preserved, received ${String(nonWindowsCopyError)}`);
  }

  const prunedNodeDir = path.join(tempRoot, 'pruned-node');
  const prunedPackageDir = path.join(tempRoot, 'pruned-package');
  await mkdir(path.join(prunedNodeDir, 'node_modules', 'npm', 'bin'), { recursive: true });
  await mkdir(path.join(prunedPackageDir, 'node_modules', 'openclaw', 'docs'), { recursive: true });
  await mkdir(
    path.join(prunedPackageDir, 'node_modules', 'openclaw', 'docs', 'reference', 'templates'),
    { recursive: true },
  );
  await mkdir(path.join(prunedPackageDir, 'node_modules', 'openclaw', 'skills', 'coding-agent'), {
    recursive: true,
  });
  await mkdir(path.join(prunedPackageDir, 'node_modules', 'dep-with-tests', 'tests'), {
    recursive: true,
  });
  await mkdir(path.join(prunedPackageDir, 'node_modules', 'dep-with-examples', 'examples'), {
    recursive: true,
  });
  await mkdir(path.join(prunedPackageDir, 'node_modules', 'dep-with-types', 'dist'), {
    recursive: true,
  });
  await writeFile(path.join(prunedNodeDir, 'CHANGELOG.md'), '# changelog\n');
  await writeFile(path.join(prunedNodeDir, 'LICENSE'), 'license\n');
  await writeFile(path.join(prunedNodeDir, 'README.md'), '# readme\n');
  await writeFile(path.join(prunedNodeDir, 'install_tools.bat'), '@echo off\r\n');
  await writeFile(path.join(prunedNodeDir, 'node.exe'), 'node');
  await writeFile(path.join(prunedNodeDir, 'nodevars.bat'), '@echo off\r\n');
  await writeFile(path.join(prunedNodeDir, 'npm.cmd'), 'npm');
  await writeFile(path.join(prunedNodeDir, 'corepack.cmd'), 'corepack');
  await writeFile(path.join(prunedNodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'), 'npm');
  await writeFile(
    path.join(prunedPackageDir, 'node_modules', 'openclaw', 'package.json'),
    '{"name":"openclaw","version":"2026.3.28"}\n',
  );
  await writeFile(path.join(prunedPackageDir, 'node_modules', 'openclaw', 'openclaw.mjs'), 'console.log("openclaw");\n');
  await writeFile(path.join(prunedPackageDir, 'node_modules', 'openclaw', 'docs', 'guide.md'), '# guide\n');
  await writeFile(
    path.join(prunedPackageDir, 'node_modules', 'openclaw', 'skills', 'coding-agent', 'SKILL.md'),
    '# skill\n',
  );
  for (const templateName of requiredWorkspaceTemplates) {
    await writeFile(
      path.join(
        prunedPackageDir,
        'node_modules',
        'openclaw',
        'docs',
        'reference',
        'templates',
        templateName,
      ),
      `# ${templateName}\n`,
    );
  }
  await writeFile(path.join(prunedPackageDir, 'node_modules', 'dep-with-tests', 'tests', 'spec.txt'), 'spec\n');
  await writeFile(path.join(prunedPackageDir, 'node_modules', 'dep-with-examples', 'examples', 'demo.txt'), 'demo\n');
  await writeFile(path.join(prunedPackageDir, 'node_modules', 'dep-with-types', 'dist', 'index.js.map'), '{}\n');
  await writeFile(path.join(prunedPackageDir, 'node_modules', 'dep-with-types', 'dist', 'index.d.ts'), 'export {};\n');
  await writeFile(path.join(prunedPackageDir, 'node_modules', 'dep-with-types', 'README.md'), '# readme\n');

  await prunePreparedOpenClawRuntimeArtifacts({
    nodeSourceDir: prunedNodeDir,
    packageSourceDir: prunedPackageDir,
  });

  await stat(path.join(prunedNodeDir, 'node.exe'));
  await stat(path.join(prunedPackageDir, 'node_modules', 'openclaw', 'openclaw.mjs'));
  await stat(path.join(prunedPackageDir, 'node_modules', 'openclaw', 'package.json'));
  await stat(path.join(prunedPackageDir, 'node_modules', 'openclaw', 'skills', 'coding-agent', 'SKILL.md'));
  for (const templateName of requiredWorkspaceTemplates) {
    await stat(
      path.join(
        prunedPackageDir,
        'node_modules',
        'openclaw',
        'docs',
        'reference',
        'templates',
        templateName,
      ),
    );
  }

  for (const removedPath of [
    path.join(prunedNodeDir, 'CHANGELOG.md'),
    path.join(prunedNodeDir, 'LICENSE'),
    path.join(prunedNodeDir, 'README.md'),
    path.join(prunedNodeDir, 'install_tools.bat'),
    path.join(prunedNodeDir, 'nodevars.bat'),
    path.join(prunedNodeDir, 'npm.cmd'),
    path.join(prunedNodeDir, 'corepack.cmd'),
    path.join(prunedNodeDir, 'node_modules'),
    path.join(prunedPackageDir, 'node_modules', 'openclaw', 'docs', 'guide.md'),
    path.join(prunedPackageDir, 'node_modules', 'dep-with-tests', 'tests'),
    path.join(prunedPackageDir, 'node_modules', 'dep-with-examples', 'examples'),
    path.join(prunedPackageDir, 'node_modules', 'dep-with-types', 'dist', 'index.js.map'),
    path.join(prunedPackageDir, 'node_modules', 'dep-with-types', 'dist', 'index.d.ts'),
    path.join(prunedPackageDir, 'node_modules', 'dep-with-types', 'README.md'),
  ]) {
    if ((await stat(removedPath).then(() => true).catch(() => false)) === true) {
      throw new Error(`Expected pruning to remove ${removedPath}`);
    }
  }

  const symlinkSourceDir = path.join(tempRoot, 'symlink-source');
  const symlinkTargetDir = path.join(tempRoot, 'symlink-target');
  const symlinkShimTarget = path.join(
    symlinkSourceDir,
    'lib',
    'node_modules',
    'corepack',
    'dist',
    'corepack.js',
  );
  const symlinkShimPath = path.join(symlinkSourceDir, 'bin', 'corepack');

  await mkdir(path.dirname(symlinkShimTarget), { recursive: true });
  await mkdir(path.dirname(symlinkShimPath), { recursive: true });
  await writeFile(symlinkShimTarget, 'console.log("corepack");\n');
  symlinkSync('../lib/node_modules/corepack/dist/corepack.js', symlinkShimPath);

  await copyDirectoryWithWindowsFallback(symlinkSourceDir, symlinkTargetDir, {
    platform: 'linux',
  });

  const copiedSymlinkPath = path.join(symlinkTargetDir, 'bin', 'corepack');
  const copiedSymlinkTarget = readlinkSync(copiedSymlinkPath).replaceAll('\\', '/');
  if (copiedSymlinkTarget !== '../lib/node_modules/corepack/dist/corepack.js') {
    throw new Error(`Expected copied symlink to preserve its relative target, received ${copiedSymlinkTarget}`);
  }

  await stat(path.join(symlinkTargetDir, 'bin', copiedSymlinkTarget));

  console.log('ok - bundled OpenClaw runtime preparation copies runtime files and writes manifest');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
