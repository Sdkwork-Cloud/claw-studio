import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Download,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';
import { Input } from '@sdkwork/claw-ui';
import { type AppCategory, type AppItem, appStoreService } from '../../services';

export function AppStore() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [featuredApp, setFeaturedApp] = useState<AppItem | null>(null);
  const [topCharts, setTopCharts] = useState<AppItem[]>([]);
  const [categories, setCategories] = useState<AppCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStoreData = async () => {
      setLoading(true);
      try {
        const [featured, charts, cats] = await Promise.all([
          appStoreService.getFeaturedApp(),
          appStoreService.getTopCharts(),
          appStoreService.getCategories(),
        ]);
        setFeaturedApp(featured);
        setTopCharts(charts);
        setCategories(cats);
      } catch (error) {
        console.error('Failed to fetch app store data:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchStoreData();
  }, []);

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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 text-white shadow-lg">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t('apps.store.title')}
          </h1>
        </div>
        <div className="group relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-primary-500 dark:text-zinc-500" />
          <Input
            type="text"
            placeholder={t('apps.store.searchPlaceholder')}
            className="rounded-2xl bg-zinc-100/80 py-2.5 pl-12 pr-4 font-medium shadow-sm focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-primary-500/10 focus-visible:ring-offset-0 dark:border-zinc-700 dark:bg-zinc-800/80 dark:focus-visible:bg-zinc-900 dark:focus-visible:ring-offset-0"
          />
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-16 p-8">
        {featuredApp ? (
          <section>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                  <Zap className="h-4 w-4" />
                  {t('apps.store.featuredLabel')}
                </h2>
                <h3 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {t('apps.store.featuredTitle')}
                </h3>
              </div>
            </div>
            <div
              onClick={() => navigate(`/apps/${featuredApp.id}`)}
              className="group relative cursor-pointer overflow-hidden rounded-[2.5rem] border border-zinc-200/50 shadow-xl transition-all duration-500 hover:shadow-2xl dark:border-zinc-800/50 dark:shadow-primary-900/10 dark:hover:shadow-primary-900/20"
            >
              <div className="relative aspect-[21/9] w-full">
                <img
                  src={featuredApp.banner}
                  alt={t('apps.store.bannerAlt')}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                <div className="absolute bottom-0 left-0 flex w-full flex-col gap-6 p-8 md:flex-row md:items-end md:gap-8 md:p-12">
                  <img
                    src={featuredApp.icon}
                    alt={t('apps.store.iconAlt')}
                    className="h-24 w-24 shrink-0 rounded-[1.5rem] border-2 border-white/20 shadow-2xl md:h-32 md:w-32"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 text-white">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                        {t('apps.store.editorsChoice')}
                      </span>
                      <span className="flex items-center gap-1 text-sm font-medium text-zinc-300">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        {t('common.official')}
                      </span>
                    </div>
                    <h2 className="mb-3 text-4xl font-bold tracking-tight md:text-5xl">
                      {featuredApp.name}
                    </h2>
                    <p className="max-w-2xl line-clamp-2 text-lg leading-relaxed text-zinc-300 md:text-xl">
                      {featuredApp.description}
                    </p>
                  </div>
                  <button className="hidden items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 font-bold text-zinc-900 shadow-xl transition-colors hover:bg-zinc-100 hover:scale-105 active:scale-95 md:flex">
                    <Download className="h-5 w-5" />
                    {t('common.get')}
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {t('apps.store.topChartsTitle')}
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t('apps.store.topChartsDescription')}
              </p>
            </div>
            <button className="flex items-center gap-1 rounded-full bg-primary-50 px-4 py-2 text-sm font-bold text-primary-600 transition-colors hover:text-primary-700 dark:bg-primary-500/10 dark:text-primary-400 dark:hover:text-primary-300">
              {t('apps.store.seeAll')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
            {topCharts.map((app) => (
              <div
                key={app.id}
                onClick={() => navigate(`/apps/${app.id}`)}
                className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-transparent p-3 transition-all hover:border-zinc-200 hover:bg-white hover:shadow-md dark:hover:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:shadow-primary-900/10"
              >
                <span className="w-6 text-center text-lg font-bold text-zinc-400 dark:text-zinc-500">
                  {app.rank}
                </span>
                <img
                  src={app.icon}
                  alt={app.name}
                  className="h-16 w-16 rounded-xl border border-zinc-100 object-cover shadow-sm dark:border-zinc-800"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-bold text-zinc-900 transition-colors group-hover:text-primary-600 dark:text-zinc-100 dark:group-hover:text-primary-400">
                    {app.name}
                  </h4>
                  <p className="mb-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {app.category}
                  </p>
                  <div className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    <Star className="h-3 w-3 fill-zinc-400 text-zinc-400 dark:fill-zinc-500 dark:text-zinc-500" />
                    {app.rating}
                  </div>
                </div>
                <button className="rounded-full bg-zinc-100 px-4 py-1.5 text-xs font-bold text-primary-600 transition-colors hover:bg-primary-600 hover:text-white dark:bg-zinc-800 dark:text-primary-400 dark:hover:bg-primary-500 dark:hover:text-zinc-900">
                  {t('common.get')}
                </button>
              </div>
            ))}
          </div>
        </section>

        {categories.map((category, index) => (
          <section key={`${category.title}-${index}`} className="relative">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {category.title}
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {category.subtitle}
                </p>
              </div>
              <button className="flex items-center gap-1 text-sm font-bold text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                {t('apps.store.seeAll')}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="-mx-8 flex snap-x gap-6 overflow-x-auto px-8 pb-6 pt-2 scrollbar-hide">
              {category.apps.map((app) => (
                <div
                  key={app.id}
                  onClick={() => navigate(`/apps/${app.id}`)}
                  className="group w-[140px] shrink-0 cursor-pointer snap-start"
                >
                  <div className="relative mb-3">
                    <img
                      src={app.icon}
                      alt={app.name}
                      className="h-[140px] w-[140px] rounded-[1.5rem] border border-zinc-200 object-cover shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl dark:border-zinc-800 dark:group-hover:shadow-primary-900/20"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 rounded-[1.5rem] bg-black/0 transition-colors group-hover:bg-black/5 dark:group-hover:bg-white/5" />
                  </div>
                  <h4 className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {app.name}
                  </h4>
                  <p className="mb-1.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {app.category}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      <Star className="h-3.5 w-3.5 fill-zinc-400 text-zinc-400 dark:fill-zinc-500 dark:text-zinc-500" />
                      {app.rating}
                    </div>
                    <button className="rounded-full bg-zinc-100/80 px-3 py-1 text-[11px] font-bold text-primary-600 transition-colors hover:bg-primary-600 hover:text-white dark:bg-zinc-800/80 dark:text-primary-400 dark:hover:bg-primary-500 dark:hover:text-zinc-900">
                      {t('common.get')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
