import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown,
  AlertCircle,
  Check,
  ChevronDown,
  Menu,
  Package,
  Search,
  Settings2,
  Sparkles,
  UserCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { clawHubService, settingsService, useInstanceStore, useLLMStore } from '@sdkwork/claw-core';
import { cn, Input } from '@sdkwork/claw-ui';
import { type Agent, type Skill } from '@sdkwork/claw-types';
import { ChatInput } from '../components/ChatInput';
import { ChatMessage } from '../components/ChatMessage';
import { ChatSidebar } from '../components/ChatSidebar';
import {
  agentService,
  composeOutgoingChatText,
  chatService,
  groupChatMessagesForDisplay,
  instanceEffectiveModelCatalogService,
  isChatViewportNearBottom,
  openClawChatAgentCatalogService,
  presentChatHeader,
  presentChatMessageGroupFooter,
  resolveChatAutoScrollDecision,
  resolveChatBootstrapAction,
  resolveChatMessageRenderKey,
  resolveChatSendSessionId,
  resolveChatSessionViewState,
  resolveGatewayVisibleSessionSyncTarget,
  resolveNewChatSessionModel,
  resolveOpenClawDraftSessionId,
} from '../services';
import {
  shouldLoadChatDirectAgents,
  shouldLoadChatSkills,
} from './chatHydrationPolicy';
import { resolveChatGenerationViewState } from './chatGenerationViewPolicy';
import type { ChatComposerSubmitPayload } from '../types/index.ts';
import { useChatStore } from '../store/useChatStore';

const EMPTY_SKILLS: Skill[] = [];
const EMPTY_AGENTS: Agent[] = [];

function getScopeKey(instanceId: string | null | undefined) {
  return instanceId ?? '__direct__';
}

function createFallbackGatewayChannel(modelId: string) {
  const [providerId, rawModelId] = modelId.includes('/')
    ? modelId.split('/', 2)
    : ['openclaw', modelId];
  const label = rawModelId || modelId;

  return {
    id: providerId || 'openclaw',
    name: providerId ? providerId.charAt(0).toUpperCase() + providerId.slice(1) : 'OpenClaw',
    provider: providerId || 'openclaw',
    baseUrl: '',
    apiKey: '',
    icon: 'AI',
    defaultModelId: modelId,
    models: [
      {
        id: modelId,
        name: label,
      },
    ],
  };
}

