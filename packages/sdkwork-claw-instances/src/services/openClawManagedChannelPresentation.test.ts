import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

async function loadManagedChannelPresentationModule() {
  const moduleUrl = new URL('./openClawManagedChannelPresentation.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected openClawManagedChannelPresentation.ts to exist',
  );

  return import('./openClawManagedChannelPresentation.ts');
}

function createManagedChannelFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'qq',
    name: 'QQ',
    description: 'QQ bridge',
    status: 'connected',
    enabled: true,
    configurationMode: 'required',
    fieldCount: 2,
    configuredFieldCount: 1,
    setupSteps: ['Scan QR'],
    values: {
      appId: 'baseline-app',
      appSecret: '',
    },
    fields: [
      {
        key: 'appId',
        label: 'App Id',
        placeholder: 'appid',
        required: true,
      },
      {
        key: 'appSecret',
        label: 'App Secret',
        placeholder: 'secret',
        required: true,
      },
    ],
    ...overrides,
  } as any;
}

await runTest(
  'buildOpenClawManagedChannelWorkspaceSyncState clears selection, drafts, and error state when no managed channels exist',
  async () => {
    const { buildOpenClawManagedChannelWorkspaceSyncState } =
      await loadManagedChannelPresentationModule();

    const syncState = buildOpenClawManagedChannelWorkspaceSyncState({
      managedChannels: [],
    });

    assert.equal(syncState.resolveSelectedManagedChannelId('qq'), null);
    assert.deepEqual(syncState.managedChannelDrafts, {});
    assert.equal(syncState.managedChannelError, null);
  },
);

await runTest(
  'buildOpenClawManagedChannelWorkspaceSyncState preserves a valid managed channel selection and clears stale selections while resetting drafts and error state',
  async () => {
    const { buildOpenClawManagedChannelWorkspaceSyncState } =
      await loadManagedChannelPresentationModule();

    const syncState = buildOpenClawManagedChannelWorkspaceSyncState({
      managedChannels: [
        createManagedChannelFixture(),
        createManagedChannelFixture({
          id: 'wechat',
          name: 'WeChat',
        }),
      ],
    });

    assert.equal(syncState.resolveSelectedManagedChannelId('wechat'), 'wechat');
    assert.equal(syncState.resolveSelectedManagedChannelId('missing-channel'), null);
    assert.equal(syncState.resolveSelectedManagedChannelId(null), null);
    assert.deepEqual(syncState.managedChannelDrafts, {});
    assert.equal(syncState.managedChannelError, null);
  },
);

await runTest(
  'buildOpenClawManagedChannelSelectionState derives the selected managed channel and prefers explicit drafts over channel values',
  async () => {
    const { buildOpenClawManagedChannelSelectionState } =
      await loadManagedChannelPresentationModule();

    const selectionState = buildOpenClawManagedChannelSelectionState({
      managedChannels: [
        createManagedChannelFixture(),
        createManagedChannelFixture({
          id: 'wechat',
          name: 'WeChat',
          values: {
            appId: 'wechat-app',
            appSecret: 'wechat-secret',
          },
        }),
      ],
      selectedManagedChannelId: 'wechat',
      managedChannelDrafts: {
        wechat: {
          appId: 'override-app',
          appSecret: '',
        },
      },
    });

    assert.equal(selectionState.selectedManagedChannel?.id, 'wechat');
    assert.deepEqual(selectionState.selectedManagedChannelDraft, {
      appId: 'override-app',
      appSecret: '',
    });
  },
);

await runTest(
  'buildOpenClawManagedChannelSelectionState clears the selected managed channel and draft when the selected id is missing',
  async () => {
    const { buildOpenClawManagedChannelSelectionState } =
      await loadManagedChannelPresentationModule();

    const selectionState = buildOpenClawManagedChannelSelectionState({
      managedChannels: [createManagedChannelFixture()],
      selectedManagedChannelId: 'missing-channel',
      managedChannelDrafts: {
        qq: {
          appId: 'override-app',
          appSecret: 'override-secret',
        },
      },
    });

    assert.equal(selectionState.selectedManagedChannel, null);
    assert.equal(selectionState.selectedManagedChannelDraft, null);
  },
);

await runTest(
  'buildOpenClawManagedChannelWorkspaceItems merges runtime channel metadata, applies explicit drafts, and derives configured status',
  async () => {
    const { buildOpenClawManagedChannelWorkspaceItems } =
      await loadManagedChannelPresentationModule();

    const workspaceItems = buildOpenClawManagedChannelWorkspaceItems({
      managedChannels: [
        createManagedChannelFixture({
          id: 'wechat',
          name: 'WeChat',
          description: 'Managed description',
          status: 'connected',
          values: {
            appId: 'wechat-app',
            appSecret: 'wechat-secret',
          },
          setupSteps: ['Managed setup'],
        }),
      ],
      runtimeChannels: [
        {
          id: 'wechat',
          description: 'Runtime description',
          setupSteps: ['Runtime setup'],
        },
      ] as any,
      managedChannelDrafts: {
        wechat: {
          appId: 'override-app',
          appSecret: '',
        },
      },
    });

    assert.equal(workspaceItems.length, 1);
    assert.equal(workspaceItems[0]?.id, 'wechat');
    assert.equal(workspaceItems[0]?.description, 'Runtime description');
    assert.equal(workspaceItems[0]?.status, 'connected');
    assert.equal(workspaceItems[0]?.configuredFieldCount, 1);
    assert.deepEqual(workspaceItems[0]?.setupSteps, ['Runtime setup']);
    assert.deepEqual(workspaceItems[0]?.values, {
      appId: 'override-app',
      appSecret: '',
    });
  },
);

