import assert from 'node:assert/strict';

import {
  CrawChatClient,
  CrawChatSdkClient,
} from './shims/craw-chat-sdk-compat.ts';

const authTokens: string[] = [];

const backendClient = {
  setAuthToken(token: string) {
    authTokens.push(token);
  },
} as const;

const client = new CrawChatClient({
  backendClient,
});

assert.ok(
  client instanceof CrawChatSdkClient,
  'compat client must preserve the composed SDK client surface',
);
assert.equal(
  client.backendClient,
  backendClient,
  'compat client must preserve the provided backend client instance',
);

client.setAuthToken('Bearer compat-token');
assert.deepEqual(
  authTokens,
  ['Bearer compat-token'],
  'compat client must forward auth tokens to the generated backend client',
);
assert.equal(
  client.getAuthToken(),
  'Bearer compat-token',
  'compat client must expose the current auth token through the legacy getter',
);

client.clearAuthToken();
assert.deepEqual(
  authTokens,
  ['Bearer compat-token', ''],
  'compat client must support clearing auth tokens through the legacy API',
);
assert.equal(
  client.getAuthToken(),
  '',
  'compat client must report the cleared auth token through the legacy getter',
);

console.log('ok - craw-chat SDK compat shim restores the legacy CrawChatClient contract');
