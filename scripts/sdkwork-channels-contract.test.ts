import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-claw-channels is implemented locally with V5 instance-aware channel wiring', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-channels/package.json');
  const indexSource = read('packages/sdkwork-claw-channels/src/index.ts');
  const serviceSource = read('packages/sdkwork-claw-channels/src/services/channelService.ts');
  const pageSource = read('packages/sdkwork-claw-channels/src/pages/channels/Channels.tsx');

  assert.ok(exists('packages/sdkwork-claw-channels/src/Channels.tsx'));
  assert.ok(exists('packages/sdkwork-claw-channels/src/services/channelService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-channels']);
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-instances']);
  assert.equal(pkg.dependencies?.['@sdkwork/claw-core'], 'workspace:*');
  assert.equal(pkg.dependencies?.['@sdkwork/claw-types'], 'workspace:*');
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-channels/);

  assert.match(serviceSource, /import\s+\{[\s\S]*studio,[\s\S]*studioMockService[\s\S]*\}\s+from\s+'@sdkwork\/claw-infrastructure'/);
  assert.match(serviceSource, /openClawConfigService/);
  assert.match(serviceSource, /resolveInstanceConfigPath/);
  assert.match(serviceSource, /getChannels\(instanceId: string\): Promise<Channel\[]>/);
  assert.match(serviceSource, /studioMockService\.listChannels\(instanceId\)/);
  assert.match(serviceSource, /studio\.getInstanceDetail\(instanceId\)/);
  assert.match(serviceSource, /updateChannelStatus\(instanceId: string, channelId: string, enabled: boolean\)/);
  assert.match(serviceSource, /studioMockService\.updateChannelStatus\(channelId, enabled\)/);
  assert.match(serviceSource, /openClawConfigService\.setChannelEnabled/);
  assert.match(serviceSource, /saveChannelConfig\(instanceId: string, channelId: string, configData: Record<string, string>\)/);
  assert.match(serviceSource, /studioMockService\.saveChannelConfig\(channelId, configData\)/);
  assert.match(serviceSource, /openClawConfigService\.saveChannelConfiguration/);
  assert.match(serviceSource, /deleteChannelConfig\(instanceId: string, channelId: string\)/);
  assert.match(serviceSource, /studioMockService\.deleteChannelConfig\(channelId\)/);
  assert.doesNotMatch(serviceSource, /fetch\('/);

  assert.match(pageSource, /useInstanceStore/);
  assert.match(pageSource, /const \{ activeInstanceId \} = useInstanceStore\(\)/);
  assert.match(pageSource, /channelService\.getChannels\(activeInstanceId\)/);
  assert.match(pageSource, /channelService\.updateChannelStatus\(\s*activeInstanceId,\s*channel\.id,\s*nextEnabled,\s*\)/);
  assert.match(pageSource, /channelService\.saveChannelConfig\(activeInstanceId, selectedChannel\.id, formData\)/);
  assert.match(pageSource, /channelService\.deleteChannelConfig\(activeInstanceId, selectedChannel\.id\)/);
  assert.match(pageSource, /ChannelWorkspace/);
  assert.match(pageSource, /getChannelOfficialLink/);
  assert.match(pageSource, /openExternalUrl/);
  assert.match(pageSource, /actionDownloadApp/);
  assert.match(pageSource, /onOpenOfficialLink=\{\(_channel, link\) => void openOfficialLink\(link\.href\)\}/);
  assert.doesNotMatch(pageSource, /href=\{selectedChannelOfficialLink\.href\}/);
});
