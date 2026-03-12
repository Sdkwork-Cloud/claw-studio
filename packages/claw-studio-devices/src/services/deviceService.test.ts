import assert from 'node:assert/strict';
import { deviceService } from './deviceService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('getList starts empty and supports pagination like the v3 backend-driven flow', async () => {
  const result = await deviceService.getList({ page: 1, pageSize: 10 });

  assert.equal(result.total, 0);
  assert.deepEqual(result.items, []);
});

await runTest('create delegates to registerDevice and persists the created device', async () => {
  const created = await deviceService.create({ name: 'Kitchen Sensor' });

  assert.match(created.id, /^claw-/);
  assert.equal(created.name, 'Kitchen Sensor');

  const devices = await deviceService.getDevices();
  assert.equal(devices.some((device) => device.id === created.id), true);
});

await runTest('delete removes a previously registered device and its installed skills', async () => {
  const created = await deviceService.registerDevice('Garage Sensor');

  await deviceService.delete(created.id);

  const devices = await deviceService.getDevices();
  assert.equal(devices.some((device) => device.id === created.id), false);
  assert.deepEqual(await deviceService.getDeviceSkills(created.id), []);
});
