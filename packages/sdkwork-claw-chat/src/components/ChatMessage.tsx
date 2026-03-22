import React, { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Camera,
  Check,
  Copy,
  FileText,
  Image as ImageIcon,
  Link2,
  Mic,
  MonitorUp,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Video,
} from 'lucide-react';
import type { StudioConversationAttachment } from '@sdkwork/claw-types';
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
  attachments?: StudioConversationAttachment[];
}

function formatFileSize(
  sizeBytes: number | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (!sizeBytes || sizeBytes <= 0) {
    return null;
  }

  if (sizeBytes < 1024) {
    return t('chat.message.fileSizeBytes', { count: sizeBytes });
  }
  if (sizeBytes < 1024 * 1024) {
    return t('chat.message.fileSizeKb', {
      size: (sizeBytes / 1024).toFixed(1),
    });
  }

  return t('chat.message.fileSizeMb', {
    size: (sizeBytes / (1024 * 1024)).toFixed(1),
  });
}

function formatDuration(durationMs: number | undefined) {
  if (!durationMs || durationMs <= 0) {
    return null;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function attachmentIcon(kind: StudioConversationAttachment['kind']) {
  switch (kind) {
    case 'image':
      return ImageIcon;
    case 'audio':
      return Mic;
    case 'video':
      return Video;
    case 'screenshot':
      return Camera;
    case 'screen-recording':
      return MonitorUp;
    case 'link':
      return Link2;
    default:
      return FileText;
  }
}

function attachmentLabel(
  attachment: StudioConversationAttachment,
  t: (key: string) => string,
) {
  switch (attachment.kind) {
    case 'image':
      return t('chat.message.attachmentKinds.image');
    case 'audio':
      return t('chat.message.attachmentKinds.audio');
    case 'video':
      return t('chat.message.attachmentKinds.video');
    case 'screenshot':
      return t('chat.message.attachmentKinds.screenshot');
    case 'screen-recording':
      return t('chat.message.attachmentKinds.screenRecording');
    case 'link':
      return t('chat.message.attachmentKinds.link');
    default:
      return t('chat.message.attachmentKinds.file');
  }
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
      <div className="relative mb-6 mt-4 min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-[#1E1E1E]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-100 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
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

const AttachmentTile = memo(function AttachmentTile({
  attachment,
  isUser,
}: {
  attachment: StudioConversationAttachment;
  isUser: boolean;
}) {
  const { t } = useTranslation();
  const Icon = attachmentIcon(attachment.kind);
  const previewUrl = attachment.previewUrl || attachment.url;
  const displayUrl = attachment.url || attachment.originalUrl;
  const detailItems = [
    attachmentLabel(attachment, t),
    formatFileSize(attachment.sizeBytes, t),
    formatDuration(attachment.durationMs),
  ].filter(Boolean);
  const surfaceClassName = isUser
    ? 'border-zinc-300/80 bg-white/90 dark:border-zinc-700 dark:bg-zinc-900/70'
    : 'border-zinc-200/80 bg-white/70 dark:border-zinc-800 dark:bg-zinc-900/50';

  if (
    previewUrl &&
    (attachment.kind === 'image' || attachment.kind === 'screenshot')
  ) {
    return (
      <a
        href={displayUrl || previewUrl}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'group relative overflow-hidden rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-lg',
          surfaceClassName,
        )}
      >
        <img
          src={previewUrl}
          alt={attachment.name}
          className="max-h-72 w-full object-cover"
        />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {attachment.name}
            </div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {detailItems.join(' / ')}
            </div>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-950/80 text-white dark:bg-zinc-100 dark:text-zinc-950">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </a>
    );
  }

  if (previewUrl && attachment.kind === 'audio') {
    return (
      <div
        className={cn(
          'rounded-2xl border p-4 shadow-sm backdrop-blur-sm',
          surfaceClassName,
        )}
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            <Mic className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {attachment.name}
            </div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {detailItems.join(' / ')}
            </div>
          </div>
        </div>
        <audio controls preload="metadata" className="w-full" src={previewUrl} />
      </div>
    );
  }

  if (
    previewUrl &&
    (attachment.kind === 'video' || attachment.kind === 'screen-recording')
  ) {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-2xl border shadow-sm backdrop-blur-sm',
          surfaceClassName,
        )}
      >
        <video controls preload="metadata" className="max-h-80 w-full bg-zinc-950" src={previewUrl} />
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
            <Video className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {attachment.name}
            </div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {detailItems.join(' / ')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <a
      href={displayUrl || '#'}
      target={displayUrl ? '_blank' : undefined}
      rel={displayUrl ? 'noreferrer' : undefined}
      className={cn(
        'flex min-w-0 items-start gap-3 rounded-2xl border p-4 shadow-sm backdrop-blur-sm transition-colors hover:border-primary-500/40',
        surfaceClassName,
      )}
    >
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-900/8 text-zinc-700 dark:bg-zinc-100/10 dark:text-zinc-200">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {attachment.name}
        </div>
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {detailItems.join(' / ')}
        </div>
        {attachment.originalUrl ? (
          <div className="mt-2 truncate text-xs text-primary-600 dark:text-primary-300">
            {attachment.originalUrl}
          </div>
        ) : null}
      </div>
      {displayUrl ? (
        <div className="text-xs font-medium text-primary-600 dark:text-primary-300">
          {t('chat.message.openAttachment')}
        </div>
      ) : null}
    </a>
  );
});

export const ChatMessage = memo(function ChatMessage({
  role,
  content,
  model,
  timestamp,
  onRegenerate,
  isTyping,
  attachments = [],
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
  const hasRenderableContent = content.trim().length > 0 || isTyping;

  return (
    <div
      className={cn(
        'group mx-auto flex w-full max-w-4xl transition-all duration-300',
        isUser ? 'justify-end pl-4 sm:pl-12 lg:pl-24' : 'justify-start pr-4 sm:pr-12 lg:pr-24',
      )}
    >
      <div
        className={cn(
          'flex max-w-full gap-3 rounded-3xl p-4 sm:gap-4 sm:p-5',
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
            <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
              <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:mr-3 sm:opacity-0 sm:group-hover:opacity-100 sm:gap-1">
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
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-3">
                <span className="max-w-full truncate text-[14px] font-semibold tracking-tight sm:text-[15px]">
                  {model || t('chat.message.assistant')}
                </span>
                <span className="text-[11px] font-medium tracking-wide text-zinc-400 dark:text-zinc-500 sm:text-xs">
                  {formatTimeLabel(timestamp)}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:gap-1">
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

          {attachments.length > 0 ? (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {attachments.map((attachment) => (
                <AttachmentTile
                  key={attachment.id}
                  attachment={attachment}
                  isUser={isUser}
                />
              ))}
            </div>
          ) : null}

          {hasRenderableContent ? (
            <div
              className={cn(
                'prose prose-zinc prose-sm relative max-w-none break-words dark:prose-invert sm:prose-base',
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
          ) : null}
        </div>
      </div>
    </div>
  );
});
