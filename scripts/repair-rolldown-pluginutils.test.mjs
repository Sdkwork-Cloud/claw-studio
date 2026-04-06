import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  inspectPluginutilsStoreHealth,
  repairRolldownPluginutils,
  selectRolldownTemplateStoreName,
} from './repair-rolldown-pluginutils.mjs';

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'repair-rolldown-pluginutils-test-'));

function createFilterIndexSource() {
  return `//#region ../pluginutils/dist/utils.js
function cleanUrl(url) {
  return url.replace(/\\?.*$/, '');
}
function extractQueryWithoutFragment(url) {
  return url;
}
//#endregion
//#region ../pluginutils/dist/filter/composable-filters.js
function and(...args) {
  return args;
}
function or(...args) {
  return args;
}
function not(expr) {
  return expr;
}
function id(pattern, params) {
  return { pattern, params };
}
function importerId(pattern, params) {
  return { pattern, params };
}
function moduleType(pattern) {
  return pattern;
}
function code(pattern) {
  return pattern;
}
function query(key, pattern) {
  return { key, pattern };
}
function include(expr) {
  return expr;
}
function exclude(expr) {
  return expr;
}
function queries(queryFilter) {
  return queryFilter;
}
function interpreter() {
  return true;
}
function interpreterImpl() {
  return true;
}
function exprInterpreter() {
  return true;
}
//#endregion
//#region ../pluginutils/dist/filter/filter-vite-plugins.js
function filterVitePlugins(plugins) {
  if (!plugins) {
    return [];
  }
  const pluginArray = Array.isArray(plugins) ? plugins : [plugins];
  return pluginArray.filter(Boolean);
}
//#endregion
//#region ../pluginutils/dist/filter/simple-filters.js
function exactRegex(str, flags) {
  return new RegExp(str, flags);
}
function prefixRegex(str, flags) {
  return new RegExp(str, flags);
}
function makeIdFiltersToMatchWithQuery(input) {
  return input;
}
//#endregion
`;
}

function createFilterIndexDtsSource() {
  return `//#region ../pluginutils/dist/filter/composable-filters.d.ts
type StringOrRegExp = string | RegExp;
type PluginModuleType = string;
type FilterExpressionKind = string;
type FilterExpression = unknown;
type TopLevelFilterExpression = unknown;
interface QueryFilterObject {
  [key: string]: StringOrRegExp | boolean;
}
declare function and(...args: unknown[]): unknown;
declare function or(...args: unknown[]): unknown;
declare function not(expr: unknown): unknown;
declare function id(pattern: StringOrRegExp, params?: { cleanUrl?: boolean }): unknown;
declare function importerId(pattern: StringOrRegExp, params?: { cleanUrl?: boolean }): unknown;
declare function moduleType(pattern: PluginModuleType): unknown;
declare function code(pattern: StringOrRegExp): unknown;
declare function query(key: string, pattern: StringOrRegExp | boolean): unknown;
declare function include(expr: unknown): unknown;
declare function exclude(expr: unknown): unknown;
declare function queries(queryFilter: QueryFilterObject): unknown;
declare function interpreter(exprs: TopLevelFilterExpression | TopLevelFilterExpression[], code?: string, id?: string, moduleType?: PluginModuleType, importerId?: string): boolean;
declare function interpreterImpl(expr: TopLevelFilterExpression[], code?: string, id?: string, moduleType?: PluginModuleType, importerId?: string): boolean;
declare function exprInterpreter(expr: FilterExpression, code?: string, id?: string, moduleType?: PluginModuleType, importerId?: string): boolean;
//#endregion
//#region ../pluginutils/dist/filter/filter-vite-plugins.d.ts
declare function filterVitePlugins<T = any>(plugins: T | T[] | null | undefined | false): T[];
//#endregion
//#region ../pluginutils/dist/filter/simple-filters.d.ts
declare function exactRegex(str: string, flags?: string): RegExp;
declare function prefixRegex(str: string, flags?: string): RegExp;
type WidenString<T> = T extends string ? string : T;
declare function makeIdFiltersToMatchWithQuery<T extends string | RegExp>(input: T): WidenString<T>;
declare function makeIdFiltersToMatchWithQuery<T extends string | RegExp>(input: readonly T[]): WidenString<T>[];
declare function makeIdFiltersToMatchWithQuery(input: string | RegExp | readonly (string | RegExp)[]): string | RegExp | (string | RegExp)[];
//#endregion
`;
}

