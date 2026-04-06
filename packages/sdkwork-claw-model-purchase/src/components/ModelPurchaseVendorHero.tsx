import { useTranslation } from 'react-i18next';
import { BadgeDollarSign, Layers3, Sparkles, Zap } from 'lucide-react';
import type { ModelPurchaseBillingCycle, ModelPurchaseVendor } from '../services';

interface ModelPurchaseVendorHeroProps {
  vendor: ModelPurchaseVendor;
  cycle: ModelPurchaseBillingCycle;
}

const toneStyles: Record<
  ModelPurchaseVendor['tone'],
  {
    panel: string;
    chip: string;
  }
> = {
  zinc: { panel: 'from-zinc-950 via-zinc-900 to-zinc-800', chip: 'bg-zinc-500/15 text-zinc-100' },
  emerald: { panel: 'from-emerald-700 via-emerald-600 to-emerald-500', chip: 'bg-emerald-500/15 text-emerald-100' },
  sky: { panel: 'from-sky-700 via-sky-600 to-cyan-500', chip: 'bg-sky-500/15 text-sky-100' },
  blue: { panel: 'from-blue-700 via-blue-600 to-indigo-500', chip: 'bg-blue-500/15 text-blue-100' },
  cyan: { panel: 'from-cyan-700 via-cyan-600 to-sky-500', chip: 'bg-cyan-500/15 text-cyan-100' },
  violet: { panel: 'from-violet-700 via-violet-600 to-fuchsia-500', chip: 'bg-violet-500/15 text-violet-100' },
  amber: { panel: 'from-amber-700 via-amber-600 to-orange-500', chip: 'bg-amber-500/15 text-amber-100' },
  orange: { panel: 'from-orange-700 via-orange-600 to-amber-500', chip: 'bg-orange-500/15 text-orange-100' },
  rose: { panel: 'from-rose-700 via-rose-600 to-pink-500', chip: 'bg-rose-500/15 text-rose-100' },
  fuchsia: { panel: 'from-fuchsia-700 via-fuchsia-600 to-pink-500', chip: 'bg-fuchsia-500/15 text-fuchsia-100' },
  teal: { panel: 'from-teal-700 via-teal-600 to-emerald-500', chip: 'bg-teal-500/15 text-teal-100' },
  indigo: { panel: 'from-indigo-700 via-indigo-600 to-blue-500', chip: 'bg-indigo-500/15 text-indigo-100' },
};

export function ModelPurchaseVendorHero({
  vendor,
  cycle,
}: ModelPurchaseVendorHeroProps) {
  const { t } = useTranslation();
  const tone = toneStyles[vendor.tone];
  const regionLabel =
    vendor.region === 'us'
      ? t('modelPurchase.regions.us')
      : vendor.region === 'china'
        ? t('modelPurchase.regions.china')
        : t('modelPurchase.regions.global');

  return (
    <section
      data-slot="model-purchase-vendor-hero"
      className={`overflow-hidden rounded-[32px] bg-gradient-to-br ${tone.panel} p-8 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]`}
    >
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
            <Sparkles className="h-3.5 w-3.5" />
            {vendor.group === 'default'
              ? t('modelPurchase.hero.defaultBundle')
              : t('modelPurchase.hero.topModelPackage', { region: regionLabel })}
          </div>
          <h2 className="mt-5 text-4xl font-semibold tracking-tight">{vendor.name}</h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white/82">
            {vendor.tagline}
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70">
            {vendor.heroDescription}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {vendor.modelHighlights.map((highlight) => (
              <span
                key={highlight}
                className={`rounded-full px-3 py-1 text-xs font-medium ${tone.chip}`}
              >
                {highlight}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/12 bg-black/15 p-5 backdrop-blur">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">
            <Zap className="h-3.5 w-3.5" />
            {t('modelPurchase.hero.procurementWindow', { cycle: cycle.label })}
          </div>
          <p className="mt-3 text-sm leading-6 text-white/78">{cycle.description}</p>

          <div className="mt-5 grid gap-3">
            {vendor.metrics.map((metric) => (
              <div
                key={metric.id}
                className="rounded-[22px] border border-white/10 bg-white/8 p-4"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                  {metric.label}
                </div>
                <div className="mt-1 text-base font-semibold tracking-tight">{metric.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-[22px] border border-white/10 bg-white/8 p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                <BadgeDollarSign className="h-3.5 w-3.5" />
                {t('modelPurchase.hero.savings')}
              </div>
              <div className="mt-1 text-sm font-medium">{cycle.savingsHint}</div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/8 p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                <Layers3 className="h-3.5 w-3.5" />
                {t('modelPurchase.hero.fit')}
              </div>
              <div className="mt-1 text-sm font-medium">{vendor.audience}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
