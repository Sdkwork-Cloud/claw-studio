import {
  getRuntimePlatform,
  installerService,
  studioMockService,
  type HubInstallAssessmentResult,
  type HubInstallCatalogEntry,
  type HubInstallDependencyResult,
  type HubInstallRecordStatus,
  type HubInstallResult,
  type HubUninstallResult,
} from '@sdkwork/claw-infrastructure';
import { type ListParams, type PaginatedResult } from '@sdkwork/claw-types';
import {
  type AppInstallContext,
  type AppInstallDefinition,
  type AppInstallHostPlatform,
  type AppInstallRuntimePlatform,
  type AppResolvedInstallTarget,
  getAppInstallDefinition,
  resolveAppHostPlatform,
  resolveAppInstallTarget,
} from './appInstallCatalog.ts';

export interface AppCategory {
  title: string;
  subtitle: string;
  apps: AppItem[];
}

export interface AppItem {
  id: string;
  name: string;
  developer: string;
  category: string;
  description?: string;
  banner?: string;
  icon: string;
  rating: number;
  rank?: number;
  reviewsCount?: string;
  screenshots?: string[];
  version?: string;
  size?: string;
  releaseDate?: string;
  compatibility?: string;
  ageRating?: string;
  installable?: boolean;
  installSummary?: string;
  installHomepage?: string;
  installTags?: string[];
  defaultSoftwareName?: string;
  supportedHostPlatforms?: AppInstallHostPlatform[];
}

export interface CreateAppDTO {
  name: string;
  developer: string;
  category: string;
  icon: string;
  description?: string;
}

export interface UpdateAppDTO extends Partial<CreateAppDTO> {}

export interface AppInstallInspection {
  app: AppItem;
  definition: AppInstallDefinition;
  target: AppResolvedInstallTarget;
  assessment: HubInstallAssessmentResult;
}

export type AppInstallSurfaceState = 'installed' | 'ready' | 'attention';

export interface AppInstallSurfaceSummary {
  appId: string;
  softwareName: string;
  variantId: string;
  runtimePlatform: AppInstallRuntimePlatform;
  installStatus: HubInstallRecordStatus | null;
  ready: boolean;
  state: AppInstallSurfaceState;
  blockingIssueCount: number;
  warningIssueCount: number;
  dependencyAttentionCount: number;
  autoRemediableDependencyCount: number;
}

export interface AppInstallDependencyOptions extends AppInstallContext {
  dependencyIds?: string[];
  continueOnError?: boolean;
}

export interface AppUninstallOptions extends AppInstallContext {
  purgeData?: boolean;
  backupBeforeUninstall?: boolean;
}

type GuidedInstallProductId = 'openclaw' | 'zeroclaw' | 'ironclaw';
type GuidedInstallMethodId = 'wsl' | 'docker' | 'npm' | 'pnpm' | 'source' | 'cloud';

export interface IAppStoreService {
  getList(params?: ListParams): Promise<PaginatedResult<AppItem>>;
  getById(id: string): Promise<AppItem | null>;
  create(data: CreateAppDTO): Promise<AppItem>;
  update(id: string, data: UpdateAppDTO): Promise<AppItem>;
  delete(id: string): Promise<boolean>;

  getInstallCatalog(context?: AppInstallContext): Promise<AppInstallDefinition[]>;
  getInstallDefinition(id: string, context?: AppInstallContext): Promise<AppInstallDefinition>;
  resolveInstallTarget(id: string, context?: AppInstallContext): Promise<AppResolvedInstallTarget>;
  inspectInstall(id: string, context?: AppInstallContext): Promise<AppInstallInspection>;
  getInstallSurfaceSummaries(
    appIds: string[],
    context?: AppInstallContext,
  ): Promise<Map<string, AppInstallSurfaceSummary>>;
  getGuidedInstallNavigation(id: string, context?: AppInstallContext): Promise<string | null>;
  installDependencies(
    id: string,
    options?: AppInstallDependencyOptions,
  ): Promise<HubInstallDependencyResult>;

