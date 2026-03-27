import {
  clawHubService,
  type ClawHubCategory,
  type ClawHubPackageListParams,
  type ClawHubService,
  type ClawHubSkillListParams,
} from '@sdkwork/claw-core';
import type { ListParams, PaginatedResult, Review, Skill, SkillPack } from '@sdkwork/claw-types';

export interface InstallSkillInput {
  instanceId: string;
  agentId: string;
  isDefaultAgent: boolean;
  slug: string;
  version?: string;
}

type AgentSkillManagementServiceLike = {
  installSkill(input: InstallSkillInput): Promise<unknown>;
};

type InstanceWorkbenchServiceLike = {
  getInstanceWorkbench(instanceId: string): Promise<{
    agents?: Array<{
      isDefault?: boolean;
      agent?: {
        id?: string;
      };
    }>;
  } | null | undefined>;
};

export interface InstallationResult {
  success: boolean;
  fallback?: boolean;
}

export type MarketCategory = ClawHubCategory;

export interface MarketCatalogQuery extends ListParams {
  categoryId?: string;
}

export interface IMarketService {
  getCategories(): Promise<MarketCategory[]>;
  getSkillList(params?: MarketCatalogQuery): Promise<PaginatedResult<Skill>>;
  getPackList(params?: MarketCatalogQuery): Promise<PaginatedResult<SkillPack>>;
  getSkills(params?: MarketCatalogQuery): Promise<Skill[]>;
  getSkill(id: string): Promise<Skill>;
  getSkillReviews(id: string): Promise<Review[]>;
  getPacks(params?: MarketCatalogQuery): Promise<SkillPack[]>;
  getPack(id: string): Promise<SkillPack>;
  installSkill(instanceId: string, skillId: string): Promise<InstallationResult>;
  installPack(instanceId: string, packId: string): Promise<InstallationResult>;
  installPackWithSkills(
    instanceId: string,
    packId: string,
    skillIds: string[],
  ): Promise<InstallationResult>;
  downloadSkillLocal(skill: Skill, onProgress: (progress: number) => void): Promise<void>;
  downloadPackLocal(pack: SkillPack, onProgress: (progress: number) => void): Promise<void>;
}

export interface CreateMarketServiceOptions {
  clawHubService?: ClawHubService;
  instanceWorkbenchService?: InstanceWorkbenchServiceLike;
  agentSkillManagementService?: AgentSkillManagementServiceLike;
}

function paginateItems<T>(items: T[], params: ListParams = {}): PaginatedResult<T> {
  const page = params.page || 1;
  const pageSize = params.pageSize || 10;
  const total = items.length;
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
}

function simulateLocalDownload(
  filename: string,
  payload: unknown,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;

      if (progress >= 100) {
        clearInterval(interval);
        onProgress(100);

        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        resolve();
        return;
      }

      onProgress(progress);
    }, 500);
  });
}

function toSkillQueryParams(params: MarketCatalogQuery = {}): ClawHubSkillListParams {
  return Object.fromEntries(
    Object.entries({
      categoryId: params.categoryId,
      keyword: params.keyword,
      sortBy: params.sortBy,
    }).filter(([, value]) => value !== undefined),
  ) as ClawHubSkillListParams;
}

function toPackageQueryParams(params: MarketCatalogQuery = {}): ClawHubPackageListParams {
  return Object.fromEntries(
    Object.entries({
      categoryId: params.categoryId,
      keyword: params.keyword,
    }).filter(([, value]) => value !== undefined),
  ) as ClawHubPackageListParams;
}

function resolveInstallAgent(workbench: Awaited<ReturnType<InstanceWorkbenchServiceLike['getInstanceWorkbench']>>) {
  const agents = workbench?.agents || [];
  const defaultAgent = agents.find((agent) => agent.isDefault) || (agents.length === 1 ? agents[0] : null);
  const agentId = defaultAgent?.agent?.id;

  if (!agentId) {
    throw new Error('No default OpenClaw agent workspace is available for ClawHub installation.');
  }

  return {
    agentId,
    isDefaultAgent: Boolean(defaultAgent?.isDefault || agents.length === 1),
  };
}

