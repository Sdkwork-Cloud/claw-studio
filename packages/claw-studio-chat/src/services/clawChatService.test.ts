import assert from 'node:assert/strict';
import { createClawChatService } from './clawChatService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('clawChatService getInitialMessages seeds a provider welcome message', async () => {
  const service = createClawChatService({ initialDelayMs: 0, responseDelayMs: 0 });

  const messages = await service.getInitialMessages('provider-1', 'Welcome to Claw Center');

  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.sender, 'provider');
  assert.equal(messages[0]?.text, 'Welcome to Claw Center');
});

await runTest('clawChatService sendMessage returns the canned provider follow-up', async () => {
  const service = createClawChatService({ initialDelayMs: 0, responseDelayMs: 0 });

  const response = await service.sendMessage('provider-1', 'Need a GPU cluster');

  assert.equal(response.sender, 'provider');
  assert.match(response.text, /specific requirements/i);
  assert.ok(response.time.length > 0);
});
