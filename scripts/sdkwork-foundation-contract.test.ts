import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

const TEXT_FILE_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.scss',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

function collectTextFiles(directory: string, results: string[] = []) {
  if (!fs.existsSync(directory)) {
    return results;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const nextPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }

      collectTextFiles(nextPath, results);
      continue;
    }

    if (TEXT_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(nextPath);
    }
  }

  return results;
}

function findFilesContaining(
  searchRoot: string,
  pattern: RegExp,
  options?: {
    excludeTestFiles?: boolean;
  },
) {
  return collectTextFiles(path.join(root, searchRoot))
    .filter((filePath) => !(options?.excludeTestFiles && /\.test\./.test(filePath)))
    .filter((filePath) => pattern.test(fs.readFileSync(filePath, 'utf8')))
    .map((filePath) => path.relative(root, filePath).replace(/\\/g, '/'))
    .sort();
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

runTest('sdkwork-claw-i18n is implemented locally instead of re-exporting claw-studio infrastructure', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-i18n/package.json');
  const source = read('packages/sdkwork-claw-i18n/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-i18n/src/locales/en.json'));
  assert.ok(exists('packages/sdkwork-claw-i18n/src/locales/zh.json'));
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-infrastructure']);
  assert.doesNotMatch(source, /@sdkwork\/claw-studio-infrastructure/);
  assert.match(source, /ensureI18n/);
});

runTest('sdkwork-claw-types is implemented locally instead of re-exporting claw-studio domain', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-types/package.json');
  const source = read('packages/sdkwork-claw-types/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-types/src/service.ts'));
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-domain']);
  assert.doesNotMatch(source, /@sdkwork\/claw-studio-domain/);
  assert.match(source, /export \* from '.\/service(?:\.ts)?'/);
});

runTest('sdkwork-claw-distribution is implemented locally instead of re-exporting claw-studio distribution', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-distribution/package.json');
  const source = read('packages/sdkwork-claw-distribution/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-distribution/src/manifests/cn/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-distribution/src/manifests/global/index.ts'));
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-distribution']);
  assert.doesNotMatch(source, /@sdkwork\/claw-studio-distribution/);
  assert.match(source, /getDistributionManifest/);
});

runTest('sdkwork-claw-web pins stable build chunks for infrastructure without shipping mock-only chunks', () => {
  const viteConfigSource = read('packages/sdkwork-claw-web/vite.config.ts');
  const buildHelperSource = read('scripts/viteBuildOptimization.ts');

  assert.match(viteConfigSource, /createClawManualChunks/);
  assert.match(viteConfigSource, /resolveClawModulePreloadDependencies/);
  assert.match(viteConfigSource, /CLAW_VITE_DEDUPE_PACKAGES/);
  assert.match(buildHelperSource, /react-vendor/);
  assert.match(buildHelperSource, /app-router/);
  assert.match(buildHelperSource, /app-state/);
  assert.match(buildHelperSource, /app-ui/);
  assert.doesNotMatch(buildHelperSource, /markdown-highlight/);
  assert.match(buildHelperSource, /sdkwork-app-sdk/);
  assert.match(buildHelperSource, /sdkwork-claw-infrastructure/);
  assert.doesNotMatch(viteConfigSource, /studioMockService/);
  assert.doesNotMatch(viteConfigSource, /claw-studio-mock/);
  assert.doesNotMatch(viteConfigSource, /sdkwork-claw-community\/src\/NewPost\.tsx/);
  assert.doesNotMatch(viteConfigSource, /sdkwork-claw-community\/src\/pages\/community\/NewPost\.tsx/);
  assert.doesNotMatch(viteConfigSource, /sdkwork-claw-community\/src\/CommunityPostDetail\.tsx/);
  assert.doesNotMatch(
    viteConfigSource,
    /sdkwork-claw-community\/src\/pages\/community\/CommunityPostDetail\.tsx/,
  );
  assert.doesNotMatch(viteConfigSource, /sdkwork-claw-chat\/src\/components\/ChatMessage\.tsx/);
  assert.doesNotMatch(viteConfigSource, /@sdkwork\/claw-studio-infrastructure/);
  assert.match(viteConfigSource, /dedupe:\s*\[\.\.\.CLAW_VITE_DEDUPE_PACKAGES\]/);
});

runTest('web studio no longer references mock task services in the platform runtime path', () => {
  const webStudioSource = read('packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts');

  assert.doesNotMatch(
    webStudioSource,
    /import\s+\{\s*studioMockService\s*\}\s+from\s+'..\/services\/index\.ts'/,
  );
  assert.doesNotMatch(
    webStudioSource,
    /import\s+\{\s*studioMockService\s*\}\s+from\s+'..\/services\/studioMockService\.ts'/,
  );
  assert.doesNotMatch(webStudioSource, /import\('..\/services\/studioMockService\.ts'\)/);
  assert.doesNotMatch(webStudioSource, /import\('..\/services\/studioMockServiceProxy\.ts'\)/);
  assert.doesNotMatch(webStudioSource, /import\('..\/services\/index\.ts'\)/);
});

runTest('infrastructure root keeps mock-service helpers private instead of exporting them to runtime consumers', () => {
  const infrastructureIndexSource = read('packages/sdkwork-claw-infrastructure/src/index.ts');
  const servicesIndexSource = read('packages/sdkwork-claw-infrastructure/src/services/index.ts');

  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/services\/studioMockService\.ts'/);
  assert.doesNotMatch(servicesIndexSource, /export \* from '.\/studioMockService\.ts'/);
  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/services\/studioMockServiceProxy\.ts'/);
  assert.doesNotMatch(servicesIndexSource, /export \* from '.\/studioMockServiceProxy\.ts'/);
});

