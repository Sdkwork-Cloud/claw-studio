import type { OpenClawChannelSnapshot } from '@sdkwork/claw-core';

export type OpenClawManagedChannelDrafts = Record<string, Record<string, string>>;

export type OpenClawManagedChannelMutationPlan =
  | {
      kind: 'toggleEnabled';
      instanceId: string;
      channelId: string;
      nextEnabled: boolean;
    }
  | {
      kind: 'saveConfig';
      instanceId: string;
      channelId: string;
      values: Record<string, string>;
    }
  | {
      kind: 'deleteConfig';
      instanceId: string;
      channelId: string;
      emptyValues: Record<string, string>;
    };

export interface OpenClawManagedChannelMutationRequest {
  mutationPlan: OpenClawManagedChannelMutationPlan;
  successMessage: string;
  failureMessage: string;
  setSaving?: (value: boolean) => void;
  setError?: (value: string | null) => void;
  afterSuccess?: () => void;
}

export type OpenClawManagedChannelMutationBuildResult =
  | {
      kind: 'skip';
    }
  | {
      kind: 'error';
      errorMessage: string;
    }
  | {
      kind: 'mutation';
      request: OpenClawManagedChannelMutationRequest;
    };

export interface RunOpenClawManagedChannelMutationArgs {
  request: OpenClawManagedChannelMutationRequest;
  executeSaveConfig: (
    instanceId: string,
    channelId: string,
    values: Record<string, string>,
  ) => Promise<void>;
  executeToggleEnabled: (
    instanceId: string,
    channelId: string,
    nextEnabled: boolean,
  ) => Promise<void>;
  reloadWorkbench: (instanceId: string) => Promise<void>;
  reportSuccess: (message: string) => void;
  reportError: (message: string) => void;
}

export interface CreateOpenClawManagedChannelMutationRunnerArgs {
  executeSaveConfig: (
    instanceId: string,
    channelId: string,
    values: Record<string, string>,
  ) => Promise<void>;
  executeToggleEnabled: (
    instanceId: string,
    channelId: string,
    nextEnabled: boolean,
  ) => Promise<void>;
  reloadWorkbench: (
    instanceId: string,
    options: {
      withSpinner: boolean;
    },
  ) => Promise<void>;
  reportSuccess: (message: string) => void;
  reportError: (message: string) => void;
}

export interface BuildOpenClawManagedChannelMutationHandlersArgs {
  instanceId: string | undefined;
  managedChannels:
    | Array<Pick<OpenClawChannelSnapshot, 'id' | 'name'>>
    | null
    | undefined;
  selectedManagedChannel:
    | Pick<OpenClawChannelSnapshot, 'id' | 'name' | 'fields' | 'values'>
    | null;
  selectedManagedChannelDraft: Record<string, string> | null;
  setSavingManagedChannel: (value: boolean) => void;
  setManagedChannelError: (value: string | null) => void;
  setSelectedManagedChannelId: (value: string | null) => void;
  setManagedChannelDrafts: (
    updater: (current: OpenClawManagedChannelDrafts) => OpenClawManagedChannelDrafts,
  ) => void;
  executeMutation: (request: OpenClawManagedChannelMutationRequest) => Promise<void>;
}

function buildOpenClawManagedChannelEmptyValues(
  channel: Pick<OpenClawChannelSnapshot, 'fields'>,
): Record<string, string> {
  return channel.fields.reduce<Record<string, string>>((accumulator, field) => {
    accumulator[field.key] = '';
    return accumulator;
  }, {});
}

export function applyOpenClawManagedChannelDraftChange(args: {
  drafts: OpenClawManagedChannelDrafts;
  channel: Pick<OpenClawChannelSnapshot, 'id' | 'values'>;
  fieldKey: string;
  value: string;
}): OpenClawManagedChannelDrafts {
  return {
    ...args.drafts,
    [args.channel.id]: {
      ...(args.drafts[args.channel.id] || args.channel.values),
      [args.fieldKey]: args.value,
    },
  };
}

