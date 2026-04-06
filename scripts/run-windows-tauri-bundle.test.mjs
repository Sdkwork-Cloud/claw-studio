import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');
const bundleModulePath = path.join(rootDir, 'scripts', 'run-windows-tauri-bundle.mjs');
const bundleModule = await import(pathToFileURL(bundleModulePath).href);
const syntheticWorkspaceRoot = 'D:\\workspace\\claw-studio';

assert.equal(
  typeof bundleModule.createWindowsNsisBridgeReplacements,
  'function',
  'run-windows-tauri-bundle must export createWindowsNsisBridgeReplacements',
);
assert.equal(
  typeof bundleModule.createWindowsNsisSourceReplacements,
  'function',
  'run-windows-tauri-bundle must export createWindowsNsisSourceReplacements',
);
assert.equal(
  typeof bundleModule.rewriteNsisSourcePaths,
  'function',
  'run-windows-tauri-bundle must export rewriteNsisSourcePaths',
);
assert.equal(
  typeof bundleModule.prepareWindowsNsisRetryScript,
  'function',
  'run-windows-tauri-bundle must export prepareWindowsNsisRetryScript',
);
assert.equal(
  typeof bundleModule.buildWindowsTauriBundleCommand,
  'function',
  'run-windows-tauri-bundle must export buildWindowsTauriBundleCommand',
);
assert.equal(
  typeof bundleModule.buildWindowsTauriBundlePreflightCommand,
  'function',
  'run-windows-tauri-bundle must export buildWindowsTauriBundlePreflightCommand',
);
assert.equal(
  typeof bundleModule.ensureWindowsBundleOpenClawAliasRoot,
  'function',
  'run-windows-tauri-bundle must export ensureWindowsBundleOpenClawAliasRoot',
);
assert.equal(
  typeof bundleModule.parseArgs,
  'function',
  'run-windows-tauri-bundle must export parseArgs',
);
assert.throws(
  () => bundleModule.parseArgs(['--profile']),
  /Missing value for --profile/,
  'run-windows-tauri-bundle must reject a missing --profile value',
);
assert.throws(
  () => bundleModule.parseArgs(['--config']),
  /Missing value for --config/,
  'run-windows-tauri-bundle must reject a missing --config value',
);
assert.throws(
  () => bundleModule.parseArgs(['--target']),
  /Missing value for --target/,
  'run-windows-tauri-bundle must reject a missing --target value',
);
assert.throws(
  () => bundleModule.parseArgs(['--bundles']),
  /Missing value for --bundles/,
  'run-windows-tauri-bundle must reject a missing --bundles value',
);
assert.match(
  readFileSync(bundleModulePath, 'utf8'),
  /if \(path\.resolve\(process\.argv\[1\] \?\? ''\) === __filename\) \{\s*try \{\s*await main\(\);\s*\} catch \(error\) \{\s*console\.error\(error instanceof Error \? error\.message : String\(error\)\);\s*process\.exit\(1\);\s*\}\s*\}/s,
  'run-windows-tauri-bundle must wrap the CLI entrypoint with a top-level error handler',
);
assert.match(
  readFileSync(bundleModulePath, 'utf8'),
  /const preflightPlan = buildWindowsTauriBundlePreflightCommand\(/,
  'run-windows-tauri-bundle must derive an OpenClaw preflight plan before tauri build',
);
assert.match(
  readFileSync(bundleModulePath, 'utf8'),
  /runCommand\(\s*preflightPlan\.command,\s*preflightPlan\.args,/s,
  'run-windows-tauri-bundle must execute the OpenClaw verifier before tauri build',
);
assert.match(
  readFileSync(bundleModulePath, 'utf8'),
  /await ensureWindowsBundleOpenClawAliasRoot\([\s\S]*const buildPlan = buildWindowsTauriBundleCommand\(/s,
  'run-windows-tauri-bundle must refresh the Windows OpenClaw alias root before invoking tauri build',
);

const windowsBundleCommand = bundleModule.buildWindowsTauriBundleCommand();
assert.equal(
  windowsBundleCommand.command,
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  'run-windows-tauri-bundle must use the Windows pnpm launcher when it shells out to tauri',
);
assert.deepEqual(
  windowsBundleCommand.args.slice(0, 10),
  [
    '--dir',
    'packages/sdkwork-claw-desktop',
    'exec',
    'tauri',
    'build',
    '--config',
    'src-tauri/tauri.windows.conf.json',
    '--config',
    'src-tauri/generated/tauri.bundle.overlay.json',
    '--bundles',
  ],
  'run-windows-tauri-bundle must invoke tauri from the desktop package with the explicit Windows config and generated bundle overlay config',
);
assert.equal(
  windowsBundleCommand.args[10],
  'nsis',
  'run-windows-tauri-bundle must request nsis-only Windows installers to avoid flaky WiX/MSI packaging on CI runners',
);
const configuredWindowsBundleCommand = bundleModule.buildWindowsTauriBundleCommand({
  bundleTargets: ['nsis', 'msi'],
});
assert.deepEqual(
  configuredWindowsBundleCommand.args.slice(-2),
  ['--bundles', 'nsis,msi'],
  'run-windows-tauri-bundle must allow release profiles to override the Windows bundle target list when a different application requires it',
);
const windowsBundlePreflight = bundleModule.buildWindowsTauriBundlePreflightCommand({
  targetTriple: 'aarch64-pc-windows-msvc',
});
assert.equal(
  windowsBundlePreflight.command,
  process.execPath,
  'run-windows-tauri-bundle must run the OpenClaw verifier through the current Node executable',
);
assert.deepEqual(
  windowsBundlePreflight.args,
  ['scripts/verify-desktop-openclaw-release-assets.mjs'],
  'run-windows-tauri-bundle must invoke the dedicated OpenClaw release asset verifier before tauri build',
);
assert.equal(windowsBundlePreflight.env.SDKWORK_DESKTOP_TARGET, 'aarch64-pc-windows-msvc');
assert.equal(windowsBundlePreflight.env.SDKWORK_DESKTOP_TARGET_PLATFORM, 'windows');
assert.equal(windowsBundlePreflight.env.SDKWORK_DESKTOP_TARGET_ARCH, 'arm64');

const ensuredAliasCalls = [];
await bundleModule.ensureWindowsBundleOpenClawAliasRoot({
  workspaceRootDir: syntheticWorkspaceRoot,
  platform: 'win32',
  resolvePackagedOpenClawResourceDirImpl(workspaceRootDir, platform) {
    ensuredAliasCalls.push(['resolve', workspaceRootDir, platform]);
    return 'D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\release\\openclaw-resource';
  },
  syncWindowsPackagedOpenClawAliasRootImpl(options) {
    ensuredAliasCalls.push([
      'sync',
      options.workspaceRootDir,
      options.packagedResourceDir,
      options.platform,
    ]);
    return Promise.resolve('ok');
  },
});
assert.deepEqual(
  ensuredAliasCalls,
  [
    ['resolve', syntheticWorkspaceRoot, 'windows'],
    [
      'sync',
      syntheticWorkspaceRoot,
      'D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\release\\openclaw-resource',
      'win32',
    ],
  ],
  'run-windows-tauri-bundle must resolve the canonical packaged OpenClaw release root and refresh the Windows alias root before build',
);

const replacements = bundleModule.createWindowsNsisSourceReplacements(syntheticWorkspaceRoot);

assert.equal(replacements.length, 6);
assert.deepEqual(replacements.slice(0, 3), [
  {
    from:
      'D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\bundled\\',
    to: 'D:\\.sdkwork-bc\\claw-studio\\bundled\\',
  },
  {
    from:
      'D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\br\\b\\',
    to: 'D:\\.sdkwork-bc\\claw-studio\\bundled\\',
  },
  {
    from:
      'D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\resources\\openclaw\\',
    to: 'D:\\.sdkwork-bc\\claw-studio\\openclaw\\',
  },
]);
assert.deepEqual(replacements.slice(3), [
  {
    from:
      'D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\dist\\',
    to: 'D:\\.sdkwork-bc\\claw-studio\\web-dist\\',
  },
  {
    from:
      'D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\br\\w\\',
    to: 'D:\\.sdkwork-bc\\claw-studio\\web-dist\\',
  },
  {
    from:
      'D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\br\\o\\',
    to: 'D:\\.sdkwork-bc\\claw-studio\\openclaw\\',
  },
]);

const mirrorResolvedReplacements = bundleModule.createWindowsNsisSourceReplacements(
  syntheticWorkspaceRoot,
  {
    resolvePathTargetImpl(sourcePath) {
      if (sourcePath.endsWith('generated\\bundled')) {
        return 'D:\\.sdkwork-bc\\claw-studio\\bundled-mirrors\\bundled-20260404-abcdef';
      }
      if (sourcePath.endsWith('generated\\br\\b')) {
        return 'D:\\.sdkwork-bc\\claw-studio\\bundled-mirrors\\bundled-20260404-abcdef';
      }
      if (sourcePath.endsWith('generated\\br\\o')) {
        return 'D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\release\\openclaw-resource';
      }
      return null;
    },
  },
);

assert.equal(
  mirrorResolvedReplacements[0].to,
  'D:\\.sdkwork-bc\\claw-studio\\bundled-mirrors\\bundled-20260404-abcdef\\',
  'run-windows-tauri-bundle must prefer the resolved current bundled mirror target when rewriting generated/bundled NSIS source paths',
);
assert.equal(
  mirrorResolvedReplacements[1].to,
  'D:\\.sdkwork-bc\\claw-studio\\bundled-mirrors\\bundled-20260404-abcdef\\',
  'run-windows-tauri-bundle must rewrite bundled bridge NSIS paths to the same resolved current bundled mirror target',
);
assert.equal(
  mirrorResolvedReplacements[5].to,
  'D:\\.sdkwork-bc\\claw-studio\\openclaw\\',
  'run-windows-tauri-bundle must keep OpenClaw bridge rewrites on the stable short mirror root even when generated/br/o resolves to the canonical packaged release directory',
);

const overrideBaseReplacements = bundleModule.createWindowsNsisSourceReplacements(
  syntheticWorkspaceRoot,
  {
    env: {
      SDKWORK_WINDOWS_MIRROR_BASE_DIR: 'D:\\workspace\\claw-studio\\.cache\\short-mirrors',
    },
  },
);

assert.equal(
  overrideBaseReplacements[2].to,
  'D:\\workspace\\claw-studio\\.cache\\short-mirrors\\openclaw\\',
  'run-windows-tauri-bundle must honor the configured Windows mirror base directory when rewriting direct resources/openclaw NSIS source paths',
);
assert.equal(
  overrideBaseReplacements[3].to,
  'D:\\workspace\\claw-studio\\.cache\\short-mirrors\\web-dist\\',
  'run-windows-tauri-bundle must honor the configured Windows mirror base directory when rewriting direct dist NSIS source paths',
);

const sampleInstaller = [
  'File /a "/oname=generated\\\\bundled\\\\bundle-manifest.json" "D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\bundled\\foundation\\components\\bundle-manifest.json"',
  'File /a "/oname=generated\\\\bundled\\\\bundle-manifest.json" "D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\br\\b\\foundation\\components\\bundle-manifest.json"',
  'File /a "/oname=resources\\\\openclaw\\\\manifest.json" "D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\resources\\openclaw\\manifest.json"',
  'File /a "/oname=dist\\\\index.html" "D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\dist\\index.html"',
  'File /a "/oname=dist\\\\index.html" "D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\br\\w\\index.html"',
  'File /a "/oname=resources\\\\openclaw\\\\manifest.json" "D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\br\\o\\manifest.json"',
].join('\n');

const rewrittenInstaller = bundleModule.rewriteNsisSourcePaths(sampleInstaller, replacements);
const preparedInstaller = bundleModule.prepareWindowsNsisRetryScript({
  installerContent: `!define OUTFILE "nsis-output.exe"\n${sampleInstaller}`,
  workspaceRootDir: syntheticWorkspaceRoot,
  outputFilePath: 'D:\\release\\Claw Studio_0.1.0_x64-setup.exe',
});

assert.match(rewrittenInstaller, /D:\\\.sdkwork-bc\\claw-studio\\bundled\\/);
assert.match(rewrittenInstaller, /D:\\\.sdkwork-bc\\claw-studio\\web-dist\\/);
assert.match(rewrittenInstaller, /D:\\\.sdkwork-bc\\claw-studio\\openclaw\\/);
assert.doesNotMatch(rewrittenInstaller, /generated\\bundled\\\\/);
assert.doesNotMatch(rewrittenInstaller, /generated\\br\\w\\\\/);
assert.doesNotMatch(rewrittenInstaller, /generated\\br\\[bo]\\\\/);
assert.doesNotMatch(rewrittenInstaller, /resources\\openclaw\\\\/);
assert.doesNotMatch(rewrittenInstaller, /packages\\sdkwork-claw-desktop\\dist\\\\/);
assert.match(
  preparedInstaller,
  /!define OUTFILE "D:\\release\\Claw Studio_0\.1\.0_x64-setup\.exe"/,
);
assert.match(preparedInstaller, /D:\\\.sdkwork-bc\\claw-studio\\bundled\\/);
assert.match(preparedInstaller, /D:\\\.sdkwork-bc\\claw-studio\\web-dist\\/);
assert.doesNotMatch(preparedInstaller, /!define OUTFILE "nsis-output\.exe"/);

console.log('ok - windows tauri bundle fallback rewrites long NSIS sources to short absolute sources');
