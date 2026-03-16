import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronRight,
  Clock,
  Eye,
  Heart,
  MessageSquare,
  Plus,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import { communityService, type CommunityPost } from '../../services';

const CATEGORIES = [
  { id: 'posts', name: 'Posts', icon: MessageSquare },
  { id: 'news', name: 'News', icon: BookOpen },
];

export function Community() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('posts');
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      try {
        const data = await communityService.getPosts(activeCategory, searchQuery);
        setPosts(data);
      } catch (error) {
        console.error('Failed to fetch posts:', error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      void fetchPosts();
    }, 300);

    return () => clearTimeout(timer);
  }, [activeCategory, searchQuery]);

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 scrollbar-hide dark:bg-zinc-950">
      <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 text-white shadow-lg">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Community
              </h1>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Learn, share, and connect
              </p>
            </div>
          </div>

          <div className="flex w-full items-center gap-4 md:w-auto">
            <div className="group relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-primary-500 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Search articles, discussions..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-100/80 py-2 pl-10 pr-4 text-sm font-medium text-zinc-900 outline-none transition-all placeholder:text-zinc-500 focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:bg-zinc-900"
              />
            </div>
            <button
              onClick={() => navigate('/community/new')}
              className="hidden shrink-0 items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary-500/20 transition-colors hover:bg-primary-700 md:flex"
            >
              <Plus className="h-4 w-4" />
              New Post
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-8 p-6 md:p-8 lg:flex-row">
        <div className="flex-1 space-y-8">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;

              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-zinc-900 text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${isActive ? '' : 'text-zinc-400 dark:text-zinc-500'}`}
                  />
                  {category.name}
                </button>
              );
            })}
          </div>

          <div className="space-y-6">
            {loading ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
                <p className="font-medium text-zinc-500 dark:text-zinc-400">Loading posts...</p>
              </div>
            ) : posts.length > 0 ? (
              posts.map((post, index) => (
                <motion.article
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/community/${post.id}`)}
                  className="group flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white transition-all hover:border-primary-500/30 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-primary-500/50 sm:flex-row"
                >
                  {post.coverImage ? (
                    <div className="relative h-48 shrink-0 overflow-hidden sm:h-auto sm:w-1/3">
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-black/20" />
                    </div>
                  ) : null}

                  <div className="flex flex-1 flex-col p-6 md:p-8">
                    <div className="mb-4 flex items-center gap-3">
                      <img
                        src={post.author.avatar}
                        alt={post.author.name}
                        className="h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-700"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {post.author.name}
                          </span>
                          {post.author.role === 'Official' ? (
                            <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                              Official
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {post.createdAt}
                        </span>
                      </div>
                    </div>

                    <h2 className="mb-3 text-xl font-bold leading-tight text-zinc-900 transition-colors group-hover:text-primary-600 dark:text-zinc-100 dark:group-hover:text-primary-400 md:text-2xl">
                      {post.title}
                    </h2>
                    <p className="mb-6 line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {post.content.replace(/<[^>]*>?/gm, '').substring(0, 150)}...
                    </p>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                      <div className="flex flex-wrap items-center gap-2">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1.5 transition-colors hover:text-primary-500">
                          <Heart className="h-4 w-4" /> {post.stats.likes}
                        </span>
                        <span className="flex items-center gap-1.5 transition-colors hover:text-primary-500">
                          <MessageSquare className="h-4 w-4" /> {post.stats.comments}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Eye className="h-4 w-4" /> {post.stats.views}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.article>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-zinc-200 bg-white py-24 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <BookOpen className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
                <h3 className="mb-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  No posts found
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Try adjusting your search or category filter.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="w-full shrink-0 space-y-6 lg:w-80">
          <button
            onClick={() => navigate('/community/new')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary-500/20 transition-colors hover:bg-primary-700 md:hidden"
          >
            <Plus className="h-4 w-4" />
            New Post
          </button>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              <Clock className="h-4 w-4 text-primary-500" /> Latest Claw
            </h3>
            <div className="space-y-4">
              {[
                { id: 'claw-1', name: 'Auto-GPT Agent', author: 'AI Labs', time: '2h ago' },
                { id: 'claw-2', name: 'Vision Analyzer', author: 'Tech Corp', time: '5h ago' },
                { id: 'claw-3', name: 'Data Scraper Pro', author: 'DevTeam', time: '1d ago' },
              ].map((claw, index) => (
                <div
                  key={`${claw.id}-${index}`}
                  onClick={() => navigate(`/market/${claw.id}`)}
                  className="group -mx-2 flex cursor-pointer items-center justify-between rounded-xl p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-bold text-zinc-900 transition-colors group-hover:text-primary-500 dark:text-zinc-100">
                      {claw.name}
                    </h4>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {claw.author}
                    </p>
                  </div>
                  <div className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    {claw.time}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Online Claw
            </h3>
            <div className="space-y-4">
              {[
                { id: 'claw-4', name: 'Trading Bot V2', users: 1240 },
                { id: 'claw-5', name: 'SEO Optimizer', users: 856 },
                { id: 'claw-6', name: 'Image Generator', users: 632 },
              ].map((claw, index) => (
                <div
                  key={`${claw.id}-${index}`}
                  onClick={() => navigate(`/market/${claw.id}`)}
                  className="group -mx-2 flex cursor-pointer items-center justify-between rounded-xl p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-bold text-zinc-900 transition-colors group-hover:text-primary-500 dark:text-zinc-100">
                      {claw.name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <Users className="h-3 w-3" /> {claw.users}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              <TrendingUp className="h-4 w-4 text-rose-500" /> Hottest Claw
            </h3>
            <div className="space-y-4">
              {[
                { id: 'claw-7', name: 'Code Assistant', downloads: '125k' },
                { id: 'claw-8', name: 'UI Builder', downloads: '98k' },
                { id: 'claw-9', name: 'DB Manager', downloads: '85k' },
              ].map((claw, index) => (
                <div
                  key={`${claw.id}-${index}`}
                  onClick={() => navigate(`/market/${claw.id}`)}
                  className="group -mx-2 flex cursor-pointer items-center justify-between rounded-xl p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className={`text-sm font-bold ${
                        index === 0
                          ? 'text-rose-500'
                          : index === 1
                            ? 'text-amber-500'
                            : index === 2
                              ? 'text-emerald-500'
                              : 'text-zinc-400'
                      }`}
                    >
                      #{index + 1}
                    </span>
                    <h4 className="truncate text-sm font-bold text-zinc-900 transition-colors group-hover:text-primary-500 dark:text-zinc-100">
                      {claw.name}
                    </h4>
                  </div>
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {claw.downloads}
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold text-primary-600 transition-colors hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-500/10">
              View Rankings <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
