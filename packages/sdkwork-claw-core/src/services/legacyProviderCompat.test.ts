import assert from 'node:assert/strict';
import {
  LEGACY_PROVIDER_KEY_PREFIX,
  normalizeLegacyProviderId,
  normalizeLegacyProviderModelRef,
} from './legacyProviderCompat.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('legacyProviderCompat exposes the legacy api-router provider prefix for migration-only callers', () => {
  assert.equal(LEGACY_PROVIDER_KEY_PREFIX, 'api-router-');
});

runTest('legacyProviderCompat normalizes legacy provider ids while preserving native ids', () => {
  assert.equal(normalizeLegacyProviderId('api-router-openai'), 'openai');
  assert.equal(normalizeLegacyProviderId(' openai '), 'openai');
  assert.equal(normalizeLegacyProviderId(''), '');
});

runTest('legacyProviderCompat normalizes model refs backed by legacy provider ids', () => {
  assert.equal(
    normalizeLegacyProviderModelRef(' api-router-openai/gpt-4.1 '),
    'openai/gpt-4.1',
  );
  assert.equal(
    normalizeLegacyProviderModelRef('openai/text-embedding-3-small'),
    'openai/text-embedding-3-small',
  );
  assert.equal(normalizeLegacyProviderModelRef('broken-ref'), 'broken-ref');
});
