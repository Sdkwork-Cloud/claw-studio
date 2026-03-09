import React from 'react';
import { Star, Download, GitFork, ShieldCheck, Box, Github, Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface RepositoryCardProps {
  id: string;
  name: string;
  author: string;
  description: string;
  stars?: number;
  downloads?: number;
  forks?: number;
  tags: string[];
  type: 'github' | 'huggingface';
  onInstall: (id: string, name: string) => void;
  iconUrl?: string;
}

export function RepositoryCard({
  id,
  name,
  author,
  description,
  stars,
  downloads,
  forks,
  tags,
  type,
  onInstall,
  iconUrl
}: RepositoryCardProps) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/${type}/${id}`);
  };

  const handleInstallClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInstall(id, `${author}/${name}`);
  };

  return (
    <div 
      onClick={handleCardClick}
      className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-zinc-200/60 dark:border-zinc-800 shadow-sm hover:shadow-xl dark:hover:shadow-primary-900/10 transition-all duration-300 group flex flex-col h-full relative overflow-hidden cursor-pointer"
    >
      {/* Background decoration */}
      <div className="absolute -right-12 -top-12 w-40 h-40 bg-zinc-50 dark:bg-zinc-800/50 rounded-full blur-3xl group-hover:bg-primary-50/50 dark:group-hover:bg-primary-900/20 transition-colors pointer-events-none" />
      
      <div className="flex items-start gap-4 mb-4 relative z-10">
        <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm overflow-hidden">
          {iconUrl ? (
            <img src={iconUrl} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : type === 'github' ? (
            <Github className="w-7 h-7 text-zinc-700 dark:text-zinc-300" />
          ) : (
            <span className="text-2xl">🤗</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider truncate">{author}</span>
            {stars && stars > 10000 && (
              <ShieldCheck className="w-3.5 h-3.5 text-primary-500 shrink-0" />
            )}
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" title={name}>
            {name}
          </h3>
        </div>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-6 flex-1 relative z-10 leading-relaxed">
        {description}
      </p>

      <div className="flex flex-wrap gap-2 mb-6 relative z-10">
        {tags.slice(0, 3).map(tag => (
          <span key={tag} className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-zinc-200/50 dark:border-zinc-700/50">
            {tag}
          </span>
        ))}
        {tags.length > 3 && (
          <span className="px-2.5 py-1 bg-zinc-50 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-zinc-100 dark:border-zinc-800">
            +{tags.length - 3}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800 relative z-10">
        <div className="flex items-center gap-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {stars !== undefined && (
            <div className="flex items-center gap-1.5" title="Stars">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              {stars > 1000 ? `${(stars / 1000).toFixed(1)}k` : stars}
            </div>
          )}
          {downloads !== undefined && (
            <div className="flex items-center gap-1.5" title="Downloads">
              <Download className="w-4 h-4 text-primary-400" />
              {downloads > 1000000 ? `${(downloads / 1000000).toFixed(1)}M` : downloads > 1000 ? `${(downloads / 1000).toFixed(1)}k` : downloads}
            </div>
          )}
          {forks !== undefined && (
            <div className="flex items-center gap-1.5" title="Forks">
              <GitFork className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              {forks > 1000 ? `${(forks / 1000).toFixed(1)}k` : forks}
            </div>
          )}
        </div>
        
        <button 
          onClick={handleInstallClick}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-primary-600 dark:hover:bg-primary-500 text-white dark:text-zinc-900 rounded-xl text-xs font-bold transition-colors shadow-sm hover:shadow-md active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          {type === 'github' ? 'Clone' : 'Download'}
        </button>
      </div>
    </div>
  );
}
