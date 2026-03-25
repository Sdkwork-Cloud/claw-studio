import { openClawGatewayClient } from '@sdkwork/claw-infrastructure';
import type { ChatSession, Message, Role } from '../store/useChatStore.ts';
import type { ChatModel } from '../types/index.ts';
import {
  DEFAULT_CHAT_SESSION_TITLE,
  getChatSessionDisplayTitle,
  isReadableChatSessionTitle,
  normalizeChatSessionTitle,
  selectReadableChatSessionTitleCandidates,
} from './chatSessionTitlePresentation.ts';

const DEFAULT_TITLE = DEFAULT_CHAT_SESSION_TITLE;
const DEFAULT_HISTORY_LIMIT = 200;
const DEFAULT_WAIT_TIMEOUT_MS = 90_000;
const DEFAULT_POLL_INTERVAL_MS = 800;

type OpenClawConversationGatewayClient = Pick<
  typeof openClawGatewayClient,
  | 'listGatewaySessions'
  | 'getChatHistory'
  | 'patchGatewaySession'
  | 'deleteGatewaySession'
  | 'resetGatewaySession'
  | 'sendChat'
  | 'abortChat'
  | 'waitForAgent'
  | 'listModels'
>;

export interface OpenClawConversationGatewayDependencies {
  client?: OpenClawConversationGatewayClient;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  createRunId?: () => string;
  pollIntervalMs?: number;
}

interface OpenClawSendMessageStreamArgs {
  instanceId: string;
  session: ChatSession;
  message: string;
  model?: ChatModel;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
}

interface OpenClawWaitResult {
  status: 'ok' | 'error' | 'timeout';
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeModelRef(provider: unknown, model: unknown) {
  const providerText = asString(provider);
  const modelText = asString(model);

  if (providerText && modelText) {
    return `${providerText}/${modelText}`;
  }

  return modelText || providerText || undefined;
}

function extractTextFragments(payload: unknown): string[] {
  if (typeof payload === 'string') {
    return payload.trim() ? [payload] : [];
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => extractTextFragments(entry));
  }

  if (!isRecord(payload)) {
    return [];
  }

  const type = asString(payload.type);
  if (
    type &&
    ['text', 'input_text', 'output_text', 'message', 'content'].includes(type) &&
    typeof payload.text === 'string'
  ) {
    return payload.text.trim() ? [payload.text] : [];
  }

  return [
    ...extractTextFragments(payload.content),
    ...extractTextFragments(payload.text),
    ...extractTextFragments(payload.message),
    ...extractTextFragments(payload.value),
    ...extractTextFragments(payload.parts),
    ...extractTextFragments(payload.items),
  ];
}

function toRole(value: unknown): Role {
  return value === 'assistant' || value === 'system' ? value : 'user';
}

function createMessageId(sessionId: string, message: Record<string, unknown>, index: number) {
  return asString(message.id) || `${sessionId}-msg-${index}`;
}

function mapHistoryMessage(sessionId: string, value: unknown, index: number): Message | null {
  if (!isRecord(value)) {
    return null;
  }

  const content = extractTextFragments(value.content).join('\n\n').trim();
  if (!content) {
    return null;
  }

  return {
    id: createMessageId(sessionId, value, index),
    role: toRole(value.role),
    content,
    timestamp:
      asNumber(value.timestamp) ??
      asNumber(value.createdAt) ??
      asNumber(value.updatedAt) ??
      Date.now(),
    model:
      normalizeModelRef(value.provider, value.model) ||
      asString(value.model) ||
      normalizeModelRef(value.modelProvider, value.modelName),
  };
}

function selectLatestAssistantText(messages: Message[]) {
  const assistantMessages = messages.filter((message) => message.role === 'assistant');
  return assistantMessages[assistantMessages.length - 1]?.content || '';
}

async function safeSleep(sleep: (ms: number) => Promise<void>, ms: number) {
  await sleep(ms);
}

function createAbortError() {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The operation was aborted.', 'AbortError');
  }

  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

