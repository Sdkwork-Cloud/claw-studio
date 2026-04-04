import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { clawHubService, settingsService, useInstanceStore, useLLMStore } from '@sdkwork/claw-core';
import { cn } from '@sdkwork/claw-ui';
import { type Agent, type Skill } from '@sdkwork/claw-types';
import { ChatComposerPanel } from '../components/ChatComposerPanel';
import { ChatEmptyState } from '../components/ChatEmptyState';
import { ChatMessage } from '../components/ChatMessage';
import { ChatSessionContextDrawer } from '../components/ChatSessionContextDrawer';
import { ChatSidebar } from '../components/ChatSidebar';
import { ChatTopControls } from '../components/ChatTopControls';
import {
  agentService,
  composeOutgoingChatText,
  chatService,
  groupChatMessagesForDisplay,
  instanceEffectiveModelCatalogService,
  openClawChatAgentCatalogService,
  presentChatHeader,
  presentChatMessageGroupFooter,
  resolveChatBootstrapAction,
  resolveChatConversationBodyState,
  resolveChatMessageRenderKey,
  resolveChatSendSessionId,
  resolveChatSessionViewState,
  resolveGatewayVisibleSessionSyncTarget,
  resolveNewChatSessionModel,
  resolveOpenClawDraftSessionId,
} from '../services';
import { resolveChatPageModelSelection } from '../services';
import {
  shouldLoadChatDirectAgents,
  shouldLoadChatSkills,
} from './chatHydrationPolicy';
import { buildChatAgentOptions, buildChatSkillOptions } from './chatContextOptions';
import { resolveChatGenerationViewState } from './chatGenerationViewPolicy';
import { useChatAutoScroll } from './useChatAutoScroll';
import type { ChatComposerSubmitPayload } from '../types/index.ts';
import { useChatStore } from '../store/useChatStore';

const EMPTY_SKILLS: Skill[] = [];
const EMPTY_AGENTS: Agent[] = [];