  getFeaturedApp(): Promise<AppItem>;
  getTopCharts(): Promise<AppItem[]>;
  getCategories(): Promise<AppCategory[]>;
  getApp(id: string): Promise<AppItem>;

  installApp(id: string, context?: AppInstallContext): Promise<HubInstallResult>;
  uninstallApp(id: string, options?: AppUninstallOptions): Promise<HubUninstallResult>;
}

function uniqStrings(values: Array<string | undefined | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function fallbackCatalogIcon(appId: string) {
  return `https://picsum.photos/seed/${appId}-icon/256/256`;
}

function mergeAppWithInstallMetadata(
  app: AppItem,
  definition?: AppInstallDefinition,
): AppItem {
  if (!definition) {
    return app;
  }

  const defaultVariant =
    definition.variants.find((item) => item.id === definition.defaultVariantId) ??
    definition.variants[0];

  return {
    ...app,
    name: app.name || definition.title,
    developer: app.developer || definition.developer,
    category: app.category || definition.category,
    description: app.description || definition.description || definition.summary,
    installable: true,
    installSummary: definition.summary,
    installHomepage:
      definition.homepage ?? defaultVariant?.manifestHomepage ?? app.installHomepage,
    installTags: uniqStrings([...(app.installTags ?? []), ...definition.tags]),
    defaultSoftwareName: definition.defaultSoftwareName,
    supportedHostPlatforms: definition.supportedHostPlatforms,
  };
}

function createCatalogBackedApp(definition: HubInstallCatalogEntry): AppItem {
  return mergeAppWithInstallMetadata(
    {
      id: definition.appId,
      name: definition.title,
      developer: definition.developer,
      category: definition.category,
      description: definition.description || definition.summary,
      icon: fallbackCatalogIcon(definition.appId),
      rating: 4.6,
    },
    definition,
  );
}

function createInstallSurfaceSummary(
  appId: string,
  target: AppResolvedInstallTarget,
  assessment: HubInstallAssessmentResult,
): AppInstallSurfaceSummary {
  const blockingIssueCount = assessment.issues.filter((issue) => issue.severity === 'error').length;
  const warningIssueCount = assessment.issues.filter((issue) => issue.severity === 'warning').length;
  const dependencyAttentionCount = assessment.dependencies.filter(
    (dependency) => dependency.status !== 'available',
  ).length;
  const autoRemediableDependencyCount = assessment.dependencies.filter(
    (dependency) => dependency.status !== 'available' && dependency.supportsAutoRemediation,
  ).length;
  const state: AppInstallSurfaceState =
    assessment.installStatus === 'installed'
      ? 'installed'
      : assessment.ready
        ? 'ready'
        : 'attention';

  return {
    appId,
    softwareName: target.softwareName,
    variantId: target.variant.id,
    runtimePlatform: target.runtimePlatform,
    installStatus: assessment.installStatus ?? null,
    ready: assessment.ready,
    state,
    blockingIssueCount,
    warningIssueCount,
    dependencyAttentionCount,
    autoRemediableDependencyCount,
  };
}

function inferGuidedInstallProduct(
  candidates: Array<string | undefined | null>,
): GuidedInstallProductId | null {
  for (const candidate of candidates) {
    const normalized = candidate?.toLowerCase();
    if (!normalized) {
      continue;
    }

    if (normalized.includes('openclaw')) {
      return 'openclaw';
    }

    if (normalized.includes('zeroclaw')) {
      return 'zeroclaw';
    }

    if (normalized.includes('ironclaw')) {
      return 'ironclaw';
    }
  }

  return null;
}

function inferGuidedInstallMethod(
  candidates: Array<string | undefined | null>,
  runtimePlatform?: AppInstallRuntimePlatform,
  effectiveRuntimePlatform?: AppResolvedInstallTarget['request']['effectiveRuntimePlatform'],
): GuidedInstallMethodId | null {
  const hints = candidates.map((value) =>
    typeof value === 'string' ? value.toLowerCase() : '',
  );

  if (hints.some((value) => value.includes('docker'))) {
    return 'docker';
  }

  if (hints.some((value) => value.includes('pnpm'))) {
    return 'pnpm';
  }

  if (hints.some((value) => value.includes('npm'))) {
    return 'npm';
  }

  if (hints.some((value) => value.includes('wsl'))) {
    return 'wsl';
  }

  if (hints.some((value) => value.includes('cloud'))) {
    return 'cloud';
  }

  if (hints.some((value) => value.includes('source'))) {
    return 'source';
  }

  if (runtimePlatform === 'wsl' || effectiveRuntimePlatform === 'wsl') {
    return 'wsl';
  }

  return null;
}

function createGuidedInstallNavigation(
  target: AppResolvedInstallTarget,
  extraHints: Array<string | undefined | null> = [],
): string | null {
  const product = inferGuidedInstallProduct([
    ...extraHints,
    target.appId,
    target.softwareName,
    target.request.softwareName,
  ]);
  const method = inferGuidedInstallMethod(
    [
      ...extraHints,
      target.variant.installationMethod?.id,
      target.variant.installationMethod?.type,
      target.variant.id,
      target.softwareName,
      target.request.softwareName,
    ],
    target.runtimePlatform,
    target.request.effectiveRuntimePlatform,
  );
  if (!product || !method) {
    return null;
  }

  const searchParams = new URLSearchParams();
  searchParams.set('product', product);
  searchParams.set('method', method);
  searchParams.set('guided', '1');
  return `/install?${searchParams.toString()}`;
}

function createGuidedInstallNavigationFromFallback(
  id: string,
  definition: AppInstallDefinition | null,
  context: AppInstallContext,
): string | null {
  const product = inferGuidedInstallProduct([
    context.variantId,
    id,
    definition?.appId,
    definition?.defaultSoftwareName,
  ]);
  const method = inferGuidedInstallMethod([
    context.variantId,
    definition?.defaultVariantId,
    definition?.defaultSoftwareName,
  ]);
  if (!product || !method) {
    return null;
  }

  const searchParams = new URLSearchParams();
  searchParams.set('product', product);
  searchParams.set('method', method);
  searchParams.set('guided', '1');
  return `/install?${searchParams.toString()}`;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await worker(items[currentIndex] as T, currentIndex);
      }
    }),
  );

  return results;
}

