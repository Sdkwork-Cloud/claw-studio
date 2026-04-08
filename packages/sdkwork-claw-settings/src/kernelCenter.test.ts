/// <reference types="node" />
import assert from 'node:assert/strict';
import fs from 'node:fs';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function readJson(filePath: URL | string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, any>;
}

await runTest(
  'KernelCenter consumes published desktop startup evidence and declares locale copy for the section',
  async () => {
    const kernelCenterSource = fs.readFileSync(
      new URL('./KernelCenter.tsx', import.meta.url),
      'utf8',
    );
    const enSettings = readJson(
      new URL(
        '../../sdkwork-claw-i18n/src/locales/en/settings.json',
        import.meta.url,
      ),
    );
    const zhSettings = readJson(
      new URL(
        '../../sdkwork-claw-i18n/src/locales/zh/settings.json',
        import.meta.url,
      ),
    );

    assert.match(kernelCenterSource, /data-slot="kernel-center-startup-evidence"/);
    assert.match(kernelCenterSource, /dashboard\?\.startupEvidence/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.sections\.startupEvidence/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceStatus/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidencePhase/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceRunId/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceRecordedAt/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceReady/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidencePath/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceDescriptorMode/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceDescriptorLifecycle/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceDescriptorEndpointId/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceDescriptorActivePort/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceDescriptorRequestedPort/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceDescriptorLoopbackOnly/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceDescriptorDynamicPort/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceDescriptorStateStoreDriver/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceDescriptorStateStoreProfileId/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceBuiltInInstanceId/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceBuiltInInstanceName/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceBuiltInInstanceVersion/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceBuiltInInstanceRuntimeKind/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceBuiltInInstanceDeploymentMode/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceBuiltInInstanceTransportKind/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceBuiltInInstanceBaseUrl/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceBuiltInInstanceWebsocketUrl/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceBuiltInInstanceIsBuiltIn/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceBuiltInInstanceIsDefault/);
    assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.startupEvidenceErrorCause/);

    assert.equal(enSettings.kernelCenter.sections.startupEvidence, 'Startup Evidence');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceStatus, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidencePhase, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceRunId, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceRecordedAt, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceReady, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidencePath, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceDescriptorMode, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceDescriptorLifecycle, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceDescriptorEndpointId, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceDescriptorActivePort, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceDescriptorRequestedPort, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceDescriptorLoopbackOnly, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceDescriptorDynamicPort, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceDescriptorStateStoreDriver, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceDescriptorStateStoreProfileId, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceId, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceName, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceVersion, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceRuntimeKind, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceDeploymentMode, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceTransportKind, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceBaseUrl, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceWebsocketUrl, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceIsBuiltIn, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceIsDefault, 'string');
    assert.equal(typeof enSettings.kernelCenter.fields.startupEvidenceErrorCause, 'string');

    assert.equal(typeof zhSettings.kernelCenter.sections.startupEvidence, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceStatus, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidencePhase, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceRunId, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceRecordedAt, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceReady, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidencePath, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceDescriptorMode, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceDescriptorLifecycle, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceDescriptorEndpointId, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceDescriptorActivePort, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceDescriptorRequestedPort, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceDescriptorLoopbackOnly, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceDescriptorDynamicPort, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceDescriptorStateStoreDriver, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceDescriptorStateStoreProfileId, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceId, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceName, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceVersion, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceRuntimeKind, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceDeploymentMode, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceTransportKind, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceBaseUrl, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceWebsocketUrl, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceIsBuiltIn, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceBuiltInInstanceIsDefault, 'string');
    assert.equal(typeof zhSettings.kernelCenter.fields.startupEvidenceErrorCause, 'string');
  },
);
