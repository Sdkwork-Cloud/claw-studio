import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Settings2, ChevronDown, Check } from 'lucide-react';
import { ChatSidebar } from '../../components/chat/ChatSidebar';
import { ChatMessage } from '../../components/chat/ChatMessage';
import { ChatInput } from '../../components/chat/ChatInput';
import { useChatStore } from '@sdkwork/claw-studio-business/stores/useChatStore';
import { useLLMStore } from '@sdkwork/claw-studio-business/stores/useLLMStore';
import { motion, AnimatePresence } from 'motion/react';
import { chatService } from '../../services/chatService';
import { useNavigate } from 'react-router-dom';

export function Chat() {
  const { sessions, activeSessionId, createSession, addMessage, updateMessage } = useChatStore();
  const { channels, activeChannelId, activeModelId, setActiveChannel, setActiveModel } = useLLMStore();
  const [isTyping, setIsTyping] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);
  const navigate = useNavigate();

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  
  const activeChannel = channels.find(c => c.id === activeChannelId) || channels[0];
  const activeModel = activeChannel?.models.find(m => m.id === activeModelId) || activeChannel?.models[0];

  // Initialize Gemini Chat (or others if implemented in chatService)
  useEffect(() => {
    if (activeChannel?.provider === 'google' && activeModel) {
      chatRef.current = chatService.createChatSession(activeModel.id);
    } else {
      chatRef.current = null; // Local models simulated for now
    }
  }, [activeChannel, activeModel]);

  // Auto-create session if none exists
  useEffect(() => {
    if (!activeSessionId && sessions.length === 0 && activeModel) {
      createSession(activeModel.name);
    } else if (!activeSessionId && sessions.length > 0) {
      useChatStore.getState().setActiveSession(sessions[0].id);
    }
  }, [activeSessionId, sessions, createSession, activeModel]);

  // Auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, isTyping]);

  const handleSend = async (content: string) => {
    if (!activeSessionId || !activeModel || !activeChannel) return;

    // Add user message
    addMessage(activeSessionId, {
      role: 'user',
      content,
    });

    setIsTyping(true);

    // Initial empty message
    addMessage(activeSessionId, {
      role: 'assistant',
      content: '',
      model: activeModel.name,
    });

    try {
      let fullContent = '';
      // We pass the channel and model info to chatService
      const stream = chatService.sendMessageStream(chatRef.current, content, {
        id: activeModel.id,
        name: activeModel.name,
        provider: activeChannel.provider,
        icon: activeChannel.icon
      });
      
      for await (const chunk of stream) {
        fullContent += chunk;
        const currentSession = useChatStore.getState().sessions.find(s => s.id === activeSessionId);
        if (currentSession) {
          const lastMsg = currentSession.messages[currentSession.messages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            updateMessage(activeSessionId, lastMsg.id, fullContent);
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const currentSession = useChatStore.getState().sessions.find(s => s.id === activeSessionId);
      if (currentSession) {
         const lastMsg = currentSession.messages[currentSession.messages.length - 1];
         if (lastMsg && lastMsg.role === 'assistant') {
            updateMessage(activeSessionId, lastMsg.id, 'Sorry, I encountered an error while processing your request. Please check your API key or internet connection.');
         }
      }
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-full flex bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* Header */}
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl flex items-center justify-between px-6 flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-sm font-medium text-zinc-900 dark:text-zinc-100 transition-colors"
              >
                <span>{activeChannel?.icon}</span>
                <span>{activeModel?.name || 'Select Model'}</span>
                <ChevronDown className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              </button>

              {/* Model Dropdown (Two-column layout) */}
              <AnimatePresence>
                {showModelDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowModelDropdown(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-2 w-[500px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 flex h-[360px]"
                    >
                      {/* Left Column: Channels */}
                      <div className="w-1/3 border-r border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 overflow-y-auto custom-scrollbar p-2">
                        <div className="px-3 py-2 text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                          Channels
                        </div>
                        <div className="space-y-1 mt-1">
                          {channels.map((channel) => (
                            <button
                              key={channel.id}
                              onClick={() => {
                                setActiveChannel(channel.id);
                                if (channel.models.length > 0) {
                                  setActiveModel(channel.models[0].id);
                                }
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                                activeChannelId === channel.id 
                                  ? 'bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700' 
                                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/50 border border-transparent'
                              }`}
                            >
                              <span className="text-lg">{channel.icon}</span>
                              <span className={`text-sm font-medium truncate ${
                                activeChannelId === channel.id ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'
                              }`}>
                                {channel.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Right Column: Models */}
                      <div className="w-2/3 bg-white dark:bg-zinc-900 overflow-y-auto custom-scrollbar p-2">
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                            Models
                          </span>
                          <button 
                            onClick={() => {
                              setShowModelDropdown(false);
                              navigate('/settings/llm');
                            }}
                            className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                          >
                            <Settings2 className="w-3 h-3" /> Config
                          </button>
                        </div>
                        <div className="space-y-1 mt-1">
                          {activeChannel?.models.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => {
                                setActiveModel(model.id);
                                setShowModelDropdown(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                                activeModelId === model.id
                                  ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300'
                                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              <span className="text-sm font-medium">{model.name}</span>
                              {activeModelId === model.id && <Check className="w-4 h-4" />}
                            </button>
                          ))}
                          {(!activeChannel?.models || activeChannel.models.length === 0) && (
                            <div className="px-3 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                              No models configured for this channel.
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
              <Settings2 className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          {activeSession?.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8">
              <div className="w-16 h-16 bg-primary-500/10 rounded-2xl flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-primary-500" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">How can I help you today?</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-md mb-8">
                I can write code, answer questions, draft emails, or help you brainstorm ideas using {activeModel?.name || 'the selected model'}.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full">
                {[
                  "Explain quantum computing in simple terms",
                  "Write a Python script to scrape a website",
                  "Help me debug this React component",
                  "Draft a professional email to my boss"
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(suggestion)}
                    className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-left hover:border-primary-500 dark:hover:border-primary-500 hover:ring-1 hover:ring-primary-500 transition-all group shadow-sm"
                  >
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {suggestion}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 space-y-6">
              {activeSession?.messages.map((msg, index) => {
                const isLastMessage = index === activeSession.messages.length - 1;
                const showTyping = isTyping && isLastMessage && msg.role === 'assistant';
                
                return (
                  <ChatMessage
                    key={msg.id || index}
                    role={msg.role}
                    content={msg.content}
                    model={msg.model}
                    timestamp={msg.timestamp}
                    isTyping={showTyping}
                  />
                );
              })}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-gradient-to-t from-zinc-50 via-zinc-50 to-transparent dark:from-zinc-950 dark:via-zinc-950 pt-8">
          <ChatInput onSend={handleSend} isLoading={isTyping} />
        </div>
      </div>
    </div>
  );
}
