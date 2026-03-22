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
  assert.ok(exists('packages/sdkwork-claw-model-purchase/src/components/ModelPurchasePaymentView.tsx'));
  assert.ok(!exists('packages/sdkwork-claw-model-purchase/src/components/ModelPurchaseVendorSummary.tsx'));
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
  const paymentSource = read(
    'packages/sdkwork-claw-model-purchase/src/components/ModelPurchasePaymentView.tsx',
  );
  const heroSource = read(
    'packages/sdkwork-claw-model-purchase/src/components/ModelPurchaseVendorHero.tsx',
  );
  const serviceSource = read(
    'packages/sdkwork-claw-model-purchase/src/services/modelPurchaseCatalog.ts',
  );

  assert.match(pageSource, /data-slot="model-purchase-page"/);
  assert.match(pageSource, /min-h-0/);
  assert.match(pageSource, /model-purchase-main-panel/);
  assert.match(pageSource, /useQuery/);
  assert.match(pageSource, /useTranslation/);
  assert.match(pageSource, /startTransition/);
  assert.match(pageSource, /useState<'plans' \| 'payment'>\('plans'\)/);
  assert.match(pageSource, /<ModelPurchasePaymentView/);
  assert.doesNotMatch(pageSource, /ModelPurchaseVendorSummary/);
  assert.doesNotMatch(pageSource, /model-purchase-vendor-summary/);
  assert.match(pageSource, /vendor=\{selectedVendor\}/);
  assert.match(sidebarSource, /data-slot="model-purchase-sidebar"/);
  assert.match(sidebarSource, /default/);
  assert.match(sidebarSource, /openai/);
  assert.match(sidebarSource, /minimax/);
  assert.match(sidebarSource, /zhipu/);
  assert.match(billingSource, /data-slot="model-purchase-billing-switch"/);
  assert.match(billingSource, /monthly/);
  assert.match(billingSource, /quarterly/);
  assert.match(billingSource, /yearly/);
  assert.match(billingSource, /vendor:/);
  assert.match(billingSource, /vendor\.name/);
  assert.doesNotMatch(billingSource, /xl:flex-row/);
  assert.match(gridSource, /data-slot="model-purchase-plan-grid"/);
  assert.match(gridSource, /freeMembership/);
  assert.match(gridSource, /kind: 'free'/);
  assert.match(gridSource, /md:grid-cols-2/);
  assert.match(gridSource, /xl:grid-cols-4/);
  assert.match(gridSource, /flex h-full flex-col/);
  assert.match(gridSource, /onPurchasePlan: \(plan: ModelPurchasePlan\) => void/);
  assert.doesNotMatch(gridSource, /mt-auto/);
  assert.match(gridSource, /startPlan[\s\S]*planGrid\.quota/);
  assert.doesNotMatch(gridSource, /planGrid\.includedModels/);
  assert.match(paymentSource, /data-slot="model-purchase-payment-view"/);
  assert.match(paymentSource, /data-slot="model-purchase-package-details"/);
  assert.match(paymentSource, /onBack: \(\) => void/);
  assert.match(paymentSource, /onConfirmPayment: \(\) => void/);
  assert.doesNotMatch(paymentSource, /ModelPurchaseBillingSwitch/);
  assert.doesNotMatch(paymentSource, /SelectTrigger/);
  assert.match(heroSource, /data-slot="model-purchase-vendor-hero"/);
  assert.match(serviceSource, /default/);
  assert.match(serviceSource, /openai/);
  assert.match(serviceSource, /minimax/);
  assert.match(serviceSource, /deepseek/);
});
