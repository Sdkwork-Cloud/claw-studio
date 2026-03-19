import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  Filter,
  MapPin,
  Menu,
  MessageCircle,
  Network,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@sdkwork/claw-ui';
import { ClawInstance, ClawCategory } from '../types';
import { clawService } from '../services';
import { useTranslation } from 'react-i18next';

export function ClawCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [claws, setClaws] = useState<ClawInstance[]>([]);
  const [categories, setCategories] = useState<ClawCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const formatCategoryLabel = (categoryId: string, fallback?: string) => {
    const translationKey = `categories.${categoryId}`;
    const translatedValue = t(translationKey);
    return translatedValue === translationKey ? (fallback ?? categoryId) : translatedValue;
  };
  const formatOrderCount = (value: number) => new Intl.NumberFormat(i18n.language).format(value);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [clawsData, categoriesData] = await Promise.all([
          clawService.getClaws(),
          clawService.getCategories()
        ]);
        setClaws(clawsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredClaws = claws.filter(claw => {
    const matchesSearch = claw.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          claw.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          claw.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = activeCategory === 'All' || claw.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="p-8 md:p-12 max-w-7xl mx-auto flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full bg-zinc-50 dark:bg-zinc-950 pb-12 overflow-y-auto scrollbar-hide">
      {/* Top Search Bar (E-commerce style header) */}
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-10 h-10 bg-primary-600 text-white rounded-xl flex items-center justify-center shadow-sm">
              <Network className="w-6 h-6" />
            </div>
            <span className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">{t('clawCenter.title')}<span className="text-primary-600 dark:text-primary-400">{t('clawCenter.titleHighlight')}</span></span>
          </div>
          
          <div className="flex-1 max-w-3xl flex items-center">
            <div className="flex w-full border-2 border-primary-600 rounded-full overflow-hidden bg-white dark:bg-zinc-950 shadow-sm focus-within:ring-4 focus-within:ring-primary-500/20 transition-all">
              <div className="pl-4 pr-2 py-3 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1">{t('clawCenter.services')} <ChevronDown className="w-4 h-4"/></span>
              </div>
              <Input
                type="text" 
                placeholder={t('clawCenter.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-auto flex-1 rounded-none border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
              />
              <button className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 font-bold transition-colors flex items-center gap-2">
                <Search className="w-4 h-4" /> {t('clawCenter.search')}
              </button>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400 shrink-0">
            <button className="hover:text-primary-600 dark:hover:text-primary-400 flex flex-col items-center gap-1 transition-colors">
              <MessageCircle className="w-5 h-5" />
              {t('clawCenter.messages')}
            </button>
            <button className="hover:text-primary-600 dark:hover:text-primary-400 flex flex-col items-center gap-1 transition-colors">
              <Briefcase className="w-5 h-5" />
              {t('clawCenter.myOrders')}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-6">
        {/* Main E-commerce Layout: Left Sidebar + Right Hero */}
        <div className="flex flex-col lg:flex-row gap-6 mb-12">
          {/* Left Categories Menu */}
          <div className="w-full lg:w-64 shrink-0 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col h-fit">
            <div className="p-4 bg-primary-600 text-white font-bold flex items-center gap-2">
              <Menu className="w-5 h-5"/> {t('clawCenter.allCategories')}
            </div>
            <div className="py-2">
              <div 
                onClick={() => setActiveCategory('All')}
                className={`px-4 py-3 cursor-pointer flex items-center justify-between group transition-colors ${activeCategory === 'All' ? 'bg-primary-50 dark:bg-primary-500/10 border-l-4 border-primary-600' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-l-4 border-transparent'}`}
              >
                <div className={`flex items-center gap-3 text-sm font-bold ${activeCategory === 'All' ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-700 dark:text-zinc-300 group-hover:text-primary-600 dark:group-hover:text-primary-400'}`}>
                  <Network className="w-4 h-4" /> {t('clawCenter.allCategories')}
                </div>
              </div>
              {categories.map(c => (
                <div 
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`px-4 py-3 cursor-pointer flex items-center justify-between group transition-colors ${activeCategory === c.id ? 'bg-primary-50 dark:bg-primary-500/10 border-l-4 border-primary-600' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-l-4 border-transparent'}`}
                >
                  <div className={`flex items-center gap-3 text-sm font-bold ${activeCategory === c.id ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-700 dark:text-zinc-300 group-hover:text-primary-600 dark:group-hover:text-primary-400'}`}>
                    <c.icon className="w-4 h-4" /> {formatCategoryLabel(c.id, c.name)}
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-opacity ${activeCategory === c.id ? 'text-primary-600 opacity-100' : 'text-zinc-400 opacity-0 group-hover:opacity-100'}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Right Hero Banner */}
          <div className="flex-1 bg-zinc-900 rounded-2xl relative overflow-hidden flex flex-col justify-center min-h-[420px] h-auto shadow-lg group cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-900/90 to-rose-900/40 z-10"></div>
            <img src="https://picsum.photos/seed/ai-banner/1200/600" alt={t('clawCenter.bannerAlt')} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            
            <div className="relative z-20 p-10 md:p-16 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider mb-6 border border-white/20">
                <Zap className="w-3.5 h-3.5 text-amber-300" /> {t('clawCenter.supercharge')}
              </span>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
                {t('clawCenter.futureOfB2B')} <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-300 to-rose-300">{t('clawCenter.aiAgentSourcing')}</span>
              </h2>
              <p className="text-primary-100 text-lg mb-8 max-w-lg">
                {t('clawCenter.subtitle')}
              </p>
              <button className="bg-white text-primary-900 px-8 py-3.5 rounded-full font-bold hover:bg-primary-50 transition-colors shadow-xl flex items-center gap-2">
                {t('clawCenter.exploreProviders')} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Trending Section */}
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {activeCategory === 'All'
              ? t('clawCenter.trendingProviders')
              : `${formatCategoryLabel(
                  activeCategory,
                  categories.find((category) => category.id === activeCategory)?.name,
                )} ${t('clawCenter.providers')}`}
          </h2>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredClaws.map(claw => (
            <div 
              key={claw.id}
              onClick={() => navigate(`/claw-center/${claw.id}`)}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 hover:shadow-xl hover:border-primary-500/30 dark:hover:border-primary-500/50 transition-all cursor-pointer flex flex-col group"
            >
              <div className="flex items-start justify-between mb-4">
                <img src={claw.logo} alt={claw.name} className="w-14 h-14 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800 object-cover" referrerPolicy="no-referrer" />
                {claw.verified && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-500/20">
                    <ShieldCheck className="w-3 h-3" />
                    {t('clawCenter.verifiedOnly')}
                  </span>
                )}
              </div>
              
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">{claw.name}</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" /> {formatCategoryLabel(claw.category, claw.category)}
              </p>
              
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-2 flex-1">
                {claw.description}
              </p>
              
              <div className="flex flex-wrap gap-1.5 mb-4">
                {claw.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-medium rounded border border-zinc-200 dark:border-zinc-700">
                    {tag}
                  </span>
                ))}
                {claw.tags.length > 2 && (
                  <span className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-500 text-[10px] font-medium rounded border border-zinc-200 dark:border-zinc-800">
                    +{claw.tags.length - 2}
                  </span>
                )}
              </div>
              
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between mt-auto">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    {claw.rating}
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                    {formatOrderCount(claw.completedOrders)}+ {t('clawCenter.orders')}
                  </div>
                </div>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                  <MessageCircle className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredClaws.length === 0 && (
          <div className="py-24 flex flex-col items-center justify-center text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 mt-4">
            <Building2 className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mb-4" />
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">{t('clawCenter.noProvidersFound')}</h3>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-md">{t('clawCenter.noResults')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