export function buildOpenClawManagedChannelToggleMutationRequest(args: {
  instanceId: string | undefined;
  channel: Pick<OpenClawChannelSnapshot, 'id' | 'name'>;
  nextEnabled: boolean;
}): OpenClawManagedChannelMutationBuildResult {
  if (!args.instanceId) {
    return {
      kind: 'skip',
    };
  }

  return {
    kind: 'mutation',
    request: {
      mutationPlan: {
        kind: 'toggleEnabled',
        instanceId: args.instanceId,
        channelId: args.channel.id,
        nextEnabled: args.nextEnabled,
      },
      successMessage: args.nextEnabled ? `${args.channel.name} enabled.` : `${args.channel.name} disabled.`,
      failureMessage: `Failed to update ${args.channel.name}.`,
    },
  };
}

export function buildOpenClawManagedChannelSaveMutationRequest(args: {
  instanceId: string | undefined;
  channel: Pick<OpenClawChannelSnapshot, 'id' | 'name' | 'fields'> | null;
  draft: Record<string, string> | null;
  setSaving: (value: boolean) => void;
  setError: (value: string | null) => void;
  afterSuccess?: () => void;
}): OpenClawManagedChannelMutationBuildResult {
  if (!args.instanceId || !args.channel || !args.draft) {
    return {
      kind: 'skip',
    };
  }

  for (const field of args.channel.fields) {
    if (field.required && !(args.draft[field.key] || '').trim()) {
      return {
        kind: 'error',
        errorMessage: `${field.label} is required.`,
      };
    }
  }

  return {
    kind: 'mutation',
    request: {
      mutationPlan: {
        kind: 'saveConfig',
        instanceId: args.instanceId,
        channelId: args.channel.id,
        values: args.draft,
      },
      successMessage: `${args.channel.name} configuration saved.`,
      failureMessage: `Failed to save ${args.channel.name}.`,
      setSaving: args.setSaving,
      setError: args.setError,
      afterSuccess: args.afterSuccess,
    },
  };
}

export function buildOpenClawManagedChannelDeleteMutationRequest(args: {
  instanceId: string | undefined;
  channel: Pick<OpenClawChannelSnapshot, 'id' | 'name' | 'fields'> | null;
  setSaving: (value: boolean) => void;
  setError: (value: string | null) => void;
  afterSuccess?: () => void;
}): OpenClawManagedChannelMutationBuildResult {
  if (!args.instanceId || !args.channel) {
    return {
      kind: 'skip',
    };
  }

  return {
    kind: 'mutation',
    request: {
      mutationPlan: {
        kind: 'deleteConfig',
        instanceId: args.instanceId,
        channelId: args.channel.id,
        emptyValues: buildOpenClawManagedChannelEmptyValues(args.channel),
      },
      successMessage: `${args.channel.name} configuration removed.`,
      failureMessage: `Failed to delete ${args.channel.name} configuration.`,
      setSaving: args.setSaving,
      setError: args.setError,
      afterSuccess: args.afterSuccess,
    },
  };
}

export function createOpenClawManagedChannelMutationRunner(
  args: CreateOpenClawManagedChannelMutationRunnerArgs,
) {
  return async (request: OpenClawManagedChannelMutationRequest) => {
    await runOpenClawManagedChannelMutation({
      request,
      executeSaveConfig: args.executeSaveConfig,
      executeToggleEnabled: args.executeToggleEnabled,
      reloadWorkbench: (instanceId) => args.reloadWorkbench(instanceId, { withSpinner: false }),
      reportSuccess: args.reportSuccess,
      reportError: args.reportError,
    });
  };
}

function findManagedChannelById(
  managedChannels:
    | Array<Pick<OpenClawChannelSnapshot, 'id' | 'name'>>
    | null
    | undefined,
  channelId: string,
) {
  return (managedChannels || []).find((channel) => channel.id === channelId) || null;
}

