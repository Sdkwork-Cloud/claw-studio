import { ArrowUpRight, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { platform } from '@sdkwork/claw-infrastructure';
import { mobileAppGuideService } from '../services';
import { MobileAppDownloadChannelCard } from './MobileAppDownloadChannelCard';

export function MobileAppDownloadSection() {
  const { t } = useTranslation();
  const guide = mobileAppGuideService.getGuide();

  return (
    <section className="relative mx-auto mt-12 overflow-hidden rounded-[32px] border border-sky-500/18 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_34%),linear-gradient(180deg,_#0f172a_0%,_#09090b_100%)] p-6 text-white shadow-[0_30px_80px_rgba(9,9,11,0.22)] md:p-8">
      <div className="absolute right-0 top-0 h-56 w-56 translate-x-1/4 -translate-y-1/3 rounded-full bg-sky-400/12 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sky-100">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.26em] text-sky-100/72">
            {t('install.mobileGuide.section.eyebrow')}
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            {t('install.mobileGuide.section.title')}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-300">
            {t('install.mobileGuide.section.description')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void platform.openExternal(guide.docsHomeHref);
          }}
          className="relative z-10 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-100"
        >
          <ArrowUpRight className="h-4 w-4" />
          {t('install.mobileGuide.section.openDocs')}
        </button>
      </div>

      <div className="relative z-10 mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {guide.channels.map((channel) => (
          <MobileAppDownloadChannelCard
            key={channel.id}
            channel={channel}
            isRecommended={channel.id === guide.recommendedChannelId}
          />
        ))}
      </div>
    </section>
  );
}
