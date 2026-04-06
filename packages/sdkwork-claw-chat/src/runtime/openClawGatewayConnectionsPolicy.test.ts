import assert from 'node:assert/strict';
import {
  resolveOpenClawGatewayWarmPlan,
  shouldWarmOpenClawGatewayConnections,
} from './openClawGatewayConnectionsPolicy.ts';

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

runTest('chat route warms the directory plus the active instance', () => {
  assert.deepEqual(
    resolveOpenClawGatewayWarmPlan({
      pathname: '/chat?instance=openclaw',
      activeInstanceId: 'instance-b',
      directoryInstanceIds: ['instance-a', 'instance-b'],
    }),
    {
      shouldQueryDirectory: true,
      instanceIds: ['instance-a', 'instance-b'],
    },
  );
});

runTest('non-chat workspace routes keep only the active instance warm', () => {
  assert.equal(shouldWarmOpenClawGatewayConnections('/tasks'), true);
  assert.equal(shouldWarmOpenClawGatewayConnections('/instances/abc'), true);
  assert.equal(shouldWarmOpenClawGatewayConnections('/kernel'), true);
  assert.deepEqual(
    resolveOpenClawGatewayWarmPlan({
      pathname: '/tasks',
      activeInstanceId: 'instance-active',
      directoryInstanceIds: ['instance-a', 'instance-b'],
    }),
    {
      shouldQueryDirectory: false,
      instanceIds: ['instance-active'],
    },
  );
});

runTest('auth and install routes stay cold even if an active instance exists', () => {
  assert.equal(shouldWarmOpenClawGatewayConnections('/auth'), false);
  assert.equal(shouldWarmOpenClawGatewayConnections('/login/oauth/callback/github'), false);
  assert.equal(shouldWarmOpenClawGatewayConnections('/install/windows'), false);
  assert.deepEqual(
    resolveOpenClawGatewayWarmPlan({
      pathname: '/install/windows',
      activeInstanceId: 'instance-active',
      directoryInstanceIds: ['instance-a'],
    }),
    {
      shouldQueryDirectory: false,
      instanceIds: [],
    },
  );
});
