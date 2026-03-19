import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Filter, Github, Search } from 'lucide-react';
import Fuse from 'fuse.js';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import { useTaskStore } from '@sdkwork/claw-core';
import { Input, RepositoryCard } from '@sdkwork/claw-ui';
import { githubService, type GithubRepo } from '../../services';

export function GitHubRepos() {
  const { t } = useTranslation();
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
    toast.success(t('github.repos.toast.installStarted', { name }));

    const taskId = addTask({
      title: t('github.repos.task.installTitle', { name }),
      subtitle: t('github.repos.task.installSubtitle'),
      type: 'install',
    });

    try {
      await githubService.installRepo(id, name);
      updateTask(taskId, {
        progress: 100,
        status: 'success',
        subtitle: t('github.repos.task.installComplete'),
      });
      toast.success(t('github.repos.toast.installSuccess', { name }));
    } catch (error) {
      updateTask(taskId, {
        status: 'error',
        subtitle: t('github.repos.task.installFailed'),
      });
      toast.error(t('github.repos.toast.installFailed', { name }));
    }
  }

  const fuse = useMemo(
    () =>
      new Fuse(repos, {
        keys: ['name', 'author', 'tags'],
        threshold: 0.3,
      }),
    [repos],
  );

  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) {
      return repos;
    }
    return fuse.search(searchQuery).map((result) => result.item);
  }, [fuse, repos, searchQuery]);

  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(filteredRepos.length / columns),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 260,
    overscan: 5,
  });

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="shrink-0 z-20 border-b border-zinc-200 bg-white/80 px-8 py-4 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 shadow-md dark:bg-zinc-100">
              <Github className="h-5 w-5 text-white dark:text-zinc-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {t('github.repos.title')}
              </h1>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {t('github.repos.subtitle', { count: filteredRepos.length })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="group relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-primary-500" />
              <Input
                type="text"
                placeholder={t('github.repos.searchPlaceholder')}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="rounded-2xl bg-zinc-100/80 py-2.5 pl-12 pr-4 font-medium focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-primary-500/10 focus-visible:ring-offset-0 dark:border-zinc-700 dark:bg-zinc-800/80 dark:focus-visible:bg-zinc-900 dark:focus-visible:ring-offset-0"
              />
            </div>
            <button
              type="button"
              title={t('github.repos.filter')}
              className="rounded-xl border border-zinc-200 bg-white p-2.5 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Filter className="h-5 w-5" />
            </button>
            <button
              type="button"
              title={t('github.repos.sort')}
              className="rounded-xl border border-zinc-200 bg-white p-2.5 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <ArrowUpDown className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div ref={parentRef} className="flex-1 overflow-y-auto px-8 pt-8 scrollbar-hide">
        <div className="mx-auto w-full max-w-7xl">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="py-20 text-center">
              <Github className="mx-auto mb-4 h-16 w-16 text-zinc-300 dark:text-zinc-700" />
              <h3 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {t('github.repos.emptyTitle')}
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400">
                {t('github.repos.emptyDescription')}
              </p>
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
                  className="absolute left-0 top-0 flex w-full gap-6"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {Array.from({ length: columns }).map((_, colIndex) => {
                    const itemIndex = virtualRow.index * columns + colIndex;
                    const repo = filteredRepos[itemIndex];

                    return (
                      <div
                        key={repo ? repo.id : `empty-${colIndex}`}
                        className="min-w-0 flex-1 pb-6"
                      >
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
