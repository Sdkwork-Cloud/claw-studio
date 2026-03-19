import { ArrowUpRight, Copy, Smartphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { platform } from '@sdkwork/claw-infrastructure';
import { OverlaySurface } from '@sdkwork/claw-ui';
import { mobileAppGuideService } from '../services';
import { MobileAppDownloadChannelCard } from './MobileAppDownloadChannelCard';
import { MobileAppDownloadQrCode } from './MobileAppDownloadQrCode';

export interface MobileAppDownloadDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileAppDownloadDialog({
  isOpen,
  onClose,
}: MobileAppDownloadDialogProps) {
  const { t } = useTranslation();
  const guide = mobileAppGuideService.getGuide();
  const featuredChannel =
    guide.channels.find((channel) => channel.id === guide.recommendedChannelId) ?? guide.channels[0];
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) {
      return;
    }

    const timeout = window.setTimeout(() => setIsCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [isCopied]);

  const handleCopyAll = async () => {
    await platform.copy(featuredChannel.href);
    setIsCopied(true);
  };

  return (
    <OverlaySurface
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop
      className="max-w-5xl"
      backdropClassName="bg-zinc-950/56"
    >
      <div className="border-b border-zinc-200 bg-white/92 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900/92">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500/12 text-primary-600 dark:text-primary-300">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                {t('install.mobileGuide.dialog.eyebrow')}
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                {t('install.mobileGuide.dialog.title')}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {t('install.mobileGuide.dialog.description')}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label={t('install.mobileGuide.dialog.close')}
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.10),_transparent_34%),linear-gradient(180deg,_rgba(9,9,11,0.02),_rgba(9,9,11,0))] px-6 py-6 dark:bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_36%),linear-gradient(180deg,_rgba(24,24,27,0.76),_rgba(9,9,11,0.96))]">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_22rem]">
          <div className="rounded-[28px] border border-sky-500/14 bg-sky-500/[0.06] px-5 py-5 text-sm leading-6 text-zinc-700 dark:text-sky-50/90">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700 dark:text-sky-200/80">
              {t('install.mobileGuide.dialog.primaryTitle')}
            </div>
            <p className="mt-3">{t('install.mobileGuide.dialog.hint')}</p>
          </div>

          <MobileAppDownloadQrCode
            label={t('install.mobileGuide.dialog.qrTitle')}
            description={t('install.mobileGuide.dialog.qrDescription', {
              channel: t(`install.mobileGuide.channels.${featuredChannel.id}.title`),
            })}
            value={featuredChannel.href}
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {guide.channels.map((channel) => (
            <MobileAppDownloadChannelCard
              key={channel.id}
              channel={channel}
              isRecommended={channel.id === guide.recommendedChannelId}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-zinc-200 bg-white/92 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900/92 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => {
            void handleCopyAll();
          }}
          className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {isCopied ? <ArrowUpRight className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {isCopied ? t('install.mobileGuide.actions.copied') : t('install.mobileGuide.dialog.copyAll')}
        </button>
        <button
          type="button"
          onClick={() => {
            void platform.openExternal(featuredChannel.href);
          }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          <ArrowUpRight className="h-4 w-4" />
          {t('install.mobileGuide.dialog.openDocs')}
        </button>
      </div>
    </OverlaySurface>
  );
}