function getScopeKey(instanceId: string | null | undefined) {
  return instanceId ?? '__direct__';
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
  const [isSessionContextDrawerOpen, setIsSessionContextDrawerOpen] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    isSessionContextDrawerOpen,
    selectedSkillId,
  });
  const shouldLoadDirectAgentCatalog = shouldLoadChatDirectAgents({
    activeInstanceId,
    isOpenClawGateway,
    isSessionContextDrawerOpen,
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
  const activeMessages = Array.isArray(activeSession?.messages) ? activeSession.messages : [];
  const isGatewayHistoryLoading =
    isOpenClawGateway &&
    activeSession?.transport === 'openclawGateway' &&
    activeSession.historyState === 'loading';
  const conversationBodyState = resolveChatConversationBodyState({
    messageCount: activeMessages.length,
    isGatewayHistoryLoading,
  });
  const activeMessageGroups = useMemo(
    () => groupChatMessagesForDisplay(activeMessages),
    [activeMessages],
  );
  const { isActiveSessionGenerating, isComposerLocked, stopSessionId } = resolveChatGenerationViewState({
    effectiveActiveSessionId,
    pendingSendSessionId,
    activeSessionRunId: activeSession?.runId ?? null,
    runningSessionId,
  });
  const isBusy = isComposerLocked;
  const { channels, activeChannel, activeModel } = resolveChatPageModelSelection({
    catalogChannels,
    sessionSelectedModelId,
    activeChannelId,
    activeModelId,
  });
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
  const hasResolvedVisibleAgents = isOpenClawGateway
    ? !activeInstanceId || isOpenClawAgentCatalogFetched
    : !shouldLoadDirectAgentCatalog || isDirectAgentsFetched;
  const isAgentSelectorLoading =
    isSessionContextDrawerOpen &&
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
    isSessionContextDrawerOpen &&
    shouldLoadSkillCatalog &&
    isSkillsFetching &&
    skills.length === 0;
  const sessionRouteLabel = isOpenClawGateway
    ? t('chat.page.route.gateway')
    : t('chat.page.route.direct');
  const agentOptions = useMemo(
    () =>
      buildChatAgentOptions({
        agents: visibleAgents,
        defaultLabel: t('chat.page.noneDefault'),
        defaultDescription: t(
          isOpenClawGateway
            ? 'chat.page.defaultAgentGatewayDescription'
            : 'chat.page.defaultAgentDirectDescription',
        ),
      }),
    [isOpenClawGateway, t, visibleAgents],
  );
  const skillOptions = useMemo(
    () =>
      buildChatSkillOptions({
        skills,
        defaultLabel: t('chat.page.noneGeneralChat'),
        defaultDescription: t('chat.page.defaultSkillDescription'),
      }),
    [skills, t],
  );
  const groupTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        hour: 'numeric',
        minute: '2-digit',
      }),
    [i18n.language],
  );
  const {
    messagesScrollContainerRef,
    showJumpToLatest,
    handleMessageListScroll,
    jumpToLatest,
  } = useChatAutoScroll({
    sessionId: effectiveActiveSessionId,
    messages: activeMessages,
    isBusy,
  });

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

  const handleOpenSessionSettings = () => {
    setIsSessionContextDrawerOpen(false);
    navigate('/settings?tab=api');
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

    const emptyStateDescription = activeSkill
      ? t('chat.page.emptyWithSkill', {
          skill: activeSkill.name,
          category: activeSkill.category.toLowerCase(),
          appName,
        })
      : t('chat.page.emptyDefault', {
          appName,
        });
    const emptyStateHighlights = [
      activeModel?.name
        ? { label: activeModel.name, tone: 'neutral' as const }
        : null,
      activeAgent?.name
        ? { label: activeAgent.name, tone: 'neutral' as const }
        : null,
      activeSkill?.name
        ? { label: activeSkill.name, tone: 'primary' as const }
        : null,
    ].filter((value): value is { label: string; tone: 'neutral' | 'primary' } => Boolean(value));

    return (
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        <ChatTopControls
          expandSidebarLabel={t('common.expandSidebar')}
          openSessionContextLabel={t('chat.page.openSessionContext')}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onClick={() => setIsSessionContextDrawerOpen(true)}
        />

        {effectiveLastError ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            {effectiveLastError}
          </div>
        ) : null}

        <div
          ref={messagesScrollContainerRef}
          onScroll={handleMessageListScroll}
          className="min-h-0 flex-1 overflow-y-auto scrollbar-hide"
        >
          {conversationBodyState.mode === 'loading' ? (
            <div className="flex min-h-full flex-1 items-center justify-center px-3 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white/88 px-5 py-5 text-center shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/78">
                <LoaderCircle className="h-5 w-5 animate-spin text-zinc-500 dark:text-zinc-400" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {t('common.loading')}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Loading conversation history...
                  </p>
                </div>
              </div>
            </div>
          ) : conversationBodyState.mode === 'empty' ? (
            <div className="flex min-h-full flex-1 items-center justify-center px-3 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
              <ChatEmptyState
                appName={appName}
                title={t('chat.page.emptyTitle')}
                description={emptyStateDescription}
                suggestions={suggestions}
                highlights={emptyStateHighlights}
                onSuggestionSelect={(suggestion) =>
                  void handleSend({
                    text: suggestion,
                    attachments: [],
                  })
                }
              />
            </div>
          ) : (
            <div className="flex-1 space-y-3 px-3 py-4 sm:space-y-4 sm:px-4 sm:py-5">
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
                  <div key={groupKey} className="space-y-1.5 sm:space-y-2">
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

        <div className="flex-shrink-0 bg-gradient-to-t from-zinc-50 via-zinc-50/78 to-transparent px-3 pb-3 pt-1.5 sm:px-4 sm:pb-4 sm:pt-2 lg:px-6 dark:from-zinc-950 dark:via-zinc-950/38 dark:to-transparent">
          <ChatComposerPanel
            showJumpToLatest={showJumpToLatest}
            hasMessages={activeMessages.length > 0}
            jumpToLatestLabel={t('chat.page.jumpToLatest')}
            onJumpToLatest={jumpToLatest}
            inputProps={{
              onSend: handleSend,
              isLoading: isBusy,
              onStop: handleStop,
              channels,
              activeChannel,
              activeModel,
              onChannelChange: handleChannelChange,
              onModelChange: handleModelChange,
              onOpenModelConfig: () => navigate('/settings?tab=api'),
              compactModelSelector,
            }}
          />
        </div>

        <ChatSessionContextDrawer
          isOpen={isSessionContextDrawerOpen}
          onClose={() => setIsSessionContextDrawerOpen(false)}
          title={headerPresentation.title}
          statusLabel={headerStatusLabel}
          statusTone={headerPresentation.status}
          detailItems={headerPresentation.detailItems}
          currentChannelName={activeChannel?.name ?? null}
          currentModelName={activeModel?.name ?? sessionSelectedModelId ?? null}
          routeLabel={sessionRouteLabel}
          errorMessage={effectiveLastError ?? null}
          onOpenSettings={handleOpenSessionSettings}
          agentOptions={agentOptions}
          selectedAgentId={selectedAgentId}
          isAgentLoading={isAgentSelectorLoading}
          onSelectAgent={setSelectedAgentId}
          skillOptions={skillOptions}
          selectedSkillId={selectedSkillId}
          isSkillLoading={isSkillSelectorLoading}
          onSelectSkill={setSelectedSkillId}
        />
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
