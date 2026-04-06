import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { lstat, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { repairPnpmFallbackLinks } from './repair-pnpm-fallback-links.mjs';

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'repair-pnpm-fallback-links-test-'));

function createIntegrityAndStorePath(storeRootDir, content) {
  const hashBuffer = crypto.createHash('sha512').update(content).digest();
  const hexDigest = hashBuffer.toString('hex');
  return {
    integrity: `sha512-${hashBuffer.toString('base64')}`,
    storeFilePath: path.join(storeRootDir, 'files', hexDigest.slice(0, 2), hexDigest.slice(2)),
  };
}

async function createStorePackage(pnpmStoreDir, storeName, packageName, version, packageJsonExtras = {}) {
  const segments = packageName.startsWith('@') ? packageName.split('/') : [packageName];
  const packageRoot = path.join(pnpmStoreDir, storeName, 'node_modules', ...segments);
  await mkdir(packageRoot, { recursive: true });
  await writeFile(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: packageName,
        version,
        ...packageJsonExtras,
      },
      null,
      2,
    )}\n`,
  );
  return packageRoot;
}

try {
  const workspaceRootDir = path.join(tempRoot, 'workspace');
  const pnpmStoreDir = path.join(workspaceRootDir, 'node_modules', '.pnpm');
  await mkdir(pnpmStoreDir, { recursive: true });

  const viteRoot = await createStorePackage(pnpmStoreDir, 'vite@8.0.3_hash', 'vite', '8.0.3');
  const picomatchOlderRoot = await createStorePackage(
    pnpmStoreDir,
    'picomatch@2.3.1',
    'picomatch',
    '2.3.1',
  );
  const picomatchNewerRoot = await createStorePackage(
    pnpmStoreDir,
    'picomatch@4.0.4',
    'picomatch',
    '4.0.4',
  );
  const pluginutilsRoot = await createStorePackage(
    pnpmStoreDir,
    '@rolldown+pluginutils@1.0.0-rc.12',
    '@rolldown/pluginutils',
    '1.0.0-rc.12',
  );

  const firstReport = await repairPnpmFallbackLinks({
    workspaceRootDir,
    logger: () => {},
  });
  assert.equal(firstReport.created.length, 3);

  const hoistedNodeModulesDir = path.join(pnpmStoreDir, 'node_modules');
  const rootNodeModulesDir = path.join(workspaceRootDir, 'node_modules');
  assert.equal(await realpath(path.join(hoistedNodeModulesDir, 'vite')), await realpath(viteRoot));
  assert.equal(
    await realpath(path.join(hoistedNodeModulesDir, 'picomatch')),
    await realpath(picomatchNewerRoot),
  );
  assert.equal(
    await realpath(path.join(hoistedNodeModulesDir, '@rolldown', 'pluginutils')),
    await realpath(pluginutilsRoot),
  );
  assert.equal(await realpath(path.join(rootNodeModulesDir, 'vite')), await realpath(viteRoot));
  assert.equal(await realpath(path.join(rootNodeModulesDir, 'picomatch')), await realpath(picomatchNewerRoot));
  assert.equal(
    await realpath(path.join(rootNodeModulesDir, '@rolldown', 'pluginutils')),
    await realpath(pluginutilsRoot),
  );

  const picomatchLinkStats = await lstat(path.join(hoistedNodeModulesDir, 'picomatch'));
  assert(picomatchLinkStats.isSymbolicLink() || picomatchLinkStats.isDirectory());

  await rm(path.join(hoistedNodeModulesDir, 'picomatch'), { recursive: true, force: true });
  const secondReport = await repairPnpmFallbackLinks({
    workspaceRootDir,
    logger: () => {},
  });
  assert.equal(secondReport.created.length, 1);
  assert.equal(
    await realpath(path.join(hoistedNodeModulesDir, 'picomatch')),
    await realpath(picomatchNewerRoot),
  );
  assert.notEqual(await realpath(path.join(hoistedNodeModulesDir, 'picomatch')), await realpath(picomatchOlderRoot));
  assert.equal(await realpath(path.join(rootNodeModulesDir, 'picomatch')), await realpath(picomatchNewerRoot));

  const repairWorkspaceRootDir = path.join(tempRoot, 'workspace-missing-packages');
  const repairPnpmStoreDir = path.join(repairWorkspaceRootDir, 'node_modules', '.pnpm');
  const globalStoreRootDir = path.join(tempRoot, 'global-store', 'v10');
  await mkdir(repairPnpmStoreDir, { recursive: true });
  await mkdir(path.join(globalStoreRootDir, 'index', 'aa'), { recursive: true });

  await createStorePackage(
    repairPnpmStoreDir,
    'vite@8.0.3_hash',
    'vite',
    '8.0.3',
    {
      dependencies: {
        tinyglobby: '0.2.15',
      },
    },
  );

  const tinyglobbyPackageJsonContent = `${JSON.stringify(
    {
      name: 'tinyglobby',
      version: '0.2.15',
      main: 'dist/index.js',
      dependencies: {
        fdir: '6.5.0',
      },
    },
    null,
    2,
  )}\n`;
  const tinyglobbyIndexContent = 'export const tinyglobby = true;\n';
  const fdirPackageJsonContent = `${JSON.stringify(
    {
      name: 'fdir',
      version: '6.5.0',
      main: 'dist/index.js',
    },
    null,
    2,
  )}\n`;
  const fdirIndexContent = 'export const fdir = true;\n';

  const tinyglobbyPackageJsonIntegrity = createIntegrityAndStorePath(globalStoreRootDir, tinyglobbyPackageJsonContent);
  const tinyglobbyIndexIntegrity = createIntegrityAndStorePath(globalStoreRootDir, tinyglobbyIndexContent);
  const fdirPackageJsonIntegrity = createIntegrityAndStorePath(globalStoreRootDir, fdirPackageJsonContent);
  const fdirIndexIntegrity = createIntegrityAndStorePath(globalStoreRootDir, fdirIndexContent);

  for (const integrityRecord of [
    tinyglobbyPackageJsonIntegrity,
    tinyglobbyIndexIntegrity,
    fdirPackageJsonIntegrity,
    fdirIndexIntegrity,
  ]) {
    await mkdir(path.dirname(integrityRecord.storeFilePath), { recursive: true });
  }

  await writeFile(tinyglobbyPackageJsonIntegrity.storeFilePath, tinyglobbyPackageJsonContent);
  await writeFile(tinyglobbyIndexIntegrity.storeFilePath, tinyglobbyIndexContent);
  await writeFile(fdirPackageJsonIntegrity.storeFilePath, fdirPackageJsonContent);
  await writeFile(fdirIndexIntegrity.storeFilePath, fdirIndexContent);

  await writeFile(
    path.join(globalStoreRootDir, 'index', 'aa', 'tinyglobby@0.2.15.json'),
    JSON.stringify(
      {
        name: 'tinyglobby',
        version: '0.2.15',
        files: {
          'package.json': {
            integrity: tinyglobbyPackageJsonIntegrity.integrity,
            mode: 420,
            size: tinyglobbyPackageJsonContent.length,
          },
          'dist/index.js': {
            integrity: tinyglobbyIndexIntegrity.integrity,
            mode: 420,
            size: tinyglobbyIndexContent.length,
          },
        },
      },
      null,
      2,
    ),
  );

  await writeFile(
    path.join(globalStoreRootDir, 'index', 'aa', 'fdir@6.5.0.json'),
    JSON.stringify(
      {
        name: 'fdir',
        version: '6.5.0',
        files: {
          'package.json': {
            integrity: fdirPackageJsonIntegrity.integrity,
            mode: 420,
            size: fdirPackageJsonContent.length,
          },
          'dist/index.js': {
            integrity: fdirIndexIntegrity.integrity,
            mode: 420,
            size: fdirIndexContent.length,
          },
        },
      },
      null,
      2,
    ),
  );

  const missingPackageReport = await repairPnpmFallbackLinks({
    workspaceRootDir: repairWorkspaceRootDir,
    pnpmStoreDir: repairPnpmStoreDir,
    globalStoreRootDir,
    logger: () => {},
  });

  assert(
    missingPackageReport.created.some((entry) => entry.packageName === 'vite'),
    'expected existing store package links to still be created',
  );
  assert(
    missingPackageReport.materialized.some((entry) => entry.packageName === 'tinyglobby'),
    'expected missing direct dependency package to be materialized',
  );
  assert(
    missingPackageReport.materialized.some((entry) => entry.packageName === 'fdir'),
    'expected transitive dependency package to be materialized recursively',
  );
  assert.equal(
    await readFile(path.join(repairPnpmStoreDir, 'node_modules', 'tinyglobby', 'package.json'), 'utf8'),
    tinyglobbyPackageJsonContent,
  );
  assert.equal(
    await readFile(path.join(repairPnpmStoreDir, 'node_modules', 'fdir', 'dist', 'index.js'), 'utf8'),
    fdirIndexContent,
  );
  assert.equal(
    await readFile(path.join(repairWorkspaceRootDir, 'node_modules', 'tinyglobby', 'package.json'), 'utf8'),
    tinyglobbyPackageJsonContent,
  );

  const rangeWorkspaceRootDir = path.join(tempRoot, 'workspace-range-deps');
  const rangePnpmStoreDir = path.join(rangeWorkspaceRootDir, 'node_modules', '.pnpm');
  const rangeGlobalStoreRootDir = path.join(tempRoot, 'global-store-range', 'v10');
  await mkdir(rangePnpmStoreDir, { recursive: true });
  await mkdir(path.join(rangeGlobalStoreRootDir, 'index', 'bb'), { recursive: true });

  await createStorePackage(
    rangePnpmStoreDir,
    'hast-util-to-jsx-runtime@2.3.6',
    'hast-util-to-jsx-runtime',
    '2.3.6',
    {
      dependencies: {
        'comma-separated-tokens': '^2.0.0',
      },
    },
  );

  const commaTokensPackageJsonContent = `${JSON.stringify(
    {
      name: 'comma-separated-tokens',
      version: '2.0.3',
      exports: './index.js',
    },
    null,
    2,
  )}\n`;
  const commaTokensIndexContent = 'export function stringify() { return ""; }\n';
  const commaTokensPackageJsonIntegrity = createIntegrityAndStorePath(
    rangeGlobalStoreRootDir,
    commaTokensPackageJsonContent,
  );
  const commaTokensIndexIntegrity = createIntegrityAndStorePath(
    rangeGlobalStoreRootDir,
    commaTokensIndexContent,
  );

  for (const integrityRecord of [commaTokensPackageJsonIntegrity, commaTokensIndexIntegrity]) {
    await mkdir(path.dirname(integrityRecord.storeFilePath), { recursive: true });
  }

  await writeFile(commaTokensPackageJsonIntegrity.storeFilePath, commaTokensPackageJsonContent);
  await writeFile(commaTokensIndexIntegrity.storeFilePath, commaTokensIndexContent);

  await writeFile(
    path.join(rangeGlobalStoreRootDir, 'index', 'bb', 'comma-separated-tokens@2.0.3.json'),
    JSON.stringify(
      {
        name: 'comma-separated-tokens',
        version: '2.0.3',
        files: {
          'package.json': {
            integrity: commaTokensPackageJsonIntegrity.integrity,
            mode: 420,
            size: commaTokensPackageJsonContent.length,
          },
          'index.js': {
            integrity: commaTokensIndexIntegrity.integrity,
            mode: 420,
            size: commaTokensIndexContent.length,
          },
        },
      },
      null,
      2,
    ),
  );

  const rangeReport = await repairPnpmFallbackLinks({
    workspaceRootDir: rangeWorkspaceRootDir,
    pnpmStoreDir: rangePnpmStoreDir,
    globalStoreRootDir: rangeGlobalStoreRootDir,
    logger: () => {},
  });

  assert(
    rangeReport.materialized.some((entry) => entry.packageName === 'comma-separated-tokens'),
    'expected semver range dependency to materialize from the best matching global store version',
  );
  assert.equal(
    await readFile(path.join(rangeWorkspaceRootDir, 'node_modules', 'comma-separated-tokens', 'index.js'), 'utf8'),
    commaTokensIndexContent,
  );

  console.log('ok - pnpm fallback link repair rebuilds hoisted package links from store packages');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
