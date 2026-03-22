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

runTest('sdkwork-claw-web pins stable build chunks for infrastructure and mock-heavy dependencies', () => {
  const viteConfigSource = read('packages/sdkwork-claw-web/vite.config.ts');

  assert.match(viteConfigSource, /manualChunks/);
  assert.match(viteConfigSource, /app-vendor/);
  assert.match(viteConfigSource, /react-router-dom/);
  assert.match(viteConfigSource, /@tanstack\/react-query/);
  assert.match(viteConfigSource, /sonner/);
  assert.match(viteConfigSource, /studioMockService/);
  assert.match(viteConfigSource, /sdkwork-claw-infrastructure/);
  assert.doesNotMatch(viteConfigSource, /sdkwork-claw-community\/src\/NewPost\.tsx/);
  assert.doesNotMatch(viteConfigSource, /sdkwork-claw-community\/src\/pages\/community\/NewPost\.tsx/);
  assert.doesNotMatch(viteConfigSource, /sdkwork-claw-community\/src\/CommunityPostDetail\.tsx/);
  assert.doesNotMatch(
    viteConfigSource,
    /sdkwork-claw-community\/src\/pages\/community\/CommunityPostDetail\.tsx/,
  );
  assert.doesNotMatch(viteConfigSource, /sdkwork-claw-chat\/src\/components\/ChatMessage\.tsx/);
  assert.doesNotMatch(viteConfigSource, /@sdkwork\/claw-studio-infrastructure/);
  assert.match(viteConfigSource, /dedupe:\s*\[[^\]]*'react'[^\]]*'react-dom'[^\]]*\]/s);
});

runTest('web studio defers mock task service loading instead of pinning it to infrastructure startup', () => {
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
  assert.match(webStudioSource, /import\('..\/services\/index\.ts'\)/);
});

runTest('infrastructure root exports a lightweight mock-service proxy instead of the heavy mock implementation', () => {
  const infrastructureIndexSource = read('packages/sdkwork-claw-infrastructure/src/index.ts');
  const servicesIndexSource = read('packages/sdkwork-claw-infrastructure/src/services/index.ts');

  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/services\/studioMockService\.ts'/);
  assert.doesNotMatch(servicesIndexSource, /export \* from '.\/studioMockService\.ts'/);
  assert.match(infrastructureIndexSource, /export \* from '.\/services\/studioMockServiceProxy\.ts'/);
  assert.match(servicesIndexSource, /export \* from '.\/studioMockServiceProxy\.ts'/);
});
