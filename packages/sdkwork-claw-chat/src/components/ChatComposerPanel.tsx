import type { ComponentProps } from 'react';
import { ArrowDown } from 'lucide-react';
import { ChatInput } from './ChatInput';

export interface ChatComposerPanelProps {
  showJumpToLatest: boolean;
  hasMessages: boolean;
  jumpToLatestLabel: string;
  onJumpToLatest: () => void;
  inputProps: ComponentProps<typeof ChatInput>;
}

export function ChatComposerPanel({
  showJumpToLatest,
  hasMessages,
  jumpToLatestLabel,
  onJumpToLatest,
  inputProps,
}: ChatComposerPanelProps) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      {showJumpToLatest && hasMessages ? (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={onJumpToLatest}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm shadow-zinc-950/5 transition-colors hover:border-primary-400 hover:text-primary-600 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200 dark:hover:border-primary-500 dark:hover:text-primary-300"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            <span>{jumpToLatestLabel}</span>
          </button>
        </div>
      ) : null}
      <ChatInput {...inputProps} />
    </div>
  );
}
