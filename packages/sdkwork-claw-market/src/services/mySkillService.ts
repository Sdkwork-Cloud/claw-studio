import {
  agentSkillManagementService as directAgentSkillManagementService,
  agentWorkbenchService as directAgentWorkbenchService,
  instanceWorkbenchService,
} from '@sdkwork/claw-instances';
import type { ListParams, PaginatedResult, Skill } from '@sdkwork/claw-types';

const defaultAgentWorkbenchService = directAgentWorkbenchService;
const defaultAgentSkillManagementService = directAgentSkillManagementService;

type InstanceWorkbenchServiceLike = Pick<typeof instanceWorkbenchService, 'getInstanceWorkbench'>;
type AgentWorkbenchServiceLike = Pick<typeof defaultAgentWorkbenchService, 'getAgentWorkbench'>;
type AgentSkillManagementServiceLike = Pick<
  typeof defaultAgentSkillManagementService,
  'removeSkill' | 'setSkillEnabled'
>;

export interface MySkillService {
  getList(instanceId: string, params?: ListParams): Promise<PaginatedResult<Skill>>;
  getMySkills(instanceId: string): Promise<Skill[]>;
  uninstallSkill(instanceId: string, skillId: string): Promise<void>;
}

export interface CreateMySkillServiceOptions {
  instanceWorkbenchService?: InstanceWorkbenchServiceLike;
  agentWorkbenchService?: AgentWorkbenchServiceLike;
  agentSkillManagementService?: AgentSkillManagementServiceLike;
}

function paginateSkills(skills: Skill[], params: ListParams = {}): PaginatedResult<Skill> {
  let filteredSkills = [...skills];

  if (params.keyword) {
    const keyword = params.keyword.toLowerCase();
    filteredSkills = filteredSkills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(keyword) ||
        skill.description.toLowerCase().includes(keyword),
    );
  }

  const page = params.page || 1;
  const pageSize = params.pageSize || 10;
  const total = filteredSkills.length;
  const start = (page - 1) * pageSize;

  return {
    items: filteredSkills.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
}

function toInstalledSkill(skill: any): Skill {
  return {
    id: String(skill.id || ''),
    skillKey: typeof skill.skillKey === 'string' ? skill.skillKey : undefined,
    name: skill.name || 'Unnamed Skill',
    description: skill.description || '',
    author: skill.author || 'SDKWork',
    rating:
      typeof skill.rating === 'number'
        ? skill.rating
        : 0,
    downloads:
      typeof skill.downloads === 'number'
        ? skill.downloads
        : 0,
    category: skill.category || 'General',
    icon: skill.icon,
    version: skill.version,
    size: skill.size,
    updatedAt: skill.updatedAt,
    readme: skill.readme,
    repositoryUrl: skill.repositoryUrl,
    homepageUrl: skill.homepage,
    documentationUrl: skill.documentationUrl,
  };
}

function resolvePreferredAgent(workbench: Awaited<ReturnType<InstanceWorkbenchServiceLike['getInstanceWorkbench']>>) {
  const agents = workbench?.agents || [];
  return agents.find((agent) => agent.isDefault) || (agents.length === 1 ? agents[0] : null);
}

async function loadAgentWorkbench(
  instanceId: string,
  workbenchService: InstanceWorkbenchServiceLike,
  perAgentWorkbenchService: AgentWorkbenchServiceLike,
) {
  const workbench = await workbenchService.getInstanceWorkbench(instanceId);
  if (!workbench) {
    return {
      workbench: null,
      preferredAgent: null,
      agentWorkbench: null,
    };
  }

  const preferredAgent = resolvePreferredAgent(workbench);
  if (!preferredAgent?.agent?.id) {
    return {
      workbench,
      preferredAgent: null,
      agentWorkbench: null,
    };
  }

  const agentWorkbench = await perAgentWorkbenchService.getAgentWorkbench({
    instanceId,
    workbench,
    agentId: preferredAgent.agent.id,
  });

  return {
    workbench,
    preferredAgent,
    agentWorkbench,
  };
}

export function createMySkillService(
  options: CreateMySkillServiceOptions = {},
): MySkillService {
  const workbenchService = options.instanceWorkbenchService || instanceWorkbenchService;
  const perAgentWorkbenchService = options.agentWorkbenchService || defaultAgentWorkbenchService;
  const skillManagementService =
    options.agentSkillManagementService || defaultAgentSkillManagementService;

  return {
    async getList(instanceId, params = {}) {
      const skills = await this.getMySkills(instanceId);
      return paginateSkills(skills, params);
    },

    async getMySkills(instanceId) {
      const { workbench, agentWorkbench } = await loadAgentWorkbench(
        instanceId,
        workbenchService,
        perAgentWorkbenchService,
      );

      if (agentWorkbench?.skills?.length) {
        return agentWorkbench.skills.map(toInstalledSkill);
      }

      return (workbench?.skills || []).map(toInstalledSkill);
    },

    async uninstallSkill(instanceId, skillId) {
      const { agentWorkbench } = await loadAgentWorkbench(
        instanceId,
        workbenchService,
        perAgentWorkbenchService,
      );

      const skill = agentWorkbench?.skills?.find((item) => item.id === skillId);
      if (!skill) {
        throw new Error('Failed to resolve the installed ClawHub skill from the current instance.');
      }

      const skillKey = skill.skillKey?.trim();
      if (!skillKey) {
        throw new Error(`Installed ClawHub skill "${skill.name}" is missing the skill key.`);
      }

      if (skill.scope === 'workspace') {
        await skillManagementService.removeSkill({
          instanceId,
          skillKey,
          scope: 'workspace',
          workspacePath: agentWorkbench?.paths?.workspacePath,
          baseDir: skill.baseDir,
          filePath: skill.filePath,
        });
        return;
      }

      await skillManagementService.setSkillEnabled({
        instanceId,
        skillKey,
        enabled: false,
      });
    },
  };
}

export const mySkillService: MySkillService = createMySkillService();
