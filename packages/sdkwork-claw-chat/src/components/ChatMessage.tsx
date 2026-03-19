import React, { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Check, Copy, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { cn } from '@sdkwork/claw-ui';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  timestamp: number;
  onRegenerate?: () => void;
  isTyping?: boolean;
}

const CodeBlock = memo(
  ({
    match,
    children,
    props,
  }: {
    match: RegExpExecArray;
    children: React.ReactNode;
    props: Record<string, unknown>;
  }) => {
    const [copied, setCopied] = useState(false);
    const { t } = useTranslation();

    const handleCopy = () => {
      navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="relative mb-6 mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-[#1E1E1E]">
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-100 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">{match[1]}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className={copied ? 'text-emerald-500' : ''}>
              {copied ? t('chat.message.copied') : t('chat.message.copyCode')}
            </span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <SyntaxHighlighter
            {...props}
            style={vscDarkPlus}
            language={match[1]}
            PreTag="div"
            className="!m-0 !bg-transparent !p-4 text-[13px] leading-relaxed"
            showLineNumbers={true}
            lineNumberStyle={{
              minWidth: '2.5em',
              paddingRight: '1em',
              color: '#6e7681',
              textAlign: 'right',
              userSelect: 'none',
            }}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  },
);

export const ChatMessage = memo(function ChatMessage({
  role,
  content,
  model,
  timestamp,
  onRegenerate,
  isTyping,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const { t, i18n } = useTranslation();
  const formatTimeLabel = (value: number) =>
    new Intl.DateTimeFormat(i18n.language, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'group mx-auto flex w-full max-w-4xl transition-all duration-300',
        isUser ? 'justify-end pl-12 sm:pl-24' : 'justify-start pr-12 sm:pr-24',
      )}
    >
      <div
        className={cn(
          'flex max-w-full gap-4 rounded-3xl p-4 sm:p-5',
          isUser
            ? 'rounded-br-md bg-zinc-100 text-zinc-900 sm:max-w-[85%] dark:bg-zinc-800 dark:text-zinc-100'
            : 'bg-transparent text-zinc-900 dark:text-zinc-100',
        )}
      >
        {!isUser ? (
          <div className="mt-1 flex-shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-purple-600 shadow-sm ring-2 ring-primary-50 dark:ring-primary-900/20 sm:h-10 sm:w-10">
              <Bot className="h-4 w-4 text-white sm:h-5 sm:w-5" />
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          {isUser ? (
            <div className="mb-2 flex items-center justify-end">
              <div className="mr-3 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 sm:gap-1">
                <button
                  onClick={handleCopy}
                  className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/50 hover:text-zinc-900 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100"
                  title={t('chat.message.copyMessage')}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500 sm:h-4 sm:w-4" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                </button>
              </div>
              <span className="text-[11px] font-medium tracking-wide text-zinc-400 dark:text-zinc-500 sm:text-xs">
                {formatTimeLabel(timestamp)}
              </span>
            </div>
          ) : (
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-[14px] font-semibold tracking-tight sm:text-[15px]">
                  {model || t('chat.message.assistant')}
                </span>
                <span className="text-[11px] font-medium tracking-wide text-zinc-400 dark:text-zinc-500 sm:text-xs">
                  {formatTimeLabel(timestamp)}
                </span>
              </div>

              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 sm:gap-1">
                <button
                  onClick={handleCopy}
                  className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/50 hover:text-zinc-900 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100"
                  title={t('chat.message.copyMessage')}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500 sm:h-4 sm:w-4" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                </button>
                <button className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/50 hover:text-zinc-900 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100">
                  <ThumbsUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
                <button className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/50 hover:text-zinc-900 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100">
                  <ThumbsDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
                {onRegenerate ? (
                  <button
                    onClick={onRegenerate}
                    className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/50 hover:text-zinc-900 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100"
                    title={t('chat.message.regenerateResponse')}
                  >
                    <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          )}

          <div
            className={cn(
              'prose prose-zinc prose-sm relative max-w-none dark:prose-invert sm:prose-base',
              'prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary-500 hover:prose-a:text-primary-600',
              'prose-code:before:content-none prose-code:after:content-none prose-p:leading-relaxed prose-pre:bg-transparent prose-pre:p-0',
              isTyping &&
                content !== '' &&
                "[&>*:last-child]:after:ml-1 [&>*:last-child]:after:animate-pulse [&>*:last-child]:after:content-['|'] [&>*:last-child]:after:text-primary-500",
            )}
          >
            {content === '' && isTyping ? (
              <div className="flex h-6 items-center gap-1">
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match && !className?.includes('language-');

                    if (!isInline && match) {
                      return <CodeBlock match={match} children={children} props={props} />;
                    }

                    return (
                      <code
                        {...props}
                        className={cn(
                          'rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-[13px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
                          className,
                        )}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