class AppStoreServiceImpl implements IAppStoreService {
  private installCatalogCache = new Map<string, Promise<AppInstallDefinition[]>>();

  private async resolveRuntimeAwareInstallContext(
    context: AppInstallContext = {},
  ): Promise<AppInstallContext> {
    if (context.hostPlatform || context.runtimeInfo) {
      return context;
    }

    try {
      const runtimeInfo = await getRuntimePlatform().getRuntimeInfo();
      return {
        ...context,
        runtimeInfo,
      };
    } catch {
      return context;
    }
  }

  private async resolveCatalogContext(context: AppInstallContext = {}) {
    const resolvedContext = await this.resolveRuntimeAwareInstallContext(context);
    const hostPlatform =
      resolvedContext.hostPlatform ??
      resolveAppHostPlatform(resolvedContext.runtimeInfo ?? resolvedContext);

    return {
      resolvedContext: {
        ...resolvedContext,
        hostPlatform,
      },
      hostPlatform,
    };
  }

  private getCatalogCacheKey(hostPlatform: AppInstallHostPlatform) {
    return hostPlatform;
  }

  private async loadInstallCatalog(context: AppInstallContext = {}): Promise<AppInstallDefinition[]> {
    const { hostPlatform } = await this.resolveCatalogContext(context);
    const cacheKey = this.getCatalogCacheKey(hostPlatform);
    const cached = this.installCatalogCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const pending = installerService.listHubInstallCatalog({ hostPlatform }).catch((error) => {
      this.installCatalogCache.delete(cacheKey);
      throw error;
    });

    this.installCatalogCache.set(cacheKey, pending);
    return pending;
  }

  private async loadInstallCatalogSafely(
    context: AppInstallContext = {},
  ): Promise<AppInstallDefinition[]> {
    try {
      return await this.loadInstallCatalog(context);
    } catch {
      return [];
    }
  }

  private async getInstallCatalogMap(context: AppInstallContext = {}) {
    return new Map(
      (await this.loadInstallCatalogSafely(context)).map((definition) => [
        definition.appId,
        definition,
      ]),
    );
  }

