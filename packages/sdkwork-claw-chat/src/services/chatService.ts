import { useInstanceStore, useLLMStore } from '@sdkwork/claw-core';
import { studio } from '@sdkwork/claw-infrastructure';
import type { Agent, Skill, StudioInstanceRecord } from '@sdkwork/claw-types';
import { resolveInstanceChatRoute } from './instanceChatRouteService.ts';
import type { ChatModel } from '../types/index.ts';

const DEFAULT_SYSTEM_INSTRUCTION =
  'You are Claw Studio AI assistant. You help users manage devices, write automation scripts, and answer questions about the ClawHub ecosystem. Keep your answers concise and helpful.';

const DEFAULT_LLM_CONFIG = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
};

export interface IChatService {
  createChatSession(modelId: string, skill?: Skill, agent?: Agent): any;
  sendMessageStream(
    chatSession: any,
    message: string,
    model: ChatModel,
    skill?: Skill,
    agent?: Agent,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<string, void, unknown>;
}

export function buildSystemInstruction(skill?: Skill, agent?: Agent) {
  let systemInstruction = agent?.systemPrompt ?? DEFAULT_SYSTEM_INSTRUCTION;

  if (skill) {
    systemInstruction += `\n\nYou are currently equipped with the "${skill.name}" skill.\nSkill Description: ${skill.description}\nSkill Category: ${skill.category}\n\nUse this skill context when it is relevant. Do not claim an action was executed unless the live runtime or an actual tool invocation completed it.`;
  }

  return systemInstruction;
}

export function buildContextualMessage(message: string, skill?: Skill, agent?: Agent) {
  let contextPrefix = '';

  if (agent) {
    contextPrefix += `[Role: ${agent.systemPrompt}]\n`;
  }

  if (skill) {
    contextPrefix += `[Context: You are equipped with the "${skill.name}" skill. Description: ${skill.description}]\n`;
  }

  return contextPrefix ? `${contextPrefix}\nUser: ${message}` : message;
}

function extractTextFragments(payload: unknown): string[] {
  if (typeof payload === 'string') {
    return payload ? [payload] : [];
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => extractTextFragments(entry));
  }

  const record = payload as Record<string, unknown>;

  if (record.choices) {
    return extractTextFragments(record.choices);
  }

  if (record.delta) {
    return extractTextFragments(record.delta);
  }

  if (record.message) {
    return extractTextFragments(record.message);
  }

  if (record.data) {
    return extractTextFragments(record.data);
  }

  if (Array.isArray(record.content)) {
    return record.content.flatMap((entry) => extractTextFragments(entry));
  }

  if (typeof record.content === 'string') {
    return record.content ? [record.content] : [];
  }

  if (typeof record.text === 'string') {
    return record.text ? [record.text] : [];
  }

  return [];
}

function extractFramePayloads(frame: string) {
  const lines = frame
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());

  return dataLines.length > 0 ? dataLines : lines;
}

async function* streamHttpResponse(response: Response): AsyncGenerator<string, void, unknown> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const payload = await response.json();
    const fragments = extractTextFragments(payload);
    if (fragments.length > 0) {
      for (const fragment of fragments) {
        yield fragment;
      }
      return;
    }

    const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (text) {
      yield text;
    }
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() || '';

    for (const frame of frames) {
      for (const payloadText of extractFramePayloads(frame)) {
        if (!payloadText || payloadText === '[DONE]') {
          if (payloadText === '[DONE]') {
            return;
          }
          continue;
        }

        try {
          const fragments = extractTextFragments(JSON.parse(payloadText));
          if (fragments.length > 0) {
            for (const fragment of fragments) {
              yield fragment;
            }
            continue;
          }
        } catch {
          // Fall back to yielding raw text when the stream frame is not JSON.
        }

        yield payloadText;
      }
    }

    if (done) {
      break;
    }
  }

  const trailing = buffer.trim();
  if (!trailing) {
    return;
  }

  for (const payloadText of extractFramePayloads(trailing)) {
    if (!payloadText || payloadText === '[DONE]') {
      continue;
    }

    try {
      const fragments = extractTextFragments(JSON.parse(payloadText));
      if (fragments.length > 0) {
        for (const fragment of fragments) {
          yield fragment;
        }
        continue;
      }
    } catch {
      // Keep the trailing raw text when it is not JSON.
    }

    yield payloadText;
  }
}

async function* streamOpenAiCompatibleRequest(
  endpoint: string,
  body: Record<string, unknown>,
  headers: Record<string, string>,
  abortSignal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    signal: abortSignal,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  yield* streamHttpResponse(response);
}

function buildInstanceHeaders(instance: StudioInstanceRecord) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream, application/json',
  };
  const authToken = instance.config.authToken;
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
}

async function resolveActiveInstanceRoute() {
  const { activeInstanceId } = useInstanceStore.getState();
  if (!activeInstanceId) {
    return {
      activeInstance: null,
      route: resolveInstanceChatRoute(null),
    };
  }

  const activeInstance = await studio.getInstance(activeInstanceId);
  return {
    activeInstance,
    route: resolveInstanceChatRoute(activeInstance),
  };
}

class ChatService implements IChatService {
  createChatSession(_modelId: string, _skill?: Skill, _agent?: Agent) {
    return null;
  }

  async *sendMessageStream(
    _chatSession: any,
    message: string,
    model: ChatModel,
    skill?: Skill,
    agent?: Agent,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<string, void, unknown> {
    const { activeInstanceId } = useInstanceStore.getState();
    const instanceConfig = activeInstanceId
      ? useLLMStore.getState().getInstanceConfig(activeInstanceId)
      : null;
    const config = instanceConfig?.config ?? DEFAULT_LLM_CONFIG;
    const finalMessage = buildContextualMessage(message, skill, agent);
    const { activeInstance, route } = await resolveActiveInstanceRoute();

    if (!activeInstance) {
      yield 'Error: Select or start an OpenClaw-compatible instance to chat.';
      return;
    }

    if (route.mode === 'instanceOpenClawGatewayWs') {
      yield `\n\n**${activeInstance.name}** uses the native OpenClaw Gateway WebSocket flow. Claw Studio now drives that route through the chat session store instead of the generic HTTP stream service.`;
      return;
    }

    if (route.endpoint) {
      try {
        yield* streamOpenAiCompatibleRequest(
          route.endpoint,
          {
            model: model.id,
            messages: [
              {
                role: 'system',
                content: buildSystemInstruction(skill, agent),
              },
              {
                role: 'user',
                content: finalMessage,
              },
            ],
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            top_p: config.topP,
            stream: true,
            metadata: {
              instanceId: activeInstance.id,
              runtimeKind: activeInstance.runtimeKind,
              deploymentMode: activeInstance.deploymentMode,
              transportKind: activeInstance.transportKind,
            },
          },
          buildInstanceHeaders(activeInstance),
          abortSignal,
        );
        return;
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          throw error;
        }

        yield `\n\n**Error connecting to ${activeInstance.name}:** ${error.message}`;
        return;
      }
    }

    if (route.mode === 'instanceWebSocket') {
      yield `\n\n**${activeInstance.name}** currently only publishes a WebSocket chat route (${route.websocketUrl}). Configure an HTTP endpoint to enable Claw Studio chat streaming.`;
      return;
    }

    if (route.mode === 'unsupported') {
      yield `\n\n**${activeInstance.name}** is not chat-ready yet: ${route.reason}`;
      return;
    }

    yield `\n\n**${activeInstance.name}** does not currently expose a compatible streaming chat endpoint.`;
  }
}

export const chatService = new ChatService();
