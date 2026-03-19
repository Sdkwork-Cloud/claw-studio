import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  BadgeAlert,
  BriefcaseBusiness,
  Building2,
  Calculator,
  ChevronRight,
  Clock3,
  Code2,
  Database,
  FileText,
  GraduationCap,
  Handshake,
  Languages,
  Lightbulb,
  MapPin,
  Megaphone,
  Newspaper,
  Palette,
  Scale,
  Search,
  Send,
  Sparkles,
  Users,
  Wallet,
  Workflow,
  Wrench,
} from 'lucide-react';
import { Input } from '@sdkwork/claw-ui';
import {
  type CommunityCategory,
  type CommunityDeliveryMode,
  type CommunityPost,
  type CommunityServiceLine,
  communityService,
} from '../../services';

const CATEGORY_CONFIG: Array<{
  id: CommunityCategory;
  labelKey: string;
  summaryKey: string;
  icon: typeof Users;
}> = [
  {
    id: 'job-seeking',
    labelKey: 'community.page.categories.jobSeeking',
    summaryKey: 'community.page.categorySummaries.jobSeeking',
    icon: Users,
  },
  {
    id: 'recruitment',
    labelKey: 'community.page.categories.recruitment',
    summaryKey: 'community.page.categorySummaries.recruitment',
    icon: BriefcaseBusiness,
  },
  {
    id: 'services',
    labelKey: 'community.page.categories.services',
    summaryKey: 'community.page.categorySummaries.services',
    icon: Wrench,
  },
  {
    id: 'partnerships',
    labelKey: 'community.page.categories.partnerships',
    summaryKey: 'community.page.categorySummaries.partnerships',
    icon: Handshake,
  },
  {
    id: 'news',
    labelKey: 'community.page.categories.news',
    summaryKey: 'community.page.categorySummaries.news',
    icon: Newspaper,
  },
];

const CATEGORY_BADGE_STYLES: Record<CommunityCategory, string> = {
  'job-seeking': 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  recruitment: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  services: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  partnerships: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
  news: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
};

const SERVICE_CATALOG_CONFIG: Array<{
  id: CommunityServiceLine;
  titleKey: string;
  descriptionKey: string;
  icon: typeof Users;
}> = [
  {
    id: 'legal',
    titleKey: 'community.page.serviceCatalog.items.legal.title',
    descriptionKey: 'community.page.serviceCatalog.items.legal.description',
    icon: Scale,
  },
  {
    id: 'tax',
    titleKey: 'community.page.serviceCatalog.items.tax.title',
    descriptionKey: 'community.page.serviceCatalog.items.tax.description',
    icon: Calculator,
  },
  {
    id: 'design',
    titleKey: 'community.page.serviceCatalog.items.design.title',
    descriptionKey: 'community.page.serviceCatalog.items.design.description',
    icon: Palette,
  },
  {
    id: 'development',
    titleKey: 'community.page.serviceCatalog.items.development.title',
    descriptionKey: 'community.page.serviceCatalog.items.development.description',
    icon: Code2,
  },
  {
    id: 'marketing',
    titleKey: 'community.page.serviceCatalog.items.marketing.title',
    descriptionKey: 'community.page.serviceCatalog.items.marketing.description',
    icon: Megaphone,
  },
  {
    id: 'translation',
    titleKey: 'community.page.serviceCatalog.items.translation.title',
    descriptionKey: 'community.page.serviceCatalog.items.translation.description',
    icon: Languages,
  },
  {
    id: 'operations',
    titleKey: 'community.page.serviceCatalog.items.operations.title',
    descriptionKey: 'community.page.serviceCatalog.items.operations.description',
    icon: Workflow,
  },
  {
    id: 'training',
    titleKey: 'community.page.serviceCatalog.items.training.title',
    descriptionKey: 'community.page.serviceCatalog.items.training.description',
    icon: GraduationCap,
  },
  {
    id: 'consulting',
    titleKey: 'community.page.serviceCatalog.items.consulting.title',
    descriptionKey: 'community.page.serviceCatalog.items.consulting.description',
    icon: Lightbulb,
  },
  {
    id: 'content',
    titleKey: 'community.page.serviceCatalog.items.content.title',
    descriptionKey: 'community.page.serviceCatalog.items.content.description',
    icon: FileText,
  },
  {
    id: 'data',
    titleKey: 'community.page.serviceCatalog.items.data.title',
    descriptionKey: 'community.page.serviceCatalog.items.data.description',
    icon: Database,
  },
  {
    id: 'hr',
    titleKey: 'community.page.serviceCatalog.items.hr.title',
    descriptionKey: 'community.page.serviceCatalog.items.hr.description',
    icon: Users,
  },
];

