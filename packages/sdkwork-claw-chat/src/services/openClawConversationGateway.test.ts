import assert from 'node:assert/strict';
import type { ChatSession } from '../store/useChatStore.ts';
import type { ChatModel } from '../types/index.ts';
import { createOpenClawConversationGateway } from './openClawConversationGateway.ts';

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

function createSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: 'thread:claw-studio:test',
    title: 'New Conversation',
    createdAt: 1_710_000_000_000,
    updatedAt: 1_710_000_000_000,
    messages: [],
    model: 'openai/gpt-5.4',
    instanceId: 'openclaw-prod',
    ...overrides,
  };
}

const openAiModel: ChatModel = {
  id: 'gpt-5.4',
  name: 'GPT-5.4',
  provider: 'openai',
  icon: 'brain',
};

await runTest('listConversations maps OpenClaw session summaries into chat sessions', async () => {
  const gateway = createOpenClawConversationGateway({
    client: {
      async listGatewaySessions() {
        return {
          sessions: [
            {
              key: 'thread:claw-studio:ops-daily',
              derivedTitle: 'Ops Daily',
              updatedAt: 1_710_000_123_000,
              modelProvider: 'openai',
              model: 'gpt-5.4',
              lastMessagePreview: 'All systems nominal',
            },
          ],
        };
      },
    } as any,
    sleep: async () => {},
    now: () => 1_710_000_999_000,
  });

  const sessions = await gateway.listConversations('openclaw-prod');

  assert.deepEqual(sessions, [
    {
      id: 'thread:claw-studio:ops-daily',
      title: 'Ops Daily',
      createdAt: 1_710_000_123_000,
      updatedAt: 1_710_000_123_000,
      messages: [],
      model: 'openai/gpt-5.4',
      instanceId: 'openclaw-prod',
      source: 'openclaw',
      messagesHydrated: false,
      lastMessagePreview: 'All systems nominal',
    },
  ]);
});

await runTest('listConversations ignores opaque upstream labels and prefers a readable preview fallback', async () => {
  const gateway = createOpenClawConversationGateway({
    client: {
      async listGatewaySessions() {
        return {
          sessions: [
            {
              key: 'thread:claw-studio:ops-daily',
              label: 'agent:research:main',
              updatedAt: 1_710_000_123_000,
              modelProvider: 'openai',
              model: 'gpt-5.4',
              lastMessagePreview: '  Summarize   the overnight alerts   and highlight the failures  ',
            },
          ],
        };
      },
    } as any,
    sleep: async () => {},
    now: () => 1_710_000_999_000,
  });

  const sessions = await gateway.listConversations('openclaw-prod');

  assert.equal(
    sessions[0]?.title,
    'Summarize the overnight alerts and highlight the failures',
  );
});

await runTest('listConversations treats technical runtime display names as placeholders and prefers readable preview text', async () => {
  const gateway = createOpenClawConversationGateway({
    client: {
      async listGatewaySessions() {
        return {
          sessions: [
            {
              key: 'thread:claw-studio:install-audit',
              displayName: 'openclaw-tui',
              label: 'main',
              updatedAt: 1_710_000_223_000,
              modelProvider: 'openai',
              model: 'gpt-5.4',
              lastMessagePreview: '  Compare the first user request with the current embedded runtime behavior  ',
            },
          ],
        };
      },
    } as any,
    sleep: async () => {},
    now: () => 1_710_000_999_000,
  });

  const sessions = await gateway.listConversations('openclaw-prod');

  assert.equal(
    sessions[0]?.title,
    'Compare the first user request with the current embedded runtime behavior',
  );
});

await runTest('hydrateConversation extracts text from structured OpenClaw chat history payloads', async () => {
  const gateway = createOpenClawConversationGateway({
    client: {
      async getChatHistory() {
        return {
          messages: [
            {
              role: 'user',
              timestamp: 1_710_000_100_000,
              content: [
                {
                  type: 'input_text',
                  text: 'Summarize the overnight alerts.',
                },
              ],
            },
            {
              role: 'assistant',
              timestamp: 1_710_000_120_000,
              model: 'gpt-5.4',
              provider: 'openai',
              content: [
                {
                  type: 'output_text',
                  text: 'No Sev-1 incidents overnight.',
                },
                {
                  type: 'output_text',
                  text: 'Queue depth stayed below threshold.',
                },
              ],
            },
          ],
        };
      },
    } as any,
    sleep: async () => {},
  });

  const hydrated = await gateway.hydrateConversation(
    createSession({
      id: 'thread:claw-studio:overnight',
      title: 'Overnight Alerts',
      model: 'unknown',
    }),
  );

  assert.deepEqual(hydrated, {
    id: 'thread:claw-studio:overnight',
    title: 'Overnight Alerts',
    createdAt: 1_710_000_000_000,
    updatedAt: 1_710_000_120_000,
    messages: [
      {
        id: 'thread:claw-studio:overnight-msg-0',
        role: 'user',
        content: 'Summarize the overnight alerts.',
        timestamp: 1_710_000_100_000,
        model: undefined,
      },
      {
        id: 'thread:claw-studio:overnight-msg-1',
        role: 'assistant',
        content: 'No Sev-1 incidents overnight.\n\nQueue depth stayed below threshold.',
        timestamp: 1_710_000_120_000,
        model: 'openai/gpt-5.4',
      },
    ],
    model: 'openai/gpt-5.4',
    instanceId: 'openclaw-prod',
    source: 'openclaw',
    messagesHydrated: true,
    lastMessagePreview: undefined,
  });
});

