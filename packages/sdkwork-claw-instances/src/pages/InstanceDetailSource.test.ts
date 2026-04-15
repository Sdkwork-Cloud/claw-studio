import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

const instanceDetailPath = new URL('./InstanceDetail.tsx', import.meta.url);
const openClawInstanceDetailPagePath = new URL('./OpenClawInstanceDetailPage.tsx', import.meta.url);
const hermesInstanceDetailPagePath = new URL('./HermesInstanceDetailPage.tsx', import.meta.url);
const unsupportedInstanceDetailPagePath = new URL('./UnsupportedInstanceDetailPage.tsx', import.meta.url);

await runTest(
  'InstanceDetail keeps shared routing separate from kernel detail implementations and passes a structured detail source',
  async () => {
    const routeSource = await readFile(instanceDetailPath, 'utf8');
    const openClawDetailSource = await readFile(openClawInstanceDetailPagePath, 'utf8');
    const hermesDetailSource = await readFile(hermesInstanceDetailPagePath, 'utf8');
    const unsupportedDetailSource = await readFile(unsupportedInstanceDetailPagePath, 'utf8');

    assert.match(routeSource, /useMemo/);
    assert.match(routeSource, /resolveSupportedInstanceDetailModule\(/);
    assert.match(routeSource, /createInstanceDetailSource\(/);
    assert.match(routeSource, /detailModule\.DetailPage/);
    assert.match(routeSource, /<DetailPage source=\{detailSource\} \/>/);
    assert.match(routeSource, /loadBaseDetail:\s*(?:async\s*)?\(instanceId\)\s*=>/);
    assert.match(routeSource, /loadModulePayload:\s*(?:async\s*)?\(instanceId\)\s*=>/);
    assert.match(routeSource, /const detailSource = useMemo\(/);
    assert.match(routeSource, /const kernelId = resolveRegistryKernelId\(instance\);/);
    assert.match(routeSource, /resolveSupportedInstanceDetailModule\(kernelId\)/);
    assert.match(routeSource, /kernelId=\{kernelId\}/);
    assert.match(routeSource, /kernelId,\s*$/m);
    assert.doesNotMatch(routeSource, /detailModule === 'hermes'/);
    assert.doesNotMatch(routeSource, /detailModule !== 'openclaw'/);
    assert.doesNotMatch(routeSource, /function OpenClawInstanceDetailPage\(/);
    assert.doesNotMatch(routeSource, /buildOpenClawAgentDialogStateHandlers/);
    assert.doesNotMatch(routeSource, /resolveRegistryRuntimeKind\(instance\)/);

    assert.match(openClawDetailSource, /function OpenClawInstanceDetailPage\(/);
    assert.match(openClawDetailSource, /source\??:\s*InstanceDetailSource/);
    assert.match(openClawDetailSource, /buildOpenClawAgentDialogStateHandlers/);
    assert.match(openClawDetailSource, /source\s*\.\s*loadModulePayload\(\)/);
    assert.match(openClawDetailSource, /getOpenClawWorkbenchFromModulePayload/);
    assert.match(openClawDetailSource, /instanceWorkbenchService\.getInstanceWorkbench\(targetInstanceId\)/);
    assert.doesNotMatch(openClawDetailSource, /getOpenClawInstanceDetailSourceExtension/);

    assert.match(hermesDetailSource, /function HermesInstanceDetailPage\(/);
    assert.match(hermesDetailSource, /source\??:\s*InstanceDetailSource/);
    assert.match(hermesDetailSource, /source\s*\.\s*loadBaseDetail\(\)/);
    assert.match(hermesDetailSource, /source\s*\.\s*loadModulePayload\(\)/);
    assert.match(hermesDetailSource, /instances\.detail\.modules\.hermes\.readiness\.title/);
    assert.match(hermesDetailSource, /sections\.readinessChecks/);
    assert.doesNotMatch(hermesDetailSource, /\}, \[source\]\);/);
    assert.doesNotMatch(hermesDetailSource, /instanceWorkbenchService\.getInstanceWorkbench\(instanceId\)/);
    assert.doesNotMatch(hermesDetailSource, /source\.loadWorkbench\(\)/);
    assert.doesNotMatch(hermesDetailSource, /buildHermesRuntimePolicies\(/);

    assert.match(unsupportedDetailSource, /interface UnsupportedInstanceDetailPageProps \{/);
    assert.match(unsupportedDetailSource, /kernelId:\s*string;/);
    assert.match(unsupportedDetailSource, /kernel:\s*formatWorkbenchLabel\(kernelId\)/);
    assert.doesNotMatch(unsupportedDetailSource, /runtimeKind:\s*string;/);
    assert.doesNotMatch(unsupportedDetailSource, /formatWorkbenchLabel\(runtimeKind\)/);
  },
);
