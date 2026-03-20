import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('sdkwork-claw-chat is implemented locally instead of re-exporting claw-studio-chat', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-chat/package.json');
  const indexSource = read('packages/sdkwork-claw-chat/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-chat/src/pages/Chat.tsx'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/chatService.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/clawChatService.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/store/useChatStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/types/index.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-chat']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-chat/);
  assert.match(indexSource, /Chat/);
  assert.match(indexSource, /useChatStore/);
  assert.match(indexSource, /chatService/);
});

await runTest('sdkwork-claw-chat routes model selection through the composer', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const chatInputSource = read('packages/sdkwork-claw-chat/src/components/ChatInput.tsx');

  assert.ok(exists('packages/sdkwork-claw-chat/src/services/chatComposerState.ts'));
  assert.doesNotMatch(chatPageSource, /showModelDropdown/);
  assert.doesNotMatch(chatPageSource, /setShowModelDropdown/);
  assert.doesNotMatch(chatPageSource, /chat\.page\.selectModel/);
  assert.match(chatPageSource, /<ChatInput[\s\S]*activeChannel=\{activeChannel\}/);
  assert.match(chatPageSource, /<ChatInput[\s\S]*activeModel=\{activeModel\}/);
  assert.match(chatPageSource, /<ChatInput[\s\S]*onModelChange=\{/);
  assert.match(chatInputSource, /onModelChange/);
  assert.match(chatInputSource, /activeChannel/);
  assert.match(chatInputSource, /activeModel/);
  assert.doesNotMatch(chatInputSource, /Sparkles/);
  assert.doesNotMatch(chatInputSource, /readyWith/);
  assert.doesNotMatch(chatInputSource, /respondingWith/);
  assert.doesNotMatch(chatInputSource, /nextReplyUses/);
  assert.doesNotMatch(chatInputSource, /activeChannel\?\.icon/);
  assert.doesNotMatch(chatInputSource, /chat\.input\.modelLabel/);
  assert.doesNotMatch(chatInputSource, /min-h-\[88px\]/);
  assert.match(chatInputSource, /const actionButtonClassName =/);
  assert.match(chatInputSource, /const modelTriggerClassName =/);
  assert.match(chatInputSource, /createPortal/);
  assert.doesNotMatch(chatInputSource, /className="absolute bottom-full left-0 z-50/);
  assert.doesNotMatch(chatInputSource, /border-t border-zinc-200/);
  assert.match(chatInputSource, /dark:bg-transparent/);
});

await runTest('sdkwork-claw-chat derives active channel and model ids from instance config', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');

  assert.match(chatPageSource, /const activeChannelId = instanceConfig\?\.activeChannelId \|\| '';/);
  assert.match(chatPageSource, /const activeModelId = instanceConfig\?\.activeModelId \|\| '';/);
});

await runTest('sdkwork-claw-chat store tolerates migrated sessions without messages arrays', async () => {
  const storeModuleUrl = pathToFileURL(
    path.join(root, 'packages/sdkwork-claw-chat/src/store/useChatStore.ts'),
  ).href;
  const { useChatStore } = (await import(storeModuleUrl)) as typeof import('../packages/sdkwork-claw-chat/src/store/useChatStore');

  const initialState = useChatStore.getState();

  try {
    useChatStore.setState({
      ...initialState,
      sessions: [
        {
          id: 'legacy-session',
          title: 'Legacy Session',
          createdAt: 1,
          updatedAt: 1,
          model: 'Gemini 3 Flash',
        } as any,
      ],
      activeSessionId: 'legacy-session',
    });

    useChatStore.getState().addMessage('legacy-session', {
      role: 'user',
      content: 'hello from migrated state',
    });

    const legacySession = useChatStore
      .getState()
      .sessions.find((session) => session.id === 'legacy-session');

    assert.ok(legacySession);
    assert.deepEqual(
      legacySession.messages.map((message) => ({
        content: message.content,
        role: message.role,
      })),
      [{ role: 'user', content: 'hello from migrated state' }],
    );
  } finally {
    useChatStore.setState(initialState, true);
  }
});

