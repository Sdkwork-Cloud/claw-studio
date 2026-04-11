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

async function loadManagedChannelMutationSupportModule() {
  const moduleUrl = new URL('./openClawManagedChannelMutationSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected openClawManagedChannelMutationSupport.ts to exist',
  );

  return import('./openClawManagedChannelMutationSupport.ts');
}

function createManagedChannelFixture() {
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
  } as any;
}

await runTest(
  'applyOpenClawManagedChannelDraftChange patches the selected channel draft while preserving sibling values',
  async () => {
    const { applyOpenClawManagedChannelDraftChange } =
      await loadManagedChannelMutationSupportModule();
    const channel = createManagedChannelFixture();

    const nextDrafts = applyOpenClawManagedChannelDraftChange({
      drafts: {
        qq: {
          appId: 'current-app',
          appSecret: '',
        },
      },
      channel,
      fieldKey: 'appSecret',
      value: 'secret-1',
    });

    assert.deepEqual(nextDrafts, {
      qq: {
        appId: 'current-app',
        appSecret: 'secret-1',
      },
    });
  },
);

await runTest(
  'buildOpenClawManagedChannelSaveMutationRequest returns required-field validation errors before the page runner executes',
  async () => {
    const { buildOpenClawManagedChannelSaveMutationRequest } =
      await loadManagedChannelMutationSupportModule();
    const setSaving = (value: boolean) => value;
    const setError = (value: string | null) => value;

    const result = buildOpenClawManagedChannelSaveMutationRequest({
      instanceId: 'instance-01',
      channel: createManagedChannelFixture(),
      draft: {
        appId: 'configured-app',
        appSecret: '   ',
      },
      setSaving,
      setError,
      afterSuccess: () => undefined,
    });

    assert.deepEqual(result, {
      kind: 'error',
      errorMessage: 'App Secret is required.',
    });
  },
);

await runTest(
  'buildOpenClawManagedChannelSaveMutationRequest packages save-config request metadata for the page shell',
  async () => {
    const { buildOpenClawManagedChannelSaveMutationRequest } =
      await loadManagedChannelMutationSupportModule();
    const channel = createManagedChannelFixture();
    const setSaving = (value: boolean) => value;
    const setError = (value: string | null) => value;
    const afterSuccess = () => undefined;

    const result = buildOpenClawManagedChannelSaveMutationRequest({
      instanceId: 'instance-01',
      channel,
      draft: {
        appId: 'configured-app',
        appSecret: 'secret-1',
      },
      setSaving,
      setError,
      afterSuccess,
    });

    assert.equal(result.kind, 'mutation');
    assert.equal(result.request.setSaving, setSaving);
    assert.equal(result.request.setError, setError);
    assert.equal(result.request.afterSuccess, afterSuccess);
    assert.equal(result.request.successMessage, 'QQ configuration saved.');
    assert.equal(result.request.failureMessage, 'Failed to save QQ.');
    assert.deepEqual(result.request.mutationPlan, {
      kind: 'saveConfig',
      instanceId: 'instance-01',
      channelId: 'qq',
      values: {
        appId: 'configured-app',
        appSecret: 'secret-1',
      },
    });
  },
);

await runTest(
  'managed channel toggle and delete requests preserve page-owned lifecycle metadata and empty-value shaping',
  async () => {
    const {
      buildOpenClawManagedChannelDeleteMutationRequest,
      buildOpenClawManagedChannelToggleMutationRequest,
    } = await loadManagedChannelMutationSupportModule();
    const channel = createManagedChannelFixture();
    const clearSelection = () => undefined;

    const toggleResult = buildOpenClawManagedChannelToggleMutationRequest({
      instanceId: 'instance-01',
      channel,
      nextEnabled: false,
    });

    assert.equal(toggleResult.kind, 'mutation');
    assert.equal(toggleResult.request.successMessage, 'QQ disabled.');
    assert.equal(toggleResult.request.failureMessage, 'Failed to update QQ.');
    assert.deepEqual(toggleResult.request.mutationPlan, {
      kind: 'toggleEnabled',
      instanceId: 'instance-01',
      channelId: 'qq',
      nextEnabled: false,
    });

    const deleteResult = buildOpenClawManagedChannelDeleteMutationRequest({
      instanceId: 'instance-01',
      channel,
      setSaving: (value: boolean) => value,
      setError: (value: string | null) => value,
      afterSuccess: clearSelection,
    });

    assert.equal(deleteResult.kind, 'mutation');
    assert.equal(deleteResult.request.afterSuccess, clearSelection);
    assert.equal(deleteResult.request.successMessage, 'QQ configuration removed.');
    assert.equal(deleteResult.request.failureMessage, 'Failed to delete QQ configuration.');
    assert.deepEqual(deleteResult.request.mutationPlan, {
      kind: 'deleteConfig',
      instanceId: 'instance-01',
      channelId: 'qq',
      emptyValues: {
        appId: '',
        appSecret: '',
      },
    });
  },
);

