import type { BuildOpenClawManagedConfigMutationHandlersArgs } from './openClawManagedConfigMutationSupport.ts';

type ManagedConfigMutationExecutors = {
  webSearch: Pick<BuildOpenClawManagedConfigMutationHandlersArgs['webSearch'], 'executeSave'>;
  xSearch: Pick<BuildOpenClawManagedConfigMutationHandlersArgs['xSearch'], 'executeSave'>;
  webSearchNativeCodex: Pick<
    BuildOpenClawManagedConfigMutationHandlersArgs['webSearchNativeCodex'],
    'executeSave'
  >;
  webFetch: Pick<BuildOpenClawManagedConfigMutationHandlersArgs['webFetch'], 'executeSave'>;
  authCooldowns: Pick<
    BuildOpenClawManagedConfigMutationHandlersArgs['authCooldowns'],
    'executeSave'
  >;
  dreaming: Pick<BuildOpenClawManagedConfigMutationHandlersArgs['dreaming'], 'executeSave'>;
};

export interface InstanceDetailManagedConfigMutationService {
  saveOpenClawWebSearchConfig: ManagedConfigMutationExecutors['webSearch']['executeSave'];
  saveOpenClawXSearchConfig: ManagedConfigMutationExecutors['xSearch']['executeSave'];
  saveOpenClawWebSearchNativeCodexConfig: ManagedConfigMutationExecutors['webSearchNativeCodex']['executeSave'];
  saveOpenClawWebFetchConfig: ManagedConfigMutationExecutors['webFetch']['executeSave'];
  saveOpenClawAuthCooldownsConfig: ManagedConfigMutationExecutors['authCooldowns']['executeSave'];
  saveOpenClawDreamingConfig: ManagedConfigMutationExecutors['dreaming']['executeSave'];
}

export function createInstanceDetailManagedConfigMutationExecutors(args: {
  instanceService: InstanceDetailManagedConfigMutationService;
}): ManagedConfigMutationExecutors {
  return {
    webSearch: {
      executeSave: (instanceId, input) => args.instanceService.saveOpenClawWebSearchConfig(instanceId, input),
    },
    xSearch: {
      executeSave: (instanceId, input) => args.instanceService.saveOpenClawXSearchConfig(instanceId, input),
    },
    webSearchNativeCodex: {
      executeSave: (instanceId, input) =>
        args.instanceService.saveOpenClawWebSearchNativeCodexConfig(instanceId, input),
    },
    webFetch: {
      executeSave: (instanceId, input) => args.instanceService.saveOpenClawWebFetchConfig(instanceId, input),
    },
    authCooldowns: {
      executeSave: (instanceId, input) =>
        args.instanceService.saveOpenClawAuthCooldownsConfig(instanceId, input),
    },
    dreaming: {
      executeSave: (instanceId, input) => args.instanceService.saveOpenClawDreamingConfig(instanceId, input),
    },
  };
}