await runTest('hydrateConversation replaces opaque titles with a readable first user message title', async () => {
  const gateway = createOpenClawConversationGateway({
    client: {
      async getChatHistory() {
        return {
          messages: [
            {
              role: 'user',
              timestamp: 1_710_000_100_000,
              content: [
                {
                  type: 'input_text',
                  text: '  Compare   Gemini CLI and Claude Code install flows across macOS and Windows  ',
                },
              ],
            },
          ],
        };
      },
    } as any,
    sleep: async () => {},
  });

  const hydrated = await gateway.hydrateConversation(
    createSession({
      id: 'agent:research:main',
      title: 'agent:research:main',
      model: 'unknown',
    }),
  );

  assert.equal(
    hydrated.title,
    'Compare Gemini CLI and Claude Code install flows across macOS and Windows',
  );
});

await runTest('upsertConversation does not persist opaque machine titles back to OpenClaw', async () => {
  const requests: Array<Record<string, unknown>> = [];
  const gateway = createOpenClawConversationGateway({
    client: {
      async patchGatewaySession(_instanceId: string, args: Record<string, unknown>) {
        requests.push(args);
        return { ok: true };
      },
    } as any,
    sleep: async () => {},
  });

  await gateway.upsertConversation(
    createSession({
      id: 'agent:research:main',
      title: 'agent:research:main',
    }),
  );

  assert.deepEqual(requests, [
    {
      key: 'agent:research:main',
    },
  ]);
});

await runTest('sendMessageStream uses the OpenClaw wrappers for model patching, send, wait, and history polling', async () => {
  const requests: Array<{ method: string; args: Record<string, unknown> }> = [];
  let historyIndex = 0;

  const gateway = createOpenClawConversationGateway({
    client: {
      async listModels() {
        return [
          {
            id: 'openai/gpt-5.4',
            provider: 'openai',
            model: 'gpt-5.4',
            label: 'GPT-5.4',
          },
        ];
      },
      async patchGatewaySession(_instanceId: string, args: Record<string, unknown>) {
        requests.push({ method: 'sessions.patch', args });
        return {
          ok: true,
          key: 'thread:claw-studio:test',
        };
      },
      async sendChat(_instanceId: string, args: Record<string, unknown>) {
        requests.push({ method: 'chat.send', args });
        return {
          runId: 'run-1',
          status: 'started',
        };
      },
      async waitForAgent(_instanceId: string, args: Record<string, unknown>) {
        requests.push({ method: 'agent.wait', args });
        return {
          runId: 'run-1',
          status: 'ok',
        };
      },
      async getChatHistory() {
        historyIndex += 1;
        if (historyIndex === 1) {
          return {
            messages: [
              {
                role: 'user',
                timestamp: 1_710_000_200_000,
                content: [{ type: 'input_text', text: 'Summarize the build health.' }],
              },
              {
                role: 'assistant',
                timestamp: 1_710_000_201_000,
                content: [{ type: 'output_text', text: 'Build health is green.' }],
              },
            ],
          };
        }

        return {
          messages: [
            {
              role: 'user',
              timestamp: 1_710_000_200_000,
              content: [{ type: 'input_text', text: 'Summarize the build health.' }],
            },
            {
              role: 'assistant',
              timestamp: 1_710_000_201_500,
              content: [{ type: 'output_text', text: 'Build health is green. No failing pipelines.' }],
            },
          ],
        };
      },
    } as any,
    sleep: async () => {},
    now: () => 1_710_000_300_000,
    createRunId: () => 'run-1',
  });

  const chunks: string[] = [];
  const stream = gateway.sendMessageStream({
    instanceId: 'openclaw-prod',
    session: createSession(),
    message: 'Summarize the build health.',
    model: openAiModel,
  });

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  assert.deepEqual(chunks, ['Build health is green. No failing pipelines.']);
  assert.deepEqual(requests, [
    {
      method: 'sessions.patch',
      args: {
        key: 'thread:claw-studio:test',
        model: 'openai/gpt-5.4',
      },
    },
    {
      method: 'chat.send',
      args: {
        sessionKey: 'thread:claw-studio:test',
        message: 'Summarize the build health.',
        idempotencyKey: 'run-1',
        timeoutMs: 90000,
      },
    },
    {
      method: 'agent.wait',
      args: {
        runId: 'run-1',
        timeoutMs: 90000,
      },
    },
  ]);
});
