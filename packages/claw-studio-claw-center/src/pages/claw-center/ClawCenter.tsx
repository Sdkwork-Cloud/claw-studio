import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  Menu,
  MessageCircle,
  Network,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  clawService,
  type ClawCategory,
  type ClawInstance,
} from '../../services';

export function ClawCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [claws, setClaws] = useState<ClawInstance[]>([]);
  const [categories, setCategories] = useState<ClawCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [clawsData, categoriesData] = await Promise.all([
          clawService.getClaws(),
          clawService.getCategories(),
        ]);
        setClaws(clawsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Failed to fetch claw center data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, []);

  const filteredClaws = claws.filter((claw) => {
    const lowerSearchQuery = searchQuery.toLowerCase();
    const matchesSearch =
      claw.name.toLowerCase().includes(lowerSearchQuery) ||
      claw.description.toLowerCase().includes(lowerSearchQuery) ||
      claw.tags.some((tag) => tag.toLowerCase().includes(lowerSearchQuery));
    const matchesCategory = activeCategory === 'All' || claw.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="mx-auto flex h-64 max-w-7xl items-center justify-center p-8 md:p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 pb-12 scrollbar-hide dark:bg-zinc-950">
      <div className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
              <Network className="h-6 w-6" />
            </div>
            <span className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
              {t('clawCenter.title')}
              <span className="text-primary-600 dark:text-primary-400">
                {t('clawCenter.titleHighlight')}
              </span>
            </span>
          </div>

          <div className="flex flex-1 items-center">
            <div className="flex w-full overflow-hidden rounded-full border-2 border-primary-600 bg-white shadow-sm transition-all focus-within:ring-4 focus-within:ring-primary-500/20 dark:bg-zinc-950">
              <div className="flex items-center justify-center border-r border-zinc-200 bg-zinc-50 px-4 py-3 pr-2 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="flex items-center gap-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  {t('clawCenter.services', 'Services')} <ChevronDown className="h-4 w-4" />
                </span>
              </div>
              <input
                type="text"
                placeholder={t('clawCenter.searchPlaceholder')}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none dark:text-zinc-100"
              />
              <button className="flex items-center gap-2 bg-primary-600 px-8 py-3 font-bold text-white transition-colors hover:bg-primary-700">
                <Search className="h-4 w-4" /> {t('clawCenter.search', 'Search')}
              </button>
            </div>
          </div>

          <div className="hidden shrink-0 items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400 lg:flex">
            <button className="flex flex-col items-center gap-1 transition-colors hover:text-primary-600 dark:hover:text-primary-400">
              <MessageCircle className="h-5 w-5" />
              {t('clawCenter.messages', 'Messages')}
            </button>
            <button className="flex flex-col items-center gap-1 transition-colors hover:text-primary-600 dark:hover:text-primary-400">
              <Briefcase className="h-5 w-5" />
              {t('clawCenter.myOrders', 'My Orders')}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-6">
        <div className="mb-12 flex flex-col gap-6 lg:flex-row">
          <div className="flex h-fit w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:w-64">
            <div className="flex items-center gap-2 bg-primary-600 p-4 font-bold text-white">
              <Menu className="h-5 w-5" /> {t('clawCenter.allCategories')}
            </div>
            <div className="py-2">
              <div
                onClick={() => setActiveCategory('All')}
                className={`group flex cursor-pointer items-center justify-between border-l-4 px-4 py-3 transition-colors ${
                  activeCategory === 'All'
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-500/10'
                    : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div
                  className={`flex items-center gap-3 text-sm font-bold ${
                    activeCategory === 'All'
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-zinc-700 group-hover:text-primary-600 dark:text-zinc-300 dark:group-hover:text-primary-400'
                  }`}
                >
                  <Network className="h-4 w-4" /> {t('clawCenter.allCategories')}
                </div>
              </div>
              {categories.map((category) => (
                <div
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`group flex cursor-pointer items-center justify-between border-l-4 px-4 py-3 transition-colors ${
                    activeCategory === category.id
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-500/10'
                      : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div
                    className={`flex items-center gap-3 text-sm font-bold ${
                      activeCategory === category.id
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-zinc-700 group-hover:text-primary-600 dark:text-zinc-300 dark:group-hover:text-primary-400'
                    }`}
                  >
                    <category.icon className="h-4 w-4" />{' '}
                    {t(`categories.${category.id}`, category.name)}
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 transition-opacity ${
                      activeCategory === category.id
                        ? 'text-primary-600 opacity-100'
                        : 'text-zinc-400 opacity-0 group-hover:opacity-100'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="group relative flex min-h-[420px] flex-1 cursor-pointer flex-col justify-center overflow-hidden rounded-2xl bg-zinc-900 shadow-lg">
            <div className="absolute inset-0 z-10 bg-gradient-to-r from-primary-900/90 to-rose-900/40" />
            <img
              src="https://picsum.photos/seed/ai-banner/1200/600"
              alt="Banner"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />

            <div className="relative z-20 max-w-2xl p-10 md:p-16">
              <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-md">
                <Zap className="h-3.5 w-3.5 text-amber-300" />{' '}
                {t('clawCenter.supercharge', 'Supercharge Your Business')}
              </span>
              <h2 className="mb-4 text-4xl font-black leading-tight text-white md:text-5xl">
                {t('clawCenter.futureOfB2B', 'The Future of B2B')} <br />
                <span className="bg-gradient-to-r from-primary-300 to-rose-300 bg-clip-text text-transparent">
                  {t('clawCenter.aiAgentSourcing', 'AI Agent Sourcing')}
                </span>
              </h2>
              <p className="mb-8 max-w-lg text-lg text-primary-100">
                {t('clawCenter.subtitle')}
              </p>
              <button className="flex items-center gap-2 rounded-full bg-white px-8 py-3.5 font-bold text-primary-900 shadow-xl transition-colors hover:bg-primary-50">
                {t('clawCenter.exploreProviders', 'Explore Top Providers')}{' '}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {activeCategory === 'All'
              ? t('clawCenter.trendingProviders', 'Trending Providers')
              : `${t(
                  `categories.${activeCategory}`,
                  categories.find((category) => category.id === activeCategory)?.name,
                )} ${t('clawCenter.providers', 'Providers')}`}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredClaws.map((claw) => (
            <div
              key={claw.id}
              onClick={() => navigate(`/claw-center/${claw.id}`)}
              className="group flex cursor-pointer flex-col rounded-2xl border border-zinc-200 bg-white p-5 transition-all hover:border-primary-500/30 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-primary-500/50"
            >
              <div className="mb-4 flex items-start justify-between">
                <img
                  src={claw.logo}
                  alt={claw.name}
                  className="h-14 w-14 rounded-xl border border-zinc-100 object-cover shadow-sm dark:border-zinc-800"
                  referrerPolicy="no-referrer"
                />
                {claw.verified && (
                  <span className="flex items-center gap-1 rounded-full border border-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <ShieldCheck className="h-3 w-3" />
                    {t('clawCenter.verifiedOnly', 'Verified')}
                  </span>
                )}
              </div>

              <h3 className="mb-1 truncate text-lg font-bold text-zinc-900 transition-colors group-hover:text-primary-600 dark:text-zinc-100 dark:group-hover:text-primary-400">
                {claw.name}
              </h3>
              <p className="mb-3 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <Briefcase className="h-3.5 w-3.5" /> {t(`categories.${claw.category}`, claw.category)}
              </p>

              <p className="mb-4 line-clamp-2 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
                {claw.description}
              </p>

              <div className="mb-4 flex flex-wrap gap-1.5">
                {claw.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-zinc-200 bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    {tag}
                  </span>
                ))}
                {claw.tags.length > 2 && (
                  <span className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-500">
                    +{claw.tags.length - 2}
                  </span>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {claw.rating}
                  </div>
                  <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    {claw.completedOrders.toLocaleString()}+ {t('clawCenter.orders')}
                  </div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-600 group-hover:text-white dark:bg-primary-500/10 dark:text-primary-400">
                  <MessageCircle className="h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredClaws.length === 0 && (
          <div className="mt-4 flex flex-col items-center justify-center rounded-3xl border border-zinc-200 bg-white py-24 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <Building2 className="mb-4 h-16 w-16 text-zinc-300 dark:text-zinc-700" />
            <h3 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {t('clawCenter.noProvidersFound', 'No providers found')}
            </h3>
            <p className="max-w-md text-zinc-500 dark:text-zinc-400">
              {t('clawCenter.noResults')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
