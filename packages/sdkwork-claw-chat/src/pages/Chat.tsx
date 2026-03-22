import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
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
import { useQuery } from '@tanstack/react-query';
import { useInstanceStore } from '@sdkwork/claw-core';
import { Input } from '@sdkwork/claw-ui';
import { marketService } from '@sdkwork/claw-market';
import { useLLMStore } from '@sdkwork/claw-settings';
import { type Agent, type Skill } from '@sdkwork/claw-types';
import { ChatInput } from '../components/ChatInput';
import { ChatMessage } from '../components/ChatMessage';
import { ChatSidebar } from '../components/ChatSidebar';
import { agentService, chatService } from '../services';
import { useChatStore } from '../store/useChatStore';

const EMPTY_SKILLS: Skill[] = [];
const EMPTY_AGENTS: Agent[] = [];

export function Chat() {
  const { activeInstanceId } = useInstanceStore();
  const {
    sessions,
    activeSessionId,
    syncState,
    hydrateInstance,
    loadSession,
    createSession,
    addMessage,
    updateMessage,
    flushSession,
  } = useChatStore();
  const { channels, setActiveChannel, setActiveModel, getInstanceConfig } = useLLMStore();
  const { t } = useTranslation();
  const suggestions = [
    t('chat.page.suggestions.quantum'),
    t('chat.page.suggestions.python'),
    t('chat.page.suggestions.react'),
    t('chat.page.suggestions.email'),
  ];

  const [isTyping, setIsTyping] = useState(false);
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [skillSearchQuery, setSkillSearchQuery] = useState('');
  const [agentSearchQuery, setAgentSearchQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();

  const { data: skills = EMPTY_SKILLS } = useQuery<Skill[]>({
    queryKey: ['skills'],
    queryFn: () => marketService.getSkills(),
  });

  const { data: agents = EMPTY_AGENTS } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => agentService.getAgents(),
  });

  const instanceConfig = activeInstanceId ? getInstanceConfig(activeInstanceId) : null;
  const activeChannelId = instanceConfig?.activeChannelId || '';
  const activeModelId = instanceConfig?.activeModelId || '';

  const instanceSessions = sessions.filter(
    (session) =>
      session.instanceId === activeInstanceId || (!session.instanceId && !activeInstanceId),
  );
  const activeSession = instanceSessions.find((session) => session.id === activeSessionId);
  const activeMessages = Array.isArray(activeSession?.messages) ? activeSession.messages : [];

  const activeChannel = channels.find((channel) => channel.id === activeChannelId) || channels[0];
  const activeModel =
    activeChannel?.models.find((model) => model.id === activeModelId) || activeChannel?.models[0];
  const activeSkill = skills.find((skill) => skill.id === selectedSkillId);
  const activeAgent = agents.find((agent) => agent.id === selectedAgentId);

  const filteredSkills = useMemo(() => {
    if (!skillSearchQuery) {
      return skills;
    }

    const lowerQuery = skillSearchQuery.toLowerCase();
    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(lowerQuery) ||
        skill.description.toLowerCase().includes(lowerQuery),
    );
  }, [skills, skillSearchQuery]);

  const filteredAgents = useMemo(() => {
    if (!agentSearchQuery) {
      return agents;
    }

    const lowerQuery = agentSearchQuery.toLowerCase();
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(lowerQuery) ||
        agent.description.toLowerCase().includes(lowerQuery),
    );
  }, [agents, agentSearchQuery]);

  useEffect(() => {
    if (activeChannel?.provider === 'google' && activeModel) {
      chatRef.current = chatService.createChatSession(activeModel.id, activeSkill, activeAgent);
      return;
    }

    chatRef.current = null;
  }, [activeAgent, activeChannel, activeModel, activeSkill]);

  useEffect(() => {
    void hydrateInstance(activeInstanceId);
  }, [activeInstanceId, hydrateInstance]);

  useEffect(() => {
    if (!activeInstanceId) {
      return;
    }

    if (syncState === 'loading') {
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
  }, [
    activeInstanceId,
    activeModel,
    activeSessionId,
    createSession,
    instanceSessions,
    syncState,
  ]);

  useEffect(() => {
    if (!activeInstanceId || !activeSessionId || !activeSession) {
      return;
    }

    if (
      activeSession.messagesHydrated === false ||
      (activeSession.source === 'openclaw' && activeSession.messages.length === 0)
    ) {
      void loadSession(activeSessionId);
    }
  }, [activeInstanceId, activeSession, activeSessionId, loadSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, isTyping]);

  const handleChannelChange = (channelId: string) => {
    if (!activeInstanceId) {
      return;
    }

    const nextChannel = channels.find((channel) => channel.id === channelId);
    if (!nextChannel) {
      return;
    }

    setActiveChannel(activeInstanceId, channelId);

    if (nextChannel.models.length > 0) {
      setActiveModel(activeInstanceId, nextChannel.defaultModelId || nextChannel.models[0].id);
    }
  };

  const handleModelChange = (channelId: string, modelId: string) => {
    if (!activeInstanceId) {
      return;
    }

    if (activeChannel?.id !== channelId) {
      setActiveChannel(activeInstanceId, channelId);
    }

    setActiveModel(activeInstanceId, modelId);
  };

  const handleSend = async (content: string) => {
    if (!activeSessionId || !activeSession || !activeModel || !activeChannel || isTyping) {
      return;
    }

    const sessionId = activeSessionId;
    const requestModel = activeModel;
    const requestChannel = activeChannel;
    const requestSkill = activeSkill;
    const requestAgent = activeAgent;
    const requestChatSession = chatRef.current;

    addMessage(sessionId, {
      role: 'user',
      content,
    });

    setIsTyping(true);

    addMessage(sessionId, {
      role: 'assistant',
      content: '',
      model: requestModel.name,
    });

    try {
      abortControllerRef.current = new AbortController();
      let fullContent = '';
      const stream = chatService.sendMessageStream(
        requestChatSession,
        content,
        {
          id: requestModel.id,
          name: requestModel.name,
          provider: requestChannel.provider,
          icon: requestChannel.icon,
        },
        requestSkill,
        requestAgent,
        abortControllerRef.current.signal,
        {
          instanceId: activeInstanceId,
          session: activeSession,
        },
      );

      for await (const chunk of stream) {
        fullContent += chunk;
        const currentSession = useChatStore
          .getState()
          .sessions.find((session) => session.id === sessionId);

        if (!currentSession) {
          continue;
        }

        const currentMessages = Array.isArray(currentSession.messages)
          ? currentSession.messages
          : [];
        const lastMessage = currentMessages[currentMessages.length - 1];
        if (lastMessage?.role === 'assistant') {
          updateMessage(sessionId, lastMessage.id, fullContent);
        }
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return;
      }

      console.error('Chat error:', error);
      const currentSession = useChatStore
        .getState()
        .sessions.find((session) => session.id === sessionId);

      if (currentSession) {
        const currentMessages = Array.isArray(currentSession.messages)
          ? currentSession.messages
          : [];
        const lastMessage = currentMessages[currentMessages.length - 1];
        if (lastMessage?.role === 'assistant') {
          updateMessage(sessionId, lastMessage.id, t('chat.page.errorResponse'));
        }
      }
    } finally {
      setIsTyping(false);
      abortControllerRef.current = null;
      void flushSession(sessionId);
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const renderContent = () => {
    if (!activeInstanceId) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center md:p-10">
          <AlertCircle className="mb-4 h-12 w-12 text-zinc-400" />
          <h2 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {t('chat.page.noInstanceTitle')}
          </h2>
          <p className="mb-6 text-zinc-500 dark:text-zinc-400">
            {t('chat.page.noInstanceDescription')}
          </p>
          <button
            onClick={() => navigate('/instances')}
            className="rounded-xl bg-primary-600 px-6 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
          >
            {t('chat.page.manageInstances')}
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
                  setShowAgentDropdown((current) => !current);
                  setShowSkillDropdown(false);
                }}
                className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                <UserCircle className="h-4 w-4 text-primary-500" />
                <span>{activeAgent?.name || t('chat.page.selectAgent')}</span>
                <ChevronDown className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              </button>

              <AnimatePresence>
                {showAgentDropdown ? (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowAgentDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full z-50 mt-2 flex max-h-[360px] w-64 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="border-b border-zinc-100 bg-zinc-50/50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-500">
                        {t('chat.page.availableAgents')}
                      </div>
                      <div className="border-b border-zinc-100 p-2 dark:border-zinc-800">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                          <Input
                            type="text"
                            placeholder={t('chat.page.searchAgentsPlaceholder')}
                            value={agentSearchQuery}
                            onChange={(event) => setAgentSearchQuery(event.target.value)}
                            className="rounded-lg border-0 bg-zinc-100 py-1.5 pl-9 pr-3 shadow-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-0 dark:bg-zinc-800"
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
                          <span className="text-sm font-medium">{t('chat.page.noneDefault')}</span>
                          {selectedAgentId === null ? <Check className="h-4 w-4" /> : null}
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
                            {selectedAgentId === agent.id ? (
                              <Check className="h-4 w-4 shrink-0" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setShowSkillDropdown((current) => !current);
                  setShowAgentDropdown(false);
                }}
                className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                <Package className="h-4 w-4 text-primary-500" />
                <span>{activeSkill?.name || t('chat.page.selectSkill')}</span>
                <ChevronDown className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              </button>

              <AnimatePresence>
                {showSkillDropdown ? (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSkillDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full z-50 mt-2 flex max-h-[360px] w-64 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="border-b border-zinc-100 bg-zinc-50/50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-500">
                        {t('chat.page.availableSkills')}
                      </div>
                      <div className="border-b border-zinc-100 p-2 dark:border-zinc-800">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                          <Input
                            type="text"
                            placeholder={t('chat.page.searchSkillsPlaceholder')}
                            value={skillSearchQuery}
                            onChange={(event) => setSkillSearchQuery(event.target.value)}
                            className="rounded-lg border-0 bg-zinc-100 py-1.5 pl-9 pr-3 shadow-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-0 dark:bg-zinc-800"
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
                          <span className="text-sm font-medium">
                            {t('chat.page.noneGeneralChat')}
                          </span>
                          {selectedSkillId === null ? <Check className="h-4 w-4" /> : null}
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
                            {selectedSkillId === skill.id ? (
                              <Check className="h-4 w-4 shrink-0" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                ) : null}
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

        <div className="relative flex flex-1 flex-col overflow-y-auto scrollbar-hide scroll-smooth">
          {activeMessages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8">
              <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-primary-500/10 shadow-inner">
                <Sparkles className="h-10 w-10 text-primary-500" />
              </div>
              <h2 className="mb-3 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {t('chat.page.emptyTitle')}
              </h2>
              <p className="mb-10 max-w-md text-center text-lg text-zinc-500 dark:text-zinc-400">
                {activeSkill
                  ? t('chat.page.emptyWithSkill', {
                      skill: activeSkill.name,
                      category: activeSkill.category.toLowerCase(),
                      model:
                        activeModel?.name || t('chat.page.selectedModelFallback'),
                    })
                  : t('chat.page.emptyDefault', {
                      model:
                        activeModel?.name || t('chat.page.selectedModelFallback'),
                    })}
              </p>

              <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
                {suggestions.map((suggestion) => (
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
            <div className="flex-1 space-y-6 py-8 pb-40">
              {activeMessages.map((message, index) => {
                const isLastMessage = index === activeMessages.length - 1;
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

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-zinc-50 via-zinc-50/90 to-transparent p-4 pb-6 pt-12 dark:from-zinc-950 dark:via-zinc-950/90 dark:to-transparent">
          <div className="pointer-events-auto mx-auto max-w-4xl">
            <ChatInput
              onSend={handleSend}
              isLoading={isTyping}
              onStop={handleStop}
              channels={channels}
              activeChannel={activeChannel}
              activeModel={activeModel}
              onChannelChange={handleChannelChange}
              onModelChange={handleModelChange}
              onOpenModelConfig={() => navigate('/settings/llm')}
            />
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
