import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Download,
  HardDrive,
  Loader2,
  Share,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { type AppItem, appStoreService } from '../../services';

export function AppDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [app, setApp] = useState<AppItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [installState, setInstallState] = useState<
    'idle' | 'downloading' | 'installing' | 'installed'
  >('idle');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchApp = async () => {
      if (!id) {
        return;
      }

      setLoading(true);
      try {
        const data = await appStoreService.getApp(id);
        setApp(data);
      } catch (error) {
        console.error('Failed to fetch app:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchApp();
  }, [id]);

  const handleInstall = () => {
    if (installState !== 'idle' || !app) {
      return;
    }

    setInstallState('downloading');
    setProgress(0);

    const downloadInterval = setInterval(() => {
      setProgress((currentProgress) => {
        if (currentProgress >= 100) {
          clearInterval(downloadInterval);
          setInstallState('installing');

          setTimeout(() => {
            setInstallState('installed');
            toast.success(t('apps.detail.installSuccess', { name: app.name }));
          }, 2000);

          return 100;
        }

        return currentProgress + Math.floor(Math.random() * 15) + 5;
      });
    }, 200);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-white dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white dark:bg-zinc-950">
        <h2 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('apps.detail.notFoundTitle')}
        </h2>
        <button
          onClick={() => navigate(-1)}
          className="rounded-xl bg-primary-600 px-4 py-2 font-bold text-white"
        >
          {t('common.goBack')}
        </button>
      </div>
    );
  }

  const extendedApp = {
    ...app,
    reviewsCount: '12.4K',
    screenshots: [
      `https://picsum.photos/seed/${app.id}_1/800/500`,
      `https://picsum.photos/seed/${app.id}_2/800/500`,
      `https://picsum.photos/seed/${app.id}_3/800/500`,
    ],
    version: '2.1.0',
    size: '342 MB',
    releaseDate: 'Oct 24, 2023',
    compatibility: 'macOS 12.0 or later, Windows 11, Linux',
    ageRating: '4+',
  };

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-zinc-950">
      <div className="sticky top-0 z-20 flex items-center gap-4 border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80">
        <button
          onClick={() => navigate(-1)}
          className="rounded-full p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
        </button>
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {t('apps.detail.pageTitle')}
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-8">
        <div className="mb-12 flex flex-col items-start gap-8 md:flex-row">
          <img
            src={extendedApp.icon}
            alt={app.name}
            className="h-32 w-32 shrink-0 rounded-3xl border border-zinc-100 object-cover shadow-lg md:h-40 md:w-40 dark:border-zinc-800"
            referrerPolicy="no-referrer"
          />

          <div className="flex-1">
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-4xl">
              {app.name}
            </h1>
            <h2 className="mb-4 text-lg text-zinc-500 dark:text-zinc-400">{app.developer}</h2>

            <div className="mb-6 flex flex-wrap items-center gap-6">
              <div className="flex flex-col">
                <span className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('apps.detail.rating')}
                </span>
                <div className="flex items-center gap-1 font-bold text-zinc-900 dark:text-zinc-100">
                  {app.rating}
                  <Star className="h-4 w-4 fill-zinc-900 dark:fill-zinc-100" />
                </div>
              </div>
              <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex flex-col">
                <span className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('apps.detail.category')}
                </span>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">{app.category}</div>
              </div>
              <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex flex-col">
                <span className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('apps.detail.age')}
                </span>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {extendedApp.ageRating}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {installState === 'idle' ? (
                <button
                  onClick={handleInstall}
                  className="flex items-center gap-2 rounded-full bg-primary-500 px-8 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-primary-600"
                >
                  <Download className="h-4 w-4" />
                  {t('apps.detail.installToLocal')}
                </button>
              ) : null}

              {installState === 'downloading' ? (
                <div className="flex w-64 items-center gap-4 rounded-full border border-zinc-200 bg-zinc-50 px-6 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <div className="flex-1">
                    <div className="mb-1.5 flex justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      <span>{t('apps.detail.downloading')}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-primary-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {installState === 'installing' ? (
                <button
                  disabled
                  className="flex cursor-not-allowed items-center gap-2 rounded-full bg-zinc-100 px-8 py-2.5 font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('apps.detail.installing')}
                </button>
              ) : null}

              {installState === 'installed' ? (
                <button className="flex items-center gap-2 rounded-full bg-zinc-900 px-8 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
                  <Check className="h-4 w-4" />
                  {t('apps.detail.openApp')}
                </button>
              ) : null}

              <button className="rounded-full p-2.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
                <Share className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h3 className="mb-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t('common.preview')}
          </h3>
          <div className="flex snap-x gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {extendedApp.screenshots.map((src: string, index: number) => (
              <img
                key={src}
                src={src}
                alt={t('apps.detail.screenshotAlt', { index: index + 1 })}
                className="h-64 shrink-0 snap-start rounded-2xl border border-zinc-200 object-cover shadow-sm md:h-80 dark:border-zinc-800"
                referrerPolicy="no-referrer"
              />
            ))}
          </div>
        </div>

        <div className="grid gap-12 md:grid-cols-3">
          <div className="space-y-8 md:col-span-2">
            <div>
              <h3 className="mb-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {t('apps.detail.about')}
              </h3>
              <div className="prose prose-zinc max-w-none dark:prose-invert">
                <p className="whitespace-pre-wrap leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {app.description}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-6 dark:border-zinc-800/50 dark:bg-zinc-900/50">
              <h4 className="mb-2 font-bold text-zinc-900 dark:text-zinc-100">
                {t('apps.detail.whatsNew')}
              </h4>
              <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                {t('apps.detail.versionReleased', {
                  version: extendedApp.version,
                  date: extendedApp.releaseDate,
                })}
              </p>
              <div className="space-y-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                <p>- {t('apps.detail.whatsNewBullets.one')}</p>
                <p>- {t('apps.detail.whatsNewBullets.two')}</p>
                <p>- {t('apps.detail.whatsNewBullets.three')}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="mb-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t('apps.detail.information')}
            </h3>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <HardDrive className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500" />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {t('apps.detail.size')}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {extendedApp.size}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500" />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {t('apps.detail.compatibility')}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {extendedApp.compatibility}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
