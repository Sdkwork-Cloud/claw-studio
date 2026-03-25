import {
  getRuntimePlatform,
  installerService,
  type HubInstallAssessmentResult,
  type HubInstallDependencyResult,
  type HubInstallRecordStatus,
  type HubInstallResult,
  type HubUninstallResult,
  type RuntimeInfo,
} from '@sdkwork/claw-infrastructure';
import {
  type AppStoreCatalogApp,
  type AppStoreCatalogCategory,
  type AppStoreCatalogService,
  appStoreCatalogService as defaultAppStoreCatalogService,
} from '@sdkwork/claw-core/services/appStoreCatalogService';
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
  subtitle?: string;
  apps: AppItem[];
}

export interface AppItem {
  id: string;
  name: string;
  developer: string;
  category: string;
  description?: string;
  icon: string;
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

const APP_STORE_INSPECTION_CONCURRENCY = 2;
const INSTALL_SURFACE_SUMMARY_CACHE_TTL_MS = 30_000;
const REMOTE_CATALOG_PAGE_SIZE = 100;

interface AppCatalogPresentation {
  items: AppItem[];
  itemsById: Map<string, AppItem>;
  categories: AppCategory[];
}

interface AppStoreRemoteCatalogSnapshot {
  items: AppStoreCatalogApp[];
  categories: AppStoreCatalogCategory[];
}

export interface CreateAppStoreServiceOptions {
  appStoreCatalogService?: AppStoreCatalogService;
}

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
  getCategories(): Promise<AppCategory[]>;
  getApp(id: string): Promise<AppItem>;

  installApp(id: string, context?: AppInstallContext): Promise<HubInstallResult>;
  uninstallApp(id: string, options?: AppUninstallOptions): Promise<HubUninstallResult>;
}

