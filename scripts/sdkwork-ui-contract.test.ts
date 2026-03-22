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

function walkFiles(dirPath: string, predicate: (filePath: string) => boolean): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(absolutePath, predicate));
      continue;
    }

    if (predicate(absolutePath)) {
      files.push(absolutePath);
    }
  }

  return files;
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

runTest('sdkwork-claw-ui is implemented locally instead of re-exporting claw-studio-shared-ui', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-ui/package.json');
  const indexSource = read('packages/sdkwork-claw-ui/src/index.ts');
  const componentsIndexSource = read('packages/sdkwork-claw-ui/src/components/index.ts');
  const taskRowListSource = read('packages/sdkwork-claw-ui/src/components/TaskRowList.tsx');
  const taskCatalogSource = read('packages/sdkwork-claw-ui/src/components/TaskCatalog.tsx');
  const taskCatalogMetaSource = read('packages/sdkwork-claw-ui/src/components/taskCatalogMeta.ts');
  const taskExecutionHistoryDrawerSource = read(
    'packages/sdkwork-claw-ui/src/components/TaskExecutionHistoryDrawer.tsx',
  );
  const channelCatalogSource = read('packages/sdkwork-claw-ui/src/components/ChannelCatalog.tsx');
  const overlaySurfaceSource = read('packages/sdkwork-claw-ui/src/components/OverlaySurface.tsx');

  assert.ok(exists('packages/sdkwork-claw-ui/src/components/Modal.tsx'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/components/Button.tsx'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/components/Input.tsx'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/components/Textarea.tsx'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/components/Label.tsx'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/components/Select.tsx'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/components/Dialog.tsx'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/components/Checkbox.tsx'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/components/Switch.tsx'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/components/Slider.tsx'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/components/RepositoryCard.tsx'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/components/TaskRowList.tsx'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/components/TaskCatalog.tsx'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/components/TaskExecutionHistoryDrawer.tsx'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/components/taskCatalogMeta.ts'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/lib/utils.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-shared-ui']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-shared-ui/);
  assert.match(indexSource, /export \* from '\.\/components'/);
  assert.match(indexSource, /OverlaySurface/);
  assert.match(indexSource, /overlayLayout/);
  assert.match(componentsIndexSource, /Button/);
  assert.match(componentsIndexSource, /Input/);
  assert.match(componentsIndexSource, /Textarea/);
  assert.match(componentsIndexSource, /Label/);
  assert.match(componentsIndexSource, /Select/);
  assert.match(componentsIndexSource, /Dialog/);
  assert.match(componentsIndexSource, /Checkbox/);
  assert.match(componentsIndexSource, /Switch/);
  assert.match(componentsIndexSource, /Slider/);
  assert.match(componentsIndexSource, /\.\/TaskCatalog/);
  assert.match(componentsIndexSource, /\.\/TaskExecutionHistoryDrawer/);
  assert.match(componentsIndexSource, /\.\/TaskRowList/);
  assert.match(componentsIndexSource, /\.\/taskCatalogMeta/);
  assert.match(
    taskRowListSource,
    /interface TaskRowProps extends Omit<React\.HTMLAttributes<HTMLDivElement>, 'title'>/,
  );
  assert.match(taskRowListSource, /title: React\.ReactNode;/);
  assert.match(taskCatalogSource, /export interface TaskCatalogItem/);
  assert.match(taskCatalogSource, /export function TaskCatalog/);
  assert.match(taskCatalogMetaSource, /export function getTaskCatalogTone/);
  assert.match(taskExecutionHistoryDrawerSource, /export function TaskExecutionHistoryDrawer/);
  assert.match(channelCatalogSource, /onOpenOfficialLink\?:/);
  assert.match(channelCatalogSource, /onOpenOfficialLink\(channel, link\)/);
  assert.match(overlaySurfaceSource, /createPortal/);
  assert.match(overlaySurfaceSource, /document\.body/);
});

runTest('feature packages use shared shadcn-style form primitives instead of native controls', () => {
  const packagesRoot = path.join(root, 'packages');
  const architectureAllowList = new Set([
    // @sdkwork/claw-core is not allowed to depend on @sdkwork/claw-ui by repo architecture rules.
    'packages/sdkwork-claw-core/src/components/CommandPalette.tsx',
  ]);
  const sourceFiles = walkFiles(
    packagesRoot,
    (filePath) =>
      filePath.endsWith('.tsx') &&
      !filePath.includes(`${path.sep}sdkwork-claw-ui${path.sep}src${path.sep}components${path.sep}`),
  );

  const nativeControlPattern = /<(input|select|textarea)\b[\s\S]*?>/g;
  const allowedInputTypePattern = /type=(['"])(file|hidden)\1/;
  const violations: string[] = [];

  for (const filePath of sourceFiles) {
    const relativePath = path.relative(root, filePath).replaceAll(path.sep, '/');

    if (architectureAllowList.has(relativePath)) {
      continue;
    }

    const source = fs.readFileSync(filePath, 'utf8');
    const matches = source.matchAll(nativeControlPattern);

    for (const match of matches) {
      const [tag] = match;
      const tagName = match[1];

      if (tagName === 'input' && allowedInputTypePattern.test(tag)) {
        continue;
      }

      const startIndex = match.index ?? 0;
      const lineNumber = source.slice(0, startIndex).split('\n').length;
      violations.push(`${relativePath}:${lineNumber} uses native <${tagName}>`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Native form controls remain outside @sdkwork/claw-ui:\n${violations.join('\n')}`,
  );
});
