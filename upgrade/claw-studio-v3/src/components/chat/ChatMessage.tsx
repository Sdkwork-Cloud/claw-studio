import React, { useState, memo } from 'react';
import { Bot, User, Copy, Check, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  timestamp: number;
  onRegenerate?: () => void;
  isTyping?: boolean;
}

export const ChatMessage = memo(function ChatMessage({ role, content, model, timestamp, onRegenerate, isTyping }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = role === 'user';

  return (
    <div className={cn(
      "group flex gap-4 p-6 w-full max-w-4xl mx-auto rounded-3xl transition-all duration-300",
      isUser ? "bg-transparent hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50" : "bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md"
    )}>
      {/* Avatar */}
      <div className="flex-shrink-0 mt-1">
        {isUser ? (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 dark:from-zinc-100 dark:to-zinc-300 flex items-center justify-center shadow-md">
            <User className="w-5 h-5 text-white dark:text-zinc-900" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-[1.25rem] bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-md ring-4 ring-primary-50 dark:ring-primary-900/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="font-bold text-[15px] text-zinc-900 dark:text-zinc-100 tracking-tight">
              {isUser ? 'You' : model || 'Assistant'}
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium tracking-wide">
              {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          
          {/* Actions (visible on hover) */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <button 
              onClick={handleCopy}
              className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
              title="Copy message"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
            {!isUser && (
              <>
                <button className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors">
                  <ThumbsUp className="w-4 h-4" />
                </button>
                <button className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors">
                  <ThumbsDown className="w-4 h-4" />
                </button>
                {onRegenerate && (
                  <button 
                    onClick={onRegenerate}
                    className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                    title="Regenerate response"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className={cn(
          "prose prose-zinc prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent relative",
          isTyping && content !== '' && "[&>*:last-child]:after:content-['▋'] [&>*:last-child]:after:animate-pulse [&>*:last-child]:after:ml-1 [&>*:last-child]:after:text-primary-500"
        )}>
          {content === '' && isTyping ? (
            <div className="flex items-center gap-1 h-6">
              <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match && !className?.includes('language-');
                  
                  if (!isInline && match) {
                    return (
                      <div className="relative group/code mt-4 mb-6 rounded-xl overflow-hidden border border-zinc-800 bg-[#1E1E1E]">
                        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/50 border-b border-zinc-800">
                          <span className="text-xs font-mono text-zinc-400">{match[1]}</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ''))}
                            className="text-zinc-400 hover:text-white transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                        <SyntaxHighlighter
                          {...props}
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          className="!m-0 !p-4 !bg-transparent text-sm font-mono"
                          showLineNumbers={true}
                          lineNumberStyle={{ minWidth: '2.5em', paddingRight: '1em', color: '#6e7681', textAlign: 'right' }}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }
                  return (
                    <code {...props} className={cn("bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-1.5 py-0.5 rounded-md text-sm font-mono", className)}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
});