function uniqStrings(values: Array<string | undefined | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function fallbackCatalogIcon(appId: string) {
  const hash = Math.abs(
    Array.from(appId).reduce((current, character) => current * 31 + character.charCodeAt(0), 7),
  );
  const palettes = [
    ['#0f172a', '#38bdf8'],
    ['#1f2937', '#34d399'],
    ['#3f3f46', '#f59e0b'],
    ['#1d4ed8', '#93c5fd'],
    ['#065f46', '#6ee7b7'],
  ] as const;
  const [backgroundColor, accentColor] = palettes[hash % palettes.length] as readonly [string, string];
  const initials = appId
    .replace(/^app-/, '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() ?? '')
    .join('') || 'AP';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${initials}"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${backgroundColor}" /><stop offset="100%" stop-color="${accentColor}" /></linearGradient></defs><rect width="128" height="128" rx="28" fill="url(#g)" /><text x="50%" y="50%" fill="#f8fafc" font-family="Segoe UI, Arial, sans-serif" font-size="42" font-weight="700" text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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

function createRemoteCatalogApp(app: AppStoreCatalogApp): AppItem {
  return {
    id: app.id,
    name: app.name,
    developer: app.developer,
    category: app.category,
    description: app.description,
    icon: app.iconUrl || fallbackCatalogIcon(app.id),
  };
}

function sortApps(items: AppItem[]) {
  return [...items].sort(
    (left, right) =>
      left.category.localeCompare(right.category) ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id),
  );
}

function createCatalogCategories(
  items: AppItem[],
  categories: AppStoreCatalogCategory[] = [],
): AppCategory[] {
  const categoryMap = new Map<string, AppItem[]>();

  items.forEach((item) => {
    const apps = categoryMap.get(item.category) ?? [];
    apps.push(item);
    categoryMap.set(item.category, apps);
  });

  const categoryOrder = new Map(
    categories.map((category, index) => [category.name, index] as const),
  );

  return [...categoryMap.entries()]
    .sort(
      ([leftTitle], [rightTitle]) =>
        (categoryOrder.get(leftTitle) ?? Number.MAX_SAFE_INTEGER) -
          (categoryOrder.get(rightTitle) ?? Number.MAX_SAFE_INTEGER) ||
        leftTitle.localeCompare(rightTitle),
    )
    .map(([title, apps]) => ({
      title,
      apps: sortApps(apps),
    }));
}

function createCatalogPresentation(
  remoteCatalog: AppStoreRemoteCatalogSnapshot,
  installCatalog: AppInstallDefinition[],
): AppCatalogPresentation {
  const installDefinitionsById = new Map(
    installCatalog.map((definition) => [definition.appId, definition] as const),
  );
  const items = sortApps(
    remoteCatalog.items.map((app) =>
      mergeAppWithInstallMetadata(
        createRemoteCatalogApp(app),
        installDefinitionsById.get(app.id),
      ),
    ),
  );
  const itemsById = new Map(items.map((item) => [item.id, item] as const));

  return {
    items,
    itemsById,
    categories: createCatalogCategories(items, remoteCatalog.categories),
  };
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

function normalizeRequestVariables(variables?: Record<string, string>) {
  if (!variables) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(variables).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  );
}

function createInstallSurfaceSummaryCacheKey(
  appId: string,
  target: AppResolvedInstallTarget,
): string {
  return `${appId}:${JSON.stringify({
    hostPlatform: target.hostPlatform,
    runtimePlatform: target.runtimePlatform,
    variantId: target.variant.id,
    request: {
      softwareName: target.request.softwareName,
      effectiveRuntimePlatform: target.request.effectiveRuntimePlatform ?? null,
      installScope: target.request.installScope ?? null,
      containerRuntimePreference: target.request.containerRuntimePreference ?? null,
      wslDistribution: target.request.wslDistribution ?? null,
      dockerContext: target.request.dockerContext ?? null,
      dockerHost: target.request.dockerHost ?? null,
      dryRun: target.request.dryRun ?? null,
      verbose: target.request.verbose ?? null,
      sudo: target.request.sudo ?? null,
      timeoutMs: target.request.timeoutMs ?? null,
      installerHome: target.request.installerHome ?? null,
      installRoot: target.request.installRoot ?? null,
      workRoot: target.request.workRoot ?? null,
      binDir: target.request.binDir ?? null,
      dataRoot: target.request.dataRoot ?? null,
      variables: normalizeRequestVariables(target.request.variables),
    },
  })}`;
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
  private appStoreCatalogService: AppStoreCatalogService;
  private installCatalogCache = new Map<string, Promise<AppInstallDefinition[]>>();
  private catalogPresentationCache = new Map<string, Promise<AppCatalogPresentation>>();
  private remoteCatalogPromise: Promise<AppStoreRemoteCatalogSnapshot> | null = null;
  private runtimeInfoPromise: Promise<RuntimeInfo | null> | null = null;
  private installSurfaceSummaryCache = new Map<
    string,
    {
      expiresAt: number;
      summary: AppInstallSurfaceSummary;
    }
  >();
  private installSurfaceSummaryPending = new Map<string, Promise<AppInstallSurfaceSummary | null>>();

  constructor(options: CreateAppStoreServiceOptions = {}) {
    this.appStoreCatalogService =
      options.appStoreCatalogService || defaultAppStoreCatalogService;
  }

  private async loadRuntimeInfo(): Promise<RuntimeInfo | null> {
    if (!this.runtimeInfoPromise) {
      this.runtimeInfoPromise = getRuntimePlatform()
        .getRuntimeInfo()
        .catch(() => {
          this.runtimeInfoPromise = null;
          return null;
        });
    }

    return this.runtimeInfoPromise;
  }

  private getCachedInstallSurfaceSummary(cacheKey: string): AppInstallSurfaceSummary | null {
    const cached = this.installSurfaceSummaryCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    if (cached.expiresAt <= Date.now()) {
      this.installSurfaceSummaryCache.delete(cacheKey);
      return null;
    }

    return cached.summary;
  }

  private cacheInstallSurfaceSummary(cacheKey: string, summary: AppInstallSurfaceSummary) {
    this.installSurfaceSummaryCache.set(cacheKey, {
      summary,
      expiresAt: Date.now() + INSTALL_SURFACE_SUMMARY_CACHE_TTL_MS,
    });
  }

  private invalidateInstallSurfaceSummaryCache(appId?: string) {
    if (!appId) {
      this.installSurfaceSummaryCache.clear();
      this.installSurfaceSummaryPending.clear();
      return;
    }

    const cacheKeyPrefix = `${appId}:`;
    for (const cacheKey of this.installSurfaceSummaryCache.keys()) {
      if (cacheKey.startsWith(cacheKeyPrefix)) {
        this.installSurfaceSummaryCache.delete(cacheKey);
      }
    }
    for (const cacheKey of this.installSurfaceSummaryPending.keys()) {
      if (cacheKey.startsWith(cacheKeyPrefix)) {
        this.installSurfaceSummaryPending.delete(cacheKey);
      }
    }
  }

  private async resolveRuntimeAwareInstallContext(
    context: AppInstallContext = {},
  ): Promise<AppInstallContext> {
    if (context.hostPlatform || context.runtimeInfo) {
      return context;
    }

    try {
      const runtimeInfo = await this.loadRuntimeInfo();
      if (!runtimeInfo) {
        return context;
      }

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
      this.catalogPresentationCache.delete(cacheKey);
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

  private async loadRemoteCatalogSnapshot(): Promise<AppStoreRemoteCatalogSnapshot> {
    if (this.remoteCatalogPromise) {
      return this.remoteCatalogPromise;
    }

    const pending = (async (): Promise<AppStoreRemoteCatalogSnapshot> => {
      const [categories, items] = await Promise.all([
        this.appStoreCatalogService.listCategories().catch(() => []),
        (async () => {
          const collectedItems: AppStoreCatalogApp[] = [];
          let page = 1;

          while (true) {
            const result = await this.appStoreCatalogService.listApps({
              page,
              pageSize: REMOTE_CATALOG_PAGE_SIZE,
            });
            collectedItems.push(...result.items);

            if (!result.hasMore || result.items.length === 0) {
              break;
            }

            page += 1;
          }

          return collectedItems;
        })(),
      ]);

      return {
        categories,
        items: Array.from(new Map(items.map((item) => [item.id, item] as const)).values()),
      };
    })().catch((error) => {
      this.remoteCatalogPromise = null;
      throw error;
    });

    this.remoteCatalogPromise = pending;
    return pending;
  }

  private async loadCatalogPresentation(
    context: AppInstallContext = {},
  ): Promise<AppCatalogPresentation> {
    const { resolvedContext, hostPlatform } = await this.resolveCatalogContext(context);
    const cacheKey = this.getCatalogCacheKey(hostPlatform);
    const cached = this.catalogPresentationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const pending = Promise.all([
      this.loadRemoteCatalogSnapshot(),
      this.loadInstallCatalog(resolvedContext),
    ])
      .then(([remoteCatalog, installCatalog]) =>
        createCatalogPresentation(remoteCatalog, installCatalog),
      )
      .catch((error) => {
        this.catalogPresentationCache.delete(cacheKey);
        throw error;
      });

    this.catalogPresentationCache.set(cacheKey, pending);
    return pending;
  }

  private async loadCatalogPresentationSafely(context: AppInstallContext = {}) {
    try {
      return await this.loadCatalogPresentation(context);
    } catch {
      return createCatalogPresentation({ items: [], categories: [] }, []);
    }
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

  private async getInstallSurfaceSummary(
    appId: string,
    definition: AppInstallDefinition,
    resolvedContext: AppInstallContext,
  ): Promise<AppInstallSurfaceSummary | null> {
    const target = resolveAppInstallTarget(definition, resolvedContext);
    const cacheKey = createInstallSurfaceSummaryCacheKey(appId, target);
    const cached = this.getCachedInstallSurfaceSummary(cacheKey);
    if (cached) {
      return cached;
    }

    const pending = this.installSurfaceSummaryPending.get(cacheKey);
    if (pending) {
      return pending;
    }

    const nextPending = installerService
      .inspectHubInstall(target.request)
      .then((assessment) => {
        const summary = createInstallSurfaceSummary(appId, target, assessment);
        this.cacheInstallSurfaceSummary(cacheKey, summary);
        return summary;
      })
      .catch(() => null)
      .finally(() => {
        this.installSurfaceSummaryPending.delete(cacheKey);
      });

    this.installSurfaceSummaryPending.set(cacheKey, nextPending);
    return nextPending;
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
      APP_STORE_INSPECTION_CONCURRENCY,
      async (appId): Promise<readonly [string, AppInstallSurfaceSummary] | null> => {
        try {
          const definition = catalogMap.get(appId);
          if (!definition) {
            return null;
          }

          const summary = await this.getInstallSurfaceSummary(appId, definition, resolvedContext);
          return summary ? ([appId, summary] as const) : null;
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
    this.invalidateInstallSurfaceSummaryCache(id);

    return installerService.runHubDependencyInstall({
      ...target.request,
      dependencyIds: options.dependencyIds,
      continueOnError: options.continueOnError,
    });
  }

  async installApp(id: string, context: AppInstallContext = {}): Promise<HubInstallResult> {
    const target = await this.resolveInstallTarget(id, context);
    this.invalidateInstallSurfaceSummaryCache(id);
    return installerService.runHubInstall(target.request);
  }

  async uninstallApp(
    id: string,
    options: AppUninstallOptions = {},
  ): Promise<HubUninstallResult> {
    const target = await this.resolveInstallTarget(id, options);
    this.invalidateInstallSurfaceSummaryCache(id);
    return installerService.runHubUninstall({
      ...target.request,
      purgeData: options.purgeData,
      backupBeforeUninstall: options.backupBeforeUninstall,
    });
  }

  async getList(params: ListParams = {}): Promise<PaginatedResult<AppItem>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const [result, installCatalogMap] = await Promise.all([
      this.appStoreCatalogService.listApps({
        keyword: params.keyword,
        page,
        pageSize,
      }),
      this.getInstallCatalogMap(),
    ]);
    const paginatedItems = sortApps(
      result.items.map((app) =>
        mergeAppWithInstallMetadata(
          createRemoteCatalogApp(app),
          installCatalogMap.get(app.id),
        ),
      ),
    );

    return {
      items: paginatedItems,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
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

  async getCategories(): Promise<AppCategory[]> {
    return (await this.loadCatalogPresentationSafely()).categories;
  }

  async getApp(id: string): Promise<AppItem> {
    const [remoteApp, installCatalogMap] = await Promise.all([
      this.appStoreCatalogService.getApp(id),
      this.getInstallCatalogMap(),
    ]);

    return mergeAppWithInstallMetadata(
      createRemoteCatalogApp(remoteApp),
      installCatalogMap.get(id),
    );
  }
}

export function createAppStoreService(
  options: CreateAppStoreServiceOptions = {},
): IAppStoreService {
  return new AppStoreServiceImpl(options);
}

export const appStoreService = createAppStoreService();
