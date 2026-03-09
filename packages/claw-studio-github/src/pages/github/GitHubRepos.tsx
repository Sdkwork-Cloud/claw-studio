import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Github, Filter, ArrowUpDown } from 'lucide-react';
import { useTaskStore } from '@sdkwork/claw-studio-business/stores/useTaskStore';
import { RepositoryCard } from '@sdkwork/claw-studio-shared-ui';
import { toast } from 'sonner';
import Fuse from 'fuse.js';
import { useVirtualizer } from '@tanstack/react-virtual';

// Generate 1000 mock repos to demonstrate extreme performance
const generateMockRepos = () => {
  const bases = [
    { name: 'llama.cpp', author: 'ggerganov', tags: ['C++', 'LLM', 'Inference'] },
    { name: 'stable-diffusion-webui', author: 'AUTOMATIC1111', tags: ['Python', 'Stable Diffusion', 'UI'] },
    { name: 'LangChain', author: 'langchain-ai', tags: ['Python', 'LLM', 'Agents'] },
    { name: 'AutoGPT', author: 'Significant-Gravitas', tags: ['Python', 'Autonomous', 'GPT-4'] },
    { name: 'ollama', author: 'ollama', tags: ['Go', 'LLM', 'Local'] },
    { name: 'whisper', author: 'openai', tags: ['Python', 'Speech Recognition', 'Audio'] }
  ];

  return Array.from({ length: 1000 }).map((_, i) => {
    const base = bases[i % bases.length];
    return {
      id: `gh-${i}`,
      name: `${base.name}-${i}`,
      author: base.author,
      description: `High-performance port of ${base.name} optimized for local execution. Instance #${i}.`,
      stars: Math.floor(Math.random() * 100000) + 1000,
      forks: Math.floor(Math.random() * 20000) + 100,
      tags: base.tags,
      iconUrl: `https://avatars.githubusercontent.com/u/${Math.floor(Math.random() * 10000000)}?s=200&v=4`
    };
  });
};

export const GITHUB_REPOS = generateMockRepos();

export function GitHubRepos() {
  const [searchQuery, setSearchQuery] = useState('');
  const { addTask, updateTask } = useTaskStore();
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(3);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      // Adjust breakpoints to match Tailwind's md (768px) and lg (1024px)
      // Note: The container might be smaller than window.innerWidth due to sidebar,
      // so we use slightly smaller thresholds or measure the container itself.
      // For simplicity and robustness, measuring the container is better.
      if (parentRef.current) {
        const containerWidth = parentRef.current.offsetWidth;
        if (containerWidth < 640) {
          setColumns(1);
        } else if (containerWidth < 1024) {
          setColumns(2);
        } else {
          setColumns(3);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    // Also set up a ResizeObserver for the container
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    
    if (parentRef.current) {
      resizeObserver.observe(parentRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, []);

  const handleInstall = (id: string, name: string) => {
    toast.success(`Started installing ${name}`);
    
    const taskId = addTask({
      title: `Installing ${name}`,
      subtitle: 'Cloning repository and setting up environment...',
      type: 'install'
    });

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        clearInterval(interval);
        updateTask(taskId, { progress: 100, status: 'success', subtitle: 'Installation complete' });
        toast.success(`${name} installed successfully`);
      } else {
        updateTask(taskId, { progress });
      }
    }, 1000);
  };

  const fuse = useMemo(() => new Fuse(GITHUB_REPOS, {
    keys: ['name', 'author', 'tags'],
    threshold: 0.3,
  }), []);

  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) return GITHUB_REPOS;
    return fuse.search(searchQuery).map(result => result.item);
  }, [searchQuery, fuse]);

  // Virtualization setup
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(filteredRepos.length / columns),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 260, // Estimated height of a row (card height + gap)
    overscan: 5,
  });

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 dark:bg-zinc-100 rounded-xl flex items-center justify-center shadow-md">
              <Github className="w-5 h-5 text-white dark:text-zinc-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">GitHub Repositories</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Install popular open-source projects locally ({filteredRepos.length} items)</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-80 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-primary-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search repos, authors, tags..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 focus:bg-white dark:focus:bg-zinc-900 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-2xl text-sm font-medium transition-all outline-none placeholder:text-zinc-500 dark:placeholder:text-zinc-400 shadow-sm"
              />
            </div>
            <button className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">
              <Filter className="w-5 h-5" />
            </button>
            <button className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">
              <ArrowUpDown className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={parentRef} className="flex-1 overflow-y-auto px-8 pt-8">
        <div className="max-w-7xl mx-auto w-full">
          {filteredRepos.length === 0 ? (
            <div className="text-center py-20">
              <Github className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">No repositories found</h3>
              <p className="text-zinc-500 dark:text-zinc-400">Try adjusting your search query or filters.</p>
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                <div
                  key={virtualRow.index}
                  className="absolute top-0 left-0 w-full flex gap-6"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {Array.from({ length: columns }).map((_, colIndex) => {
                    const itemIndex = virtualRow.index * columns + colIndex;
                    const repo = filteredRepos[itemIndex];
                    
                    return (
                      <div key={repo ? repo.id : `empty-${colIndex}`} className="flex-1 min-w-0 pb-6">
                        {repo ? (
                          <RepositoryCard
                            {...repo}
                            type="github"
                            onInstall={handleInstall}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