  async getInstallCatalog(context: AppInstallContext = {}): Promise<AppInstallDefinition[]> {
    return this.loadInstallCatalog(context);
  }

  async getInstallDefinition(
    id: string,
    context: AppInstallContext = {},
  ): Promise<AppInstallDefinition> {
    return getAppInstallDefinition(await this.loadInstallCatalog(context), id);
  }

  async resolveInstallTarget(
    id: string,
    context: AppInstallContext = {},
  ): Promise<AppResolvedInstallTarget> {
    const { resolvedContext } = await this.resolveCatalogContext(context);
    const definition = await this.getInstallDefinition(id, resolvedContext);

    return resolveAppInstallTarget(definition, resolvedContext);
  }

  private async inspectInstallTarget(
    id: string,
    context: AppInstallContext = {},
  ): Promise<{
    definition: AppInstallDefinition;
    target: AppResolvedInstallTarget;
    assessment: HubInstallAssessmentResult;
  }> {
    const { resolvedContext } = await this.resolveCatalogContext(context);
    const definition = await this.getInstallDefinition(id, resolvedContext);
    const target = resolveAppInstallTarget(definition, resolvedContext);
    const assessment = await installerService.inspectHubInstall(target.request);

    return {
      definition,
      target,
      assessment,
    };
  }

  async inspectInstall(
    id: string,
    context: AppInstallContext = {},
  ): Promise<AppInstallInspection> {
    const [app, inspection] = await Promise.all([
      this.getApp(id),
      this.inspectInstallTarget(id, context),
    ]);

    return {
      app,
      definition: inspection.definition,
      target: inspection.target,
      assessment: inspection.assessment,
    };
  }

  async getInstallSurfaceSummaries(
    appIds: string[],
    context: AppInstallContext = {},
  ): Promise<Map<string, AppInstallSurfaceSummary>> {
    const uniqueAppIds = [...new Set(appIds.filter((appId) => Boolean(appId && appId.trim())))];
    if (uniqueAppIds.length === 0) {
      return new Map();
    }

    const { resolvedContext } = await this.resolveCatalogContext(context);
    const catalogMap = await this.getInstallCatalogMap(resolvedContext);
    const inspectableIds = uniqueAppIds.filter((appId) => catalogMap.has(appId));

    const entries = await mapWithConcurrency(
      inspectableIds,
      3,
      async (appId): Promise<readonly [string, AppInstallSurfaceSummary] | null> => {
        try {
          const inspection = await this.inspectInstallTarget(appId, resolvedContext);
          return [appId, createInstallSurfaceSummary(appId, inspection.target, inspection.assessment)] as const;
        } catch {
          return null;
        }
      },
    );

    return new Map(
      entries.filter(
        (entry): entry is readonly [string, AppInstallSurfaceSummary] => Boolean(entry),
      ),
    );
  }

  async getGuidedInstallNavigation(
    id: string,
    context: AppInstallContext = {},
  ): Promise<string | null> {
    try {
      const target = await this.resolveInstallTarget(id, context);
      return createGuidedInstallNavigation(target, [context.variantId]);
    } catch {
      try {
        const definition = await this.getInstallDefinition(id, context);
        return createGuidedInstallNavigationFromFallback(id, definition, context);
      } catch {
        return createGuidedInstallNavigationFromFallback(id, null, context);
      }
    }
  }

  async installDependencies(
    id: string,
    options: AppInstallDependencyOptions = {},
  ): Promise<HubInstallDependencyResult> {
    const target = await this.resolveInstallTarget(id, options);

    return installerService.runHubDependencyInstall({
      ...target.request,
      dependencyIds: options.dependencyIds,
      continueOnError: options.continueOnError,
    });
  }

  async installApp(id: string, context: AppInstallContext = {}): Promise<HubInstallResult> {
    const target = await this.resolveInstallTarget(id, context);
    return installerService.runHubInstall(target.request);
  }