const SERVICE_LINE_LABEL_KEYS: Record<CommunityServiceLine, string> = {
  legal: 'community.page.serviceCatalog.items.legal.title',
  tax: 'community.page.serviceCatalog.items.tax.title',
  design: 'community.page.serviceCatalog.items.design.title',
  development: 'community.page.serviceCatalog.items.development.title',
  marketing: 'community.page.serviceCatalog.items.marketing.title',
  translation: 'community.page.serviceCatalog.items.translation.title',
  operations: 'community.page.serviceCatalog.items.operations.title',
  training: 'community.page.serviceCatalog.items.training.title',
  consulting: 'community.page.serviceCatalog.items.consulting.title',
  content: 'community.page.serviceCatalog.items.content.title',
  data: 'community.page.serviceCatalog.items.data.title',
  hr: 'community.page.serviceCatalog.items.hr.title',
};

const DELIVERY_MODE_LABEL_KEYS: Record<CommunityDeliveryMode, string> = {
  online: 'community.newPost.deliveryModes.online',
  hybrid: 'community.newPost.deliveryModes.hybrid',
  onsite: 'community.newPost.deliveryModes.onsite',
};

function formatPostDate(createdAt: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(createdAt));
  } catch {
    return createdAt;
  }
}

export function Community() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<CommunityCategory>('recruitment');
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [urgentRecruitment, setUrgentRecruitment] = useState<CommunityPost[]>([]);
  const [newsEntries, setNewsEntries] = useState<CommunityPost[]>([]);
  const [serviceEntries, setServiceEntries] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchPosts = async () => {
      setLoading(true);

      try {
        const [nextPosts, nextRecruitment, nextNews, nextServices] = await Promise.all([
          communityService.getPosts(activeCategory, searchQuery),
          communityService.getPosts('recruitment'),
          communityService.getPosts('news'),
          communityService.getPosts('services'),
        ]);

        if (!active) {
          return;
        }

        setPosts(nextPosts);
        setUrgentRecruitment(nextRecruitment.slice(0, 3));
        setNewsEntries(nextNews.slice(0, 3));
        setServiceEntries(nextServices);
      } catch (error) {
        console.error('Failed to fetch community entries:', error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const timer = window.setTimeout(() => {
      void fetchPosts();
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [activeCategory, searchQuery]);

  const assistantCards = useMemo(
    () => [
      {
        id: 'job-seeker',
        title: t('community.page.assistantWorkbench.cards.jobSeeker.title'),
        description: t('community.page.assistantWorkbench.cards.jobSeeker.description'),
      },
      {
        id: 'recruiter',
        title: t('community.page.assistantWorkbench.cards.recruiter.title'),
        description: t('community.page.assistantWorkbench.cards.recruiter.description'),
      },
      {
        id: 'lead-followup',
        title: t('community.page.assistantWorkbench.cards.leadFollowup.title'),
        description: t('community.page.assistantWorkbench.cards.leadFollowup.description'),
      },
    ],
    [t],
  );

  const revenueCards = useMemo(
    () => [
      {
        id: 'featured',
        title: t('community.page.revenueServices.items.featured.title'),
        description: t('community.page.revenueServices.items.featured.description'),
      },
      {
        id: 'accelerator',
        title: t('community.page.revenueServices.items.accelerator.title'),
        description: t('community.page.revenueServices.items.accelerator.description'),
      },
      {
        id: 'assistant',
        title: t('community.page.revenueServices.items.assistant.title'),
        description: t('community.page.revenueServices.items.assistant.description'),
      },
    ],
    [t],
  );

  const activeCategorySummary = CATEGORY_CONFIG.find((item) => item.id === activeCategory);
  const isNewsMode = activeCategory === 'news';
  const isServiceMode = activeCategory === 'services';
  const onlineServiceEntries = useMemo(
    () => serviceEntries.filter((post) => post.deliveryMode === 'online' || post.deliveryMode === 'hybrid'),
    [serviceEntries],
  );
  const serviceCatalog = useMemo(
    () =>
      SERVICE_CATALOG_CONFIG.map((item) => ({
        ...item,
        count: serviceEntries.filter((post) => post.serviceLine === item.id).length,
      })),
    [serviceEntries],
  );

  return (
    <div className="h-full overflow-y-auto bg-[#f6f1e8] text-zinc-950 scrollbar-hide dark:bg-[#130f0c] dark:text-zinc-50">
      <div className="border-b border-black/5 bg-[radial-gradient(circle_at_top_left,_rgba(196,104,42,0.24),_transparent_38%),linear-gradient(135deg,_rgba(255,250,244,0.98),_rgba(245,233,216,0.9))] px-6 py-8 dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(196,104,42,0.28),_transparent_35%),linear-gradient(135deg,_rgba(28,20,16,0.98),_rgba(16,12,10,0.94))] md:px-8 md:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_22rem]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-700 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                <Sparkles className="h-3.5 w-3.5" />
                {t('community.page.hero.eyebrow')}
              </div>

              <div className="max-w-4xl space-y-4">
                <h1 className="max-w-3xl text-4xl font-black tracking-[-0.06em] md:text-6xl">
                  {t('community.page.title')}
                </h1>
                <p className="max-w-3xl text-base leading-7 text-zinc-600 dark:text-zinc-300 md:text-lg">
                  {t('community.page.subtitle')}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => navigate('/community/new')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#18120d] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2a1d14] dark:bg-[#f4eadb] dark:text-zinc-900 dark:hover:bg-white"
                >
                  <Send className="h-4 w-4" />
                  {t('community.page.hero.primaryCta')}
                </button>
                <button
                  onClick={() => setActiveCategory('news')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/75 px-5 py-3 text-sm font-semibold text-zinc-800 transition-colors hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
                >
                  <Newspaper className="h-4 w-4" />
                  {t('community.page.hero.secondaryCta')}
                </button>
              </div>

              <div className="group relative max-w-3xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-[#c4682a]" />
                <Input
                  type="text"
                  placeholder={t('community.page.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-12 rounded-2xl border-black/10 bg-white/80 pl-11 text-sm font-medium shadow-none focus-visible:ring-2 focus-visible:ring-[#c4682a]/25 focus-visible:ring-offset-0 dark:border-white/10 dark:bg-white/5 dark:focus-visible:ring-offset-0"
                />
              </div>
            </div>

            <div className="rounded-[2rem] border border-black/10 bg-white/75 p-6 shadow-[0_24px_80px_rgba(132,72,29,0.12)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-none">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c4682a]">
                  {t('community.page.assistantWorkbench.title')}
                </p>
                <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {t('community.page.assistantWorkbench.description')}
                </p>
              </div>
              <div className="mt-5 space-y-3">
                {assistantCards.map((card) => (
                  <div
                    key={card.id}
                    className="rounded-2xl border border-black/5 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-black/20"
                  >
                    <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {card.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                      {card.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-8 px-6 py-8 md:px-8">
        <div className="grid gap-3 lg:grid-cols-5">
          {CATEGORY_CONFIG.map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;

            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`rounded-[1.75rem] border p-5 text-left transition-all ${
                  isActive
                    ? 'border-[#c4682a]/40 bg-[#22160e] text-white shadow-[0_24px_60px_rgba(83,43,12,0.24)] dark:border-[#c4682a]/40 dark:bg-[#2a1a11]'
                    : 'border-black/10 bg-white/80 hover:border-[#c4682a]/25 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    isActive ? 'text-[#ffd5b0]' : 'text-[#c4682a]'
                  }`}
                />
                <div className="mt-4">
                  <p className="text-sm font-semibold">{t(category.labelKey)}</p>
                  <p
                    className={`mt-1 text-sm leading-6 ${
                      isActive ? 'text-white/72' : 'text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {t(category.summaryKey)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c4682a]">
                    {t('community.page.feedEyebrow')}
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                    {activeCategorySummary ? t(activeCategorySummary.labelKey) : t('community.page.title')}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    {activeCategorySummary ? t(activeCategorySummary.summaryKey) : t('community.page.subtitle')}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/community/new')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-black px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:border-white/10 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  {t('community.page.hero.primaryCta')}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {isServiceMode ? (
              <section className="rounded-[2rem] border border-black/10 bg-[linear-gradient(135deg,_rgba(29,78,216,0.08),_rgba(196,104,42,0.08))] p-6 dark:border-white/10 dark:bg-[linear-gradient(135deg,_rgba(29,78,216,0.14),_rgba(196,104,42,0.12))]">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c4682a]">
                      {t('community.page.serviceCatalog.title')}
                    </p>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                      {t('community.page.serviceCatalog.description')}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-medium text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                    {onlineServiceEntries.length} {t('community.page.rails.onlineServices')}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {serviceCatalog.map((item) => {
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        onClick={() => setSearchQuery(item.id)}
                        className="rounded-[1.5rem] border border-black/10 bg-white/80 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#c4682a]/30 hover:bg-white dark:border-white/10 dark:bg-black/10 dark:hover:bg-black/20"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1f130d] text-[#ffd5b0] dark:bg-[#f4eadb] dark:text-zinc-900">
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-semibold text-zinc-600 dark:bg-white/10 dark:text-zinc-200">
                            {item.count}
                          </span>
                        </div>
                        <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                          {t(item.titleKey)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                          {t(item.descriptionKey)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {loading ? (
              <div className="rounded-[2rem] border border-black/10 bg-white/80 px-6 py-20 text-center dark:border-white/10 dark:bg-white/5">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#c4682a] border-t-transparent" />
                <p className="mt-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {t('community.page.loadingPosts')}
                </p>
              </div>
            ) : posts.length > 0 ? (
              posts.map((post, index) => (
                <motion.article
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => navigate(`/community/${post.id}`)}
                  className="cursor-pointer rounded-[2rem] border border-black/10 bg-white/85 p-6 transition-all hover:-translate-y-0.5 hover:border-[#c4682a]/30 hover:shadow-[0_28px_70px_rgba(132,72,29,0.14)] dark:border-white/10 dark:bg-white/5 dark:hover:border-[#c4682a]/30"
                >
                  <div className="flex flex-col gap-5 md:flex-row">
                    {post.coverImage ? (
                      <div className="h-48 overflow-hidden rounded-[1.5rem] md:w-[16rem] md:shrink-0">
                        <img
                          src={post.coverImage}
                          alt={post.title}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : null}

                    <div className="min-w-0 flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${CATEGORY_BADGE_STYLES[post.category]}`}
                        >
                          {t(
                            CATEGORY_CONFIG.find((item) => item.id === post.category)?.labelKey ??
                              'community.page.categories.news',
                          )}
                        </span>
                        {post.isFeatured ? (
                          <span className="rounded-full bg-[#1f130d] px-3 py-1 text-xs font-semibold text-[#ffd5b0] dark:bg-[#f4eadb] dark:text-zinc-900">
                            {t('community.page.featuredBadge')}
                          </span>
                        ) : null}
                        {post.publisherType === 'official' ? (
                          <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                            {t('community.page.officialBadge')}
                          </span>
                        ) : null}
                      </div>

                      <div>
                        <h3 className="text-2xl font-black tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">
                          {post.title}
                        </h3>
                        <p className="mt-3 line-clamp-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                          {post.content.replace(/<[^>]*>?/gm, '')}
                        </p>
                      </div>

                      <div className="grid gap-3 text-sm text-zinc-600 dark:text-zinc-300 md:grid-cols-2">
                        {post.location ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-[#c4682a]" />
                            <span>
                              {t('community.page.meta.location')}: {post.location}
                            </span>
                          </div>
                        ) : null}
                        {post.compensation ? (
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-[#c4682a]" />
                            <span>
                              {t('community.page.meta.compensation')}: {post.compensation}
                            </span>
                          </div>
                        ) : null}
                        {post.company ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-[#c4682a]" />
                            <span>
                              {t('community.page.meta.company')}: {post.company}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <BadgeAlert className="h-4 w-4 text-[#c4682a]" />
                          <span>
                            {t('community.page.meta.publisher')}: {post.author.name}
                          </span>
                        </div>
                        {post.serviceLine ? (
                          <div className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-[#c4682a]" />
                            <span>
                              {t('community.page.meta.serviceLine')}: {t(SERVICE_LINE_LABEL_KEYS[post.serviceLine])}
                            </span>
                          </div>
                        ) : null}
                        {post.deliveryMode ? (
                          <div className="flex items-center gap-2">
                            <Send className="h-4 w-4 text-[#c4682a]" />
                            <span>
                              {t('community.page.meta.deliveryMode')}:{' '}
                              {t(DELIVERY_MODE_LABEL_KEYS[post.deliveryMode])}
                            </span>
                          </div>
                        ) : null}
                        {post.turnaround ? (
                          <div className="flex items-center gap-2">
                            <Clock3 className="h-4 w-4 text-[#c4682a]" />
                            <span>
                              {t('community.page.meta.turnaround')}: {post.turnaround}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-4 text-sm dark:border-white/10">
                        <div className="flex flex-wrap items-center gap-2 text-zinc-500 dark:text-zinc-400">
                          {post.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-black/[0.04] px-3 py-1 dark:bg-white/10"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-zinc-500 dark:text-zinc-400">
                            {formatPostDate(post.createdAt, i18n.language)}
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold text-[#c4682a]">
                            {isNewsMode
                              ? t('community.page.listing.readMore')
                              : t('community.page.listing.openclawAction')}
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.article>
              ))
            ) : (
              <div className="rounded-[2rem] border border-dashed border-black/15 bg-white/70 px-6 py-20 text-center dark:border-white/10 dark:bg-white/5">
                <h3 className="text-xl font-black tracking-[-0.03em]">
                  {t('community.page.emptyTitle')}
                </h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {t('community.page.emptyDescription')}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-black/10 bg-[#1b120c] p-6 text-white dark:border-white/10 dark:bg-[#1d140e]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ffcfaa]">
                {t('community.page.revenueServices.title')}
              </p>
              <div className="mt-4 space-y-3">
                {revenueCards.map((card) => (
                  <div
                    key={card.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <p className="text-sm font-semibold">{card.title}</p>
                    <p className="mt-1 text-sm leading-6 text-white/72">{card.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c4682a]">
                  {t('community.page.rails.urgentRecruitment')}
                </h3>
                <button
                  onClick={() => setActiveCategory('recruitment')}
                  className="text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {t('community.page.listing.viewAll')}
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {urgentRecruitment.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => navigate(`/community/${post.id}`)}
                    className="block w-full rounded-2xl border border-black/5 bg-black/[0.02] p-4 text-left transition-colors hover:bg-black/[0.04] dark:border-white/10 dark:bg-black/20 dark:hover:bg-black/30"
                  >
                    <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {post.title}
                    </p>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                      {[post.location, post.compensation].filter(Boolean).join(' / ')}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c4682a]">
                  {t('community.page.rails.onlineServices')}
                </h3>
                <button
                  onClick={() => setActiveCategory('services')}
                  className="text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {t('community.page.listing.viewAll')}
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {onlineServiceEntries.slice(0, 4).map((post) => (
                  <button
                    key={post.id}
                    onClick={() => navigate(`/community/${post.id}`)}
                    className="block w-full rounded-2xl border border-black/5 bg-black/[0.02] p-4 text-left transition-colors hover:bg-black/[0.04] dark:border-white/10 dark:bg-black/20 dark:hover:bg-black/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {post.title}
                      </p>
                      {post.serviceLine ? (
                        <span className="rounded-full bg-[#1f130d] px-2.5 py-1 text-[11px] font-semibold text-[#ffd5b0] dark:bg-[#f4eadb] dark:text-zinc-900">
                          {t(SERVICE_LINE_LABEL_KEYS[post.serviceLine])}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                      {[post.deliveryMode ? t(DELIVERY_MODE_LABEL_KEYS[post.deliveryMode]) : null, post.turnaround]
                        .filter(Boolean)
                        .join(' / ')}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c4682a]">
                  {t('community.page.rails.platformNews')}
                </h3>
                <button
                  onClick={() => setActiveCategory('news')}
                  className="text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {t('community.page.listing.viewAll')}
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {newsEntries.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => navigate(`/community/${post.id}`)}
                    className="block w-full rounded-2xl border border-black/5 bg-black/[0.02] p-4 text-left transition-colors hover:bg-black/[0.04] dark:border-white/10 dark:bg-black/20 dark:hover:bg-black/30"
                  >
                    <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {post.title}
                    </p>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                      {formatPostDate(post.createdAt, i18n.language)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
