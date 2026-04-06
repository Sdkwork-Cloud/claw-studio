import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Code,
  Download,
  FileText,
  GitBranch,
  GitFork,
  ShieldCheck,
  Star,
  Terminal,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTaskStore } from '@sdkwork/claw-core';
import { githubService, type GithubRepo } from '../../services';

const REPOSITORY_ENTRIES = [
  { kind: 'dir', name: 'src' },
  { kind: 'dir', name: 'docs' },
  { kind: 'file', name: 'README.md' },
  { kind: 'file', name: 'package.json' },
] as const;

export function GitHubRepoDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addTask, updateTask } = useTaskStore();
  const [activeTab, setActiveTab] = useState<'readme' | 'files' | 'activity'>('readme');
  const [repo, setRepo] = useState<GithubRepo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const formatCount = (value?: number) =>
    new Intl.NumberFormat(i18n.language).format(value ?? 0);

  useEffect(() => {
    async function fetchRepo() {
      setIsLoading(true);
      try {
        const foundRepo = id ? await githubService.getById(id) : null;
        setRepo(foundRepo);
      } catch (error) {
        console.error('Failed to fetch repo:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchRepo();
  }, [id]);

  async function handleDownload() {
    if (!repo) {
      return;
    }

    toast.success(t('github.detail.toast.downloadStarted', { name: repo.name }));

    const taskId = addTask({
      title: t('github.detail.task.downloadTitle', { name: repo.name }),
      subtitle: t('github.detail.task.downloadSubtitle'),
      type: 'download',
    });

    try {
      await githubService.downloadRepo(repo.id, repo.name);
      updateTask(taskId, {
        progress: 100,
        status: 'success',
        subtitle: t('github.detail.task.downloadComplete'),
      });
      toast.success(t('github.detail.toast.downloadSuccess', { name: repo.name }));

      const blob = new Blob([`# ${repo.name}\n\nDownloaded via OpenClaw.`], {
        type: 'text/markdown',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${repo.name}-readme.md`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      updateTask(taskId, {
        status: 'error',
        subtitle: t('github.detail.task.downloadFailed'),
      });
      toast.error(t('github.detail.toast.downloadFailed', { name: repo.name }));
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex h-64 max-w-7xl items-center justify-center p-8 md:p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-center md:p-12">
        <h2 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('github.detail.notFoundTitle')}
        </h2>
        <button
          onClick={() => navigate('/github')}
          className="text-primary-600 hover:underline dark:text-primary-400"
        >
          {t('github.detail.notFoundBack')}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto p-6 scrollbar-hide md:p-10">
      <button
        onClick={() => navigate('/github')}
        className="mb-8 flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-primary-600 dark:hover:text-primary-400"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('github.detail.back')}
      </button>

      <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-start">
        <div className="flex items-start gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-zinc-200/50 bg-zinc-100 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-800">
            {repo.iconUrl ? (
              <img
                src={repo.iconUrl}
                alt={repo.name}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <GitBranch className="h-10 w-10 text-zinc-700 dark:text-zinc-300" />
            )}
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {repo.author}
              </span>
              {repo.stars && repo.stars > 10000 ? (
                <div title={t('github.detail.verifiedPopular')}>
                  <ShieldCheck className="h-4 w-4 shrink-0 text-primary-500" />
                </div>
              ) : null}
            </div>
            <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {repo.name}
            </h1>
            <div className="mb-4 flex flex-wrap gap-2">
              {repo.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg border border-zinc-200/50 bg-zinc-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:border-zinc-700/50 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void handleDownload()}
            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 font-bold text-white shadow-sm transition-all hover:bg-primary-600 hover:shadow-md active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-primary-500"
          >
            <Download className="h-5 w-5" />
            {t('github.detail.downloadToLocal')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex border-b border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setActiveTab('readme')}
                className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'readme'
                    ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <FileText className="h-4 w-4" /> {t('github.detail.tabs.readme')}
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'files'
                    ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Code className="h-4 w-4" /> {t('github.detail.tabs.files')}
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'activity'
                    ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Activity className="h-4 w-4" /> {t('github.detail.tabs.activity')}
              </button>
            </div>
            <div className="p-6">
              {activeTab === 'readme' ? (
                <div className="prose prose-zinc max-w-none dark:prose-invert">
                  <h2>{t('github.detail.readme.aboutTitle', { name: repo.name })}</h2>
                  <p>{repo.description}</p>
                  <h3>{t('github.detail.readme.installation')}</h3>
                  <pre>
                    <code>{`git clone https://github.com/${repo.author}/${repo.name}.git`}</code>
                  </pre>
                  <h3>{t('github.detail.readme.usage')}</h3>
                  <p>{t('github.detail.readme.usageDescription')}</p>
                </div>
              ) : null}
              {activeTab === 'files' ? (
                <div className="space-y-2 font-mono text-sm">
                  {REPOSITORY_ENTRIES.map((entry) => (
                    <div
                      key={entry.name}
                      className="cursor-pointer rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <span className={`mr-3 ${entry.kind === 'dir' ? 'text-blue-500' : 'text-zinc-400'}`}>
                        {entry.kind === 'dir'
                          ? t('github.detail.files.dir')
                          : t('github.detail.files.file')}
                      </span>
                      <code>{entry.name}</code>
                    </div>
                  ))}
                </div>
              ) : null}
              {activeTab === 'activity' ? (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <Terminal className="h-4 w-4 text-zinc-500" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100">
                        <span className="font-semibold">{repo.author}</span>{' '}
                        {t('github.detail.activity.pushedToMain')}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {t('github.detail.activity.twoHoursAgo')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              {t('github.detail.stats.title')}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <Star className="h-4 w-4" /> {t('github.detail.stats.stars')}
                </div>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatCount(repo.stars)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <GitFork className="h-4 w-4" /> {t('github.detail.stats.forks')}
                </div>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatCount(repo.forks)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
