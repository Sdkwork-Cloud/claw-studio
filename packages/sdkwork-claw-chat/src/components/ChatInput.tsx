import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  ChevronDown,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Send,
  Settings2,
  StopCircle,
} from 'lucide-react';
import { type LLMChannel, type LLMModel } from '@sdkwork/claw-settings';
import { cn, Textarea } from '@sdkwork/claw-ui';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  onStop?: () => void;
  channels: LLMChannel[];
  activeChannel?: LLMChannel;
  activeModel?: LLMModel;
  onChannelChange: (channelId: string) => void;
  onModelChange: (channelId: string, modelId: string) => void;
  onOpenModelConfig?: () => void;
}

export function ChatInput({
  onSend,
  isLoading,
  onStop,
  channels,
  activeChannel,
  activeModel,
  onChannelChange,
  onModelChange,
  onOpenModelConfig,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [modelDropdownStyle, setModelDropdownStyle] = useState<React.CSSProperties | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelTriggerRef = useRef<HTMLButtonElement>(null);
  const { t } = useTranslation();
  const modelTriggerClassName = cn(
    'inline-flex min-w-0 max-w-full items-center gap-1 rounded-full px-1.5 py-1 text-xs font-medium transition-colors sm:px-2',
    showModelDropdown
      ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800/90 dark:text-zinc-100'
      : 'text-zinc-500 hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100',
  );
  const actionButtonClassName =
    'flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100 sm:h-8 sm:w-8';

  const updateModelDropdownPosition = () => {
    if (typeof window === 'undefined') {
      return;
    }

    const trigger = modelTriggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 16;
    const dropdownWidth = Math.min(560, Math.max(320, window.innerWidth - viewportPadding * 2));
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - dropdownWidth - viewportPadding),
    );
    const availableAbove = rect.top - viewportPadding - 12;
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding - 12;
    const placeAbove = availableAbove >= 260 || availableAbove >= availableBelow;
    const maxHeight = Math.max(
      180,
      Math.min(380, placeAbove ? availableAbove : availableBelow),
    );

    setModelDropdownStyle({
      left: `${left}px`,
      width: `${dropdownWidth}px`,
      maxHeight: `${maxHeight}px`,
      ...(placeAbove
        ? { bottom: `${window.innerHeight - rect.top + 12}px` }
        : { top: `${rect.bottom + 12}px` }),
    });
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${scrollHeight}px`;
    textarea.style.overflowY = scrollHeight > 320 ? 'auto' : 'hidden';
  }, [message]);

  useEffect(() => {
    if (!showModelDropdown) {
      setModelDropdownStyle(null);
      return;
    }

    updateModelDropdownPosition();

    const handleReposition = () => {
      updateModelDropdownPosition();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowModelDropdown(false);
        restoreTextareaFocus();
      }
    };

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showModelDropdown, activeChannel?.id]);

  const restoreTextareaFocus = () => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
    });
  };

  const handleSend = () => {
    if (!message.trim() || isLoading || !activeModel) {
      return;
    }

    onSend(message.trim());
    setMessage('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !isLoading) {
      event.preventDefault();
      handleSend();
    }
  };

  const showElevatedSurface = isFocused || Boolean(message.trim()) || showModelDropdown;

  return (
    <div className="relative w-full px-2 sm:px-4">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn(
          'relative flex w-full flex-col overflow-hidden rounded-[26px] border backdrop-blur-xl transition-all duration-300',
          showElevatedSurface
            ? 'border-zinc-300 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.14)] ring-1 ring-zinc-200/80 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_18px_48px_rgba(0,0,0,0.32)] dark:ring-zinc-800'
            : 'border-zinc-300/90 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.09)] ring-1 ring-zinc-200/70 dark:border-zinc-700/90 dark:bg-zinc-900 dark:shadow-[0_12px_30px_rgba(0,0,0,0.2)] dark:ring-zinc-800/80',
        )}
      >
        <div className="flex flex-col gap-2 px-4 py-3 sm:px-5 sm:py-4">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={t('chat.input.placeholder')}
            className="min-h-[70px] max-h-[320px] w-full resize-none rounded-none border-none bg-transparent px-0 py-0 text-[15px] leading-7 text-zinc-900 shadow-none placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent dark:text-zinc-100 dark:placeholder:text-zinc-500"
            rows={1}
          />

          <div className="flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:gap-1.5">
              <button
                className={actionButtonClassName}
                title={t('chat.input.attachFile')}
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                className={actionButtonClassName}
                title={t('chat.input.uploadImage')}
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <button
                className={actionButtonClassName}
                title={t('chat.input.voiceInput')}
              >
                <Mic className="h-4 w-4" />
              </button>

              <div className="relative min-w-0">
                <button
                  ref={modelTriggerRef}
                  onClick={() => setShowModelDropdown((current) => !current)}
                  className={modelTriggerClassName}
                >
                  <span className="truncate max-w-[160px] sm:max-w-[220px]">
                    {activeModel?.name || t('chat.page.selectModel')}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400',
                      showModelDropdown && 'rotate-180',
                    )}
                  />
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.button
                  key="stop"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  onClick={onStop}
                  className="group flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900"
                  title={t('chat.input.stopGenerating')}
                >
                  <StopCircle className="h-[18px] w-[18px] transition-colors group-hover:text-red-400" />
                </motion.button>
              ) : (
                <motion.button
                  key="send"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  onClick={handleSend}
                  disabled={!message.trim() || !activeModel}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300',
                    message.trim() && activeModel
                      ? 'bg-zinc-900 text-white shadow-sm hover:scale-105 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500',
                  )}
                >
                  <Send className="h-[18px] w-[18px]" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {showModelDropdown && modelDropdownStyle && typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              <div
                className="fixed inset-0 z-[70]"
                onClick={() => {
                  setShowModelDropdown(false);
                  restoreTextareaFocus();
                }}
              />
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.15 }}
                style={modelDropdownStyle}
                className="fixed z-[80] flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_24px_70px_rgba(0,0,0,0.42)] sm:flex-row"
              >
                <div className="overflow-y-auto border-b border-zinc-100 bg-zinc-50/80 p-2 dark:border-zinc-800 dark:bg-zinc-900/70 sm:w-[220px] sm:border-b-0 sm:border-r">
                  <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    {t('chat.page.channels')}
                  </div>
                  <div className="mt-1 space-y-1">
                    {channels.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => onChannelChange(channel.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                          activeChannel?.id === channel.id
                            ? 'border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800'
                            : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/60',
                        )}
                      >
                        <span className="text-lg">{channel.icon}</span>
                        <span
                          className={cn(
                            'truncate text-sm font-medium',
                            activeChannel?.id === channel.id
                              ? 'text-zinc-900 dark:text-zinc-100'
                              : 'text-zinc-600 dark:text-zinc-400',
                          )}
                        >
                          {channel.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="min-w-0 flex-1 overflow-y-auto bg-white p-2 dark:bg-zinc-900">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      {t('chat.page.models')}
                    </span>
                    <button
                      onClick={() => {
                        setShowModelDropdown(false);
                        onOpenModelConfig?.();
                      }}
                      className="flex items-center gap-1 text-xs text-primary-600 hover:underline dark:text-primary-400"
                    >
                      <Settings2 className="h-3 w-3" />
                      {t('chat.page.config')}
                    </button>
                  </div>
                  <div className="mt-1 space-y-1">
                    {activeChannel?.models.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          if (!activeChannel) {
                            return;
                          }

                          onModelChange(activeChannel.id, model.id);
                          setShowModelDropdown(false);
                          restoreTextareaFocus();
                        }}
                        className={cn(
                          'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors',
                          activeModel?.id === model.id
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                            : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800',
                        )}
                      >
                        <span className="truncate text-sm font-medium">{model.name}</span>
                        {activeModel?.id === model.id ? (
                          <Check className="h-4 w-4 shrink-0" />
                        ) : null}
                      </button>
                    ))}
                    {!activeChannel?.models || activeChannel.models.length === 0 ? (
                      <div className="px-3 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        {t('chat.page.noModels')}
                      </div>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>,
            document.body,
          )
        : null}

      <div className="mt-2 text-center dark:text-zinc-500 sm:mt-3">
        <p className="text-[10px] font-medium tracking-wide text-zinc-500 sm:text-[11px] dark:text-zinc-500">
          {t('chat.input.disclaimer')}
        </p>
      </div>
    </div>
  );
}