runTest('infrastructure root keeps legacy raw-http auth helpers private instead of exporting bypass clients', () => {
  const infrastructureIndexSource = read('packages/sdkwork-claw-infrastructure/src/index.ts');
  const servicesIndexSource = read('packages/sdkwork-claw-infrastructure/src/services/index.ts');

  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/http\/httpClient\.ts'/);
  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/http\/apiClient\.ts'/);
  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/services\/authClient\.ts'/);
  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/services\/userClient\.ts'/);
  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/services\/accountClient\.ts'/);
  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/services\/notificationClient\.ts'/);
  assert.doesNotMatch(servicesIndexSource, /export \* from '.\/authClient\.ts'/);
  assert.doesNotMatch(servicesIndexSource, /export \* from '.\/userClient\.ts'/);
  assert.doesNotMatch(servicesIndexSource, /export \* from '.\/accountClient\.ts'/);
  assert.doesNotMatch(servicesIndexSource, /export \* from '.\/notificationClient\.ts'/);
});

runTest('desktop update client uses generated app-sdk instead of handwritten raw HTTP', () => {
  const updateClientSource = read('packages/sdkwork-claw-infrastructure/src/updates/updateClient.ts');

  assert.match(updateClientSource, /@sdkwork\/app-sdk/);
  assert.doesNotMatch(updateClientSource, /postJson/);
  assert.doesNotMatch(updateClientSource, /getApiUrl/);
  assert.doesNotMatch(updateClientSource, /httpClient/);
});

runTest('mock studio helpers are removed from the production source tree', () => {
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/services/studioMockService.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/services/studioMockServiceProxy.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts'));
});

runTest('dead raw-http business helper files are removed after app-sdk migration', () => {
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/http/apiClient.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/services/authClient.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/services/authClient.test.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/services/userClient.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/services/accountClient.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/services/notificationClient.ts'));
});

runTest('foundation removes legacy api-router runtime bridge files and dead locale blocks after extraction', () => {
  const enLocaleSource = read('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocaleSource = read('packages/sdkwork-claw-i18n/src/locales/zh.json');
  const envExampleSource = read('.env.example');
  const envDevelopmentSource = read('.env.development');
  const envTestSource = read('.env.test');
  const envProductionSource = read('.env.production');
  const pnpmLockSource = read('pnpm-lock.yaml');
  const upstreamReferenceSource = read('docs/reference/upstream-integration.md');
  const upstreamReferenceZhSource = read('docs/zh-CN/reference/upstream-integration.md');

  assert.doesNotThrow(() => JSON.parse(enLocaleSource));
  assert.doesNotThrow(() => JSON.parse(zhLocaleSource));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/platform/webApiRouter.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/platform/webApiRouter.test.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/platform/contracts/apiRouter.ts'));
  assert.doesNotMatch(enLocaleSource, /"apiRouterComingSoon"/);
  assert.doesNotMatch(enLocaleSource, /"apiRouterPage"/);
  assert.doesNotMatch(enLocaleSource, /"apiRouterWorkspace"/);
  assert.doesNotMatch(enLocaleSource, /sdkwork-api-router/);
  assert.doesNotMatch(enLocaleSource, /VITE_API_ROUTER_ADMIN_TOKEN/);
  assert.doesNotMatch(zhLocaleSource, /"apiRouterComingSoon"/);
  assert.doesNotMatch(zhLocaleSource, /"apiRouterPage"/);
  assert.doesNotMatch(zhLocaleSource, /"apiRouterWorkspace"/);
  assert.doesNotMatch(zhLocaleSource, /sdkwork-api-router/);
  assert.doesNotMatch(zhLocaleSource, /VITE_API_ROUTER_ADMIN_TOKEN/);
  assert.doesNotMatch(envExampleSource, /VITE_API_ROUTER_/);
  assert.doesNotMatch(envDevelopmentSource, /VITE_API_ROUTER_/);
  assert.doesNotMatch(envTestSource, /VITE_API_ROUTER_/);
  assert.doesNotMatch(envProductionSource, /VITE_API_ROUTER_/);
  assert.doesNotMatch(pnpmLockSource, /packages\/sdkwork-claw-apirouter:/);
  assert.doesNotMatch(pnpmLockSource, /@sdkwork\/claw-apirouter/);
  assert.doesNotMatch(upstreamReferenceSource, /sdkwork-api-router/);
  assert.doesNotMatch(upstreamReferenceZhSource, /sdkwork-api-router/);
  assert.match(upstreamReferenceSource, /OpenClaw/);
  assert.match(upstreamReferenceZhSource, /OpenClaw/);
});

runTest('foundation centralizes legacy api-router provider-id compatibility in one core helper', () => {
  const matches = findFilesContaining('packages', /api-router-/, {
    excludeTestFiles: true,
  });

  assert.deepEqual(matches, [
    'packages/sdkwork-claw-core/src/services/legacyProviderCompat.ts',
  ]);
});

runTest('foundation removes obsolete api-router docs and implementation plans from the workspace docs surface', () => {
  const matches = findFilesContaining(
    'docs',
    /API Router|api router|sdkwork-api-router|@sdkwork\/claw-apirouter|sdkwork-claw-apirouter|api-router-|apirouter|apiRouter|ApiRouter|VITE_API_ROUTER_|openApiRouter/,
  );

  assert.deepEqual(matches, []);
});

runTest('foundation removes active apiRouter naming from package source outside tests', () => {
  const matches = findFilesContaining('packages', /apiRouter|ApiRouter/, {
    excludeTestFiles: true,
  });

  assert.deepEqual(matches, []);
});