export function Chat() {
  const [compactModelSelector, setCompactModelSelector] = useState(true);
  const { activeInstanceId } = useInstanceStore();
  const {
    sessions,
    activeSessionIdByInstance,
    syncStateByInstance,
    gatewayConnectionStatusByInstance,
    lastErrorByInstance,
    instanceRouteModeById,
    hydrateInstance,
    createSession,
    addMessage,
    updateMessage,
    flushSession,
    setActiveSession,
    sendGatewayMessage,
    abortSession,
    setGatewaySessionModel,
  } = useChatStore();
  const { setActiveChannel, setActiveModel, getInstanceConfig } = useLLMStore();
  const { t, i18n } = useTranslation();
  const appName = t('common.productName');
  const suggestions = [
    t('chat.page.suggestions.quantum'),
    t('chat.page.suggestions.python'),
    t('chat.page.suggestions.react'),
    t('chat.page.suggestions.email'),
  ];

  const [pendingSendSessionId, setPendingSendSessionId] = useState<string | null>(null);
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [skillSearchQuery, setSkillSearchQuery] = useState('');
  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [composerSurfaceHeight, setComposerSurfaceHeight] = useState(0);

  const messagesScrollContainerRef = useRef<HTMLDivElement>(null);
  const composerSurfaceRef = useRef<HTMLDivElement | null>(null);
  const chatHasAutoScrolledRef = useRef(false);
  const chatUserNearBottomRef = useRef(true);
  const chatScrollRetryTimeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();
  const instanceConfig = activeInstanceId ? getInstanceConfig(activeInstanceId) : null;
  const activeChannelId = instanceConfig?.activeChannelId || '';
  const activeModelId = instanceConfig?.activeModelId || '';
  const scopeKey = getScopeKey(activeInstanceId);
  const activeSessionId = activeSessionIdByInstance[scopeKey] ?? null;
  const syncState = syncStateByInstance[scopeKey] ?? 'idle';
  const routeMode = activeInstanceId ? instanceRouteModeById[activeInstanceId] : 'directLlm';
  const isOpenClawGateway = routeMode === 'instanceOpenClawGatewayWs';
  const gatewayConnectionStatus =
    gatewayConnectionStatusByInstance[scopeKey] ?? (isOpenClawGateway ? 'disconnected' : null);
  const lastError = lastErrorByInstance[scopeKey];
  const shouldLoadSkillCatalog = shouldLoadChatSkills({
    showSkillDropdown,
    selectedSkillId,
  });
  const shouldLoadDirectAgentCatalog = shouldLoadChatDirectAgents({
    activeInstanceId,
    isOpenClawGateway,
    showAgentDropdown,
    selectedAgentId,
  });

  const {
    data: skills = EMPTY_SKILLS,
    isFetching: isSkillsFetching,
  } = useQuery<Skill[]>({
    queryKey: ['skills'],
    enabled: shouldLoadSkillCatalog,
    staleTime: 30_000,
    queryFn: () => clawHubService.listSkills(),
  });

  const {
    data: agents = EMPTY_AGENTS,
    isFetched: isDirectAgentsFetched,
    isFetching: isDirectAgentsFetching,
  } = useQuery<Agent[]>({
    queryKey: ['agents', activeInstanceId],
    enabled: shouldLoadDirectAgentCatalog,
    staleTime: 30_000,
    queryFn: () => agentService.getAgents(activeInstanceId ?? undefined),
  });
  const {
    data: openClawAgentCatalog,
    isFetched: isOpenClawAgentCatalogFetched,
  } = useQuery({
    queryKey: ['chat', 'openclaw-agent-catalog', activeInstanceId],
    enabled: Boolean(activeInstanceId),
    staleTime: 10_000,
    queryFn: async () => {
      if (!activeInstanceId) {
        return {
          agents: [],
          defaultAgentId: null,
        };
      }

      return openClawChatAgentCatalogService.getCatalog(activeInstanceId);
    },
  });
  const visibleAgents =
    isOpenClawGateway ? openClawAgentCatalog?.agents ?? EMPTY_AGENTS : agents;
  const defaultOpenClawAgentId =
    isOpenClawGateway ? openClawAgentCatalog?.defaultAgentId ?? null : null;
  const effectiveGatewayAgentId =
    isOpenClawGateway ? selectedAgentId || defaultOpenClawAgentId : selectedAgentId;

  const instanceSessions = sessions.filter(
    (session) =>
      session.instanceId === activeInstanceId || (!session.instanceId && !activeInstanceId),
  );
  const {
    selectableSessions: selectableInstanceSessions,
    effectiveActiveSessionId,
  } = useMemo(
    () =>
      resolveChatSessionViewState({
        sessions: instanceSessions,
        activeSessionId,
        isOpenClawGateway,
        openClawAgentId: effectiveGatewayAgentId,
      }),
    [activeSessionId, effectiveGatewayAgentId, instanceSessions, isOpenClawGateway],
  );
  const activeSession = selectableInstanceSessions.find(
    (session) => session.id === effectiveActiveSessionId,
  );
  const runningSessionId = isOpenClawGateway
    ? instanceSessions.find((session) => Boolean(session.runId))?.id ?? null
    : null;
  const sessionSelectedModelId =
    isOpenClawGateway && activeSession
      ? activeSession.model || activeSession.defaultModel || null
      : null;

  const {
    data: modelCatalog,
    error: modelCatalogError,
  } = useQuery({
    queryKey: ['chat', 'instance-model-catalog', activeInstanceId, effectiveGatewayAgentId],
    enabled: Boolean(activeInstanceId),
    staleTime: 10_000,
    queryFn: async () => {
      if (!activeInstanceId) {
        return { channels: [] };
      }

      return instanceEffectiveModelCatalogService.getCatalog(
        activeInstanceId,
        isOpenClawGateway ? effectiveGatewayAgentId : undefined,
      );
    },
  });
  const catalogChannels = modelCatalog?.channels ?? [];
  const channels = useMemo(() => {
    if (catalogChannels.length > 0) {
      return catalogChannels;
    }

    if (sessionSelectedModelId) {
      return [createFallbackGatewayChannel(sessionSelectedModelId)];
    }

    return [];
  }, [catalogChannels, sessionSelectedModelId]);
  const activeMessages = Array.isArray(activeSession?.messages) ? activeSession.messages : [];
  const activeMessageGroups = useMemo(
    () => groupChatMessagesForDisplay(activeMessages),
    [activeMessages],
  );
  const gatewayStreaming = isOpenClawGateway ? Boolean(activeSession?.runId) : false;
  const { isActiveSessionGenerating, isComposerLocked, stopSessionId } = resolveChatGenerationViewState({
    effectiveActiveSessionId,
    pendingSendSessionId,
    activeSessionRunId: activeSession?.runId ?? null,
    runningSessionId,
  });
  const isBusy = isComposerLocked;

  const preferredModelId = sessionSelectedModelId || activeModelId || '';
  const channelFromPreferredModel = preferredModelId
    ? channels.find((channel) => channel.models.some((model) => model.id === preferredModelId))
    : undefined;
  const activeChannel = channelFromPreferredModel || channels.find((channel) => channel.id === activeChannelId) || channels[0];
  const activeModel =
    (preferredModelId
      ? activeChannel?.models.find((model) => model.id === preferredModelId) ||
        channels.flatMap((channel) => channel.models).find((model) => model.id === preferredModelId)
      : undefined) ||
    activeChannel?.models.find((model) => model.id === activeModelId) ||
    activeChannel?.models[0];
  const newSessionModel = resolveNewChatSessionModel({
    isOpenClawGateway,
    activeModelId: activeModel?.id,
    activeModelName: activeModel?.name,
  });
  const activeSkill = skills.find((skill) => skill.id === selectedSkillId);
  const activeAgent = visibleAgents.find((agent) => agent.id === effectiveGatewayAgentId);
  const headerPresentation = useMemo(
    () =>
      presentChatHeader({
        activeSession,
        isOpenClawGateway,
        gatewayConnectionStatus,
        syncState,
        activeAgentName: activeAgent?.name ?? null,
        activeModelName: activeModel?.name ?? null,
        isActiveSessionGenerating,
      }),
    [
      activeAgent?.name,
      activeModel?.name,
      activeSession,
      gatewayConnectionStatus,
      isActiveSessionGenerating,
      isOpenClawGateway,
      syncState,
    ],
  );
  const effectiveLastError =
    lastError ||
    (modelCatalogError instanceof Error ? modelCatalogError.message : undefined);
  const headerStatusLabel = t(`chat.page.headerStatus.${headerPresentation.status}`);
  const headerStatusClassName = cn(
    'inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium',
    headerPresentation.status === 'responding'
      ? 'text-primary-700 dark:text-primary-300'
      : headerPresentation.status === 'connected'
        ? 'text-emerald-700 dark:text-emerald-300'
        : headerPresentation.status === 'reconnecting'
          ? 'text-amber-700 dark:text-amber-300'
          : headerPresentation.status === 'disconnected'
            ? 'text-rose-700 dark:text-rose-300'
            : 'text-zinc-500 dark:text-zinc-400',
  );
  const headerStatusDotClassName = cn(
    'h-1.5 w-1.5 rounded-full',
    headerPresentation.status === 'responding'
      ? 'animate-pulse bg-primary-500 dark:bg-primary-300'
      : headerPresentation.status === 'connected'
        ? 'bg-emerald-500 dark:bg-emerald-300'
        : headerPresentation.status === 'reconnecting'
          ? 'animate-pulse bg-amber-500 dark:bg-amber-300'
          : headerPresentation.status === 'disconnected'
            ? 'bg-rose-500 dark:bg-rose-300'
            : 'bg-zinc-400 dark:bg-zinc-500',
  );
  const hasResolvedVisibleAgents = isOpenClawGateway
    ? !activeInstanceId || isOpenClawAgentCatalogFetched
    : !shouldLoadDirectAgentCatalog || isDirectAgentsFetched;
  const isAgentSelectorLoading =
    showAgentDropdown &&
    (
      (isOpenClawGateway &&
        Boolean(activeInstanceId) &&
        !isOpenClawAgentCatalogFetched &&
        visibleAgents.length === 0) ||
      (!isOpenClawGateway &&
        shouldLoadDirectAgentCatalog &&
        isDirectAgentsFetching &&
        agents.length === 0)
    );
  const isSkillSelectorLoading =
    showSkillDropdown &&
    shouldLoadSkillCatalog &&
    isSkillsFetching &&
    skills.length === 0;

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
      return visibleAgents;
    }

    const lowerQuery = agentSearchQuery.toLowerCase();
    return visibleAgents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(lowerQuery) ||
        agent.description.toLowerCase().includes(lowerQuery),
    );
  }, [visibleAgents, agentSearchQuery]);
  const groupTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        hour: 'numeric',
        minute: '2-digit',
      }),
    [i18n.language],
  );
  const messageListBottomPadding = `calc(${composerSurfaceHeight + 32}px + env(safe-area-inset-bottom))`;
  const emptyStateBottomPadding = `calc(${composerSurfaceHeight + 52}px + env(safe-area-inset-bottom))`;

  useEffect(() => {
    let cancelled = false;

    void settingsService
      .getPreferences()
      .then((preferences) => {
        if (!cancelled) {
          setCompactModelSelector(preferences.general.compactModelSelector);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompactModelSelector(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const composerSurface = composerSurfaceRef.current;
    if (!composerSurface) {
      setComposerSurfaceHeight(0);
      return;
    }

    const updateComposerSurfaceHeight = (height: number) => {
      setComposerSurfaceHeight((current) => (current === height ? current : height));
    };

    updateComposerSurfaceHeight(Math.ceil(composerSurface.getBoundingClientRect().height));

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      updateComposerSurfaceHeight(Math.ceil(entry.contentRect.height));
    });

    resizeObserver.observe(composerSurface);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (
      selectedAgentId &&
      hasResolvedVisibleAgents &&
      !visibleAgents.some((agent) => agent.id === selectedAgentId)
    ) {
      setSelectedAgentId(null);
    }
  }, [hasResolvedVisibleAgents, selectedAgentId, visibleAgents]);

  useEffect(() => {
    void hydrateInstance(activeInstanceId);
  }, [activeInstanceId, hydrateInstance]);

  useEffect(() => {
    if (!activeInstanceId || channels.length === 0 || sessionSelectedModelId) {
      return;
    }

    const nextChannelId = activeChannel?.id || channels[0]?.id;
    const nextModelId =
      activeModel?.id ||
      activeChannel?.defaultModelId ||
      activeChannel?.models[0]?.id;

    if (nextChannelId && nextChannelId !== activeChannelId) {
      setActiveChannel(activeInstanceId, nextChannelId);
    }
    if (nextModelId && nextModelId !== activeModelId) {
      setActiveModel(activeInstanceId, nextModelId);
    }
  }, [
    activeChannel?.defaultModelId,
    activeChannel?.id,
    activeChannel?.models,
    activeChannelId,
    activeInstanceId,
    activeModel?.id,
    activeModelId,
    channels,
    sessionSelectedModelId,
    setActiveChannel,
    setActiveModel,
  ]);

  const lastOpenClawModelScopeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpenClawGateway || !activeInstanceId || sessionSelectedModelId) {
      if (!isOpenClawGateway || !activeInstanceId) {
        lastOpenClawModelScopeRef.current = null;
      }
      return;
    }

    const preferredModelId = modelCatalog?.preferredModelId;
    if (!preferredModelId) {
      return;
    }

    const scopeKey = `${activeInstanceId}:${effectiveGatewayAgentId || 'main'}`;
    if (lastOpenClawModelScopeRef.current === scopeKey) {
      return;
    }
    lastOpenClawModelScopeRef.current = scopeKey;

    const preferredChannel = catalogChannels.find((channel) =>
      channel.models.some((model) => model.id === preferredModelId),
    );
    if (preferredChannel?.id && preferredChannel.id !== activeChannelId) {
      setActiveChannel(activeInstanceId, preferredChannel.id);
    }
    if (preferredModelId !== activeModelId) {
      setActiveModel(activeInstanceId, preferredModelId);
    }
  }, [
    activeChannelId,
    activeInstanceId,
    activeModelId,
    catalogChannels,
    effectiveGatewayAgentId,
    isOpenClawGateway,
    modelCatalog?.preferredModelId,
    sessionSelectedModelId,
    setActiveChannel,
    setActiveModel,
  ]);

  useEffect(() => {
    const bootstrapAction = resolveChatBootstrapAction({
      activeInstanceId,
      routeMode,
      syncState,
      hasActiveModel: Boolean(activeModel),
      activeSessionId: effectiveActiveSessionId,
      sessionIds: selectableInstanceSessions.map((session) => session.id),
    });

    if (bootstrapAction.type === 'create' && activeModel) {
      void createSession(
        isOpenClawGateway ? activeModel.id : activeModel.name,
        activeInstanceId ?? undefined,
      );
      return;
    }

    if (bootstrapAction.type === 'select') {
      void setActiveSession(bootstrapAction.sessionId, activeInstanceId ?? undefined);
    }
  }, [
    activeInstanceId,
    activeModel,
    effectiveActiveSessionId,
    createSession,
    isOpenClawGateway,
    routeMode,
    setActiveSession,
    selectableInstanceSessions,
    syncState,
  ]);

  useEffect(() => {
    if (!activeInstanceId) {
      return;
    }

    const syncTarget = resolveGatewayVisibleSessionSyncTarget({
      isOpenClawGateway,
      activeSessionId,
      effectiveActiveSessionId,
    });
    if (!syncTarget) {
      return;
    }

    void setActiveSession(syncTarget, activeInstanceId);
  }, [
    activeInstanceId,
    activeSessionId,
    effectiveActiveSessionId,
    isOpenClawGateway,
    setActiveSession,
  ]);

  const clearChatScrollRetry = () => {
    if (chatScrollRetryTimeoutRef.current !== null) {
      window.clearTimeout(chatScrollRetryTimeoutRef.current);
      chatScrollRetryTimeoutRef.current = null;
    }
  };

  const scrollChatToLatest = (force = false) => {
    const container = messagesScrollContainerRef.current;
    if (!container) {
      return;
    }

    const decision = resolveChatAutoScrollDecision({
      force,
      hasAutoScrolled: chatHasAutoScrolledRef.current,
      userNearBottom: chatUserNearBottomRef.current,
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop,
      clientHeight: container.clientHeight,
    });
    chatHasAutoScrolledRef.current = decision.nextHasAutoScrolled;

    if (!decision.shouldScroll) {
      setShowJumpToLatest(decision.showJumpToLatest);
      return;
    }

    const applyScroll = (behavior: ScrollBehavior) => {
      const target = messagesScrollContainerRef.current;
      if (!target) {
        return;
      }

      if (typeof target.scrollTo === 'function') {
        target.scrollTo({
          top: target.scrollHeight,
          behavior,
        });
      } else {
        target.scrollTop = target.scrollHeight;
      }

      chatUserNearBottomRef.current = true;
      setShowJumpToLatest(false);
    };

    window.requestAnimationFrame(() => {
      applyScroll('auto');
      clearChatScrollRetry();
      const shouldForceRetry = decision.effectiveForce;
      chatScrollRetryTimeoutRef.current = window.setTimeout(() => {
        const target = messagesScrollContainerRef.current;
        if (!target) {
          return;
        }

        const shouldStickRetry =
          shouldForceRetry ||
          chatUserNearBottomRef.current ||
          isChatViewportNearBottom({
            scrollHeight: target.scrollHeight,
            scrollTop: target.scrollTop,
            clientHeight: target.clientHeight,
          });
        if (!shouldStickRetry) {
          return;
        }

        applyScroll('auto');
      }, decision.effectiveForce ? 150 : 120);
    });
  };

  const jumpToLatest = () => {
    clearChatScrollRetry();
    const target = messagesScrollContainerRef.current;
    if (!target) {
      return;
    }

    if (typeof target.scrollTo === 'function') {
      target.scrollTo({
        top: target.scrollHeight,
        behavior: 'smooth',
      });
    } else {
      target.scrollTop = target.scrollHeight;
    }

    chatHasAutoScrolledRef.current = true;
    chatUserNearBottomRef.current = true;
    setShowJumpToLatest(false);
  };

  useEffect(() => {
    chatHasAutoScrolledRef.current = false;
    chatUserNearBottomRef.current = true;
    setShowJumpToLatest(false);
    clearChatScrollRetry();

    const frame = window.requestAnimationFrame(() => {
      scrollChatToLatest(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [effectiveActiveSessionId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      scrollChatToLatest(false);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activeMessages, composerSurfaceHeight, isBusy]);

  useEffect(() => () => {
    clearChatScrollRetry();
  }, []);

  const handleMessageListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const userNearBottom = isChatViewportNearBottom({
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop,
      clientHeight: container.clientHeight,
    });
    chatUserNearBottomRef.current = userNearBottom;
    if (userNearBottom) {
      setShowJumpToLatest(false);
    }
  };

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
      const nextModelId = nextChannel.defaultModelId || nextChannel.models[0].id;
      setActiveModel(activeInstanceId, nextModelId);

      if (isOpenClawGateway && activeSession) {
        void setGatewaySessionModel({
          instanceId: activeInstanceId,
          sessionId: activeSession.id,
          model: nextModelId,
        }).catch((error) => {
          console.error('Failed to switch OpenClaw session model:', error);
        });
      }
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

    if (isOpenClawGateway && activeSession) {
      void setGatewaySessionModel({
        instanceId: activeInstanceId,
        sessionId: activeSession.id,
        model: modelId,
      }).catch((error) => {
        console.error('Failed to update OpenClaw session model:', error);
      });
    }
  };

  const handleSend = async ({ text, attachments }: ChatComposerSubmitPayload) => {
    const content = text.trim();
    const normalizedAttachments = attachments.map((attachment) => ({ ...attachment }));
    const requestText = composeOutgoingChatText(content, normalizedAttachments);

    if (!activeModel || !activeChannel || isBusy || (activeInstanceId && !routeMode)) {
      return;
    }

    if (!content && normalizedAttachments.length === 0) {
      return;
    }

    let sessionId = resolveChatSendSessionId({
      activeSessionId,
      effectiveActiveSessionId,
      isOpenClawGateway,
    });
    if (!sessionId) {
      if (isOpenClawGateway && activeInstanceId) {
        sessionId = await createSession(
          activeModel.id,
          activeInstanceId,
          {
            openClawAgentId: effectiveGatewayAgentId,
            openClawSessionId: resolveOpenClawDraftSessionId({
              isOpenClawGateway,
              openClawAgentId: effectiveGatewayAgentId,
            }),
          },
        );
      } else {
        sessionId = await createSession(
          activeModel.name,
          activeInstanceId ?? undefined,
        );
      }
    }

    if (!sessionId) {
      return;
    }

    const requestModel = activeModel;
    const requestChannel = activeChannel;
    const requestSkill = activeSkill;
    const requestAgent = activeAgent;

    if (isOpenClawGateway && activeInstanceId) {
      setPendingSendSessionId(sessionId);
      try {
        await sendGatewayMessage({
          instanceId: activeInstanceId,
          sessionId,
          content,
          model: requestModel.id,
          attachments: normalizedAttachments,
          requestText,
        });
      } catch (error) {
        console.error('OpenClaw gateway chat error:', error);
      } finally {
        setPendingSendSessionId((current) => (current === sessionId ? null : current));
      }
      return;
    }

    addMessage(sessionId, {
      role: 'user',
      content,
      attachments: normalizedAttachments,
    });

    setPendingSendSessionId(sessionId);

    addMessage(sessionId, {
      role: 'assistant',
      content: '',
      model: requestModel.name,
    });

    try {
      abortControllerRef.current = new AbortController();
      let fullContent = '';
      const stream = chatService.sendMessageStream(
        null,
        requestText,
        {
          id: requestModel.id,
          name: requestModel.name,
          provider: requestChannel.provider,
          icon: requestChannel.icon,
        },
        requestSkill,
        requestAgent,
        abortControllerRef.current.signal,
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
      setPendingSendSessionId((current) => (current === sessionId ? null : current));
      abortControllerRef.current = null;
      void flushSession(sessionId);
    }
  };

  const handleStop = () => {
    if (isOpenClawGateway && activeInstanceId && stopSessionId) {
      void abortSession({
        instanceId: activeInstanceId,
        sessionId: stopSessionId,
      });
      return;
    }

    abortControllerRef.current?.abort();
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const renderContent = () => {
    if (!activeInstanceId) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center sm:p-8 lg:p-10">
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
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        <header className="z-10 flex min-h-[3.75rem] flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white/80 px-3 py-2.5 backdrop-blur-xl sm:px-4 lg:px-6 dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 lg:hidden"
              aria-label={t('common.expandSidebar')}
              title={t('common.expandSidebar')}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h1
                  className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-base"
                  title={headerPresentation.title}
                >
                  {headerPresentation.title}
                </h1>
                <span className={headerStatusClassName}>
                  <span className={headerStatusDotClassName} />
                  <span>{headerStatusLabel}</span>
                </span>
              </div>
              {headerPresentation.detailItems.length > 0 ? (
                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {headerPresentation.detailItems.map((item, index) => (
                    <React.Fragment key={item}>
                      {index > 0 ? (
                        <span className="text-zinc-300 dark:text-zinc-600">•</span>
                      ) : null}
                      <span className="max-w-[16rem] truncate">{item}</span>
                    </React.Fragment>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex max-w-full items-center gap-2 overflow-x-auto scrollbar-hide">
            <div className="relative min-w-0 max-w-full">
              <button
                onClick={() => {
                  setShowAgentDropdown((current) => !current);
                  setShowSkillDropdown(false);
                }}
                className="flex min-w-0 max-w-full items-center gap-2 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                <UserCircle className="h-4 w-4 text-primary-500" />
                <span className="truncate max-w-[8rem] sm:max-w-[11rem] lg:max-w-[14rem] xl:max-w-[16rem]">
                  {activeAgent?.name || t('chat.page.selectAgent')}
                </span>
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
                      className="absolute left-0 top-full z-50 mt-2 flex max-h-[360px] w-[min(20rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl sm:w-64 dark:border-zinc-800 dark:bg-zinc-900"
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

                        {isAgentSelectorLoading ? (
                          <div className="px-3 py-6 text-sm text-zinc-500 dark:text-zinc-400">
                            {t('common.loading')}
                          </div>
                        ) : filteredAgents.map((agent) => (
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

            <div className="relative min-w-0 max-w-full">
              <button
                onClick={() => {
                  setShowSkillDropdown((current) => !current);
                  setShowAgentDropdown(false);
                }}
                className="flex min-w-0 max-w-full items-center gap-2 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                <Package className="h-4 w-4 text-primary-500" />
                <span className="truncate max-w-[8rem] sm:max-w-[11rem] lg:max-w-[14rem] xl:max-w-[16rem]">
                  {activeSkill?.name || t('chat.page.selectSkill')}
                </span>
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
                      className="absolute left-0 top-full z-50 mt-2 flex max-h-[360px] w-[min(20rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl sm:w-64 dark:border-zinc-800 dark:bg-zinc-900"
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

                        {isSkillSelectorLoading ? (
                          <div className="px-3 py-6 text-sm text-zinc-500 dark:text-zinc-400">
                            {t('common.loading')}
                          </div>
                        ) : filteredSkills.map((skill) => (
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

            <button
              onClick={() => navigate('/settings?tab=api')}
              className="rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Settings2 className="h-5 w-5" />
            </button>
          </div>
        </header>

        {effectiveLastError ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            {effectiveLastError}
          </div>
        ) : null}

        <div
          ref={messagesScrollContainerRef}
          onScroll={handleMessageListScroll}
          className="relative flex flex-1 flex-col overflow-y-auto scrollbar-hide"
        >
          {activeMessages.length === 0 ? (
            <div
              className="flex min-h-full flex-1 items-center justify-center px-3 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10"
              style={{
                paddingBottom: emptyStateBottomPadding,
              }}
            >
              <div className="grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] lg:items-center xl:gap-6">
                <div className="flex flex-col items-center rounded-[2rem] border border-zinc-200/70 bg-white/80 p-6 text-center shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:p-8 lg:items-start lg:p-10 lg:text-left dark:border-zinc-800/70 dark:bg-zinc-900/80 dark:shadow-none">
                  <span className="mb-6 inline-flex items-center rounded-full border border-primary-500/15 bg-primary-500/8 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-primary-600 dark:border-primary-400/20 dark:bg-primary-400/10 dark:text-primary-300">
                    <span className="max-w-full truncate">{appName.toUpperCase()}</span>
                  </span>

                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-primary-500/10 shadow-inner sm:h-20 sm:w-20 sm:rounded-[2rem]">
                    <Sparkles className="h-10 w-10 text-primary-500" />
                  </div>

                  <h2 className="max-w-[18ch] text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl xl:text-[2.15rem] dark:text-zinc-100">
                    {t('chat.page.emptyTitle')}
                  </h2>

                  <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-500 sm:text-base lg:max-w-[34rem] dark:text-zinc-400">
                    {activeSkill
                      ? t('chat.page.emptyWithSkill', {
                          skill: activeSkill.name,
                          category: activeSkill.category.toLowerCase(),
                          appName,
                        })
                      : t('chat.page.emptyDefault', {
                          appName,
                        })}
                  </p>

                  <div className="mt-8 flex w-full flex-wrap justify-center gap-3 lg:justify-start">
                    <div className="inline-flex max-w-full items-center rounded-2xl border border-zinc-200/80 bg-zinc-50/90 px-4 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-300">
                      <span className="truncate">
                        {activeModel?.name || t('chat.page.selectedModelFallback')}
                      </span>
                    </div>
                    {activeSkill ? (
                      <div className="inline-flex max-w-full items-center rounded-2xl border border-primary-500/15 bg-primary-500/8 px-4 py-2 text-sm text-primary-600 dark:border-primary-400/20 dark:bg-primary-400/10 dark:text-primary-300">
                        <span className="truncate">{activeSkill.name}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex min-w-0 items-stretch">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={suggestion}
                        onClick={() =>
                          handleSend({
                            text: suggestion,
                            attachments: [],
                          })
                        }
                        className="group relative flex min-h-[8.5rem] flex-col justify-between overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-white p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/5 dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:border-primary-500/50"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 via-primary-500/0 to-primary-500/0 transition-colors duration-500 group-hover:from-primary-500/5 group-hover:via-primary-500/0 group-hover:to-transparent" />
                        <span className="relative z-10 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="relative z-10 flex min-w-0 items-end justify-between gap-4">
                          <p className="min-w-0 text-[15px] font-medium leading-6 text-zinc-700 transition-colors group-hover:text-primary-600 dark:text-zinc-300 dark:group-hover:text-primary-400">
                            {suggestion}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="flex-1 space-y-4 px-3 py-6 sm:space-y-5 sm:px-4 sm:py-8"
              style={{
                paddingBottom: messageListBottomPadding,
              }}
            >
              {activeMessageGroups.map((group, groupIndex) => {
                const firstItem = group.items[0];
                const groupKey = firstItem
                  ? `group:${groupIndex}:${resolveChatMessageRenderKey({
                      sessionId: effectiveActiveSessionId,
                      message: firstItem.message,
                      index: firstItem.index,
                    })}`
                  : `group:${groupIndex}`;
                const footerPresentation = presentChatMessageGroupFooter({
                  role: group.role,
                  senderLabel: group.senderLabel,
                  messages: group.items.map((item) => ({
                    role: item.message.role,
                    timestamp: item.message.timestamp,
                    model: item.message.model ?? null,
                  })),
                  assistantLabel: t('chat.message.assistant'),
                  userLabel: t('chat.message.you'),
                  toolLabel: t('chat.message.toolOutput'),
                  systemLabel: t('chat.message.system'),
                });
                const footerTimestampLabel =
                  typeof footerPresentation.timestamp === 'number'
                    ? groupTimeFormatter.format(new Date(footerPresentation.timestamp))
                    : null;
                const showGroupFooter =
                  Boolean(footerPresentation.label) ||
                  Boolean(footerTimestampLabel) ||
                  Boolean(footerPresentation.modelLabel);

                return (
                  <div key={groupKey} className="space-y-2 sm:space-y-2.5">
                    {group.items.map((item) => {
                      const message = item.message;
                      const isLastMessage = item.index === activeMessages.length - 1;
                      const showTyping =
                        isActiveSessionGenerating &&
                        isLastMessage &&
                        message.role === 'assistant';

                      return (
                        <ChatMessage
                          key={resolveChatMessageRenderKey({
                            sessionId: effectiveActiveSessionId,
                            message,
                            index: item.index,
                          })}
                          role={message.role}
                          content={message.content}
                          model={message.model}
                          timestamp={message.timestamp}
                          senderLabel={message.senderLabel}
                          isTyping={showTyping}
                          attachments={message.attachments}
                          reasoning={message.reasoning}
                          toolCards={message.toolCards}
                          showHeader={false}
                        />
                      );
                    })}
                    {showGroupFooter ? (
                      <div
                        className={cn(
                          'mx-auto flex w-full max-w-6xl px-4 text-[10px] tracking-normal text-zinc-400 sm:px-6 lg:px-8 dark:text-zinc-500',
                          group.role === 'user'
                            ? 'justify-end'
                            : 'justify-start',
                        )}
                      >
                        <div
                          className={cn(
                            'flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5',
                            group.role === 'user' ? 'justify-end' : null,
                          )}
                        >
                          <span className="truncate font-medium text-zinc-500 dark:text-zinc-400">
                            {footerPresentation.label}
                          </span>
                          {footerTimestampLabel ? (
                            <>
                              <span className="shrink-0 text-zinc-300 dark:text-zinc-600">/</span>
                              <span className="text-zinc-400 dark:text-zinc-500">
                                {footerTimestampLabel}
                              </span>
                            </>
                          ) : null}
                          {footerPresentation.modelLabel ? (
                            <>
                              <span className="shrink-0 text-zinc-300 dark:text-zinc-600">/</span>
                              <span className="truncate text-zinc-400 dark:text-zinc-500">
                                {footerPresentation.modelLabel}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          ref={composerSurfaceRef}
          className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-zinc-50 via-zinc-50/90 to-transparent p-3 pb-4 pt-10 sm:p-4 sm:pb-6 sm:pt-12 dark:from-zinc-950 dark:via-zinc-950/90 dark:to-transparent"
        >
          <div className="pointer-events-auto mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            {showJumpToLatest && activeMessages.length > 0 ? (
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={jumpToLatest}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-lg shadow-zinc-950/5 transition-colors hover:border-primary-400 hover:text-primary-600 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200 dark:hover:border-primary-500 dark:hover:text-primary-300"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  <span>{t('chat.page.jumpToLatest')}</span>
                </button>
              </div>
            ) : null}
            <ChatInput
              onSend={handleSend}
              isLoading={isBusy}
              onStop={handleStop}
              channels={channels}
              activeChannel={activeChannel}
              activeModel={activeModel}
              onChannelChange={handleChannelChange}
              onModelChange={handleModelChange}
              onOpenModelConfig={() => navigate('/settings?tab=api')}
              compactModelSelector={compactModelSelector}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex h-full min-w-0 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div className="hidden h-full w-72 shrink-0 lg:flex xl:w-80">
        <ChatSidebar
          isOpenClawGateway={isOpenClawGateway}
          openClawAgentId={effectiveGatewayAgentId}
          newSessionModel={newSessionModel}
        />
      </div>
      <AnimatePresence>
        {isSidebarOpen ? (
          <>
            <motion.button
              key="chat-sidebar-backdrop"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSidebar}
              className="fixed inset-0 z-40 bg-zinc-950/45 backdrop-blur-sm lg:hidden"
              aria-label={t('common.close')}
            />
            <motion.div
              key="chat-sidebar-drawer"
              initial={{ x: -32, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -32, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 w-[min(22rem,calc(100vw-1rem))] lg:hidden"
            >
              <ChatSidebar
                onSessionSelect={closeSidebar}
                onClose={closeSidebar}
                isOpenClawGateway={isOpenClawGateway}
                openClawAgentId={effectiveGatewayAgentId}
                newSessionModel={newSessionModel}
              />
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
      {renderContent()}
    </div>
  );
}
