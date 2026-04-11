import type { CreateOpenClawManagedChannelMutationRunnerArgs } from './openClawManagedChannelMutationSupport.ts';

type ManagedChannelMutationExecutors = Pick<
  CreateOpenClawManagedChannelMutationRunnerArgs,
  'executeSaveConfig' | 'executeToggleEnabled'
>;

export interface InstanceDetailManagedChannelMutationService {
  saveOpenClawChannelConfig: ManagedChannelMutationExecutors['executeSaveConfig'];
  setOpenClawChannelEnabled: ManagedChannelMutationExecutors['executeToggleEnabled'];
}

export function createInstanceDetailManagedChannelMutationExecutors(args: {
  instanceService: InstanceDetailManagedChannelMutationService;
}): ManagedChannelMutationExecutors {
  return {
    executeSaveConfig: (instanceId, channelId, values) =>
      args.instanceService.saveOpenClawChannelConfig(instanceId, channelId, values),
    executeToggleEnabled: (instanceId, channelId, enabled) =>
      args.instanceService.setOpenClawChannelEnabled(instanceId, channelId, enabled),
  };
}
