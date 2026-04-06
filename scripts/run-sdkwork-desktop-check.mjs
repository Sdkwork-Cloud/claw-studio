import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

const scriptPaths = process.argv.slice(2);

if (scriptPaths.length === 0) {
  console.error('run-sdkwork-desktop-check requires at least one TypeScript test path.');
  process.exit(1);
}

runNodeTypeScriptChecks(scriptPaths);