export function createOpenClawConversationGateway(
  dependencies: OpenClawConversationGatewayDependencies = {},
) {
  const client = dependencies.client || openClawGatewayClient;
  const now = dependencies.now || (() => Date.now());
  const sleep =
    dependencies.sleep ||
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const createRunId =
    dependencies.createRunId ||
    (() =>
      globalThis.crypto?.randomUUID?.() ||
      `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  const pollIntervalMs = dependencies.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  async function listConversations(instanceId: string): Promise<ChatSession[]> {
    const result = (await client.listGatewaySessions(instanceId, {
      limit: 100,
      includeDerivedTitles: true,
      includeLastMessage: true,
    })) as Record<string, unknown>;
    const sessions = Array.isArray(result.sessions) ? result.sessions : [];

    return sessions
      .filter(isRecord)
      .map((session) => {
        const updatedAt = asNumber(session.updatedAt) ?? now();
        const title = selectReadableChatSessionTitleCandidates(
          [
            asString(session.derivedTitle),
            asString(session.displayName),
            asString(session.label),
            asString(session.lastMessagePreview),
            asString(session.key),
          ],
          DEFAULT_TITLE,
        );

        return {
          id: asString(session.key) || `thread:claw-studio:${updatedAt}`,
          title,
          createdAt: updatedAt,
          updatedAt,
          messages: [],
          model:
            normalizeModelRef(session.modelProvider, session.model) ||
            asString(session.model) ||
            'unknown',
          instanceId,
          source: 'openclaw' as const,
          messagesHydrated: false,
          lastMessagePreview: asString(session.lastMessagePreview),
        };
      });
  }

  async function hydrateConversation(session: ChatSession): Promise<ChatSession> {
    if (!session.instanceId) {
      return session;
    }

    const result = (await client.getChatHistory(session.instanceId, {
      sessionKey: session.id,
      limit: DEFAULT_HISTORY_LIMIT,
    })) as Record<string, unknown>;
    const rawMessages = Array.isArray(result.messages) ? result.messages : [];
    const messages = rawMessages
      .map((message, index) => mapHistoryMessage(session.id, message, index))
      .filter((message): message is Message => Boolean(message));
    const latestTimestamp = messages[messages.length - 1]?.timestamp ?? session.updatedAt;
    const latestModel =
      messages
        .slice()
        .reverse()
        .find((message) => message.role === 'assistant' && message.model)?.model ||
      session.model;

    return {
      ...session,
      title: getChatSessionDisplayTitle({
        title: session.title,
        messages,
        lastMessagePreview: session.lastMessagePreview,
      }),
      updatedAt: latestTimestamp,
      messages,
      model: latestModel || 'unknown',
      source: 'openclaw',
      messagesHydrated: true,
      lastMessagePreview: session.lastMessagePreview,
    };
  }

  async function upsertConversation(session: ChatSession): Promise<ChatSession> {
    if (!session.instanceId) {
      return session;
    }

    const payload: Record<string, unknown> = {
      key: session.id,
    };

    if (isReadableChatSessionTitle(session.title)) {
      payload.label = normalizeChatSessionTitle(session.title);
    }

    await client.patchGatewaySession(session.instanceId, payload);

    return {
      ...session,
      source: 'openclaw',
      messagesHydrated: session.messagesHydrated ?? false,
    };
  }

  async function deleteConversation(instanceId: string, sessionId: string) {
    await client.deleteGatewaySession(instanceId, {
      key: sessionId,
      deleteTranscript: true,
    });
  }

  async function resetConversation(session: ChatSession): Promise<ChatSession> {
    if (!session.instanceId) {
      return session;
    }

    await client.resetGatewaySession(session.instanceId, {
      key: session.id,
      reason: 'reset',
    });

    return {
      ...session,
      updatedAt: now(),
      messages: [],
      source: 'openclaw',
      messagesHydrated: true,
      lastMessagePreview: undefined,
    };
  }

  async function resolveGatewayModelRef(instanceId: string, model?: ChatModel) {
    if (!model) {
      return undefined;
    }

    const fallback = `${model.provider}/${model.id}`;

    try {
      const models = await client.listModels(instanceId);
      const normalizedRequested = new Set(
        [fallback, model.id, model.name]
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
      );

      for (const entry of models) {
        const candidate = normalizeModelRef(entry.provider, entry.model);
        const candidateId = asString(entry.id);
        const candidateLabel = asString(entry.label);
        const candidateTitle = asString(entry.title);
        const matches = [candidate, candidateId, candidateLabel, candidateTitle]
          .map((value) => value?.toLowerCase())
          .filter(Boolean);

        if (matches.some((value) => normalizedRequested.has(value!))) {
          return candidate || candidateId || fallback;
        }
      }
    } catch {
      return fallback;
    }

    return fallback;
  }

  async function* sendMessageStream(
    args: OpenClawSendMessageStreamArgs,
  ): AsyncGenerator<string, void, unknown> {
    const {
      instanceId,
      session,
      message,
      model,
      abortSignal,
      timeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
    } = args;

    const modelRef = await resolveGatewayModelRef(instanceId, model);
    const ensurePayload: Record<string, unknown> = {
      key: session.id,
    };

    if (isReadableChatSessionTitle(session.title)) {
      ensurePayload.label = normalizeChatSessionTitle(session.title);
    }

    if (modelRef) {
      ensurePayload.model = modelRef;
    }

    try {
      await client.patchGatewaySession(instanceId, ensurePayload);
    } catch (error) {
      if (!modelRef) {
        throw error;
      }

      const fallbackPayload = { ...ensurePayload };
      delete fallbackPayload.model;
      await client.patchGatewaySession(instanceId, fallbackPayload);
    }

    const baselineHistory = (await client.getChatHistory(instanceId, {
      sessionKey: session.id,
      limit: DEFAULT_HISTORY_LIMIT,
    })) as Record<string, unknown>;
    const baselineMessages = (Array.isArray(baselineHistory.messages)
      ? baselineHistory.messages
      : []
    )
      .map((entry, index) => mapHistoryMessage(session.id, entry, index))
      .filter((entry): entry is Message => Boolean(entry));
    const baselineAssistantText = selectLatestAssistantText(baselineMessages);

    if (abortSignal?.aborted) {
      throw createAbortError();
    }

    const runId = createRunId();
    const sendResult = (await client.sendChat(instanceId, {
      sessionKey: session.id,
      message,
      idempotencyKey: runId,
      timeoutMs,
    })) as Record<string, unknown>;
    const resolvedRunId = asString(sendResult.runId) || runId;

    let waitResult: OpenClawWaitResult | null = null;
    const waitPromise = client
      .waitForAgent(instanceId, {
        runId: resolvedRunId,
        timeoutMs,
      })
      .then((result) => {
        const record = isRecord(result) ? result : {};
        const status = asString(record.status);
        waitResult = {
          status:
            status === 'error' || status === 'timeout'
              ? status
              : 'ok',
          error: asString(record.error),
        };
        return waitResult;
      })
      .catch((error: unknown) => {
        waitResult = {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        };
        return waitResult;
      });

    let yieldedAssistantText = '';

    const emitLatestAssistantDelta = async () => {
      const history = (await client.getChatHistory(instanceId, {
        sessionKey: session.id,
        limit: DEFAULT_HISTORY_LIMIT,
      })) as Record<string, unknown>;
      const messages = (Array.isArray(history.messages) ? history.messages : [])
        .map((entry, index) => mapHistoryMessage(session.id, entry, index))
        .filter((entry): entry is Message => Boolean(entry));
      const latestAssistantText = selectLatestAssistantText(messages);

      if (!latestAssistantText || latestAssistantText === baselineAssistantText) {
        return '';
      }

      if (!yieldedAssistantText) {
        yieldedAssistantText = latestAssistantText;
        return latestAssistantText;
      }

      if (latestAssistantText.startsWith(yieldedAssistantText)) {
        const delta = latestAssistantText.slice(yieldedAssistantText.length);
        yieldedAssistantText = latestAssistantText;
        return delta;
      }

      yieldedAssistantText = latestAssistantText;
      return latestAssistantText;
    };

    try {
      while (!waitResult) {
        if (abortSignal?.aborted) {
          await client.abortChat(instanceId, {
            sessionKey: session.id,
            runId: resolvedRunId,
          });
          throw createAbortError();
        }

        const delta = await emitLatestAssistantDelta();
        if (delta) {
          yield delta;
        }

        await Promise.race([
          waitPromise,
          safeSleep(sleep, pollIntervalMs),
        ]);
      }

      const finalDelta = await emitLatestAssistantDelta();
      if (finalDelta) {
        yield finalDelta;
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw error;
      }
      throw error;
    }

    if (waitResult?.status === 'error') {
      throw new Error(waitResult.error || 'OpenClaw chat run failed.');
    }

    if (waitResult?.status === 'timeout') {
      throw new Error(waitResult.error || 'OpenClaw chat run timed out.');
    }
  }

  return {
    listConversations,
    hydrateConversation,
    upsertConversation,
    deleteConversation,
    resetConversation,
    sendMessageStream,
  };
}

export const openClawConversationGateway = createOpenClawConversationGateway();
