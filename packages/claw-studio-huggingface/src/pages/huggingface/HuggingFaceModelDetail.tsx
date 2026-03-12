import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, ShieldCheck, FileText, Code, Activity, HardDrive } from 'lucide-react';
import { useTaskStore } from '@sdkwork/claw-studio-business';
import { toast } from 'sonner';
import { huggingfaceService, type HuggingFaceModel } from '../../services';

export function HuggingFaceModelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addTask, updateTask } = useTaskStore();
  const [activeTab, setActiveTab] = useState<'model_card' | 'files' | 'community'>('model_card');
  const [model, setModel] = useState<HuggingFaceModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchModel() {
      setIsLoading(true);
      try {
        const foundModel = id ? await huggingfaceService.getById(id) : null;
        setModel(foundModel);
      } catch (error) {
        console.error('Failed to fetch model:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchModel();
  }, [id]);

  if (isLoading) {
    return (
      <div className="p-8 md:p-12 max-w-7xl mx-auto flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="p-8 md:p-12 max-w-7xl mx-auto text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Model Not Found</h2>
        <button onClick={() => navigate('/huggingface')} className="text-primary-600 dark:text-primary-400 hover:underline">
          Return to Hugging Face Models
        </button>
      </div>
    );
  }

  async function handleDownload() {
    toast.success(`Started downloading ${model.name}`);

    const taskId = addTask({
      title: `Downloading ${model.name}`,
      subtitle: 'Fetching model weights and configuration...',
      type: 'download',
    });

    try {
      await huggingfaceService.downloadModel(model.id, model.name);
      updateTask(taskId, { progress: 100, status: 'success', subtitle: 'Download complete' });
      toast.success(`${model.name} downloaded successfully`);

      const blob = new Blob([`{ "model": "${model.name}", "author": "${model.author}", "status": "downloaded" }`], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${model.name}-config.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      updateTask(taskId, { status: 'error', subtitle: 'Download failed' });
      toast.error(`Failed to download ${model.name}`);
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto h-full overflow-y-auto scrollbar-hide">
      <button
        onClick={() => navigate('/huggingface')}
        className="flex items-center gap-2 text-zinc-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-8 font-medium text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Models
      </button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm overflow-hidden">
            {model.iconUrl ? (
              <img src={model.iconUrl} alt={model.name} className="w-full h-full object-cover p-2" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-4xl">HF</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{model.author}</span>
              {model.downloads && model.downloads > 1000000 ? (
                <div title="Highly Downloaded">
                  <ShieldCheck className="w-4 h-4 text-primary-500 shrink-0" />
                </div>
              ) : null}
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">{model.name}</h1>
            <div className="flex flex-wrap gap-2 mb-4">
              {model.tags.map((tag) => (
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
                onClick={() => setActiveTab('model_card')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${activeTab === 'model_card' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                <FileText className="w-4 h-4" /> Model Card
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${activeTab === 'files' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                <Code className="w-4 h-4" /> Files and versions
              </button>
              <button
                onClick={() => setActiveTab('community')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${activeTab === 'community' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                <Activity className="w-4 h-4" /> Community
              </button>
            </div>
            <div className="p-6">
              {activeTab === 'model_card' ? (
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <h2>Model Description</h2>
                  <p>{model.description}</p>
                  <h3>Intended Uses & Limitations</h3>
                  <p>This is a simulated model card. In a real application, this would fetch the README.md from the Hugging Face hub.</p>
                  <h3>How to use</h3>
                  <pre><code>{`from transformers import AutoModelForCausalLM, AutoTokenizer

model_id = "${model.author}/${model.name}"
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(model_id)`}</code></pre>
                </div>
              ) : null}
              {activeTab === 'files' ? (
                <div className="space-y-2 font-mono text-sm">
                  <div className="flex items-center justify-between p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-400">FILE</span> config.json
                    </div>
                    <span className="text-zinc-500 text-xs">2.4 kB</span>
                  </div>
                  <div className="flex items-center justify-between p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-400">FILE</span> pytorch_model.bin
                    </div>
                    <span className="text-zinc-500 text-xs">14.2 GB</span>
                  </div>
                  <div className="flex items-center justify-between p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-400">FILE</span> tokenizer.json
                    </div>
                    <span className="text-zinc-500 text-xs">1.8 MB</span>
                  </div>
                </div>
              ) : null}
              {activeTab === 'community' ? (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <span className="text-sm">U</span>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100"><span className="font-semibold">User123</span> opened an issue: How to fine-tune?</p>
                      <p className="text-xs text-zinc-500">1 day ago</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4 uppercase tracking-wider">Model Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <Download className="w-4 h-4" /> Downloads
                </div>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{model.downloads?.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <HardDrive className="w-4 h-4" /> Size (Est.)
                </div>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">~14.2 GB</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
