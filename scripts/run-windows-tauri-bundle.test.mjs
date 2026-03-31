import assert from 'node:assert/strict';
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

const windowsBundleCommand = bundleModule.buildWindowsTauriBundleCommand();
assert.equal(
  windowsBundleCommand.command,
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  'run-windows-tauri-bundle must use the Windows pnpm launcher when it shells out to tauri',
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
      'D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\resources\\openclaw-runtime\\',
    to: 'D:\\.sdkwork-bc\\claw-studio\\openclaw-runtime\\',
  },
]);
assert.deepEqual(replacements.slice(3), [
  {
    from:
      'D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\br\\o\\',
    to: 'D:\\.sdkwork-bc\\claw-studio\\openclaw-runtime\\',
  },
  {
    from:
      'D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\resources\\sdkwork-api-router-runtime\\',
    to: 'D:\\.sdkwork-bc\\claw-studio\\sdkwork-api-router-runtime\\',
  },
  {
    from:
      'D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\br\\a\\',
    to: 'D:\\.sdkwork-bc\\claw-studio\\sdkwork-api-router-runtime\\',
  },
]);

const sampleInstaller = [
  'File /a "/oname=generated\\\\bundled\\\\bundle-manifest.json" "D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\bundled\\foundation\\components\\bundle-manifest.json"',
  'File /a "/oname=generated\\\\bundled\\\\bundle-manifest.json" "D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\br\\b\\foundation\\components\\bundle-manifest.json"',
  'File /a "/oname=resources\\\\openclaw-runtime\\\\manifest.json" "D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\resources\\openclaw-runtime\\manifest.json"',
  'File /a "/oname=resources\\\\openclaw-runtime\\\\manifest.json" "D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\br\\o\\manifest.json"',
  'File /a "/oname=resources\\\\sdkwork-api-router-runtime\\\\manifest.json" "D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\resources\\sdkwork-api-router-runtime\\manifest.json"',
  'File /a "/oname=resources\\\\sdkwork-api-router-runtime\\\\manifest.json" "D:\\workspace\\claw-studio\\packages\\sdkwork-claw-desktop\\src-tauri\\generated\\br\\a\\manifest.json"',
].join('\n');

const rewrittenInstaller = bundleModule.rewriteNsisSourcePaths(sampleInstaller, replacements);
const preparedInstaller = bundleModule.prepareWindowsNsisRetryScript({
  installerContent: `!define OUTFILE "nsis-output.exe"\n${sampleInstaller}`,
  workspaceRootDir: syntheticWorkspaceRoot,
  outputFilePath: 'D:\\release\\Claw Studio_0.1.0_x64-setup.exe',
});

assert.match(rewrittenInstaller, /D:\\\.sdkwork-bc\\claw-studio\\bundled\\/);
assert.match(rewrittenInstaller, /D:\\\.sdkwork-bc\\claw-studio\\openclaw-runtime\\/);
assert.match(rewrittenInstaller, /D:\\\.sdkwork-bc\\claw-studio\\sdkwork-api-router-runtime\\/);
assert.doesNotMatch(rewrittenInstaller, /generated\\bundled\\\\/);
assert.doesNotMatch(rewrittenInstaller, /generated\\br\\[boa]\\\\/);
assert.doesNotMatch(rewrittenInstaller, /resources\\openclaw-runtime\\\\/);
assert.doesNotMatch(rewrittenInstaller, /resources\\sdkwork-api-router-runtime\\\\/);
assert.match(
  preparedInstaller,
  /!define OUTFILE "D:\\release\\Claw Studio_0\.1\.0_x64-setup\.exe"/,
);
assert.match(preparedInstaller, /D:\\\.sdkwork-bc\\claw-studio\\bundled\\/);
assert.doesNotMatch(preparedInstaller, /!define OUTFILE "nsis-output\.exe"/);

console.log('ok - windows tauri bundle fallback rewrites long NSIS sources to short absolute sources');
