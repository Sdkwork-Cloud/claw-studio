import type { ChannelWorkspaceItem } from '@sdkwork/claw-ui';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import {
  applyOpenClawManagedChannelDraftChange,
  type OpenClawManagedChannelDrafts,
} from './openClawManagedChannelMutationSupport.ts';

export interface BuildOpenClawManagedChannelWorkspaceSyncStateInput {
  managedChannels: InstanceWorkbenchSnapshot['managedChannels'] | null | undefined;
}

export interface BuildOpenClawManagedChannelSelectionStateInput {
  managedChannels: InstanceWorkbenchSnapshot['managedChannels'] | null | undefined;
  selectedManagedChannelId: string | null;
  managedChannelDrafts: OpenClawManagedChannelDrafts;
}

export interface BuildOpenClawManagedChannelWorkspaceItemsInput {
  managedChannels: InstanceWorkbenchSnapshot['managedChannels'] | null | undefined;
  runtimeChannels: InstanceWorkbenchSnapshot['channels'] | null | undefined;
  managedChannelDrafts: OpenClawManagedChannelDrafts;
}

export interface OpenClawManagedChannelWorkspaceSyncState {
  resolveSelectedManagedChannelId: (currentSelectedManagedChannelId: string | null) => string | null;
  managedChannelDrafts: OpenClawManagedChannelDrafts;
  managedChannelError: string | null;
}

export interface OpenClawManagedChannelSelectionState {
  selectedManagedChannel: NonNullable<InstanceWorkbenchSnapshot['managedChannels']>[number] | null;
  selectedManagedChannelDraft: Record<string, string> | null;
}

export interface BuildOpenClawManagedChannelStateHandlersArgs {
  selectedManagedChannel: NonNullable<InstanceWorkbenchSnapshot['managedChannels']>[number] | null;
  setManagedChannelError: (value: string | null) => void;
  setSelectedManagedChannelId: (value: string | null) => void;
  setManagedChannelDrafts: (
    updater: (current: OpenClawManagedChannelDrafts) => OpenClawManagedChannelDrafts,
  ) => void;
}

export function findOpenClawManagedChannelById(
  managedChannels: InstanceWorkbenchSnapshot['managedChannels'] | null | undefined,
  channelId: string | null,
): NonNullable<InstanceWorkbenchSnapshot['managedChannels']>[number] | null {
  if (!channelId) {
    return null;
  }

  return (managedChannels || []).find((channel) => channel.id === channelId) || null;
}

export function buildOpenClawManagedChannelWorkspaceSyncState({
  managedChannels,
}: BuildOpenClawManagedChannelWorkspaceSyncStateInput): OpenClawManagedChannelWorkspaceSyncState {
  const availableManagedChannels = managedChannels || [];

  return {
    resolveSelectedManagedChannelId: (currentSelectedManagedChannelId) =>
      currentSelectedManagedChannelId &&
      availableManagedChannels.some((channel) => channel.id === currentSelectedManagedChannelId)
        ? currentSelectedManagedChannelId
        : null,
    managedChannelDrafts: {},
    managedChannelError: null,
  };
}

export function buildOpenClawManagedChannelSelectionState({
  managedChannels,
  selectedManagedChannelId,
  managedChannelDrafts,
}: BuildOpenClawManagedChannelSelectionStateInput): OpenClawManagedChannelSelectionState {
  const selectedManagedChannel = findOpenClawManagedChannelById(
    managedChannels,
    selectedManagedChannelId,
  );

  return {
    selectedManagedChannel,
    selectedManagedChannelDraft: selectedManagedChannel
      ? managedChannelDrafts[selectedManagedChannel.id] || selectedManagedChannel.values
      : null,
  };
}

export function buildOpenClawManagedChannelWorkspaceItems({
  managedChannels,
  runtimeChannels,
  managedChannelDrafts,
}: BuildOpenClawManagedChannelWorkspaceItemsInput): ChannelWorkspaceItem[] {
  const availableManagedChannels = managedChannels || [];
  const availableRuntimeChannels = runtimeChannels || [];

  return availableManagedChannels.map((channel) => {
    const runtimeChannel = availableRuntimeChannels.find((item) => item.id === channel.id) || null;
    const draft = managedChannelDrafts[channel.id] || channel.values;
    const configuredFieldCount = channel.fields.filter((field) => Boolean((draft[field.key] || '').trim())).length;
    const status =
      channel.configurationMode === 'none'
        ? channel.enabled
          ? 'connected'
          : 'disconnected'
        : configuredFieldCount === 0
          ? 'not_configured'
          : channel.status === 'connected'
            ? 'connected'
            : 'disconnected';

    return {
      id: channel.id,
      name: channel.name,
      description: runtimeChannel?.description || channel.description,
      status,
      enabled: channel.enabled,
      configurationMode: channel.configurationMode,
      fieldCount: channel.fieldCount,
      configuredFieldCount,
      setupSteps:
        runtimeChannel?.setupSteps && runtimeChannel.setupSteps.length > 0
          ? [...runtimeChannel.setupSteps]
          : [...channel.setupSteps],
      fields: channel.fields.map((field) => ({ ...field })),
      values: { ...draft },
    };
  });
}

export function buildOpenClawManagedChannelStateHandlers(
  args: BuildOpenClawManagedChannelStateHandlersArgs,
) {
  return {
    onSelectedManagedChannelIdChange: (channelId: string | null) => {
      args.setManagedChannelError(null);
      args.setSelectedManagedChannelId(channelId);
    },
    onManagedChannelFieldChange: (fieldKey: string, value: string) => {
      if (!args.selectedManagedChannel) {
        return;
      }

      args.setManagedChannelError(null);
      args.setManagedChannelDrafts((current) =>
        applyOpenClawManagedChannelDraftChange({
          drafts: current,
          channel: args.selectedManagedChannel!,
          fieldKey,
          value,
        }),
      );
    },
  };
}
