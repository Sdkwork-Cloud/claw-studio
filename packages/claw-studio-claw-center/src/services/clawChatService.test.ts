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

await runTest('clawChatService seeds a provider welcome message for claw detail chat', async () => {
  const service = createClawChatService({ initialDelayMs: 0, responseDelayMs: 0 });

  const messages = await service.getInitialMessages('claw-009', 'Hello from QuickBites');

  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.sender, 'provider');
  assert.equal(messages[0]?.text, 'Hello from QuickBites');
});

await runTest('clawChatService returns the canned storefront reply', async () => {
  const service = createClawChatService({ initialDelayMs: 0, responseDelayMs: 0 });

  const response = await service.sendMessage('claw-009', 'I want the pizza combo');

  assert.equal(response.sender, 'provider');
  assert.match(response.text, /specific requirements/i);
  assert.ok(response.time.length > 0);
});
