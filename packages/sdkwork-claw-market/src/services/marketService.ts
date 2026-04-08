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

export interface MarketCategory {
  id: string;
  code?: string;
  name: string;
}

type ClawHubSkillListParams = {
  categoryId?: string;
  keyword?: string;
  sortBy?: string;
};

type ClawHubPackageListParams = {
  categoryId?: string;
  keyword?: string;
};

export interface ClawHubService {
  listCategories(): Promise<MarketCategory[]>;
  listSkills(params?: ClawHubSkillListParams): Promise<Skill[]>;
  getSkill(id: string): Promise<Skill>;
  listReviews(id: string): Promise<Review[]>;
  listPackages(params?: ClawHubPackageListParams): Promise<SkillPack[]>;
  getPackage(id: string): Promise<SkillPack>;
}

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
  downloadCatalogAsset?: (
    filename: string,
    payload: unknown,
    onProgress: (progress: number) => void,
  ) => Promise<void>;
}

async function getDefaultClawHubService(): Promise<ClawHubService> {
  const module = await import('@sdkwork/claw-core');
  return module.clawHubService as ClawHubService;
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

async function downloadCatalogAssetAsJsonFile(
  filename: string,
  payload: unknown,
  onProgress: (progress: number) => void,
) {
  if (
    typeof Blob === 'undefined'
    || typeof URL === 'undefined'
    || typeof URL.createObjectURL !== 'function'
    || typeof document === 'undefined'
  ) {
    throw new Error('Local export is only available in the browser host.');
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onProgress(100);
  } finally {
    URL.revokeObjectURL(url);
  }
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
  const downloadCatalogAsset = options.downloadCatalogAsset || downloadCatalogAssetAsJsonFile;
  const resolveClawHubService = async () => options.clawHubService || await getDefaultClawHubService();

  return {
    async getCategories() {
      return (await resolveClawHubService()).listCategories();
    },

    async getSkillList(params: MarketCatalogQuery = {}) {
      return paginateItems(await this.getSkills(params), params);
    },

    async getPackList(params: MarketCatalogQuery = {}) {
      return paginateItems(await this.getPacks(params), params);
    },

    async getSkills(params: MarketCatalogQuery = {}) {
      return (await resolveClawHubService()).listSkills(toSkillQueryParams(params));
    },

    async getSkill(id: string) {
      return (await resolveClawHubService()).getSkill(id);
    },

    async getSkillReviews(id: string) {
      return (await resolveClawHubService()).listReviews(id);
    },

    async getPacks(params: MarketCatalogQuery = {}) {
      return (await resolveClawHubService()).listPackages(toPackageQueryParams(params));
    },

    async getPack(id: string) {
      return (await resolveClawHubService()).getPackage(id);
    },

    async installSkill(instanceId: string, skillId: string) {
      const workbenchService =
        options.instanceWorkbenchService || await getDefaultInstanceWorkbenchService();
      const skillManagementService =
        options.agentSkillManagementService || await getDefaultAgentSkillManagementService();
      const hubService = await resolveClawHubService();
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
      const pack = await (await resolveClawHubService()).getPackage(packId);
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
      const hubService = await resolveClawHubService();
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
      return downloadCatalogAsset(`${skill.id}-skill.json`, skill, onProgress);
    },

    async downloadPackLocal(pack: SkillPack, onProgress: (progress: number) => void) {
      return downloadCatalogAsset(`${pack.id}-pack.json`, pack, onProgress);
    },
  };
}

export const marketService = createMarketService();
