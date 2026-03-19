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

runTest('sdkwork-claw-install keeps the V5 install package surface locally', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-install/package.json');
  const indexSource = read('packages/sdkwork-claw-install/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-install/src/Install.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/InstallDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/components/MobileAppDownloadDialog.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/components/MobileAppDownloadQrCode.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/components/MobileAppDownloadSection.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/pages/install/Install.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/pages/install/InstallDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-install/src/services/installerService.ts'));
  assert.ok(exists('packages/sdkwork-claw-install/src/services/mobileAppGuideService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-install']);
  assert.equal(typeof pkg.dependencies?.qrcode, 'string');
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-install/);
  assert.match(indexSource, /MobileAppDownloadDialog/);
  assert.match(indexSource, /MobileAppDownloadSection/);
});

runTest('sdkwork-claw-install preserves the V5 installation methods and system requirements surface', () => {
  const installSource = read('packages/sdkwork-claw-install/src/pages/install/Install.tsx');
  const sectionSource = read('packages/sdkwork-claw-install/src/components/MobileAppDownloadSection.tsx');

  assert.match(installSource, /useTranslation/);
  assert.match(installSource, /translateMethodText/);
  assert.match(installSource, /t\('install\.page\.systemRequirements\.title'\)/);
  assert.match(installSource, /id: 'script'/);
  assert.match(installSource, /id: 'docker'/);
  assert.match(installSource, /id: 'npm'/);
  assert.match(installSource, /id: 'cloud'/);
  assert.match(installSource, /id: 'source'/);
  assert.match(installSource, /installerService\.executeInstallScript/);
  assert.match(installSource, /MobileAppDownloadSection/);
  assert.match(sectionSource, /install\.mobileGuide\.section/);
});

runTest('sdkwork-claw-install keeps install execution behind infrastructure abstraction', () => {
  const serviceSource = read('packages/sdkwork-claw-install/src/services/installerService.ts');
  const infraSource = read('packages/sdkwork-claw-infrastructure/src/services/installerService.ts');

  assert.match(serviceSource, /@sdkwork\/claw-infrastructure/);
  assert.doesNotMatch(serviceSource, /@tauri-apps\/api\/core/);
  assert.match(infraSource, /getInstallerPlatform/);
  assert.match(infraSource, /executeInstallScript/);
});

runTest('sdkwork-claw-install resolves mobile guidance through feature-local service, sdkwork download links, and QR affordances', () => {
  const serviceSource = read('packages/sdkwork-claw-install/src/services/mobileAppGuideService.ts');
  const dialogSource = read('packages/sdkwork-claw-install/src/components/MobileAppDownloadDialog.tsx');
  const cardSource = read('packages/sdkwork-claw-install/src/components/MobileAppDownloadChannelCard.tsx');

  assert.match(serviceSource, /APP_ENV/);
  assert.match(serviceSource, /https:\/\/clawstudio\.sdkwork\.com\/platforms\/android/);
  assert.match(serviceSource, /https:\/\/clawstudio\.sdkwork\.com\/platforms\/ios/);
  assert.match(serviceSource, /https:\/\/clawstudio\.sdkwork\.com\/platforms\/harmony/);
  assert.match(serviceSource, /'harmony'/);
  assert.match(dialogSource, /mobileAppGuideService/);
  assert.match(dialogSource, /QRCode|QrCode|qrCode|qr code/);
  assert.match(dialogSource, /platform\.openExternal/);
  assert.match(dialogSource, /platform\.copy/);
  assert.match(cardSource, /channel\.href/);
});
