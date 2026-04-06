import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Download, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { Input } from '@sdkwork/claw-ui';
import { type AppCategory, type AppInstallSurfaceSummary, appStoreService } from '../../services';
import {
  type AppInstallSurfaceLookup,
  collectPriorityInstallableAppIds,
  countAppsInCategories,
  createStoreOverview,
  filterCategoriesByKeyword,
} from './appCatalogPresentation.ts';

const INSTALL_SURFACE_BATCH_SIZE = 3;
const INSTALL_SURFACE_PRIORITY_LIMIT = 6;
const INSTALL_SURFACE_OBSERVER_ROOT_MARGIN = '600px 0px';

function createInstallSurfaceLookup(
  summaries: Map<string, AppInstallSurfaceSummary>,
): AppInstallSurfaceLookup {
  return Object.fromEntries(summaries.entries()) as AppInstallSurfaceLookup;
}

function mergeInstallSurfaceLookup(
  currentLookup: AppInstallSurfaceLookup,
  summaries: Map<string, AppInstallSurfaceSummary>,
): AppInstallSurfaceLookup {
  if (summaries.size === 0) {
    return currentLookup;
  }

  return {
    ...currentLookup,
    ...createInstallSurfaceLookup(summaries),
  };
}

function waitForNextPaint() {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function getInstallSurfaceLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  summary?: AppInstallSurfaceSummary,
) {
  if (!summary) {
    return null;
  }

  if (summary.state === 'installed') {
    return t('apps.store.installed');
  }

  if (summary.state === 'ready') {
    return t('apps.store.ready');
  }

  return t('apps.store.needsSetup');
}

function getInstallSurfaceHint(
  t: (key: string, options?: Record<string, unknown>) => string,
  summary?: AppInstallSurfaceSummary,
) {
  if (!summary) {
    return null;
  }

  if (summary.state === 'installed') {
    return t('apps.store.installedHint');
  }

  if (summary.state === 'ready') {
    return t('apps.store.readyHint');
  }

  if (summary.blockingIssueCount > 0) {
    return t('apps.store.blockingHint', { count: summary.blockingIssueCount });
  }

  if (summary.dependencyAttentionCount > 0) {
    return t('apps.store.dependencyHint', { count: summary.dependencyAttentionCount });
  }

  return t('apps.store.reviewHint');
}

function getInstallSurfaceTone(summary?: AppInstallSurfaceSummary) {
  if (!summary) {
    return 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300';
  }

  if (summary.state === 'installed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
  }

  if (summary.state === 'ready') {
    return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300';
}

function getHostPlatformLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  value: string,
) {
  return t(`apps.detail.values.platforms.${value}`, {
    defaultValue: value,
  });
}

