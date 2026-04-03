import assert from 'node:assert/strict';
import { shouldWarmOpenClawGatewayConnections } from './openClawGatewayConnectionsPolicy.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('chat route enables gateway connection warmup', () => {
  assert.equal(shouldWarmOpenClawGatewayConnections('/chat'), true);
  assert.equal(shouldWarmOpenClawGatewayConnections('/chat?instance=openclaw'), true);
  assert.equal(shouldWarmOpenClawGatewayConnections('/chat#session'), true);
});

runTest('non-chat routes skip gateway connection warmup', () => {
  assert.equal(shouldWarmOpenClawGatewayConnections('/tasks'), false);
  assert.equal(shouldWarmOpenClawGatewayConnections('/instances/abc'), false);
  assert.equal(shouldWarmOpenClawGatewayConnections('/kernel'), false);
});
