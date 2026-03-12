import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Package,
  Search,
  Settings2,
  Sparkles,
  UserCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  marketService,
  useChatStore,
  useInstanceStore,
  useLLMStore,
} from '@sdkwork/claw-studio-business';
import type { Skill } from '@sdkwork/claw-studio-domain';
import { ChatSidebar } from '../../components/chat/ChatSidebar';
import { ChatMessage } from '../../components/chat/ChatMessage';
import { ChatInput } from '../../components/chat/ChatInput';
import { agentService, chatService, type Agent } from '../../services';

export function Chat() {
  const { activeInstanceId } = useInstanceStore();
  const { sessions, activeSessionId, createSession, addMessage, updateMessage } = useChatStore();
  const { channels, setActiveChannel, setActiveModel, getInstanceConfig } = useLLMStore();

  const [isTyping, setIsTyping] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [skillSearchQuery, setSkillSearchQuery] = useState('');
  const [agentSearchQuery, setAgentSearchQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);
  const navigate = useNavigate();

  const { data: skills = [] } = useQuery<Skill[]>({
    queryKey: ['skills'],
    queryFn: () => marketService.getSkills(),
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => agentService.getAgents(),
  });

  const instanceConfig = activeInstanceId ? getInstanceConfig(activeInstanceId) : null;
  const activeChannelId = instanceConfig?.activeChannelId ?? '';
  const activeModelId = instanceConfig?.activeModelId ?? '';

  const instanceSessions = sessions.filter(
    (session) =>
      session.instanceId === activeInstanceId || (!session.instanceId && !activeInstanceId),
  );
  const activeSession = instanceSessions.find((session) => session.id === activeSessionId);

  const activeChannel = channels.find((channel) => channel.id === activeChannelId) ?? channels[0];
  const activeModel =
    activeChannel?.models.find((model) => model.id === activeModelId) ?? activeChannel?.models[0];
  const activeSkill = skills.find((skill) => skill.id === selectedSkillId);
  const activeAgent = agents.find((agent) => agent.id === selectedAgentId);

  const filteredSkills = skillSearchQuery
    ? skills.filter((skill) => {
        const query = skillSearchQuery.toLowerCase();
        return (
          skill.name.toLowerCase().includes(query) ||
          skill.description.toLowerCase().includes(query)
        );
      })
    : skills;

  const filteredAgents = agentSearchQuery
    ? agents.filter((agent) => {
        const query = agentSearchQuery.toLowerCase();
        return (
          agent.name.toLowerCase().includes(query) ||
          agent.description.toLowerCase().includes(query)
        );
      })
    : agents;

  useEffect(() => {
    if (activeChannel?.provider === 'google' && activeModel) {
      chatRef.current = chatService.createChatSession(activeModel.id, activeSkill, activeAgent);
      return;
    }

    chatRef.current = null;
  }, [activeAgent, activeChannel, activeModel, activeSkill]);

  useEffect(() => {
    if (!activeInstanceId) {
      return;
    }

    if (!activeSessionId && instanceSessions.length === 0 && activeModel) {
      createSession(activeModel.name, activeInstanceId);
      return;
    }

    if (!activeSessionId && instanceSessions.length > 0) {
      useChatStore.getState().setActiveSession(instanceSessions[0].id);
      return;
    }

    if (activeSessionId && !instanceSessions.find((session) => session.id === activeSessionId)) {
      if (instanceSessions.length > 0) {
        useChatStore.getState().setActiveSession(instanceSessions[0].id);
      } else if (activeModel) {
        createSession(activeModel.name, activeInstanceId);
      }
    }
  }, [activeInstanceId, activeModel, activeSessionId, createSession, instanceSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isTyping]);

  const handleSend = async (content: string) => {
    if (!activeSessionId || !activeModel || !activeChannel) {
      return;
    }

    addMessage(activeSessionId, {
      role: 'user',
      content,
    });

    setIsTyping(true);

    addMessage(activeSessionId, {
      role: 'assistant',
      content: '',
      model: activeModel.name,
    });

    try {
      let fullContent = '';
      const stream = chatService.sendMessageStream(
        chatRef.current,
        content,
        {
          id: activeModel.id,
          name: activeModel.name,
          provider: activeChannel.provider,
          icon: activeChannel.icon,
        },
        activeSkill,
        activeAgent,
      );

      for await (const chunk of stream) {
        fullContent += chunk;
        const currentSession = useChatStore
          .getState()
          .sessions.find((session) => session.id === activeSessionId);

        if (!currentSession) {
          continue;
        }

        const lastMessage = currentSession.messages[currentSession.messages.length - 1];
        if (lastMessage?.role === 'assistant') {
          updateMessage(activeSessionId, lastMessage.id, fullContent);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const currentSession = useChatStore
        .getState()
        .sessions.find((session) => session.id === activeSessionId);

      if (currentSession) {
        const lastMessage = currentSession.messages[currentSession.messages.length - 1];
        if (lastMessage?.role === 'assistant') {
          updateMessage(
            activeSessionId,
            lastMessage.id,
            'Sorry, I encountered an error while processing your request. Please check your API key or internet connection.',
          );
        }
      }
    } finally {
      setIsTyping(false);
    }
  };

  const renderContent = () => {
    if (!activeInstanceId) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center md:p-10">
          <AlertCircle className="mb-4 h-12 w-12 text-zinc-400" />
          <h2 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            No Instance Selected
          </h2>
          <p className="mb-6 text-zinc-500 dark:text-zinc-400">
            Please select an instance from the sidebar to start chatting.
          </p>
          <button
            onClick={() => navigate('/instances')}
            className="rounded-xl bg-primary-600 px-6 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
          >
            Manage Instances
          </button>
        </div>
      );
    }

    return (
      <div className="relative flex h-full flex-1 flex-col">
        <header className="z-10 flex h-16 flex-shrink-0 items-center justify-between border-b border-zinc-200 bg-white/80 px-6 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => {
                  setShowModelDropdown((current) => !current);
                  setShowSkillDropdown(false);
                  setShowAgentDropdown(false);
                }}
                className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                <span>{activeChannel?.icon}</span>
                <span>{activeModel?.name ?? 'Select Model'}</span>
                <ChevronDown className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              </button>

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
                      className="absolute left-0 top-full z-50 mt-2 flex h-[360px] w-[500px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="w-1/3 overflow-y-auto border-r border-zinc-100 bg-zinc-50/50 p-2 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          Channels
                        </div>
                        <div className="mt-1 space-y-1">
                          {channels.map((channel) => (
                            <button
                              key={channel.id}
                              onClick={() => {
                                if (!activeInstanceId) {
                                  return;
                                }

                                setActiveChannel(activeInstanceId, channel.id);
                                if (channel.models.length > 0) {
                                  setActiveModel(
                                    activeInstanceId,
                                    channel.defaultModelId ?? channel.models[0].id,
                                  );
                                }
                              }}
                              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                activeChannelId === channel.id
                                  ? 'border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800'
                                  : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                              }`}
                            >
                              <span className="text-lg">{channel.icon}</span>
                              <span
                                className={`truncate text-sm font-medium ${
                                  activeChannelId === channel.id
                                    ? 'text-zinc-900 dark:text-zinc-100'
                                    : 'text-zinc-600 dark:text-zinc-400'
                                }`}
                              >
                                {channel.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="w-2/3 overflow-y-auto bg-white p-2 dark:bg-zinc-900">
                        <div className="flex items-center justify-between px-3 py-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                            Models
                          </span>
                          <button
                            onClick={() => {
                              setShowModelDropdown(false);
                              navigate('/settings/llm');
                            }}
                            className="flex items-center gap-1 text-xs text-primary-600 hover:underline dark:text-primary-400"
                          >
                            <Settings2 className="h-3 w-3" /> Config
                          </button>
                        </div>
                        <div className="mt-1 space-y-1">
                          {activeChannel?.models.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => {
                                if (!activeInstanceId) {
                                  return;
                                }

                                setActiveModel(activeInstanceId, model.id);
                                setShowModelDropdown(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
                                activeModelId === model.id
                                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                                  : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                              }`}
                            >
                              <span className="text-sm font-medium">{model.name}</span>
                              {activeModelId === model.id && <Check className="h-4 w-4" />}
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

            <div className="relative">
              <button
                onClick={() => {
                  setShowAgentDropdown((current) => !current);
                  setShowModelDropdown(false);
                  setShowSkillDropdown(false);
                }}
                className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                <UserCircle className="h-4 w-4 text-primary-500" />
                <span>{activeAgent?.name ?? 'Select Agent'}</span>
                <ChevronDown className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              </button>

              <AnimatePresence>
                {showAgentDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowAgentDropdown(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full z-50 mt-2 flex max-h-[360px] w-64 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="border-b border-zinc-100 bg-zinc-50/50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-500">
                        Available Agents
                      </div>
                      <div className="border-b border-zinc-100 p-2 dark:border-zinc-800">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                          <input
                            type="text"
                            placeholder="Search agents..."
                            value={agentSearchQuery}
                            onChange={(event) => setAgentSearchQuery(event.target.value)}
                            className="w-full rounded-lg bg-zinc-100 py-1.5 pl-9 pr-3 text-sm text-zinc-900 placeholder-zinc-500 focus:ring-2 focus:ring-primary-500 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                        </div>
                      </div>
                      <div className="custom-scrollbar space-y-1 overflow-y-auto p-2">
                        <button
                          onClick={() => {
                            setSelectedAgentId(null);
                            setShowAgentDropdown(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
                            selectedAgentId === null
                              ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                              : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <span className="text-sm font-medium">None (Default)</span>
                          {selectedAgentId === null && <Check className="h-4 w-4" />}
                        </button>

                        {filteredAgents.map((agent) => (
                          <button
                            key={agent.id}
                            onClick={() => {
                              setSelectedAgentId(agent.id);
                              setShowAgentDropdown(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
                              selectedAgentId === agent.id
                                ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                                : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-100 text-sm dark:bg-zinc-800">
                                {agent.avatar}
                              </div>
                              <span className="truncate text-sm font-medium">{agent.name}</span>
                            </div>
                            {selectedAgentId === agent.id && (
                              <Check className="h-4 w-4 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setShowSkillDropdown((current) => !current);
                  setShowModelDropdown(false);
                  setShowAgentDropdown(false);
                }}
                className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                <Package className="h-4 w-4 text-primary-500" />
                <span>{activeSkill?.name ?? 'Select Skill'}</span>
                <ChevronDown className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              </button>

              <AnimatePresence>
                {showSkillDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowSkillDropdown(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full z-50 mt-2 flex max-h-[360px] w-64 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="border-b border-zinc-100 bg-zinc-50/50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-500">
                        Available Skills
                      </div>
                      <div className="border-b border-zinc-100 p-2 dark:border-zinc-800">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                          <input
                            type="text"
                            placeholder="Search skills..."
                            value={skillSearchQuery}
                            onChange={(event) => setSkillSearchQuery(event.target.value)}
                            className="w-full rounded-lg bg-zinc-100 py-1.5 pl-9 pr-3 text-sm text-zinc-900 placeholder-zinc-500 focus:ring-2 focus:ring-primary-500 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                        </div>
                      </div>
                      <div className="custom-scrollbar space-y-1 overflow-y-auto p-2">
                        <button
                          onClick={() => {
                            setSelectedSkillId(null);
                            setShowSkillDropdown(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
                            selectedSkillId === null
                              ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                              : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <span className="text-sm font-medium">None (General Chat)</span>
                          {selectedSkillId === null && <Check className="h-4 w-4" />}
                        </button>

                        {filteredSkills.map((skill) => (
                          <button
                            key={skill.id}
                            onClick={() => {
                              setSelectedSkillId(skill.id);
                              setShowSkillDropdown(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
                              selectedSkillId === skill.id
                                ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                                : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-100 text-[10px] font-bold text-primary-500 dark:bg-zinc-800">
                                {skill.name.substring(0, 2).toUpperCase()}
                              </div>
                              <span className="truncate text-sm font-medium">{skill.name}</span>
                            </div>
                            {selectedSkillId === skill.id && (
                              <Check className="h-4 w-4 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/settings/llm')}
              className="rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Settings2 className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="scrollbar-hide flex-1 overflow-y-auto scroll-smooth pb-32">
          {activeSession?.messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8">
              <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-primary-500/10 shadow-inner">
                <Sparkles className="h-10 w-10 text-primary-500" />
              </div>
              <h2 className="mb-3 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                How can I help you today?
              </h2>
              <p className="mb-10 max-w-md text-center text-lg text-zinc-500 dark:text-zinc-400">
                {activeSkill
                  ? `I am equipped with the "${activeSkill.name}" skill. I can help you with tasks related to ${activeSkill.category.toLowerCase()} using ${activeModel?.name ?? 'the selected model'}.`
                  : `I can write code, answer questions, draft emails, or help you brainstorm ideas using ${activeModel?.name ?? 'the selected model'}.`}
              </p>

              <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  'Explain quantum computing in simple terms',
                  'Write a Python script to scrape a website',
                  'Help me debug this React component',
                  'Draft a professional email to my boss',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    className="group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-5 text-left transition-all duration-300 hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/5 dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:border-primary-500/50"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 to-primary-500/0 transition-colors duration-500 group-hover:from-primary-500/5 group-hover:to-transparent" />
                    <p className="relative z-10 text-[15px] font-medium text-zinc-700 transition-colors group-hover:text-primary-600 dark:text-zinc-300 dark:group-hover:text-primary-400">
                      {suggestion}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 py-8">
              {activeSession?.messages.map((message, index) => {
                const isLastMessage = index === activeSession.messages.length - 1;
                const showTyping = isTyping && isLastMessage && message.role === 'assistant';

                return (
                  <ChatMessage
                    key={message.id || index}
                    role={message.role}
                    content={message.content}
                    model={message.model}
                    timestamp={message.timestamp}
                    isTyping={showTyping}
                  />
                );
              })}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-zinc-50 via-zinc-50 to-transparent p-4 pb-6 pt-12 dark:from-zinc-950 dark:via-zinc-950">
          <div className="mx-auto max-w-4xl">
            <ChatInput onSend={handleSend} isLoading={isTyping} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <ChatSidebar />
      {renderContent()}
    </div>
  );
}
