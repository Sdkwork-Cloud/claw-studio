import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, ChevronRight, Download, ShieldCheck, Zap, Cpu, Sparkles, Layers } from 'lucide-react';
import { appStoreService, AppItem, AppCategory } from '../../services/appStoreService';
import { motion } from 'motion/react';

export function AppStore() {
  const navigate = useNavigate();
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
          appStoreService.getCategories()
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

    fetchStoreData();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full bg-zinc-50 dark:bg-zinc-950 overflow-y-auto scrollbar-hide"
    >
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
            <Sparkles className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">AI App Store</h1>
        </div>
        <div className="relative w-full max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-primary-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search AI agents, models, tools..." 
            className="w-full pl-12 pr-4 py-2.5 bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 focus:bg-white dark:focus:bg-zinc-900 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-2xl text-sm font-medium transition-all outline-none placeholder:text-zinc-500 dark:placeholder:text-zinc-400 shadow-sm text-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto space-y-16">
        
        {/* Featured Banner */}
        {featuredApp && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Featured AI
                </h2>
                <h3 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Discover the Best</h3>
              </div>
            </div>
            <div 
              onClick={() => navigate(`/apps/${featuredApp.id}`)}
              className="relative rounded-[2.5rem] overflow-hidden cursor-pointer group shadow-xl hover:shadow-2xl dark:shadow-primary-900/10 dark:hover:shadow-primary-900/20 transition-all duration-500 border border-zinc-200/50 dark:border-zinc-800/50"
            >
              <div className="aspect-[21/9] w-full relative">
                <img src={featuredApp.banner} alt="Banner" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                
                <div className="absolute bottom-0 left-0 p-8 md:p-12 flex flex-col md:flex-row md:items-end gap-6 md:gap-8 w-full">
                  <img src={featuredApp.icon} alt="Icon" className="w-24 h-24 md:w-32 md:h-32 rounded-[1.5rem] shadow-2xl border-2 border-white/20 shrink-0" referrerPolicy="no-referrer" />
                  <div className="flex-1 text-white">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider border border-white/10">Editor's Choice</span>
                      <span className="flex items-center gap-1 text-sm font-medium text-zinc-300">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" /> Official
                      </span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">{featuredApp.name}</h2>
                    <p className="text-zinc-300 max-w-2xl line-clamp-2 text-lg md:text-xl leading-relaxed">{featuredApp.description}</p>
                  </div>
                  <button className="hidden md:flex items-center justify-center gap-2 bg-white text-zinc-900 px-8 py-3.5 rounded-full font-bold hover:bg-zinc-100 transition-colors shadow-xl hover:scale-105 active:scale-95">
                    <Download className="w-5 h-5" />
                    Get
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* Top Charts (List Style) */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Top Charts</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">The most popular apps right now</p>
            </div>
            <button className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-bold text-sm flex items-center gap-1 bg-primary-50 dark:bg-primary-500/10 px-4 py-2 rounded-full transition-colors">
              See All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
            {topCharts.map((app, idx) => (
              <motion.div 
                key={app.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + idx * 0.05 }}
                onClick={() => navigate(`/apps/${app.id}`)}
                className="flex items-center gap-4 p-4 rounded-[1.5rem] hover:bg-white dark:hover:bg-zinc-900 hover:shadow-lg dark:hover:shadow-primary-900/10 border border-transparent hover:border-zinc-200/80 dark:hover:border-zinc-800/80 transition-all duration-300 cursor-pointer group"
              >
                <span className="text-lg font-bold text-zinc-400 dark:text-zinc-500 w-6 text-center">{app.rank}</span>
                <img src={app.icon} alt={app.name} className="w-16 h-16 rounded-[1.25rem] shadow-sm border border-zinc-100 dark:border-zinc-800 object-cover group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors tracking-tight">{app.name}</h4>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate mb-1.5">{app.category}</p>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    {app.rating}
                  </div>
                </div>
                <button className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-primary-500 hover:text-white dark:hover:bg-primary-500 dark:hover:text-white px-5 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm">
                  GET
                </button>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Categories (Horizontal Scroll) */}
        {categories.map((category, idx) => (
          <motion.section 
            key={idx} 
            className="relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 + idx * 0.1 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{category.title}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">{category.subtitle}</p>
              </div>
              <button className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-bold text-sm flex items-center gap-1">
                See All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex gap-6 overflow-x-auto pb-6 pt-2 scrollbar-hide snap-x -mx-8 px-8">
              {category.apps.map(app => (
                <div 
                  key={app.id} 
                  onClick={() => navigate(`/apps/${app.id}`)}
                  className="snap-start shrink-0 w-[140px] cursor-pointer group"
                >
                  <div className="relative mb-4">
                    <img 
                      src={app.icon} 
                      alt={app.name} 
                      className="w-[140px] h-[140px] rounded-[1.5rem] shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl dark:group-hover:shadow-primary-900/20 object-cover" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-colors duration-300 rounded-[1.5rem]" />
                  </div>
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 truncate text-[15px] tracking-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{app.name}</h4>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate mb-2">{app.category}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      {app.rating}
                    </div>
                    <button className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-primary-500 hover:text-white dark:hover:bg-primary-500 dark:hover:text-white px-4 py-1.5 rounded-xl text-[11px] font-bold transition-colors shadow-sm">
                      GET
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        ))}
      </div>
    </motion.div>
  );
}
