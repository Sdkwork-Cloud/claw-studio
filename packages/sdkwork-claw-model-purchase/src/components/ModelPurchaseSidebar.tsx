import { useTranslation } from 'react-i18next';
import { Globe2, Sparkles, Star } from 'lucide-react';
import { Button } from '@sdkwork/claw-ui';
import type { ModelPurchaseVendor } from '../services';

interface ModelPurchaseVendorGroup {
  id: string;
  label: string;
  vendors: ModelPurchaseVendor[];
}

interface ModelPurchaseSidebarProps {
  groups: ModelPurchaseVendorGroup[];
  selectedVendorId: string;
  onSelect: (vendorId: string) => void;
}

const spotlightVendorIds = new Set(['default', 'openai', 'minimax', 'zhipu']);

function getSectionIcon(sectionId: string) {
  if (sectionId === 'default') {
    return Sparkles;
  }

  if (sectionId === 'us-top10') {
    return Globe2;
  }

  return Star;
}

export function ModelPurchaseSidebar({
  groups,
  selectedVendorId,
  onSelect,
}: ModelPurchaseSidebarProps) {
  const { t } = useTranslation();

  return (
    <aside
      data-slot="model-purchase-sidebar"
      className="w-full shrink-0 xl:h-full xl:w-[17rem]"
    >
      <div className="rounded-[28px] border border-zinc-200/80 bg-white/92 p-3 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70 xl:flex xl:h-full xl:flex-col">
        <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          {t('modelPurchase.sidebar.catalogTitle')}
        </div>
        <div className="space-y-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
          {groups.map((group) => {
            const SectionIcon = getSectionIcon(group.id);

            return (
              <section key={group.id} className="space-y-2">
                <div className="flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  <SectionIcon className="h-3.5 w-3.5" />
                  <span>{group.label}</span>
                </div>
                <div className="space-y-1.5">
                  {group.vendors.map((vendor) => {
                    const isActive = vendor.id === selectedVendorId;
                    const isSpotlight = spotlightVendorIds.has(vendor.id);

                    return (
                      <Button
                        key={vendor.id}
                        type="button"
                        variant="ghost"
                        onClick={() => onSelect(vendor.id)}
                        aria-pressed={isActive}
                        className={`flex h-auto w-full items-start justify-between rounded-2xl px-3 py-3 text-left ${
                          isActive
                            ? 'bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200'
                            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{vendor.name}</span>
                          <span
                            className={`mt-1 block truncate text-xs ${
                              isActive ? 'text-white/75 dark:text-zinc-600' : 'text-zinc-500'
                            }`}
                          >
                            {vendor.audience}
                          </span>
                        </span>
                        {isSpotlight ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                              isActive
                                ? 'bg-white/12 text-white dark:bg-zinc-900 dark:text-zinc-100'
                                : 'bg-primary-500/10 text-primary-700 dark:text-primary-300'
                            }`}
                          >
                            {t('modelPurchase.sidebar.spotlight')}
                          </span>
                        ) : null}
                      </Button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
