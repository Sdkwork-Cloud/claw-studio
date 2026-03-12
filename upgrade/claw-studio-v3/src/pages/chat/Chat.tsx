import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, Settings2, ChevronDown, Check, Package, Cpu, Search, UserCircle, AlertCircle } from 'lucide-react';
import { ChatSidebar } from '../../components/chat/ChatSidebar';
import { ChatMessage } from '../../components/chat/ChatMessage';
import { ChatInput } from '../../components/chat/ChatInput';
import { useChatStore } from '../../store/useChatStore';
import { useLLMStore } from '../../store/useLLMStore';
import { useInstanceStore } from '../../store/useInstanceStore';
import { motion, AnimatePresence } from 'motion/react';
import { chatService } from '../../services/chatService';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { marketService } from '../../services/marketService';
import { agentService } from '../../services/agentService';
import { Skill, Agent } from '../../types';


export function Chat() {
  const { activeInstanceId } = useInstanceStore();
  const { sessions, activeSessionId, createSession, addMessage, updateMessage } = useChatStore();
  const { channels, setActiveChannel, setActiveModel, getInstanceConfig } = useLLMStore();
  
  const instanceConfig = activeInstanceId ? getInstanceConfig(activeInstanceId) : null;
  const activeChannelId = instanceConfig?.activeChannelId || '';
  const activeModelId = instanceConfig?.activeModelId || '';

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

  const instanceSessions = sessions.filter(s => s.instanceId === activeInstanceId || (!s.instanceId && !activeInstanceId));
  const activeSession = instanceSessions.find((s) => s.id === activeSessionId);
  
  const activeChannel = channels.find(c => c.id === activeChannelId) || channels[0];
  const activeModel = activeChannel?.models.find(m => m.id === activeModelId) || activeChannel?.models[0];
  const activeSkill = skills.find(s => s.id === selectedSkillId);
  const activeAgent = agents.find(a => a.id === selectedAgentId);

  const filteredSkills = useMemo(() => {
    if (!skillSearchQuery) return skills;
    const lowerQuery = skillSearchQuery.toLowerCase();
    return skills.filter(s => s.name.toLowerCase().includes(lowerQuery) || s.description.toLowerCase().includes(lowerQuery));
  }, [skills, skillSearchQuery]);

  const filteredAgents = useMemo(() => {
    if (!agentSearchQuery) return agents;
    const lowerQuery = agentSearchQuery.toLowerCase();
    return agents.filter(a => a.name.toLowerCase().includes(lowerQuery) || a.description.toLowerCase().includes(lowerQuery));
  }, [agents, agentSearchQuery]);

  // Initialize Gemini Chat (or others if implemented in chatService)
  useEffect(() => {
    if (activeChannel?.provider === 'google' && activeModel) {
      // In a real app, we'd pass agent context as well
      chatRef.current = chatService.createChatSession(activeModel.id, activeSkill, activeAgent);
    } else {
      chatRef.current = null; // Local models simulated for now
    }
  }, [activeChannel, activeModel, activeSkill, activeAgent]);

  // Auto-create session if none exists
  useEffect(() => {
    if (!activeSessionId && instanceSessions.length === 0 && activeModel) {
      createSession(activeModel.name, activeInstanceId || undefined);
    } else if (!activeSessionId && instanceSessions.length > 0) {
      useChatStore.getState().setActiveSession(instanceSessions[0].id);
    } else if (activeSessionId && !instanceSessions.find(s => s.id === activeSessionId)) {
      if (instanceSessions.length > 0) {
        useChatStore.getState().setActiveSession(instanceSessions[0].id);
      } else if (activeModel) {
        createSession(activeModel.name, activeInstanceId || undefined);
      }
    }
  }, [activeSessionId, instanceSessions, createSession, activeModel, activeInstanceId]);

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
      // We pass the channel, model, skill, and agent info to chatService
      const stream = chatService.sendMessageStream(chatRef.current, content, {
        id: activeModel.id,
        name: activeModel.name,
        provider: activeChannel.provider,
        icon: activeChannel.icon
      }, activeSkill, activeAgent);
      
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

  const renderContent = () => {
    if (!activeInstanceId) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 text-center">
          <AlertCircle className="w-12 h-12 text-zinc-400 mb-4" />
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">No Instance Selected</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6">Please select an instance from the sidebar to start chatting.</p>
          <button 
            onClick={() => navigate('/instances')}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl font-bold transition-colors shadow-sm"
          >
            Manage Instances
          </button>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col relative h-full">
        {/* Header */}
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl flex items-center justify-between px-6 flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => {
                  setShowModelDropdown(!showModelDropdown);
                  setShowSkillDropdown(false);
                }}
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
                                if (activeInstanceId) {
                                  setActiveChannel(activeInstanceId, channel.id);
                                  if (channel.models.length > 0) {
                                    setActiveModel(activeInstanceId, channel.models[0].id);
                                  }
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
                                if (activeInstanceId) {
                                  setActiveModel(activeInstanceId, model.id);
                                  setShowModelDropdown(false);
                                }
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

            {/* Agent Dropdown */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowAgentDropdown(!showAgentDropdown);
                  setShowModelDropdown(false);
                  setShowSkillDropdown(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-sm font-medium text-zinc-900 dark:text-zinc-100 transition-colors"
              >
                <UserCircle className="w-4 h-4 text-primary-500" />
                <span>{activeAgent?.name || 'Select Agent'}</span>
                <ChevronDown className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
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
                      className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[360px] flex flex-col"
                    >
                      <div className="px-3 py-2 text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                        Available Agents
                      </div>
                      <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                          <input
                            type="text"
                            placeholder="Search agents..."
                            value={agentSearchQuery}
                            onChange={(e) => setAgentSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500"
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto custom-scrollbar p-2 space-y-1">
                        <button
                          onClick={() => {
                            setSelectedAgentId(null);
                            setShowAgentDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                            selectedAgentId === null
                              ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          <span className="text-sm font-medium">None (Default)</span>
                          {selectedAgentId === null && <Check className="w-4 h-4" />}
                        </button>
                        
                        {filteredAgents.map((agent) => (
                          <button
                            key={agent.id}
                            onClick={() => {
                              setSelectedAgentId(agent.id);
                              setShowAgentDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                              selectedAgentId === agent.id
                                ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300'
                                : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div className="w-6 h-6 bg-zinc-100 dark:bg-zinc-800 rounded flex items-center justify-center text-sm shrink-0">
                                {agent.avatar}
                              </div>
                              <span className="text-sm font-medium truncate">{agent.name}</span>
                            </div>
                            {selectedAgentId === agent.id && <Check className="w-4 h-4 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Skill Dropdown */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowSkillDropdown(!showSkillDropdown);
                  setShowModelDropdown(false);
                  setShowAgentDropdown(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-sm font-medium text-zinc-900 dark:text-zinc-100 transition-colors"
              >
                <Package className="w-4 h-4 text-primary-500" />
                <span>{activeSkill?.name || 'Select Skill'}</span>
                <ChevronDown className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
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
                      className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[360px] flex flex-col"
                    >
                      <div className="px-3 py-2 text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                        Available Skills
                      </div>
                      <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                          <input
                            type="text"
                            placeholder="Search skills..."
                            value={skillSearchQuery}
                            onChange={(e) => setSkillSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500"
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto custom-scrollbar p-2 space-y-1">
                        <button
                          onClick={() => {
                            setSelectedSkillId(null);
                            setShowSkillDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                            selectedSkillId === null
                              ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          <span className="text-sm font-medium">None (General Chat)</span>
                          {selectedSkillId === null && <Check className="w-4 h-4" />}
                        </button>
                        
                        {filteredSkills.map((skill) => (
                          <button
                            key={skill.id}
                            onClick={() => {
                              setSelectedSkillId(skill.id);
                              setShowSkillDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                              selectedSkillId === skill.id
                                ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300'
                                : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div className="w-6 h-6 bg-zinc-100 dark:bg-zinc-800 rounded flex items-center justify-center text-[10px] font-bold text-primary-500 shrink-0">
                                {skill.name.substring(0, 2).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium truncate">{skill.name}</span>
                            </div>
                            {selectedSkillId === skill.id && <Check className="w-4 h-4 shrink-0" />}
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
            <button className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
              <Settings2 className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto scrollbar-hide scroll-smooth pb-32">
          {activeSession?.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8">
              <div className="w-20 h-20 bg-primary-500/10 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner">
                <Sparkles className="w-10 h-10 text-primary-500" />
              </div>
              <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-3 tracking-tight">How can I help you today?</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-md mb-10 text-lg">
                {activeSkill 
                  ? `I am equipped with the "${activeSkill.name}" skill. I can help you with tasks related to ${activeSkill.category.toLowerCase()} using ${activeModel?.name || 'the selected model'}.` 
                  : `I can write code, answer questions, draft emails, or help you brainstorm ideas using ${activeModel?.name || 'the selected model'}.`}
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl w-full">
                {[
                  "Explain quantum computing in simple terms",
                  "Write a Python script to scrape a website",
                  "Help me debug this React component",
                  "Draft a professional email to my boss"
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(suggestion)}
                    className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl text-left hover:border-primary-500/50 dark:hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300 group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 to-primary-500/0 group-hover:from-primary-500/5 group-hover:to-transparent transition-colors duration-500" />
                    <p className="text-[15px] font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors relative z-10">
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
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-zinc-50 via-zinc-50 to-transparent dark:from-zinc-950 dark:via-zinc-950 pt-12 pb-6">
          <div className="max-w-4xl mx-auto">
            <ChatInput onSend={handleSend} isLoading={isTyping} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Chat Sidebar */}
      <ChatSidebar />

      {/* Main Chat Area */}
      {renderContent()}
    </div>
  );
}