export function buildOpenClawManagedChannelMutationHandlers(
  args: BuildOpenClawManagedChannelMutationHandlersArgs,
) {
  const clearSelectedManagedChannelId = () => args.setSelectedManagedChannelId(null);

  return {
    clearSelectedManagedChannelId,
    onToggleManagedChannel: async (channelId: string, nextEnabled: boolean) => {
      const managedChannel = findManagedChannelById(args.managedChannels, channelId);
      if (!managedChannel) {
        return;
      }

      const mutationRequest = buildOpenClawManagedChannelToggleMutationRequest({
        instanceId: args.instanceId,
        channel: managedChannel,
        nextEnabled,
      });
      if (mutationRequest.kind !== 'mutation') {
        return;
      }

      await args.executeMutation(mutationRequest.request);
    },
    onSaveManagedChannel: async () => {
      const mutationRequest = buildOpenClawManagedChannelSaveMutationRequest({
        instanceId: args.instanceId,
        channel: args.selectedManagedChannel,
        draft: args.selectedManagedChannelDraft,
        setSaving: args.setSavingManagedChannel,
        setError: args.setManagedChannelError,
        afterSuccess: clearSelectedManagedChannelId,
      });
      if (mutationRequest.kind === 'skip') {
        return;
      }

      if (mutationRequest.kind === 'error') {
        args.setManagedChannelError(mutationRequest.errorMessage);
        return;
      }

      await args.executeMutation(mutationRequest.request);
    },
    onDeleteManagedChannelConfiguration: async () => {
      const mutationRequest = buildOpenClawManagedChannelDeleteMutationRequest({
        instanceId: args.instanceId,
        channel: args.selectedManagedChannel,
        setSaving: args.setSavingManagedChannel,
        setError: args.setManagedChannelError,
        afterSuccess: clearSelectedManagedChannelId,
      });
      if (mutationRequest.kind !== 'mutation') {
        return;
      }

      const baseRequest = mutationRequest.request;
      if (baseRequest.mutationPlan.kind === 'deleteConfig' && args.selectedManagedChannel) {
        const { emptyValues } = baseRequest.mutationPlan;
        const selectedManagedChannelId = args.selectedManagedChannel.id;

        await args.executeMutation({
          ...baseRequest,
          afterSuccess: () => {
            args.setManagedChannelDrafts((current) => ({
              ...current,
              [selectedManagedChannelId]: emptyValues,
            }));
            baseRequest.afterSuccess?.();
          },
        });
        return;
      }

      await args.executeMutation(baseRequest);
    },
  };
}

export async function runOpenClawManagedChannelMutation({
  request,
  executeSaveConfig,
  executeToggleEnabled,
  reloadWorkbench,
  reportSuccess,
  reportError,
}: RunOpenClawManagedChannelMutationArgs) {
  request.setSaving?.(true);
  request.setError?.(null);
  try {
    switch (request.mutationPlan.kind) {
      case 'toggleEnabled':
        await executeToggleEnabled(
          request.mutationPlan.instanceId,
          request.mutationPlan.channelId,
          request.mutationPlan.nextEnabled,
        );
        break;
      case 'saveConfig':
        await executeSaveConfig(
          request.mutationPlan.instanceId,
          request.mutationPlan.channelId,
          request.mutationPlan.values,
        );
        break;
      case 'deleteConfig':
        await executeSaveConfig(
          request.mutationPlan.instanceId,
          request.mutationPlan.channelId,
          request.mutationPlan.emptyValues,
        );
        await executeToggleEnabled(
          request.mutationPlan.instanceId,
          request.mutationPlan.channelId,
          false,
        );
        break;
    }

    reportSuccess(request.successMessage);
    request.afterSuccess?.();
    await reloadWorkbench(request.mutationPlan.instanceId);
  } catch (error: any) {
    const message = error?.message || request.failureMessage;
    if (request.setError) {
      request.setError(message);
    } else {
      reportError(message);
    }
  } finally {
    request.setSaving?.(false);
  }
}
