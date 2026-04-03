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

const packageContracts = [
  {
    pkg: 'apps',
    files: [
      'packages/sdkwork-claw-apps/src/AppStore.tsx',
      'packages/sdkwork-claw-apps/src/AppDetail.tsx',
      'packages/sdkwork-claw-apps/src/services/appStoreService.ts',
    ],
    requiredExports: ["export * from './AppDetail';", "export * from './AppStore';"],
  },
  {
    pkg: 'channels',
    files: [
      'packages/sdkwork-claw-channels/src/Channels.tsx',
      'packages/sdkwork-claw-channels/src/services/channelService.ts',
    ],
    requiredExports: ["export * from './Channels';"],
  },
  {
    pkg: 'community',
    files: [
      'packages/sdkwork-claw-community/src/Community.tsx',
      'packages/sdkwork-claw-community/src/CommunityPostDetail.tsx',
      'packages/sdkwork-claw-community/src/NewPost.tsx',
      'packages/sdkwork-claw-community/src/services/communityService.ts',
    ],
    requiredExports: [
      "export * from './Community';",
      "export * from './CommunityPostDetail';",
      "export * from './NewPost';",
    ],
  },
  {
    pkg: 'devices',
    files: [
      'packages/sdkwork-claw-devices/src/Devices.tsx',
      'packages/sdkwork-claw-devices/src/services/deviceService.ts',
    ],
    requiredExports: ["export * from './Devices';"],
  },
  {
    pkg: 'docs',
    files: [
      'packages/sdkwork-claw-docs/src/Docs.tsx',
      'packages/sdkwork-claw-docs/src/content/index.ts',
      'packages/sdkwork-claw-docs/src/content/ArchitectureDoc.tsx',
      'packages/sdkwork-claw-docs/src/content/CliDoc.tsx',
      'packages/sdkwork-claw-docs/src/content/InstallDoc.tsx',
      'packages/sdkwork-claw-docs/src/content/IntroDoc.tsx',
      'packages/sdkwork-claw-docs/src/content/QuickstartDoc.tsx',
      'packages/sdkwork-claw-docs/src/content/SkillsDoc.tsx',
    ],
    requiredExports: ["export * from './Docs';", "export * from './content';"],
  },
  {
    pkg: 'extensions',
    files: [
      'packages/sdkwork-claw-extensions/src/Extensions.tsx',
      'packages/sdkwork-claw-extensions/src/services/extensionService.ts',
    ],
    requiredExports: ["export * from './Extensions';"],
  },
  {
    pkg: 'github',
    files: [
      'packages/sdkwork-claw-github/src/GitHubRepos.tsx',
      'packages/sdkwork-claw-github/src/GitHubRepoDetail.tsx',
      'packages/sdkwork-claw-github/src/services/githubService.ts',
    ],
    requiredExports: ["export * from './GitHubRepoDetail';", "export * from './GitHubRepos';"],
  },
  {
    pkg: 'huggingface',
    files: [
      'packages/sdkwork-claw-huggingface/src/HuggingFaceModels.tsx',
      'packages/sdkwork-claw-huggingface/src/HuggingFaceModelDetail.tsx',
      'packages/sdkwork-claw-huggingface/src/services/huggingfaceService.ts',
    ],
    requiredExports: [
      "export * from './HuggingFaceModelDetail';",
      "export * from './HuggingFaceModels';",
    ],
  },
  {
    pkg: 'install',
    files: [
      'packages/sdkwork-claw-install/src/Install.tsx',
      'packages/sdkwork-claw-install/src/InstallDetail.tsx',
    ],
    requiredExports: ["export * from './Install';", "export * from './InstallDetail';"],
  },
  {
    pkg: 'model-purchase',
    files: [
      'packages/sdkwork-claw-model-purchase/src/ModelPurchase.tsx',
      'packages/sdkwork-claw-model-purchase/src/pages/ModelPurchase.tsx',
      'packages/sdkwork-claw-model-purchase/src/services/modelPurchaseCatalog.ts',
    ],
    requiredExports: ["export * from './ModelPurchase';", "export * from './services';"],
  },
  {
    pkg: 'points',
    files: [
      'packages/sdkwork-claw-points/src/Points.tsx',
      'packages/sdkwork-claw-points/src/pages/Points.tsx',
      'packages/sdkwork-claw-points/src/services/pointsService.ts',
    ],
    requiredExports: ["export * from './Points';", "export * from './services';"],
  },
] as const;

runTest('remaining sdkwork feature packages are implemented locally instead of bridge re-exports', () => {
  for (const contract of packageContracts) {
    const packagePath = `packages/sdkwork-claw-${contract.pkg}/package.json`;
    const indexPath = `packages/sdkwork-claw-${contract.pkg}/src/index.ts`;
    const pkg = readJson<{ dependencies?: Record<string, string> }>(packagePath);
    const indexSource = read(indexPath);

    assert.ok(!pkg.dependencies?.[`@sdkwork/claw-studio-${contract.pkg}`], contract.pkg);
    assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-/);

    for (const file of contract.files) {
      assert.ok(exists(file), file);
    }

    for (const exportLine of contract.requiredExports) {
      assert.match(indexSource, new RegExp(exportLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  }
});
