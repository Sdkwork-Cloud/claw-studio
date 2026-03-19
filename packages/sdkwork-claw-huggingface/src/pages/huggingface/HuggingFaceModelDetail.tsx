import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Code,
  Download,
  FileText,
  HardDrive,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTaskStore } from '@sdkwork/claw-core';
import { huggingfaceService, type HuggingFaceModel } from '../../services';

const HUGGING_FACE_MONOGRAM = 'HF';
const MODEL_FILES = [
  { name: 'config.json', size: '2.4 kB' },
  { name: 'pytorch_model.bin', size: '14.2 GB' },
  { name: 'tokenizer.json', size: '1.8 MB' },
] as const;

export function HuggingFaceModelDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addTask, updateTask } = useTaskStore();
  const [activeTab, setActiveTab] = useState<'model_card' | 'files' | 'community'>(
    'model_card',
  );
  const [model, setModel] = useState<HuggingFaceModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const formatCount = (value?: number) =>
    new Intl.NumberFormat(i18n.language).format(value ?? 0);

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

  async function handleDownload() {
    if (!model) {
      return;
    }

    toast.success(t('huggingface.detail.toast.downloadStarted', { name: model.name }));

    const taskId = addTask({
      title: t('huggingface.detail.task.downloadTitle', { name: model.name }),
      subtitle: t('huggingface.detail.task.downloadSubtitle'),
      type: 'download',
    });

    try {
      await huggingfaceService.downloadModel(model.id, model.name);
      updateTask(taskId, {
        progress: 100,
        status: 'success',
        subtitle: t('huggingface.detail.task.downloadComplete'),
      });
      toast.success(t('huggingface.detail.toast.downloadSuccess', { name: model.name }));

      const blob = new Blob(
        [
          `{ "model": "${model.name}", "author": "${model.author}", "status": "downloaded" }`,
        ],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${model.name}-config.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      updateTask(taskId, {
        status: 'error',
        subtitle: t('huggingface.detail.task.downloadFailed'),
      });
      toast.error(t('huggingface.detail.toast.downloadFailed', { name: model.name }));
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex h-64 max-w-7xl items-center justify-center p-8 md:p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-center md:p-12">
        <h2 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('huggingface.detail.notFoundTitle')}
        </h2>
        <button
          onClick={() => navigate('/huggingface')}
          className="text-primary-600 hover:underline dark:text-primary-400"
        >
          {t('huggingface.detail.notFoundBack')}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto p-6 scrollbar-hide md:p-10">
      <button
        onClick={() => navigate('/huggingface')}
        className="mb-8 flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-primary-600 dark:hover:text-primary-400"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('huggingface.detail.back')}
      </button>

      <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-start">
        <div className="flex items-start gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-zinc-200/50 bg-zinc-100 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-800">
            {model.iconUrl ? (
              <img
                src={model.iconUrl}
                alt={model.name}
                className="h-full w-full object-cover p-2"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                {HUGGING_FACE_MONOGRAM}
              </span>
            )}
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {model.author}
              </span>
              {model.downloads && model.downloads > 1000000 ? (
                <div title={t('huggingface.detail.highlyDownloaded')}>
                  <ShieldCheck className="h-4 w-4 shrink-0 text-primary-500" />
                </div>
              ) : null}
            </div>
            <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {model.name}
            </h1>
            <div className="mb-4 flex flex-wrap gap-2">
              {model.tags.map((tag) => (
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
            {t('huggingface.detail.downloadToLocal')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex border-b border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setActiveTab('model_card')}
                className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'model_card'
                    ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <FileText className="h-4 w-4" /> {t('huggingface.detail.tabs.modelCard')}
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'files'
                    ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Code className="h-4 w-4" /> {t('huggingface.detail.tabs.files')}
              </button>
              <button
                onClick={() => setActiveTab('community')}
                className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'community'
                    ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Activity className="h-4 w-4" /> {t('huggingface.detail.tabs.community')}
              </button>
            </div>
            <div className="p-6">
              {activeTab === 'model_card' ? (
                <div className="prose prose-zinc max-w-none dark:prose-invert">
                  <h2>{t('huggingface.detail.modelCard.descriptionTitle')}</h2>
                  <p>{model.description}</p>
                  <h3>{t('huggingface.detail.modelCard.intendedUseTitle')}</h3>
                  <p>{t('huggingface.detail.modelCard.intendedUseDescription')}</p>
                  <h3>{t('huggingface.detail.modelCard.howToUse')}</h3>
                  <pre>
                    <code>{`from transformers import AutoModelForCausalLM, AutoTokenizer

model_id = "${model.author}/${model.name}"
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(model_id)`}</code>
                  </pre>
                </div>
              ) : null}
              {activeTab === 'files' ? (
                <div className="space-y-2 font-mono text-sm">
                  {MODEL_FILES.map((file) => (
                    <div
                      key={file.name}
                      className="flex cursor-pointer items-center justify-between rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-400">{t('huggingface.detail.files.file')}</span>
                        <code>{file.name}</code>
                      </div>
                      <span className="text-xs text-zinc-500">{file.size}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {activeTab === 'community' ? (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <span className="text-sm">
                        {t('huggingface.detail.community.userInitial')}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100">
                        <span className="font-semibold">
                          {t('huggingface.detail.community.userName')}
                        </span>{' '}
                        {t('huggingface.detail.community.issueOpened')}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {t('huggingface.detail.community.oneDayAgo')}
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
              {t('huggingface.detail.stats.title')}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <Download className="h-4 w-4" /> {t('huggingface.detail.stats.downloads')}
                </div>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatCount(model.downloads)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <HardDrive className="h-4 w-4" /> {t('huggingface.detail.stats.size')}
                </div>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {t('huggingface.detail.stats.estimatedSize')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
