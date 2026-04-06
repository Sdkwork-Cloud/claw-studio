import { openClawConfigService } from '@sdkwork/claw-core';
import {
  openClawGatewayClient,
  platform,
  studio,
} from '@sdkwork/claw-infrastructure';
import {
  createAgentSkillManagementService as createAgentSkillManagementServiceCore,
  type AgentSkillManagementServiceDependencyOverrides,
} from './agentSkillManagementServiceCore.ts';

export type {
  AgentSkillManagementDependencies,
  AgentSkillManagementServiceDependencyOverrides,
  InstallAgentSkillInput,
  RemoveAgentSkillInput,
  SetAgentSkillEnabledInput,
} from './agentSkillManagementServiceCore.ts';

function createRuntimeDependencyOverrides(): AgentSkillManagementServiceDependencyOverrides {
  return {
    studioApi: {
      getInstanceDetail: (id) => studio.getInstanceDetail(id),
    },
    openClawGatewayClient: {
      installSkill: (instanceId, args) => openClawGatewayClient.installSkill(instanceId, args),
      updateSkill: (instanceId, args) => openClawGatewayClient.updateSkill(instanceId, args),
    },
    openClawConfigService: {
      resolveInstanceConfigPath: (detail) => openClawConfigService.resolveInstanceConfigPath(detail),
      saveSkillEntry: (input) => openClawConfigService.saveSkillEntry(input),
      deleteSkillEntry: (input) => openClawConfigService.deleteSkillEntry(input),
    },
    platform: {
      pathExists: (path) => platform.pathExists(path),
      removePath: (path) => platform.removePath(path),
      readFile: (path) => platform.readFile(path),
      writeFile: (path, content) => platform.writeFile(path, content),
    },
  };
}

export function createAgentSkillManagementService(
  overrides: AgentSkillManagementServiceDependencyOverrides = {},
) {
  const runtimeOverrides = createRuntimeDependencyOverrides();

  return createAgentSkillManagementServiceCore({
    studioApi: {
      ...runtimeOverrides.studioApi,
      ...(overrides.studioApi || {}),
    },
    openClawGatewayClient: {
      ...runtimeOverrides.openClawGatewayClient,
      ...(overrides.openClawGatewayClient || {}),
    },
    openClawConfigService: {
      ...runtimeOverrides.openClawConfigService,
      ...(overrides.openClawConfigService || {}),
    },
    platform: {
      ...runtimeOverrides.platform,
      ...(overrides.platform || {}),
    },
  });
}

export const agentSkillManagementService = createAgentSkillManagementService();
