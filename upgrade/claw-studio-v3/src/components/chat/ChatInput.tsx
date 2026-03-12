import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Image as ImageIcon, FileText } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'motion/react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (message.trim() && !isLoading) {
      onSend(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative w-full px-4">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
          "relative flex flex-col w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl dark:shadow-black/40 rounded-[2rem] overflow-hidden transition-all duration-300",
          "focus-within:border-primary-500/50 dark:focus-within:border-primary-500/50 focus-within:ring-4 focus-within:ring-primary-500/10 focus-within:bg-white dark:focus-within:bg-zinc-900"
        )}
      >
        {/* Input Area */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Claw Studio..."
          className="w-full max-h-[200px] min-h-[60px] p-5 pb-14 bg-transparent border-none resize-none focus:ring-0 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-[15px] leading-relaxed outline-none"
          rows={1}
          disabled={isLoading}
        />

        {/* Action Buttons */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button 
              className="p-2.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button 
              className="p-2.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              title="Upload image"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <button 
              className="p-2.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              title="Voice input"
            >
              <Mic className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={handleSend}
            disabled={!message.trim() || isLoading}
            className={cn(
              "p-3 rounded-full flex items-center justify-center transition-all duration-300",
              message.trim() && !isLoading
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-lg hover:scale-105 active:scale-95"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
      
      <div className="text-center mt-4">
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium tracking-wide">
          AI models can make mistakes. Consider verifying important information.
        </p>
      </div>
    </div>
  );
}