async function createBrokenPluginutilsStore(pnpmStoreDir, storeName, version) {
  const packageRoot = path.join(
    pnpmStoreDir,
    storeName,
    'node_modules',
    '@rolldown',
    'pluginutils',
  );
  await mkdir(path.join(packageRoot, 'dist', 'filter'), { recursive: true });
  await writeFile(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: '@rolldown/pluginutils',
        version,
        type: 'module',
        main: './dist/index.js',
        module: './dist/index.js',
        types: './dist/index.d.ts',
        exports: {
          '.': './dist/index.js',
          './filter': './dist/filter/index.js',
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(path.join(packageRoot, 'README.md'), '# pluginutils\n');
  await writeFile(path.join(packageRoot, 'dist', 'index.js'), 'export * from "./filter/index.js";\n');
  await writeFile(path.join(packageRoot, 'dist', 'index.d.ts'), "export * from './filter/index.ts';\n");
  await writeFile(
    path.join(packageRoot, 'dist', 'filter', 'index.js'),
    'export * from "./composable-filters.js";\nexport * from "./filter-vite-plugins.js";\nexport * from "./simple-filters.js";\n',
  );
  await writeFile(
    path.join(packageRoot, 'dist', 'filter', 'index.d.ts'),
    "export * from './composable-filters.ts';\nexport * from './filter-vite-plugins.ts';\nexport * from './simple-filters.ts';\n",
  );
  await writeFile(
    path.join(packageRoot, 'dist', 'filter', 'composable-filters.js'),
    'export function and(...args) { return args; }\n',
  );
  await writeFile(
    path.join(packageRoot, 'dist', 'filter', 'composable-filters.d.ts'),
    [
      'type StringOrRegExp = string | RegExp;',
      'type PluginModuleType = string;',
      "export type FilterExpressionKind = string;",
      'export type FilterExpression = unknown;',
      'export interface QueryFilterObject {',
      '  [key: string]: StringOrRegExp | boolean;',
      '}',
      'export declare function and(...args: unknown[]): unknown;',
      'export declare function or(...args: unknown[]): unknown;',
      'export declare function not(expr: unknown): unknown;',
      'export declare function id(pattern: StringOrRegExp, params?: { cleanUrl?: boolean }): unknown;',
      'export declare function importerId(pattern: StringOrRegExp, params?: { cleanUrl?: boolean }): unknown;',
      'export declare function moduleType(pattern: PluginModuleType): unknown;',
      'export declare function code(pattern: StringOrRegExp): unknown;',
      'export declare function query(key: string, pattern: StringOrRegExp | boolean): unknown;',
      'export declare function include(expr: unknown): unknown;',
      'export declare function exclude(expr: unknown): unknown;',
      'export declare function queries(queryFilter: QueryFilterObject): unknown;',
      'export declare function interpreter(exprs: unknown): boolean;',
      'export declare function interpreterImpl(expr: unknown[]): boolean;',
      'export declare function exprInterpreter(expr: unknown): boolean;',
      'export {};',
      '',
    ].join('\n'),
  );
}

try {
  assert.equal(
    selectRolldownTemplateStoreName(
      [
        'rolldown@1.0.0-rc.3_hash',
        'rolldown@1.0.0-rc.12_hash',
      ],
      '1.0.0-rc.7',
    ),
    'rolldown@1.0.0-rc.12_hash',
  );

  const workspaceRootDir = path.join(tempRoot, 'workspace');
  const pnpmStoreDir = path.join(workspaceRootDir, 'node_modules', '.pnpm');
  const rolldownStoreName = 'rolldown@1.0.0-rc.12_hash';
  const rolldownDistDir = path.join(
    pnpmStoreDir,
    rolldownStoreName,
    'node_modules',
    'rolldown',
    'dist',
  );

  await mkdir(rolldownDistDir, { recursive: true });
  await writeFile(path.join(rolldownDistDir, 'filter-index.mjs'), createFilterIndexSource());
  await writeFile(path.join(rolldownDistDir, 'filter-index.d.mts'), createFilterIndexDtsSource());

  const brokenStoreName = '@rolldown+pluginutils@1.0.0-rc.7';
  await createBrokenPluginutilsStore(pnpmStoreDir, brokenStoreName, '1.0.0-rc.7');

  const beforeRepair = await inspectPluginutilsStoreHealth({
    pluginutilsStoreDir: path.join(pnpmStoreDir, brokenStoreName),
  });
  assert.deepEqual(
    beforeRepair.unhealthyFiles.map((entry) => entry.relativePath).sort(),
    [
      'dist/filter/filter-vite-plugins.d.ts',
      'dist/filter/filter-vite-plugins.js',
      'dist/filter/simple-filters.d.ts',
      'dist/filter/simple-filters.js',
      'dist/utils.js',
    ],
  );

  const report = await repairRolldownPluginutils({
    workspaceRootDir,
    logger: () => {},
  });

  assert.equal(report.repaired.length, 1);
  assert.equal(report.repaired[0].storeName, brokenStoreName);
  assert.equal(report.repaired[0].templateStoreName, rolldownStoreName);

  const afterRepair = await inspectPluginutilsStoreHealth({
    pluginutilsStoreDir: path.join(pnpmStoreDir, brokenStoreName),
  });
  assert.deepEqual(afterRepair.unhealthyFiles, []);

  const secondRepairReport = await repairRolldownPluginutils({
    workspaceRootDir,
    logger: () => {},
  });
  assert.equal(secondRepairReport.repaired.length, 0);

  const repairedPackageRoot = path.join(
    pnpmStoreDir,
    brokenStoreName,
    'node_modules',
    '@rolldown',
    'pluginutils',
  );
  assert.match(
    await readFile(path.join(repairedPackageRoot, 'dist', 'utils.js'), 'utf8'),
    /export \{ cleanUrl, extractQueryWithoutFragment \};/,
  );
  assert.match(
    await readFile(path.join(repairedPackageRoot, 'dist', 'filter', 'filter-vite-plugins.js'), 'utf8'),
    /export \{ filterVitePlugins \};/,
  );
  assert.match(
    await readFile(path.join(repairedPackageRoot, 'dist', 'filter', 'simple-filters.d.ts'), 'utf8'),
    /export declare function exactRegex/,
  );
  assert.match(
    await readFile(path.join(repairedPackageRoot, 'LICENSE'), 'utf8'),
    /MIT License/u,
  );

  const pnpmEntries = await readdir(pnpmStoreDir);
  assert(
    pnpmEntries.some((entry) => entry.startsWith(`${brokenStoreName}.bak-`)),
    'Expected repair to preserve the broken package as a backup store directory',
  );

  console.log('ok - rolldown pluginutils repair reconstructs broken pnpm store packages and preserves backups');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
