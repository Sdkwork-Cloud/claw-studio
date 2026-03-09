import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageSquare, Heart, Eye, Plus, TrendingUp, Clock, BookOpen, Users, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { communityService, CommunityPost } from '../../services/communityService';

const CATEGORIES = [
  { id: 'latest', name: 'Latest', icon: Clock },
  { id: 'popular', name: 'Popular', icon: TrendingUp },
  { id: 'tutorials', name: 'Tutorials', icon: BookOpen },
  { id: 'discussions', name: 'Discussions', icon: Users },
];

export function Community() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('latest');
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
    
    // Debounce search
    const timer = setTimeout(() => {
      fetchPosts();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [activeCategory, searchQuery]);

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Community</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Learn, share, and connect</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-80 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 group-focus-within:text-primary-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search articles, discussions..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 focus:bg-white dark:focus:bg-zinc-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-xl text-sm font-medium transition-all outline-none placeholder:text-zinc-500 dark:placeholder:text-zinc-400 shadow-sm text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <button 
              onClick={() => navigate('/community/new')}
              className="hidden md:flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-primary-500/20 shrink-0"
            >
              <Plus className="w-4 h-4" />
              New Post
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        
        {/* Main Content */}
        <div className="flex-1 space-y-8">
          
          {/* Categories */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                    isActive 
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-md' 
                      : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? '' : 'text-zinc-400 dark:text-zinc-500'}`} />
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Posts Feed */}
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium">Loading posts...</p>
              </div>
            ) : posts.length > 0 ? (
              posts.map((post, idx) => (
                <motion.article 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={post.id} 
                  onClick={() => navigate(`/community/${post.id}`)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden hover:shadow-xl hover:border-primary-500/30 dark:hover:border-primary-500/50 transition-all cursor-pointer group flex flex-col sm:flex-row"
                >
                  {post.coverImage && (
                    <div className="sm:w-1/3 h-48 sm:h-auto relative overflow-hidden shrink-0">
                      <img 
                        src={post.coverImage} 
                        alt={post.title} 
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 sm:bg-gradient-to-r sm:from-transparent sm:to-black/20 to-transparent" />
                    </div>
                  )}
                  
                  <div className="p-6 md:p-8 flex flex-col flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <img src={post.author.avatar} alt={post.author.name} className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700" referrerPolicy="no-referrer" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{post.author.name}</span>
                          {post.author.role === 'Official' && (
                            <span className="px-1.5 py-0.5 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 text-[10px] font-bold uppercase rounded">Official</span>
                          )}
                        </div>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{post.createdAt}</span>
                      </div>
                    </div>
                    
                    <h2 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-3 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-tight">
                      {post.title}
                    </h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 line-clamp-2 leading-relaxed">
                      {post.content.replace(/<[^>]*>?/gm, '').substring(0, 150)}...
                    </p>
                    
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex flex-wrap items-center gap-2">
                        {post.tags.map(tag => (
                          <span key={tag} className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-medium rounded-md">
                            #{tag}
                          </span>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1.5 hover:text-primary-500 transition-colors"><Heart className="w-4 h-4" /> {post.stats.likes}</span>
                        <span className="flex items-center gap-1.5 hover:text-primary-500 transition-colors"><MessageSquare className="w-4 h-4" /> {post.stats.comments}</span>
                        <span className="flex items-center gap-1.5"><Eye className="w-4 h-4" /> {post.stats.views}</span>
                      </div>
                    </div>
                  </div>
                </motion.article>
              ))
            ) : (
              <div className="py-24 flex flex-col items-center justify-center text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl">
                <BookOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">No posts found</h3>
                <p className="text-zinc-500 dark:text-zinc-400">Try adjusting your search or category filter.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 shrink-0 space-y-6">
          {/* Mobile New Post Button */}
          <button 
            onClick={() => navigate('/community/new')}
            className="md:hidden w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-primary-500/20"
          >
            <Plus className="w-4 h-4" />
            New Post
          </button>

          {/* Trending Tags */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-500" /> Trending Topics
            </h3>
            <div className="flex flex-wrap gap-2">
              {['LLM', 'Tutorial', 'Automation', 'Vision', 'Setup', 'Hardware'].map(tag => (
                <button key={tag} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-lg transition-colors">
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Top Contributors */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-4">Top Contributors</h3>
            <div className="space-y-4">
              {[
                { name: 'Alex Chen', role: 'Core Contributor', avatar: 'https://picsum.photos/seed/alex/100/100', score: 1250 },
                { name: 'Sarah Jenkins', role: 'AI Researcher', avatar: 'https://picsum.photos/seed/sarah/100/100', score: 980 },
                { name: 'Elena Rodriguez', role: 'Developer', avatar: 'https://picsum.photos/seed/elena/100/100', score: 850 },
              ].map((user, idx) => (
                <div key={idx} className="flex items-center gap-3 group cursor-pointer">
                  <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700 group-hover:border-primary-500 transition-colors" referrerPolicy="no-referrer" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-primary-500 transition-colors">{user.name}</h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{user.role}</p>
                  </div>
                  <div className="text-xs font-bold text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                    {user.score}
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 py-2 text-xs font-bold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors flex items-center justify-center gap-1">
              View Leaderboard <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