  async uninstallApp(
    id: string,
    options: AppUninstallOptions = {},
  ): Promise<HubUninstallResult> {
    const target = await this.resolveInstallTarget(id, options);
    return installerService.runHubUninstall({
      ...target.request,
      purgeData: options.purgeData,
      backupBeforeUninstall: options.backupBeforeUninstall,
    });
  }

  async getList(params: ListParams = {}): Promise<PaginatedResult<AppItem>> {
    const [catalog, topChartApps] = await Promise.all([
      this.loadInstallCatalogSafely(),
      studioMockService.getTopChartApps(),
    ]);
    const catalogMap = new Map(catalog.map((definition) => [definition.appId, definition]));
    const rankedApps = topChartApps.map((app) =>
      mergeAppWithInstallMetadata(app, catalogMap.get(app.id)),
    );
    const rankedIds = new Set(rankedApps.map((item) => item.id));
    const catalogOnlyApps = catalog
      .filter((definition) => !rankedIds.has(definition.appId))
      .map(createCatalogBackedApp);
    const items = [...rankedApps, ...catalogOnlyApps];

    let filtered = items;
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(
        (app) =>
          app.name.toLowerCase().includes(lowerKeyword) ||
          app.developer.toLowerCase().includes(lowerKeyword) ||
          app.category.toLowerCase().includes(lowerKeyword) ||
          app.description?.toLowerCase().includes(lowerKeyword) ||
          app.installSummary?.toLowerCase().includes(lowerKeyword) ||
          app.installTags?.some((tag) => tag.toLowerCase().includes(lowerKeyword)),
      );
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paginatedItems = filtered.slice(start, start + pageSize);

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  }

  async getById(id: string): Promise<AppItem | null> {
    try {
      return await this.getApp(id);
    } catch {
      return null;
    }
  }

  async create(_data: CreateAppDTO): Promise<AppItem> {
    throw new Error('Method not implemented.');
  }

  async update(_id: string, _data: UpdateAppDTO): Promise<AppItem> {
    throw new Error('Method not implemented.');
  }

  async delete(_id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  async getFeaturedApp(): Promise<AppItem> {
    const [app, catalogMap] = await Promise.all([
      studioMockService.getFeaturedApp(),
      this.getInstallCatalogMap(),
    ]);
    if (!app) {
      throw new Error('Failed to fetch featured app');
    }

    return mergeAppWithInstallMetadata(app, catalogMap.get(app.id));
  }

  async getTopCharts(): Promise<AppItem[]> {
    const [apps, catalogMap] = await Promise.all([
      studioMockService.getTopChartApps(),
      this.getInstallCatalogMap(),
    ]);

    return apps.map((app) => mergeAppWithInstallMetadata(app, catalogMap.get(app.id)));
  }

  async getCategories(): Promise<AppCategory[]> {
    const [categories, catalog] = await Promise.all([
      studioMockService.getAppCategories(),
      this.loadInstallCatalogSafely(),
    ]);
    const catalogMap = new Map(catalog.map((definition) => [definition.appId, definition]));
    const categorizedIds = new Set<string>();
    const nextCategories = categories.map((category) => ({
      ...category,
      apps: category.apps.map((app) => {
        categorizedIds.add(app.id);
        return mergeAppWithInstallMetadata(app, catalogMap.get(app.id));
      }),
    }));
    const uncategorizedCatalogApps = catalog
      .filter((definition) => !categorizedIds.has(definition.appId))
      .map(createCatalogBackedApp);

    if (uncategorizedCatalogApps.length > 0) {
      nextCategories.push({
        title: 'Hub Installer Catalog',
        subtitle: 'Additional installable products resolved directly from the Rust registry.',
        apps: uncategorizedCatalogApps,
      });
    }

    return nextCategories;
  }

  async getApp(id: string): Promise<AppItem> {
    const [catalogMap, app] = await Promise.all([
      this.getInstallCatalogMap(),
      studioMockService.getApp(id),
    ]);
    const definition = catalogMap.get(id);

    if (app) {
      return mergeAppWithInstallMetadata(app, definition);
    }

    if (definition) {
      return createCatalogBackedApp(definition);
    }

    throw new Error('Failed to fetch app');
  }
}

export const appStoreService = new AppStoreServiceImpl();