await runTest('sdkwork-claw-chat resolves runtime chat routes for multiple claw instance kinds', async () => {
  const runtimeRouteModuleUrl = pathToFileURL(
    path.join(root, 'packages/sdkwork-claw-chat/src/services/instanceChatRouteService.ts'),
  ).href;
  const { resolveInstanceChatRoute } =
    (await import(runtimeRouteModuleUrl)) as typeof import('../packages/sdkwork-claw-chat/src/services/instanceChatRouteService');

  const openClawRoute = resolveInstanceChatRoute({
    id: 'local-built-in',
    name: 'Local Built-In',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    status: 'online',
    isBuiltIn: true,
    isDefault: true,
    iconType: 'server',
    version: 'bundled',
    typeLabel: 'Built-In OpenClaw',
    host: '127.0.0.1',
    port: 18789,
    baseUrl: 'http://127.0.0.1:18789',
    websocketUrl: 'ws://127.0.0.1:18789',
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat', 'health'],
    storage: {
      provider: 'localFile',
      namespace: 'claw-studio',
    },
    config: {
      port: '18789',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://127.0.0.1:18789',
      websocketUrl: 'ws://127.0.0.1:18789',
    },
    createdAt: 1,
    updatedAt: 1,
  });

  const zeroClawRoute = resolveInstanceChatRoute({
    id: 'zero-remote',
    name: 'Zero Remote',
    runtimeKind: 'zeroclaw',
    deploymentMode: 'remote',
    transportKind: 'zeroclawHttp',
    status: 'online',
    isBuiltIn: false,
    isDefault: false,
    iconType: 'server',
    version: '1.0.0',
    typeLabel: 'ZeroClaw',
    host: 'zero.example.com',
    port: 443,
    baseUrl: 'https://zero.example.com/',
    websocketUrl: null,
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat'],
    storage: {
      provider: 'postgres',
      namespace: 'studio.chat',
    },
    config: {
      port: '443',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'https://zero.example.com/',
      websocketUrl: null,
    },
    createdAt: 1,
    updatedAt: 1,
  });

  const ironClawRoute = resolveInstanceChatRoute({
    id: 'iron-remote',
    name: 'Iron Remote',
    runtimeKind: 'ironclaw',
    deploymentMode: 'remote',
    transportKind: 'ironclawWeb',
    status: 'online',
    isBuiltIn: false,
    isDefault: false,
    iconType: 'server',
    version: '0.3.0',
    typeLabel: 'IronClaw',
    host: 'iron.example.com',
    port: 443,
    baseUrl: 'https://iron.example.com',
    websocketUrl: null,
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat'],
    storage: {
      provider: 'postgres',
      namespace: 'studio.chat',
    },
    config: {
      port: '443',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'https://iron.example.com',
      websocketUrl: null,
    },
    createdAt: 1,
    updatedAt: 1,
  });

  const customWebSocketRoute = resolveInstanceChatRoute({
    id: 'custom-ws',
    name: 'Custom WS',
    runtimeKind: 'custom',
    deploymentMode: 'remote',
    transportKind: 'customWs',
    status: 'online',
    isBuiltIn: false,
    isDefault: false,
    iconType: 'server',
    version: 'custom',
    typeLabel: 'Custom',
    host: 'custom.example.com',
    port: 443,
    baseUrl: null,
    websocketUrl: 'wss://custom.example.com/ws',
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat'],
    storage: {
      provider: 'remoteApi',
      namespace: 'studio.chat',
    },
    config: {
      port: '443',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: null,
      websocketUrl: 'wss://custom.example.com/ws',
    },
    createdAt: 1,
    updatedAt: 1,
  });

  assert.equal(openClawRoute.mode, 'instanceOpenAiHttp');
  assert.equal(openClawRoute.endpoint, 'http://127.0.0.1:18789/v1/chat/completions');
  assert.equal(openClawRoute.runtimeKind, 'openclaw');
  assert.equal(zeroClawRoute.mode, 'instanceOpenAiHttp');
  assert.equal(zeroClawRoute.endpoint, 'https://zero.example.com/chat/completions');
  assert.equal(ironClawRoute.mode, 'instanceSseHttp');
  assert.equal(ironClawRoute.endpoint, 'https://iron.example.com/api/chat/completions');
  assert.equal(customWebSocketRoute.mode, 'instanceWebSocket');
  assert.equal(customWebSocketRoute.websocketUrl, 'wss://custom.example.com/ws');
  assert.equal(resolveInstanceChatRoute(null).mode, 'directLlm');
});