await runTest(
  'createOpenClawManagedChannelMutationRunner composes page-owned transport bindings and spinnerless reload behavior',
  async () => {
    const { createOpenClawManagedChannelMutationRunner } =
      await loadManagedChannelMutationSupportModule();
    const savingStates: boolean[] = [];
    const clearedErrors: Array<string | null> = [];
    const callLog: string[] = [];

    const runManagedChannelMutation = createOpenClawManagedChannelMutationRunner({
      executeSaveConfig: async (instanceId: string, channelId: string, values: Record<string, string>) => {
        callLog.push(`save:${instanceId}:${channelId}:${values.appId}:${values.appSecret}`);
      },
      executeToggleEnabled: async (instanceId: string, channelId: string, nextEnabled: boolean) => {
        callLog.push(`toggle:${instanceId}:${channelId}:${nextEnabled}`);
      },
      reloadWorkbench: async (
        instanceId: string,
        options: {
          withSpinner: boolean;
        },
      ) => {
        callLog.push(`reload:${instanceId}:${options.withSpinner}`);
      },
      reportSuccess: (message: string) => {
        callLog.push(`success:${message}`);
      },
      reportError: (message: string) => {
        callLog.push(`error:${message}`);
      },
    });

    await runManagedChannelMutation({
      mutationPlan: {
        kind: 'saveConfig',
        instanceId: 'instance-01',
        channelId: 'qq',
        values: {
          appId: 'configured-app',
          appSecret: 'secret-1',
        },
      },
      successMessage: 'QQ configuration saved.',
      failureMessage: 'Failed to save QQ.',
      setSaving: (value: boolean) => {
        savingStates.push(value);
      },
      setError: (value: string | null) => {
        clearedErrors.push(value);
      },
    });

    assert.deepEqual(savingStates, [true, false]);
    assert.deepEqual(clearedErrors, [null]);
    assert.deepEqual(callLog, [
      'save:instance-01:qq:configured-app:secret-1',
      'success:QQ configuration saved.',
      'reload:instance-01:false',
    ]);
  },
);

await runTest(
  'runOpenClawManagedChannelMutation executes injected save/toggle actions, reloads the workbench, and preserves page-owned saving hooks',
  async () => {
    const { runOpenClawManagedChannelMutation } =
      await loadManagedChannelMutationSupportModule();
    const savingStates: boolean[] = [];
    const clearedErrors: Array<string | null> = [];
    const callLog: string[] = [];

    await runOpenClawManagedChannelMutation({
      request: {
        mutationPlan: {
          kind: 'deleteConfig',
          instanceId: 'instance-01',
          channelId: 'qq',
          emptyValues: {
            appId: '',
            appSecret: '',
          },
        },
        successMessage: 'QQ configuration removed.',
        failureMessage: 'Failed to delete QQ configuration.',
        setSaving: (value: boolean) => {
          savingStates.push(value);
        },
        setError: (value: string | null) => {
          clearedErrors.push(value);
        },
        afterSuccess: () => {
          callLog.push('afterSuccess');
        },
      },
      executeSaveConfig: async (instanceId: string, channelId: string, values: Record<string, string>) => {
        callLog.push(`save:${instanceId}:${channelId}:${values.appId}:${values.appSecret}`);
      },
      executeToggleEnabled: async (instanceId: string, channelId: string, nextEnabled: boolean) => {
        callLog.push(`toggle:${instanceId}:${channelId}:${nextEnabled}`);
      },
      reloadWorkbench: async (instanceId: string) => {
        callLog.push(`reload:${instanceId}`);
      },
      reportSuccess: (message: string) => {
        callLog.push(`success:${message}`);
      },
      reportError: (message: string) => {
        callLog.push(`error:${message}`);
      },
    });

    assert.deepEqual(savingStates, [true, false]);
    assert.deepEqual(clearedErrors, [null]);
    assert.deepEqual(callLog, [
      'save:instance-01:qq::',
      'toggle:instance-01:qq:false',
      'success:QQ configuration removed.',
      'afterSuccess',
      'reload:instance-01',
    ]);
  },
);