await runTest(
  'buildOpenClawManagedChannelWorkspaceItems falls back to managed metadata and derives none/not-configured states',
  async () => {
    const { buildOpenClawManagedChannelWorkspaceItems } =
      await loadManagedChannelPresentationModule();

    const workspaceItems = buildOpenClawManagedChannelWorkspaceItems({
      managedChannels: [
        createManagedChannelFixture({
          id: 'disabled-none',
          configurationMode: 'none',
          enabled: false,
          status: 'connected',
        }),
        createManagedChannelFixture({
          id: 'empty-required',
          configurationMode: 'required',
          enabled: true,
          status: 'connected',
          values: {
            appId: '',
            appSecret: '',
          },
        }),
      ],
      runtimeChannels: null,
      managedChannelDrafts: {},
    });

    assert.equal(workspaceItems.length, 2);
    assert.equal(workspaceItems[0]?.description, 'QQ bridge');
    assert.equal(workspaceItems[0]?.status, 'disconnected');
    assert.deepEqual(workspaceItems[0]?.setupSteps, ['Scan QR']);
    assert.equal(workspaceItems[1]?.status, 'not_configured');
    assert.equal(workspaceItems[1]?.configuredFieldCount, 0);
    assert.deepEqual(workspaceItems[1]?.values, {
      appId: '',
      appSecret: '',
    });
  },
);

await runTest(
  'findOpenClawManagedChannelById returns the matching managed channel and null for unknown ids',
  async () => {
    const { findOpenClawManagedChannelById } = await loadManagedChannelPresentationModule();

    const managedChannels = [
      createManagedChannelFixture(),
      createManagedChannelFixture({
        id: 'wechat',
        name: 'WeChat',
      }),
    ];

    assert.equal(findOpenClawManagedChannelById(managedChannels, 'wechat')?.id, 'wechat');
    assert.equal(findOpenClawManagedChannelById(managedChannels, 'missing-channel'), null);
    assert.equal(findOpenClawManagedChannelById(null, 'wechat'), null);
  },
);

await runTest(
  'buildOpenClawManagedChannelStateHandlers routes selection clears and draft changes through page-owned setters',
  async () => {
    const { buildOpenClawManagedChannelStateHandlers } =
      await loadManagedChannelPresentationModule();
    const selectedManagedChannel = createManagedChannelFixture();
    let selectedManagedChannelId: string | null = 'qq';
    let managedChannelError: string | null = 'Stale error';
    let managedChannelDrafts = {
      qq: {
        appId: 'baseline-app',
        appSecret: '',
      },
    };

    const handlers = buildOpenClawManagedChannelStateHandlers({
      selectedManagedChannel,
      setManagedChannelError: (value) => {
        managedChannelError = value;
      },
      setSelectedManagedChannelId: (value) => {
        selectedManagedChannelId = value;
      },
      setManagedChannelDrafts: (updater) => {
        managedChannelDrafts = updater(managedChannelDrafts);
      },
    });

    handlers.onSelectedManagedChannelIdChange('wechat');

    assert.equal(selectedManagedChannelId, 'wechat');
    assert.equal(managedChannelError, null);

    managedChannelError = 'Another stale error';
    handlers.onManagedChannelFieldChange('appSecret', 'secret-1');

    assert.equal(managedChannelError, null);
    assert.deepEqual(managedChannelDrafts, {
      qq: {
        appId: 'baseline-app',
        appSecret: 'secret-1',
      },
    });
  },
);

await runTest(
  'buildOpenClawManagedChannelStateHandlers ignores draft updates when the page has no selected managed channel',
  async () => {
    const { buildOpenClawManagedChannelStateHandlers } =
      await loadManagedChannelPresentationModule();
    let managedChannelError: string | null = 'Stale error';
    let selectedManagedChannelId: string | null = 'qq';
    let managedChannelDrafts = {
      qq: {
        appId: 'baseline-app',
        appSecret: '',
      },
    };

    const handlers = buildOpenClawManagedChannelStateHandlers({
      selectedManagedChannel: null,
      setManagedChannelError: (value) => {
        managedChannelError = value;
      },
      setSelectedManagedChannelId: (value) => {
        selectedManagedChannelId = value;
      },
      setManagedChannelDrafts: (updater) => {
        managedChannelDrafts = updater(managedChannelDrafts);
      },
    });

    handlers.onManagedChannelFieldChange('appSecret', 'ignored');

    assert.equal(selectedManagedChannelId, 'qq');
    assert.equal(managedChannelError, 'Stale error');
    assert.deepEqual(managedChannelDrafts, {
      qq: {
        appId: 'baseline-app',
        appSecret: '',
      },
    });
  },
);
