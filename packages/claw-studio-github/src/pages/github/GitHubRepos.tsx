import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Github, Filter, ArrowUpDown } from 'lucide-react';
import { useTaskStore } from '@sdkwork/claw-studio-business';
import { RepositoryCard } from '@sdkwork/claw-studio-shared-ui';
import { toast } from 'sonner';
import Fuse from 'fuse.js';
import { useVirtualizer } from '@tanstack/react-virtual';
import { githubService, type GithubRepo } from '../../services';

export function GitHubRepos() {
  const [searchQuery, setSearchQuery] = useState('');
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addTask, updateTask } = useTaskStore();
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(3);

  useEffect(() => {
    async function fetchRepos() {
      setIsLoading(true);
      try {
        const data = await githubService.getRepos();
        setRepos(data);
      } catch (error) {
        console.error('Failed to fetch repos:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchRepos();
  }, []);

  useEffect(() => {
    const handleResize = () => {
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

  async function handleInstall(id: string, name: string) {
    toast.success(`Started installing ${name}`);

    const taskId = addTask({
      title: `Installing ${name}`,
      subtitle: 'Cloning repository and setting up environment...',
      type: 'install',
    });

    try {
      await githubService.installRepo(id, name);
      updateTask(taskId, { progress: 100, status: 'success', subtitle: 'Installation complete' });
      toast.success(`${name} installed successfully`);
    } catch (error) {
      updateTask(taskId, { status: 'error', subtitle: 'Installation failed' });
      toast.error(`Failed to install ${name}`);
    }
  }

  const fuse = useMemo(() => new Fuse(repos, {
    keys: ['name', 'author', 'tags'],
    threshold: 0.3,
  }), [repos]);

  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) return repos;
    return fuse.search(searchQuery).map((result) => result.item);
  }, [searchQuery, fuse, repos]);

  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(filteredRepos.length / columns),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 260,
    overscan: 5,
  });

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
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
                onChange={(event) => setSearchQuery(event.target.value)}
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

      <div ref={parentRef} className="flex-1 overflow-y-auto scrollbar-hide px-8 pt-8">
        <div className="max-w-7xl mx-auto w-full">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredRepos.length === 0 ? (
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
                            onInstall={(id, name) => void handleInstall(id, name)}
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