await runTest(
  'runOpenClawManagedChannelMutation surfaces fallback failures through page error state or toast reporter based on request wiring',
  async () => {
    const { runOpenClawManagedChannelMutation } =
      await loadManagedChannelMutationSupportModule();
    const managedErrors: Array<string | null> = [];
    const toastErrors: string[] = [];

    await runOpenClawManagedChannelMutation({
      request: {
        mutationPlan: {
          kind: 'saveConfig',
          instanceId: 'instance-01',
          channelId: 'qq',
          values: {
            appId: 'configured-app',
            appSecret: 'secret-1',
          },
        },
        successMessage: 'unused',
        failureMessage: 'Failed to save QQ.',
        setError: (value: string | null) => {
          managedErrors.push(value);
        },
      },
      executeSaveConfig: async () => {
        throw new Error('');
      },
      executeToggleEnabled: async () => undefined,
      reloadWorkbench: async () => undefined,
      reportSuccess: () => undefined,
      reportError: (message: string) => {
        toastErrors.push(message);
      },
    });

    await runOpenClawManagedChannelMutation({
      request: {
        mutationPlan: {
          kind: 'toggleEnabled',
          instanceId: 'instance-01',
          channelId: 'qq',
          nextEnabled: true,
        },
        successMessage: 'unused',
        failureMessage: 'Failed to update QQ.',
      },
      executeSaveConfig: async () => undefined,
      executeToggleEnabled: async () => {
        throw new Error('');
      },
      reloadWorkbench: async () => undefined,
      reportSuccess: () => undefined,
      reportError: (message: string) => {
        toastErrors.push(message);
      },
    });

    assert.deepEqual(managedErrors, [null, 'Failed to save QQ.']);
    assert.deepEqual(toastErrors, ['Failed to update QQ.']);
  },
);

await runTest(
  'buildOpenClawManagedChannelMutationHandlers routes toggle, save, and delete through injected page-owned mutation execution and draft resets',
  async () => {
    const { buildOpenClawManagedChannelMutationHandlers } =
      await loadManagedChannelMutationSupportModule();
    const channel = createManagedChannelFixture();
    const executedRequests: any[] = [];
    let selectedManagedChannelId: string | null = 'qq';
    let managedChannelDrafts = {
      qq: {
        appId: 'configured-app',
        appSecret: 'secret-1',
      },
    };
    const reportedErrors: Array<string | null> = [];

    const handlers = buildOpenClawManagedChannelMutationHandlers({
      instanceId: 'instance-01',
      managedChannels: [channel],
      selectedManagedChannel: channel,
      selectedManagedChannelDraft: managedChannelDrafts.qq,
      setSavingManagedChannel: () => undefined,
      setManagedChannelError: (value) => {
        reportedErrors.push(value);
      },
      setSelectedManagedChannelId: (value) => {
        selectedManagedChannelId = value;
      },
      setManagedChannelDrafts: (updater) => {
        managedChannelDrafts = updater(managedChannelDrafts);
      },
      executeMutation: async (request) => {
        executedRequests.push(request);
      },
    });

    await handlers.onToggleManagedChannel('qq', false);
    await handlers.onSaveManagedChannel();
    await handlers.onDeleteManagedChannelConfiguration();

    assert.equal(executedRequests.length, 3);
    assert.equal(executedRequests[0].mutationPlan.kind, 'toggleEnabled');
    assert.equal(executedRequests[1].mutationPlan.kind, 'saveConfig');
    assert.equal(executedRequests[1].afterSuccess, handlers.clearSelectedManagedChannelId);
    assert.equal(executedRequests[2].mutationPlan.kind, 'deleteConfig');

    executedRequests[2].afterSuccess?.();

    assert.equal(selectedManagedChannelId, null);
    assert.deepEqual(managedChannelDrafts, {
      qq: {
        appId: '',
        appSecret: '',
      },
    });
    assert.deepEqual(reportedErrors, []);
  },
);

await runTest(
  'buildOpenClawManagedChannelMutationHandlers keeps validation errors in the page and skips unresolved toggle targets',
  async () => {
    const { buildOpenClawManagedChannelMutationHandlers } =
      await loadManagedChannelMutationSupportModule();
    const channel = createManagedChannelFixture();
    const executedRequests: any[] = [];
    const reportedErrors: Array<string | null> = [];

    const handlers = buildOpenClawManagedChannelMutationHandlers({
      instanceId: 'instance-01',
      managedChannels: [channel],
      selectedManagedChannel: channel,
      selectedManagedChannelDraft: {
        appId: 'configured-app',
        appSecret: '   ',
      },
      setSavingManagedChannel: () => undefined,
      setManagedChannelError: (value) => {
        reportedErrors.push(value);
      },
      setSelectedManagedChannelId: () => undefined,
      setManagedChannelDrafts: () => undefined,
      executeMutation: async (request) => {
        executedRequests.push(request);
      },
    });

    await handlers.onToggleManagedChannel('missing-channel', true);
    await handlers.onSaveManagedChannel();

    assert.deepEqual(executedRequests, []);
    assert.deepEqual(reportedErrors, ['App Secret is required.']);
  },
);
