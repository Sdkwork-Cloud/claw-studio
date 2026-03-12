import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Github, Star, GitFork, ShieldCheck, Download, Code, Terminal, FileText, Activity } from 'lucide-react';
import { useTaskStore } from '@sdkwork/claw-studio-business';
import { toast } from 'sonner';
import { githubService, type GithubRepo } from '../../services';

export function GitHubRepoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addTask, updateTask } = useTaskStore();
  const [activeTab, setActiveTab] = useState<'readme' | 'files' | 'activity'>('readme');
  const [repo, setRepo] = useState<GithubRepo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return (
      <div className="p-8 md:p-12 max-w-7xl mx-auto flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="p-8 md:p-12 max-w-7xl mx-auto text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Repository Not Found</h2>
        <button onClick={() => navigate('/github')} className="text-primary-600 dark:text-primary-400 hover:underline">
          Return to GitHub Repos
        </button>
      </div>
    );
  }

  async function handleDownload() {
    toast.success(`Started downloading ${repo.name}`);

    const taskId = addTask({
      title: `Downloading ${repo.name}`,
      subtitle: 'Cloning repository to local disk...',
      type: 'download',
    });

    try {
      await githubService.downloadRepo(repo.id, repo.name);
      updateTask(taskId, { progress: 100, status: 'success', subtitle: 'Download complete' });
      toast.success(`${repo.name} downloaded successfully`);

      const blob = new Blob([`# ${repo.name}\n\nDownloaded via OpenClaw.`], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${repo.name}-readme.md`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      updateTask(taskId, { status: 'error', subtitle: 'Download failed' });
      toast.error(`Failed to download ${repo.name}`);
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto h-full overflow-y-auto scrollbar-hide">
      <button
        onClick={() => navigate('/github')}
        className="flex items-center gap-2 text-zinc-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-8 font-medium text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Repositories
      </button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm overflow-hidden">
            {repo.iconUrl ? (
              <img src={repo.iconUrl} alt={repo.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <Github className="w-10 h-10 text-zinc-700 dark:text-zinc-300" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{repo.author}</span>
              {repo.stars && repo.stars > 10000 ? (
                <div title="Verified Popular">
                  <ShieldCheck className="w-4 h-4 text-primary-500 shrink-0" />
                </div>
              ) : null}
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">{repo.name}</h1>
            <div className="flex flex-wrap gap-2 mb-4">
              {repo.tags.map((tag) => (
                <span key={tag} className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-zinc-200/50 dark:border-zinc-700/50">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void handleDownload()}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 hover:bg-primary-600 dark:hover:bg-primary-500 text-white dark:text-zinc-900 rounded-xl font-bold transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <Download className="w-5 h-5" />
            Download to Local
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex border-b border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setActiveTab('readme')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${activeTab === 'readme' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                <FileText className="w-4 h-4" /> README
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${activeTab === 'files' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                <Code className="w-4 h-4" /> Files
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${activeTab === 'activity' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                <Activity className="w-4 h-4" /> Activity
              </button>
            </div>
            <div className="p-6">
              {activeTab === 'readme' ? (
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <h2>About {repo.name}</h2>
                  <p>{repo.description}</p>
                  <h3>Installation</h3>
                  <pre><code>git clone https://github.com/{repo.author}/{repo.name}.git</code></pre>
                  <h3>Usage</h3>
                  <p>Detailed usage instructions would go here. This is a simulated README for the repository.</p>
                </div>
              ) : null}
              {activeTab === 'files' ? (
                <div className="space-y-2 font-mono text-sm">
                  <div className="flex items-center gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer">
                    <span className="text-blue-500">DIR</span> src
                  </div>
                  <div className="flex items-center gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer">
                    <span className="text-blue-500">DIR</span> docs
                  </div>
                  <div className="flex items-center gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer">
                    <span className="text-zinc-400">FILE</span> README.md
                  </div>
                  <div className="flex items-center gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer">
                    <span className="text-zinc-400">FILE</span> package.json
                  </div>
                </div>
              ) : null}
              {activeTab === 'activity' ? (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <Terminal className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100"><span className="font-semibold">{repo.author}</span> pushed to main</p>
                      <p className="text-xs text-zinc-500">2 hours ago</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4 uppercase tracking-wider">Repository Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <Star className="w-4 h-4" /> Stars
                </div>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{repo.stars?.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <GitFork className="w-4 h-4" /> Forks
                </div>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{repo.forks?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