export function AppStore() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [categories, setCategories] = useState<AppCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [installSurfaceById, setInstallSurfaceById] = useState<AppInstallSurfaceLookup>({});
  const [loading, setLoading] = useState(true);
  const [isHydratingInstallSurfaces, setIsHydratingInstallSurfaces] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const activeRef = useRef(true);
  const installSurfaceQueueRef = useRef<string[]>([]);
  const installSurfaceRequestedIdsRef = useRef<Set<string>>(new Set());
  const installSurfaceHydrationInFlightRef = useRef(false);
  const categorySectionElementsRef = useRef(new Map<string, HTMLElement>());

  const categoryInstallableIdsByTitle = useMemo(
    () =>
      new Map(
        categories.map((category) => [
          category.title,
          category.apps.filter((app) => app.installable).map((app) => app.id),
        ]),
      ),
    [categories],
  );

  const visibleCategories = useMemo(
    () => filterCategoriesByKeyword(categories, deferredSearchQuery),
    [categories, deferredSearchQuery],
  );
  const visibleAppsCount = useMemo(
    () => countAppsInCategories(visibleCategories),
    [visibleCategories],
  );
  const overview = useMemo(
    () => createStoreOverview(categories, installSurfaceById),
    [categories, installSurfaceById],
  );
  const hasSearchQuery = deferredSearchQuery.trim().length > 0;

  const applyInstallSurfaceBatch = (summaries: Map<string, AppInstallSurfaceSummary>) => {
    if (!activeRef.current || summaries.size === 0) {
      return;
    }

    startTransition(() => {
      setInstallSurfaceById((currentLookup) => mergeInstallSurfaceLookup(currentLookup, summaries));
    });
  };

  const drainInstallSurfaceQueue = async () => {
    if (!activeRef.current || installSurfaceHydrationInFlightRef.current) {
      return;
    }

    installSurfaceHydrationInFlightRef.current = true;

    try {
      while (activeRef.current && installSurfaceQueueRef.current.length > 0) {
        const batch = installSurfaceQueueRef.current.splice(0, INSTALL_SURFACE_BATCH_SIZE);
        if (batch.length === 0) {
          continue;
        }

        try {
          const summaries = await appStoreService.getInstallSurfaceSummaries(batch);
          if (!activeRef.current) {
            return;
          }

          applyInstallSurfaceBatch(summaries);
        } catch (error) {
          console.error('Failed to fetch app install surface summaries:', error);
        }

        await waitForNextPaint();
      }
    } finally {
      installSurfaceHydrationInFlightRef.current = false;
      if (!activeRef.current) {
        return;
      }

      const hasQueuedItems = installSurfaceQueueRef.current.length > 0;
      startTransition(() => {
        setIsHydratingInstallSurfaces(hasQueuedItems);
      });

      if (hasQueuedItems) {
        void drainInstallSurfaceQueue();
      }
    }
  };

  const enqueueInstallSurfaceHydration = (appIds: string[]) => {
    const nextIds = appIds.filter((appId) => {
      const normalizedAppId = appId.trim();
      if (!normalizedAppId || installSurfaceRequestedIdsRef.current.has(normalizedAppId)) {
        return false;
      }

      installSurfaceRequestedIdsRef.current.add(normalizedAppId);
      return true;
    });

    if (nextIds.length === 0) {
      return;
    }

    installSurfaceQueueRef.current.push(...nextIds);
    startTransition(() => {
      setIsHydratingInstallSurfaces(true);
    });
    void drainInstallSurfaceQueue();
  };

  useEffect(() => {
    activeRef.current = true;

    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchStoreData = async () => {
      installSurfaceQueueRef.current = [];
      installSurfaceRequestedIdsRef.current = new Set();
      installSurfaceHydrationInFlightRef.current = false;

      startTransition(() => {
        setLoading(true);
        setIsHydratingInstallSurfaces(false);
        setInstallSurfaceById({});
      });

      try {
        const nextCategories = await appStoreService.getCategories();
        if (cancelled || !activeRef.current) {
          return;
        }

        startTransition(() => {
          setCategories(nextCategories);
          setLoading(false);
        });

        enqueueInstallSurfaceHydration(
          collectPriorityInstallableAppIds(nextCategories, INSTALL_SURFACE_PRIORITY_LIMIT),
        );
      } catch (error) {
        console.error('Failed to fetch app store data:', error);
        if (!cancelled && activeRef.current) {
          startTransition(() => {
            setCategories([]);
            setLoading(false);
            setIsHydratingInstallSurfaces(false);
          });
        }
      }
    };

    void fetchStoreData();

    return () => {
      cancelled = true;
      installSurfaceQueueRef.current = [];
      installSurfaceHydrationInFlightRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (categories.length === 0) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      categoryInstallableIdsByTitle.forEach((appIds) => {
        enqueueInstallSurfaceHydration(appIds);
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const title = entry.target.getAttribute('data-category-title');
          if (!title) {
            return;
          }

          const appIds = categoryInstallableIdsByTitle.get(title) ?? [];
          enqueueInstallSurfaceHydration(appIds);
        });
      },
      {
        rootMargin: INSTALL_SURFACE_OBSERVER_ROOT_MARGIN,
      },
    );

    categorySectionElementsRef.current.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, [categories, categoryInstallableIdsByTitle]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white/80 px-8 py-4 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-sky-500 text-white shadow-lg">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t('apps.store.title')}
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {t('apps.store.description')}
            </p>
            {isHydratingInstallSurfaces ? (
              <p className="mt-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {t('apps.store.checkingInstallReadiness')}
              </p>
            ) : null}
          </div>
        </div>
        <label className="group relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-primary-500 dark:text-zinc-500" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
            }}
            placeholder={t('apps.store.searchPlaceholder')}
            className="rounded-2xl bg-zinc-100/80 py-2.5 pl-12 pr-4 font-medium shadow-sm focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-primary-500/10 focus-visible:ring-offset-0 dark:border-zinc-700 dark:bg-zinc-800/80 dark:focus-visible:bg-zinc-900 dark:focus-visible:ring-offset-0"
          />
        </label>
      </div>

      <div className="mx-auto max-w-7xl space-y-10 p-8">
        <section className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="grid gap-8 px-8 py-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('apps.store.catalogBadge')}
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-4xl">
                {t('apps.store.catalogTitle')}
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
                {t('apps.store.catalogDescription')}
              </p>
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                {hasSearchQuery
                  ? t('apps.store.searchResultsDescription', { count: visibleAppsCount })
                  : t('apps.store.catalogTotals', {
                      count: overview.totalApps,
                      categories: overview.totalCategories,
                    })}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('apps.store.overview.totalApps')}
                </div>
                <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {overview.totalApps}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('apps.store.overview.categories')}
                </div>
                <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {overview.totalCategories}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('apps.store.overview.installed')}
                </div>
                <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {overview.installedApps}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('apps.store.overview.ready')}
                </div>
                <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {overview.readyApps}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60 sm:col-span-2 xl:col-span-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('apps.store.overview.attention')}
                </div>
                <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {overview.attentionApps}
                </div>
              </div>
            </div>
          </div>
        </section>

        {categories.length === 0 ? (
          <section className="rounded-[2rem] border border-dashed border-zinc-300 bg-white px-8 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/60">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t('apps.store.emptyCatalogTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
              {t('apps.store.emptyCatalogDescription')}
            </p>
          </section>
        ) : visibleAppsCount === 0 ? (
          <section className="rounded-[2rem] border border-dashed border-zinc-300 bg-white px-8 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/60">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t('apps.store.emptySearchTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
              {t('apps.store.emptySearchDescription', { query: deferredSearchQuery.trim() })}
            </p>
          </section>
        ) : (
          visibleCategories.map((category) => (
            <section
              key={category.title}
              ref={(node) => {
                if (node) {
                  categorySectionElementsRef.current.set(category.title, node);
                  return;
                }

                categorySectionElementsRef.current.delete(category.title);
              }}
              data-category-title={category.title}
              className="relative"
              style={{ contentVisibility: 'auto', containIntrinsicSize: '760px' }}
            >
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {category.title}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {t('apps.store.categoryCount', { count: category.apps.length })}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {category.apps.map((app) => {
                  const installSurface = installSurfaceById[app.id];
                  const hostPlatforms = app.supportedHostPlatforms?.slice(0, 3) ?? [];

                  return (
                    <article
                      key={app.id}
                      onClick={() => navigate(`/apps/${app.id}`)}
                      className="group flex h-full cursor-pointer flex-col rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-zinc-700"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <img
                            src={app.icon}
                            alt={app.name}
                            className="h-16 w-16 rounded-2xl border border-zinc-200 object-cover shadow-sm dark:border-zinc-800"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="min-w-0">
                            <h4 className="truncate text-lg font-bold text-zinc-900 transition-colors group-hover:text-primary-600 dark:text-zinc-100 dark:group-hover:text-primary-400">
                              {app.name}
                            </h4>
                            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                              {app.developer}
                            </p>
                          </div>
                        </div>

                        {installSurface ? (
                          <span
                            className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${getInstallSurfaceTone(
                              installSurface,
                            )}`}
                          >
                            {getInstallSurfaceLabel(t, installSurface)}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-4 line-clamp-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                        {app.installSummary || app.description}
                      </p>

                      {hostPlatforms.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {hostPlatforms.map((platform) => (
                            <span
                              key={`${app.id}-${platform}`}
                              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                            >
                              {getHostPlatformLabel(t, platform)}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {app.installTags?.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {app.installTags.slice(0, 3).map((tag) => (
                            <span
                              key={`${app.id}-${tag}`}
                              className="rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-auto pt-5">
                        <div className="min-h-[2.5rem] text-sm text-zinc-500 dark:text-zinc-400">
                          {getInstallSurfaceHint(t, installSurface) || t('apps.store.catalogAppFallback')}
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            {t('apps.store.hostPlatforms')}
                          </span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/apps/${app.id}`);
                            }}
                            className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-bold text-primary-600 transition-colors hover:bg-primary-600 hover:text-white dark:bg-zinc-800 dark:text-primary-400 dark:hover:bg-primary-500 dark:hover:text-zinc-900"
                          >
                            <Download className="h-4 w-4" />
                            {installSurface?.state === 'installed'
                              ? t('apps.store.installed')
                              : app.installable
                                ? t('common.install')
                                : t('common.get')}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
