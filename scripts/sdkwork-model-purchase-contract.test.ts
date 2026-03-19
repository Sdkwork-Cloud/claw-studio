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

runTest('sdkwork-claw-model-purchase is implemented as a real feature package', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-model-purchase/package.json',
  );
  const indexSource = read('packages/sdkwork-claw-model-purchase/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-model-purchase/src/ModelPurchase.tsx'));
  assert.ok(exists('packages/sdkwork-claw-model-purchase/src/pages/ModelPurchase.tsx'));
  assert.ok(exists('packages/sdkwork-claw-model-purchase/src/components/ModelPurchaseSidebar.tsx'));
  assert.ok(exists('packages/sdkwork-claw-model-purchase/src/components/ModelPurchaseBillingSwitch.tsx'));
  assert.ok(exists('packages/sdkwork-claw-model-purchase/src/components/ModelPurchasePlanGrid.tsx'));
  assert.ok(exists('packages/sdkwork-claw-model-purchase/src/components/ModelPurchaseVendorHero.tsx'));
  assert.ok(exists('packages/sdkwork-claw-model-purchase/src/services/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-model-purchase/src/services/modelPurchaseCatalog.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-model-purchase']);
  assert.match(indexSource, /\.\/ModelPurchase/);
  assert.match(indexSource, /\.\/services/);
});

runTest('sdkwork-claw-model-purchase renders a sidebar-driven billing experience', () => {
  const pageSource = read('packages/sdkwork-claw-model-purchase/src/pages/ModelPurchase.tsx');
  const sidebarSource = read(
    'packages/sdkwork-claw-model-purchase/src/components/ModelPurchaseSidebar.tsx',
  );
  const billingSource = read(
    'packages/sdkwork-claw-model-purchase/src/components/ModelPurchaseBillingSwitch.tsx',
  );
  const gridSource = read(
    'packages/sdkwork-claw-model-purchase/src/components/ModelPurchasePlanGrid.tsx',
  );
  const heroSource = read(
    'packages/sdkwork-claw-model-purchase/src/components/ModelPurchaseVendorHero.tsx',
  );
  const serviceSource = read(
    'packages/sdkwork-claw-model-purchase/src/services/modelPurchaseCatalog.ts',
  );

  assert.match(pageSource, /data-slot="model-purchase-page"/);
  assert.match(pageSource, /useQuery/);
  assert.match(pageSource, /useTranslation/);
  assert.match(pageSource, /startTransition/);
  assert.match(sidebarSource, /data-slot="model-purchase-sidebar"/);
  assert.match(sidebarSource, /default/);
  assert.match(sidebarSource, /openai/);
  assert.match(sidebarSource, /minimax/);
  assert.match(billingSource, /data-slot="model-purchase-billing-switch"/);
  assert.match(billingSource, /monthly/);
  assert.match(billingSource, /quarterly/);
  assert.match(billingSource, /yearly/);
  assert.match(gridSource, /data-slot="model-purchase-plan-grid"/);
  assert.match(heroSource, /data-slot="model-purchase-vendor-hero"/);
  assert.match(serviceSource, /default/);
  assert.match(serviceSource, /openai/);
  assert.match(serviceSource, /minimax/);
  assert.match(serviceSource, /deepseek/);
});