function ensureSkillSlug(skill: Skill) {
  const slug = skill.skillKey?.trim();
  if (!slug) {
    throw new Error(`ClawHub skill "${skill.name}" is missing the installation slug.`);
  }
  return slug;
}

async function getDefaultInstanceWorkbenchService(): Promise<InstanceWorkbenchServiceLike> {
  const module = await import('@sdkwork/claw-instances');
  return module.instanceWorkbenchService;
}

async function getDefaultAgentSkillManagementService(): Promise<AgentSkillManagementServiceLike> {
  const module = await import('@sdkwork/claw-instances');
  return module.agentSkillManagementService;
}

export function createMarketService(options: CreateMarketServiceOptions = {}): IMarketService {
  const hubService = options.clawHubService || clawHubService;

  return {
    async getCategories() {
      return hubService.listCategories();
    },

    async getSkillList(params: MarketCatalogQuery = {}) {
      return paginateItems(await this.getSkills(params), params);
    },

    async getPackList(params: MarketCatalogQuery = {}) {
      return paginateItems(await this.getPacks(params), params);
    },

    async getSkills(params: MarketCatalogQuery = {}) {
      return hubService.listSkills(toSkillQueryParams(params));
    },

    async getSkill(id: string) {
      return hubService.getSkill(id);
    },

    async getSkillReviews(id: string) {
      return hubService.listReviews(id);
    },

    async getPacks(params: MarketCatalogQuery = {}) {
      return hubService.listPackages(toPackageQueryParams(params));
    },

    async getPack(id: string) {
      return hubService.getPackage(id);
    },

    async installSkill(instanceId: string, skillId: string) {
      const workbenchService =
        options.instanceWorkbenchService || await getDefaultInstanceWorkbenchService();
      const skillManagementService =
        options.agentSkillManagementService || await getDefaultAgentSkillManagementService();
      const [skill, workbench] = await Promise.all([
        hubService.getSkill(skillId),
        workbenchService.getInstanceWorkbench(instanceId),
      ]);
      const installTarget = resolveInstallAgent(workbench);

      await skillManagementService.installSkill({
        instanceId,
        agentId: installTarget.agentId,
        isDefaultAgent: installTarget.isDefaultAgent,
        slug: ensureSkillSlug(skill),
        version: skill.version,
      });

      return { success: true };
    },

    async installPack(instanceId: string, packId: string) {
      const pack = await hubService.getPackage(packId);
      return this.installPackWithSkills(
        instanceId,
        packId,
        pack.skills.map((skill) => skill.id),
      );
    },

    async installPackWithSkills(instanceId: string, packId: string, skillIds: string[]) {
      const workbenchService =
        options.instanceWorkbenchService || await getDefaultInstanceWorkbenchService();
      const skillManagementService =
        options.agentSkillManagementService || await getDefaultAgentSkillManagementService();
      const [pack, workbench] = await Promise.all([
        hubService.getPackage(packId),
        workbenchService.getInstanceWorkbench(instanceId),
      ]);
      const selectedIds = Array.from(new Set(skillIds.map((id) => id.trim()).filter(Boolean)));
      if (selectedIds.length === 0) {
        throw new Error('Select at least one ClawHub skill before starting installation.');
      }

      const selectedSkills = pack.skills.filter((skill) => selectedIds.includes(skill.id));
      if (selectedSkills.length !== selectedIds.length) {
        throw new Error('Some selected ClawHub skills could not be resolved from the selected package.');
      }

      const installTarget = resolveInstallAgent(workbench);
      await Promise.all(
        selectedSkills.map((skill) =>
          skillManagementService.installSkill({
            instanceId,
            agentId: installTarget.agentId,
            isDefaultAgent: installTarget.isDefaultAgent,
            slug: ensureSkillSlug(skill),
            version: skill.version,
          }),
        ),
      );

      return { success: true };
    },

    async downloadSkillLocal(skill: Skill, onProgress: (progress: number) => void) {
      return simulateLocalDownload(`${skill.id}-skill.json`, skill, onProgress);
    },

    async downloadPackLocal(pack: SkillPack, onProgress: (progress: number) => void) {
      return simulateLocalDownload(`${pack.id}-pack.json`, pack, onProgress);
    },
  };
}

export const marketService = createMarketService();
