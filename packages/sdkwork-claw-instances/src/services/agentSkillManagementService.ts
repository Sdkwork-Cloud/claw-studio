import {
  openClawGatewayClient,
  studio,
} from '@sdkwork/claw-infrastructure';
import { openClawConfigService } from '@sdkwork/claw-core';
import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';

interface AgentSkillManagementDependencies {
  studioApi: {
    getInstanceDetail(id: string): Promise<StudioInstanceDetailRecord | null>;
  };
  openClawGatewayClient: {
    installSkill(
      instanceId: string,
      args: Record<string, unknown>,
    ): Promise<Record<string, unknown>>;
    updateSkill(
      instanceId: string,
      args: Record<string, unknown>,
    ): Promise<Record<string, unknown>>;
  };
  openClawConfigService: {
    resolveInstanceConfigPath(detail: StudioInstanceDetailRecord | null | undefined): string | null;
    saveSkillEntry(input: {
      configPath: string;
      skillKey: string;
      enabled?: boolean;
      apiKey?: string;
      env?: Record<string, string>;
    }): Promise<unknown>;
  };
}

export interface AgentSkillManagementServiceDependencyOverrides {
  studioApi?: Partial<AgentSkillManagementDependencies['studioApi']>;
  openClawGatewayClient?: Partial<AgentSkillManagementDependencies['openClawGatewayClient']>;
  openClawConfigService?: Partial<AgentSkillManagementDependencies['openClawConfigService']>;
}

export interface InstallAgentSkillInput {
  instanceId: string;
  agentId: string;
  isDefaultAgent: boolean;
  slug: string;
  version?: string;
  force?: boolean;
}

export interface SetAgentSkillEnabledInput {
  instanceId: string;
  skillKey: string;
  enabled: boolean;
}

function isOpenClawDetail(detail: StudioInstanceDetailRecord | null | undefined) {
  return detail?.instance.runtimeKind === 'openclaw';
}

function readErrorMessage(result: Record<string, unknown>) {
  const error = result.error;
  if (error && typeof error === 'object' && !Array.isArray(error)) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  const message = result.message;
  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }

  return null;
}

class AgentSkillManagementService {
  private readonly dependencies: AgentSkillManagementDependencies;

  constructor(dependencies: AgentSkillManagementDependencies) {
    this.dependencies = dependencies;
  }

  async installSkill(input: InstallAgentSkillInput) {
    const slug = input.slug.trim();
    if (!slug) {
      throw new Error('Skill slug is required before starting installation.');
    }

    if (!input.isDefaultAgent) {
      throw new Error(
        'Direct installs only target the default OpenClaw workspace. Use the workspace command for agent-specific workspaces.',
      );
    }

    const detail = await this.dependencies.studioApi.getInstanceDetail(input.instanceId);
    if (!isOpenClawDetail(detail)) {
      throw new Error('Only OpenClaw instances support skill installation.');
    }

    const result = await this.dependencies.openClawGatewayClient.installSkill(input.instanceId, {
      source: 'clawhub',
      slug,
      ...(input.version?.trim() ? { version: input.version.trim() } : {}),
      ...(input.force ? { force: true } : {}),
    });

    if (result.ok === false) {
      throw new Error(readErrorMessage(result) || 'Failed to install the selected OpenClaw skill.');
    }
  }

  async setSkillEnabled(input: SetAgentSkillEnabledInput) {
    const skillKey = input.skillKey.trim();
    if (!skillKey) {
      throw new Error('Skill key is required before updating skill configuration.');
    }

    const detail = await this.dependencies.studioApi.getInstanceDetail(input.instanceId);
    if (!isOpenClawDetail(detail)) {
      throw new Error('Only OpenClaw instances support skill configuration updates.');
    }

    const configPath = detail.lifecycle.configWritable
      ? this.dependencies.openClawConfigService.resolveInstanceConfigPath(detail)
      : null;

    if (configPath) {
      await this.dependencies.openClawConfigService.saveSkillEntry({
        configPath,
        skillKey,
        enabled: input.enabled,
      });
      return;
    }

    const result = await this.dependencies.openClawGatewayClient.updateSkill(
      input.instanceId,
      {
        skillKey,
        enabled: input.enabled,
      },
    );

    if (result.ok === false) {
      throw new Error(readErrorMessage(result) || 'Failed to update the selected OpenClaw skill.');
    }
  }
}

function createDefaultDependencies(): AgentSkillManagementDependencies {
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
    },
  };
}

export function createAgentSkillManagementService(
  overrides: AgentSkillManagementServiceDependencyOverrides = {},
) {
  const defaults = createDefaultDependencies();

  return new AgentSkillManagementService({
    studioApi: {
      ...defaults.studioApi,
      ...(overrides.studioApi || {}),
    },
    openClawGatewayClient: {
      ...defaults.openClawGatewayClient,
      ...(overrides.openClawGatewayClient || {}),
    },
    openClawConfigService: {
      ...defaults.openClawConfigService,
      ...(overrides.openClawConfigService || {}),
    },
  });
}

export const agentSkillManagementService = createAgentSkillManagementService();
