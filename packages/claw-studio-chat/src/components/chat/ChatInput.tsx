import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Image as ImageIcon, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@sdkwork/claw-studio-shared-ui';

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
    <div className="relative max-w-4xl mx-auto w-full">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
          "relative flex flex-col w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-2xl overflow-hidden transition-all duration-200",
          "focus-within:border-primary-500 dark:focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-500/10"
        )}
      >
        {/* Input Area */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Claw Studio... (Shift + Enter for new line)"
          className="w-full max-h-[200px] min-h-[60px] p-4 pb-12 bg-transparent border-none resize-none focus:ring-0 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-base leading-relaxed"
          rows={1}
          disabled={isLoading}
        />

        {/* Action Buttons */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button 
              className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button 
              className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              title="Upload image"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <button 
              className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              title="Voice input"
            >
              <Mic className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={handleSend}
            disabled={!message.trim() || isLoading}
            className={cn(
              "p-2 rounded-xl flex items-center justify-center transition-all duration-200",
              message.trim() && !isLoading
                ? "bg-primary-500 text-white shadow-md hover:bg-primary-600 hover:shadow-lg hover:-translate-y-0.5"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
      
      <div className="text-center mt-3">
        <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
          AI models can make mistakes. Consider verifying important information.
        </p>
      </div>
    </div>
  );
}
