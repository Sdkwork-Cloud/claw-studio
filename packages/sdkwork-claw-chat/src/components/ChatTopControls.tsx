import { Menu, Settings2 } from 'lucide-react';

export interface ChatTopControlsProps {
  expandSidebarLabel: string;
  openSessionContextLabel: string;
  onOpenSidebar: () => void;
  onClick: () => void;
}

export function ChatTopControls({
  expandSidebarLabel,
  openSessionContextLabel,
  onOpenSidebar,
  onClick,
}: ChatTopControlsProps) {
  return (
    <>
      <div className="pointer-events-none absolute left-2.5 top-2.5 z-20 sm:left-3 sm:top-3 lg:hidden">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/78 text-zinc-600 shadow-[0_8px_24px_rgba(15,23,42,0.10)] ring-1 ring-white/75 backdrop-blur-md transition-colors hover:bg-white/92 hover:text-zinc-900 dark:bg-zinc-900/58 dark:text-zinc-200 dark:ring-white/[0.08] dark:shadow-[0_10px_24px_rgba(0,0,0,0.24)] dark:hover:bg-zinc-900/78 dark:hover:text-zinc-50 sm:h-9 sm:w-9"
          aria-label={expandSidebarLabel}
          title={expandSidebarLabel}
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="pointer-events-none absolute right-2.5 top-2.5 z-20 sm:right-3 sm:top-3 lg:right-4">
        <button
          type="button"
          onClick={onClick}
          className="pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/78 text-zinc-500 shadow-[0_8px_24px_rgba(15,23,42,0.10)] ring-1 ring-white/75 backdrop-blur-md transition-colors hover:bg-white/92 hover:text-zinc-900 dark:bg-zinc-900/58 dark:text-zinc-200 dark:ring-white/[0.08] dark:shadow-[0_10px_24px_rgba(0,0,0,0.24)] dark:hover:bg-zinc-900/78 dark:hover:text-zinc-50 sm:h-9 sm:w-9"
          aria-label={openSessionContextLabel}
          title={openSessionContextLabel}
        >
          <Settings2 className="h-[18px] w-[18px]" />
        </button>
      </div>
    </>
  );
}
