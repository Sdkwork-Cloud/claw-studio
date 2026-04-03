import assert from 'node:assert/strict';
import {
  isExistingGuidedInstallProviderDraft,
  isGuidedInstallProviderDraftReady,
} from './guidedInstallProviderPolicy.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest('guided install provider policy treats provider-center selections as existing routes', async () => {
  assert.equal(
    isExistingGuidedInstallProviderDraft({
      providerId: 'provider-config-openai-primary',
      channelId: 'openai',
      name: 'OpenAI Primary',
      apiKey: '',
      baseUrl: 'https://ai.sdkwork.com',
      modelId: 'sdkwork-chat',
    }),
    true,
  );
  assert.equal(
    isExistingGuidedInstallProviderDraft({
      channelId: 'openai',
      name: 'Guided OpenAI',
      apiKey: 'sk-guided',
      baseUrl: 'https://api.openai.com/v1',
      modelId: 'gpt-5.4',
    }),
    false,
  );
});

await runTest('guided install provider policy only requires upstream credentials for new routes', async () => {
  assert.equal(
    isGuidedInstallProviderDraftReady({
      providerId: 'local-ai-proxy-system-default-openai-compatible',
      channelId: 'openai',
      name: 'SDKWork Default',
      apiKey: '',
      baseUrl: 'https://ai.sdkwork.com',
      modelId: 'sdkwork-chat',
    }),
    true,
  );

  assert.equal(
    isGuidedInstallProviderDraftReady({
      channelId: 'openai',
      name: 'Guided OpenAI',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      modelId: 'gpt-5.4',
    }),
    false,
  );

  assert.equal(
    isGuidedInstallProviderDraftReady({
      channelId: 'openai',
      name: 'Guided OpenAI',
      apiKey: 'sk-guided',
      baseUrl: 'https://api.openai.com/v1',
      modelId: 'gpt-5.4',
    }),
    true,
  );
});
