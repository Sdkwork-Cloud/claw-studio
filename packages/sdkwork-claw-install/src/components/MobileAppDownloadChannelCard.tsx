import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Copy, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { platform } from '@sdkwork/claw-infrastructure';
import type { MobileAppGuideChannel } from '../services';

interface MobileAppDownloadChannelCardProps {
  channel: MobileAppGuideChannel;
  isRecommended?: boolean;
}

function getStatusClasses(status: MobileAppGuideChannel['status']) {
  if (status === 'preview') {
    return 'border-amber-500/25 bg-amber-500/12 text-amber-200';
  }

  return 'border-emerald-500/25 bg-emerald-500/12 text-emerald-200';
}

export function MobileAppDownloadChannelCard({
  channel,
  isRecommended = false,
}: MobileAppDownloadChannelCardProps) {
  const { t } = useTranslation();
  const [isCopied, setIsCopied] = useState(false);
  const channelKey = `install.mobileGuide.channels.${channel.id}`;

  useEffect(() => {
    if (!isCopied) {
      return;
    }

    const timeout = window.setTimeout(() => setIsCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [isCopied]);

  const handleOpen = () => {
    void platform.openExternal(channel.href);
  };

  const handleCopy = async () => {
    await platform.copy(channel.copyHref);
    setIsCopied(true);
  };

  return (
    <div className="flex h-full flex-col rounded-[28px] border border-white/10 bg-zinc-950/78 p-5 text-zinc-100 shadow-[0_24px_60px_rgba(9,9,11,0.22)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/6 text-white">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isRecommended ? (
            <span className="rounded-full border border-sky-400/20 bg-sky-400/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100">
              {t('install.mobileGuide.badges.recommended')}
            </span>
          ) : null}
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getStatusClasses(channel.status)}`}
          >
            {t(`install.mobileGuide.status.${channel.status}`)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">{t(`${channelKey}.title`)}</h3>
        <p className="text-sm leading-6 text-zinc-300">{t(`${channelKey}.description`)}</p>
        <p className="text-xs leading-5 text-zinc-400">{t(`${channelKey}.note`)}</p>
        <div className="rounded-2xl bg-white/[0.06] px-3 py-2 font-mono text-[11px] leading-5 text-sky-100/88">
          {channel.href}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleOpen}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-100"
        >
          <ArrowUpRight className="h-4 w-4" />
          {t('install.mobileGuide.actions.openGuide')}
        </button>
        <button
          type="button"
          onClick={() => {
            void handleCopy();
          }}
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-white/[0.08]"
        >
          {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {isCopied ? t('install.mobileGuide.actions.copied') : t('install.mobileGuide.actions.copyLink')}
        </button>
      </div>
    </div>
  );
}
