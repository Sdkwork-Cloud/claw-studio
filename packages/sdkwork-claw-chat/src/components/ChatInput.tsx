import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Mic, Paperclip, Send, StopCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@sdkwork/claw-ui';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  onStop?: () => void;
}

export function ChatInput({ onSend, isLoading, onStop }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${scrollHeight}px`;
    textarea.style.overflowY = scrollHeight > 400 ? 'auto' : 'hidden';
  }, [message]);

  const handleSend = () => {
    if (!message.trim() || isLoading) {
      return;
    }

    onSend(message.trim());
    setMessage('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative w-full px-2 sm:px-4">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn(
          'relative flex w-full flex-col overflow-hidden rounded-3xl transition-all duration-300',
          isFocused || message.trim()
            ? 'bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] ring-1 ring-zinc-200 dark:bg-zinc-900 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] dark:ring-zinc-800'
            : 'bg-zinc-100/80 hover:bg-zinc-200/60 dark:bg-zinc-800/80 dark:hover:bg-zinc-800',
        )}
      >
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Ask Claw Studio..."
          className="min-h-[56px] w-full max-h-[400px] resize-none border-none bg-transparent px-4 pb-12 pt-4 text-[16px] leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-500 focus:ring-0 sm:px-6 sm:pb-14 sm:pt-5 dark:text-zinc-100 dark:placeholder:text-zinc-400"
          rows={1}
          disabled={isLoading}
        />

        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between sm:bottom-3 sm:left-3 sm:right-3">
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 sm:p-2.5 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              title="Attach file"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <button
              className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 sm:p-2.5 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              title="Upload image"
            >
              <ImageIcon className="h-5 w-5" />
            </button>
            <button
              className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 sm:p-2.5 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              title="Voice input"
            >
              <Mic className="h-5 w-5" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.button
                key="stop"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={onStop}
                className="group flex items-center justify-center rounded-full bg-zinc-900 p-2 text-white shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 sm:p-2.5 dark:bg-zinc-100 dark:text-zinc-900"
                title="Stop generating"
              >
                <StopCircle className="h-5 w-5 transition-colors group-hover:text-red-400" />
              </motion.button>
            ) : (
              <motion.button
                key="send"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={handleSend}
                disabled={!message.trim()}
                className={cn(
                  'flex items-center justify-center rounded-full p-2 transition-all duration-300 sm:p-2.5',
                  message.trim()
                    ? 'bg-zinc-900 text-white shadow-sm hover:scale-105 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-transparent text-zinc-400 dark:text-zinc-500',
                )}
              >
                <Send className="h-5 w-5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <div className="mt-3 text-center sm:mt-4">
        <p className="text-[10px] font-medium tracking-wide text-zinc-400 sm:text-[11px] dark:text-zinc-500">
          AI models can make mistakes. Consider verifying important information.
        </p>
      </div>
    </div>
  );
}
