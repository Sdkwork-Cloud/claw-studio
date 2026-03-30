import { openClawConfigService } from '@sdkwork/claw-core';
import {
  studio,
} from '@sdkwork/claw-infrastructure';
import { getSharedOpenClawGatewayClient } from './openclaw/openClawGatewayClientRegistry.ts';
export {
  createInstanceEffectiveModelCatalogService,
  type InstanceEffectiveModelCatalog,
  type InstanceEffectiveModelCatalogDependencies,
  type InstanceEffectiveModelCatalogService,
} from './instanceEffectiveModelCatalogCore.ts';
import { createInstanceEffectiveModelCatalogService } from './instanceEffectiveModelCatalogCore.ts';

export const instanceEffectiveModelCatalogService = createInstanceEffectiveModelCatalogService({
  getInstance: (instanceId) => studio.getInstance(instanceId),
  getInstanceDetail: (instanceId) => studio.getInstanceDetail(instanceId),
  listRouterChannels: async () => [],
  listRouterProviders: async () => [],
  listRouterModels: async () => [],
  resolveOpenClawConfigPath: (detail) => openClawConfigService.resolveInstanceConfigPath(detail),
  readOpenClawConfigSnapshot: (configPath) => openClawConfigService.readConfigSnapshot(configPath),
  listGatewayModels: async (instanceId) => {
    const client = await getSharedOpenClawGatewayClient(instanceId);
    return client.listModels();
  },
});
