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
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/store/useChatStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/types/index.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-chat']);
  assert.ok(!pkg.dependencies?.['@google/genai']);
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

await runTest('sdkwork-claw-chat keeps route-level boundaries by consuming shared core services instead of other route packages', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const chatServiceSource = read('packages/sdkwork-claw-chat/src/services/chatService.ts');
  const chatInputSource = read('packages/sdkwork-claw-chat/src/components/ChatInput.tsx');

  assert.doesNotMatch(chatPageSource, /from '@sdkwork\/claw-market'/);
  assert.doesNotMatch(chatPageSource, /from '@sdkwork\/claw-settings'/);
  assert.doesNotMatch(chatServiceSource, /from '@sdkwork\/claw-settings'/);
  assert.doesNotMatch(chatInputSource, /from '@sdkwork\/claw-settings'/);
  assert.match(chatPageSource, /from '@sdkwork\/claw-core'/);
  assert.match(chatServiceSource, /from '@sdkwork\/claw-core'/);
  assert.match(chatInputSource, /from '@sdkwork\/claw-core'/);
  assert.match(chatPageSource, /clawHubService/);
  assert.match(chatServiceSource, /useLLMStore/);
});

await runTest('sdkwork-claw-chat routes model configuration entry points into settings after api-router removal', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');

  assert.match(chatPageSource, /onClick=\{\(\) => navigate\('\/settings\?tab=api'\)\}/);
  assert.match(chatPageSource, /onOpenModelConfig=\{\(\) => navigate\('\/settings\?tab=api'\)\}/);
  assert.doesNotMatch(chatPageSource, /navigate\('\/settings\/llm'\)/);
  assert.doesNotMatch(chatPageSource, /navigate\('\/api-router'\)/);
});

await runTest('sdkwork-claw-chat resolves model catalogs through the shared provider routing catalog instead of studio mocks', () => {
  const serviceSource = read(
    'packages/sdkwork-claw-chat/src/services/instanceEffectiveModelCatalogService.ts',
  );

  assert.doesNotMatch(serviceSource, /studioMockService/);
  assert.match(serviceSource, /providerRoutingCatalogService/);
  assert.match(serviceSource, /from '@sdkwork\/claw-core'/);
});

await runTest('sdkwork-claw-chat chat service loads under Node without Vite env injection', async () => {
  const chatServiceModuleUrl = pathToFileURL(
    path.join(root, 'packages/sdkwork-claw-chat/src/services/chatService.ts'),
  ).href;
  const chatServiceModule =
    (await import(chatServiceModuleUrl)) as typeof import('../packages/sdkwork-claw-chat/src/services/chatService');

  assert.ok(chatServiceModule.chatService);
  assert.equal(typeof chatServiceModule.buildSystemInstruction, 'function');
});

await runTest('sdkwork-claw-chat chat service forbids browser-direct provider calls and env-key fallbacks', () => {
  const chatServiceSource = read('packages/sdkwork-claw-chat/src/services/chatService.ts');

  assert.doesNotMatch(chatServiceSource, /@google\/genai/);
  assert.doesNotMatch(chatServiceSource, /GoogleGenAI/);
  assert.doesNotMatch(chatServiceSource, /GenerateContentResponse/);
  assert.doesNotMatch(chatServiceSource, /VITE_ANTHROPIC_API_KEY/);
  assert.doesNotMatch(chatServiceSource, /VITE_GEMINI_API_KEY/);
  assert.doesNotMatch(chatServiceSource, /VITE_OPENAI_API_KEY/);
  assert.doesNotMatch(chatServiceSource, /API_KEY_MAP/);
  assert.doesNotMatch(chatServiceSource, /channel\.baseUrl}\/chat\/completions/);
  assert.doesNotMatch(chatServiceSource, /new GoogleGenAI/);
  assert.match(chatServiceSource, /Select or start an OpenClaw-compatible instance to chat\./);
});

await runTest('sdkwork-claw-chat chat service requires a real active instance before streaming', async () => {
  const chatServiceModuleUrl = pathToFileURL(
    path.join(root, 'packages/sdkwork-claw-chat/src/services/chatService.ts'),
  ).href;
  const instanceStoreModuleUrl = pathToFileURL(
    path.join(root, 'packages/sdkwork-claw-core/src/stores/useInstanceStore.ts'),
  ).href;
  const {
    chatService,
  } = (await import(chatServiceModuleUrl)) as typeof import('../packages/sdkwork-claw-chat/src/services/chatService');
  const {
    useInstanceStore,
  } = (await import(instanceStoreModuleUrl)) as typeof import('../packages/sdkwork-claw-core/src/stores/useInstanceStore');

  const initialState = useInstanceStore.getState();

  try {
    useInstanceStore.setState({
      ...initialState,
      activeInstanceId: null,
    });

    const chunks: string[] = [];
    for await (const chunk of chatService.sendMessageStream(
      null,
      'hello',
      {
        id: 'google/gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'google',
        icon: 'AI',
      },
      undefined,
      undefined,
    )) {
      chunks.push(chunk);
    }

    assert.deepEqual(chunks, [
      'Error: Select or start an OpenClaw-compatible instance to chat.',
    ]);
  } finally {
    useInstanceStore.setState(initialState, true);
  }
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
      activeSessionIdByInstance: {
        __direct__: 'legacy-session',
      },
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

await runTest('sdkwork-claw-chat derives a readable local session title from the first user message', async () => {
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
          id: 'fresh-session',
          title: 'New Conversation',
          createdAt: 1,
          updatedAt: 1,
          model: 'Gemini 3 Flash',
          messages: [],
        } as any,
      ],
      activeSessionIdByInstance: {
        __direct__: 'fresh-session',
      },
    });

    useChatStore.getState().addMessage('fresh-session', {
      role: 'user',
      content:
        '  Build   an install checklist\n\nfor OpenClaw across macOS   and Windows, then summarize blockers  ',
    });

    const session = useChatStore
      .getState()
      .sessions.find((entry) => entry.id === 'fresh-session');

    assert.ok(session);
    assert.equal(
      session.title,
      'Build an install checklist for OpenClaw across macOS and Windows, then summar...',
    );
  } finally {
    useChatStore.setState(initialState, true);
  }
});

await runTest('sdkwork-claw-chat keeps active session state isolated per instance and blocks local persistence for openclaw gateway sessions', () => {
  const chatStoreSource = read('packages/sdkwork-claw-chat/src/store/useChatStore.ts');
  const localGatewaySource = read('packages/sdkwork-claw-chat/src/store/studioConversationGateway.ts');
  const chatMappingSource = read('packages/sdkwork-claw-chat/src/chatSessionMapping.ts');
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const chatSidebarSource = read('packages/sdkwork-claw-chat/src/components/ChatSidebar.tsx');

  assert.match(chatStoreSource, /activeSessionIdByInstance/);
  assert.match(chatStoreSource, /syncStateByInstance/);
  assert.match(chatStoreSource, /connectGatewayInstances/);
  assert.match(chatStoreSource, /sendGatewayMessage/);
  assert.match(chatStoreSource, /abortSession/);
  assert.match(chatStoreSource, /instanceRouteModeById/);
  assert.match(localGatewaySource, /openclawGateway/);
  assert.match(localGatewaySource, /not persisted locally/);
  assert.match(chatMappingSource, /must not be persisted through the studio conversation store/);
  assert.match(chatPageSource, /const isOpenClawGateway = routeMode === 'instanceOpenClawGatewayWs';/);
  assert.match(chatPageSource, /sendGatewayMessage/);
  assert.match(chatPageSource, /abortSession/);
  assert.match(chatSidebarSource, /activeSessionIdByInstance/);
  assert.match(chatSidebarSource, /getChatSessionDisplayTitle/);
  assert.doesNotMatch(chatSidebarSource, /\{session\.title\}/);
});

await runTest('sdkwork-claw-chat does not fall back to local HTTP while an instance route is still unresolved', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');

  assert.match(
    chatPageSource,
    /const routeMode = activeInstanceId \? instanceRouteModeById\[activeInstanceId\] : 'directLlm';/,
  );
  assert.doesNotMatch(
    chatPageSource,
    /const routeMode = activeInstanceId \? instanceRouteModeById\[activeInstanceId\] \?\? 'directLlm' : 'directLlm';/,
  );
  assert.match(
    chatPageSource,
    /if \(!activeModel \|\| !activeChannel \|\| isBusy \|\| \(activeInstanceId && !routeMode\)\) \{/,
  );
  assert.match(chatPageSource, /if \(isOpenClawGateway && activeInstanceId\) \{/);
});

await runTest('sdkwork-claw-chat wires managed OpenClaw history config into the gateway session store', () => {
  const chatStoreSource = read('packages/sdkwork-claw-chat/src/store/useChatStore.ts');

  assert.match(chatStoreSource, /openClawGatewayHistoryConfigService/);
  assert.match(chatStoreSource, /resolveHistoryMaxChars\(instanceId\)/);
  assert.match(
    chatStoreSource,
    /openClawGatewayHistoryConfigService\.getHistoryMaxChars\(instanceId\)/,
  );
});

await runTest('sdkwork-claw-chat llm store does not seed default browser-direct provider channels', () => {
  const llmStoreSource = read('packages/sdkwork-claw-settings/src/store/useLLMStore.ts');

  assert.doesNotMatch(llmStoreSource, /const DEFAULT_CHANNELS:/);
  assert.doesNotMatch(llmStoreSource, /channels:\s*DEFAULT_CHANNELS/);
  assert.doesNotMatch(llmStoreSource, /activeChannelId:\s*'google-gemini'/);
  assert.doesNotMatch(llmStoreSource, /activeModelId:\s*'gemini-3-flash-preview'/);
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

  const legacyOpenClawRoute = resolveInstanceChatRoute({
    id: 'openclaw-legacy-http',
    name: 'OpenClaw Legacy HTTP',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-external',
    transportKind: 'customHttp',
    status: 'online',
    isBuiltIn: false,
    isDefault: false,
    iconType: 'server',
    version: '0.6.0',
    typeLabel: 'OpenClaw Legacy',
    host: '127.0.0.1',
    port: 18795,
    baseUrl: 'http://127.0.0.1:18795/v1/chat/completions',
    websocketUrl: 'ws://127.0.0.1:18795/ws',
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
      port: '18795',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://127.0.0.1:18795/v1/chat/completions',
      websocketUrl: 'ws://127.0.0.1:18795/ws',
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

  assert.equal(openClawRoute.mode, 'instanceOpenClawGatewayWs');
  assert.equal(openClawRoute.endpoint, undefined);
  assert.equal(openClawRoute.websocketUrl, 'ws://127.0.0.1:18789');
  assert.equal(openClawRoute.runtimeKind, 'openclaw');
  assert.equal(legacyOpenClawRoute.mode, 'instanceOpenClawGatewayWs');
  assert.equal(legacyOpenClawRoute.endpoint, 'http://127.0.0.1:18795/v1/chat/completions');
  assert.equal(legacyOpenClawRoute.websocketUrl, 'ws://127.0.0.1:18795');
  assert.equal(zeroClawRoute.mode, 'instanceOpenAiHttp');
  assert.equal(zeroClawRoute.endpoint, 'https://zero.example.com/chat/completions');
  assert.equal(ironClawRoute.mode, 'instanceSseHttp');
  assert.equal(ironClawRoute.endpoint, 'https://iron.example.com/api/chat/completions');
  assert.equal(customWebSocketRoute.mode, 'instanceWebSocket');
  assert.equal(customWebSocketRoute.websocketUrl, 'wss://custom.example.com/ws');
  assert.equal(resolveInstanceChatRoute(null).mode, 'directLlm');
});

await runTest('sdkwork-claw-chat reflows chrome before text gets squeezed on smaller screens', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const chatSidebarSource = read('packages/sdkwork-claw-chat/src/components/ChatSidebar.tsx');
  const chatInputSource = read('packages/sdkwork-claw-chat/src/components/ChatInput.tsx');
  const chatMessageSource = read('packages/sdkwork-claw-chat/src/components/ChatMessage.tsx');

  assert.match(chatPageSource, /const \[isSidebarOpen, setIsSidebarOpen\] = useState\(false\);/);
  assert.match(chatPageSource, /className="hidden h-full w-72 shrink-0 lg:flex xl:w-80"/);
  assert.match(chatPageSource, /className="fixed inset-0 z-40 bg-zinc-950\/45 backdrop-blur-sm lg:hidden"/);
  assert.match(chatPageSource, /className="fixed inset-y-0 left-0 z-50 w-\[min\(22rem,calc\(100vw-1rem\)\)\] lg:hidden"/);
  assert.match(chatPageSource, /className="z-10 flex min-h-\[3\.75rem\] flex-shrink-0 flex-wrap items-center justify-between gap-3/);
  assert.match(chatPageSource, /className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3"/);
  assert.match(chatPageSource, /className="flex min-w-0 items-center gap-2"/);
  assert.match(chatPageSource, /'inline-flex shrink-0 items-center gap-1\.5 text-\[11px\] font-medium'/);
  assert.match(chatPageSource, /className="mt-0\.5 flex min-w-0 flex-wrap items-center gap-x-1\.5 gap-y-0\.5 text-\[11px\] text-zinc-500 dark:text-zinc-400"/);
  assert.match(chatPageSource, /className="relative min-w-0 max-w-full"/);
  assert.match(chatPageSource, /const composerSurfaceRef = useRef<HTMLDivElement \| null>\(null\);/);
  assert.match(chatPageSource, /const \[composerSurfaceHeight, setComposerSurfaceHeight\] = useState\(0\);/);
  assert.match(chatPageSource, /const messageListBottomPadding = `calc\(\$\{composerSurfaceHeight \+ 32\}px \+ env\(safe-area-inset-bottom\)\)`;/);
  assert.match(chatPageSource, /const emptyStateBottomPadding = `calc\(\$\{composerSurfaceHeight \+ 52\}px \+ env\(safe-area-inset-bottom\)\)`;/);
  assert.match(chatPageSource, /style=\{\{\s*paddingBottom: messageListBottomPadding,\s*\}\}/);
  assert.match(chatPageSource, /new ResizeObserver\(\(\[entry\]\) => \{/);
  assert.match(chatPageSource, /mx-auto flex w-full max-w-6xl px-4 text-\[10px\] tracking-normal text-zinc-400 sm:px-6 lg:px-8 dark:text-zinc-500/);
  assert.match(chatPageSource, /flex min-w-0 max-w-full flex-wrap items-center gap-x-1\.5 gap-y-0\.5/);
  assert.match(chatPageSource, /<span className="truncate font-medium text-zinc-500 dark:text-zinc-400">/);
  assert.match(chatPageSource, /<span className="shrink-0 text-zinc-300 dark:text-zinc-600">\/<\/span>/);
  assert.match(chatPageSource, /<span className="truncate text-zinc-400 dark:text-zinc-500">\s*\{footerPresentation\.modelLabel\}\s*<\/span>/);
  assert.doesNotMatch(chatPageSource, /rounded-full border border-zinc-200 bg-white\/80 px-2 py-0\.5 text-\[10px\] font-semibold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900\/70 dark:text-zinc-300/);
  assert.doesNotMatch(chatPageSource, /'inline-flex shrink-0 items-center gap-1\.5 rounded-full border px-2\.5 py-1 text-\[11px\] font-semibold'/);

  assert.match(chatSidebarSource, /onSessionSelect\?: \(\) => void;/);
  assert.match(chatSidebarSource, /onClose\?: \(\) => void;/);
  assert.match(chatSidebarSource, /'flex h-full min-h-0 w-full flex-col border-r border-zinc-200 bg-zinc-50\/50/);
  assert.match(chatSidebarSource, /<h3 className="mb-1\.5 px-3 text-\[10px\] font-medium uppercase tracking-\[0\.14em\] text-zinc-400 dark:text-zinc-500">/);
  assert.match(chatSidebarSource, /'group relative flex cursor-pointer items-start rounded-xl px-3 py-2\.5 transition-all'/);
  assert.match(chatSidebarSource, /<div className="flex min-w-0 flex-1 flex-col gap-0\.5 overflow-hidden">/);
  assert.match(chatSidebarSource, /<span className="min-w-0 flex-1 truncate text-\[13px\] font-medium leading-5">/);
  assert.match(chatSidebarSource, /<span className="shrink-0 text-\[10px\] font-medium tabular-nums text-zinc-400 dark:text-zinc-500">\s*\{presentation\.relativeTimeLabel\}\s*<\/span>/);
  assert.match(chatSidebarSource, /<div className="truncate text-\[11px\] leading-5 text-zinc-400 dark:text-zinc-500">\s*\{presentation\.preview\}\s*<\/div>/);
  assert.match(chatSidebarSource, /className="ml-2 mt-0\.5 shrink-0 rounded-md p-1 opacity-100 transition-opacity hover:bg-zinc-200 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-zinc-700"/);
  assert.doesNotMatch(chatSidebarSource, /<MessageSquare\s+className=\{cn\(\s*'mt-0\.5 h-4 w-4 shrink-0'/);
  assert.doesNotMatch(chatSidebarSource, /<div className="mt-0\.5 flex min-w-0 items-center gap-1\.5 text-\[11px\] leading-5 text-zinc-400 dark:text-zinc-500">/);

  assert.match(chatInputSource, /const viewportPadding = window\.innerWidth < 640 \? 12 : 16;/);
  assert.match(chatInputSource, /Math\.max\(window\.innerWidth < 640 \? 280 : 320/);
  assert.match(chatInputSource, /className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"/);
  assert.match(chatInputSource, /truncate max-w-\[8\.5rem\] sm:max-w-\[12rem\] lg:max-w-\[16rem\]/);
  assert.doesNotMatch(chatInputSource, /chat\.input\.disclaimer/);

  assert.match(chatMessageSource, /group mx-auto flex w-full max-w-6xl px-4 sm:px-6 lg:px-8 transition-all duration-300/);
  assert.match(chatMessageSource, /isUser \? 'justify-end' : 'justify-start'/);
  assert.match(chatMessageSource, /rounded-br-md bg-zinc-100 px-4 py-2\.5 text-zinc-900 sm:max-w-\[95%\] dark:bg-zinc-800 dark:text-zinc-100/);
  assert.match(chatMessageSource, /:\s*isTool\s*\?\s*'w-full px-0 py-0\.5 text-zinc-900 dark:text-zinc-100'\s*:\s*'w-full px-0 py-0\.5 text-zinc-900 dark:text-zinc-100'/);
  assert.match(chatMessageSource, /mb-1\.5 flex flex-wrap items-start justify-between gap-2/);
  assert.match(chatMessageSource, /relative mb-4 mt-3 min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-\[#1E1E1E\]/);
  assert.match(chatMessageSource, /prose-headings:font-semibold prose-headings:tracking-tight prose-headings:mb-2 prose-headings:mt-4 prose-a:text-primary-500 hover:prose-a:text-primary-600/);
  assert.match(chatMessageSource, /prose-code:before:content-none prose-code:after:content-none prose-p:my-2\.5 prose-p:leading-relaxed prose-pre:my-3 prose-pre:bg-transparent prose-pre:p-0 prose-ul:my-2\.5 prose-ol:my-2\.5/);
  assert.match(chatMessageSource, /attachments\.length > 0 \? \(\s*<div className="mb-3 grid gap-3 sm:grid-cols-2">/);
  assert.match(chatMessageSource, /reasoning \? \(\s*<details className="mb-3 overflow-hidden rounded-2xl border/);
  assert.match(chatMessageSource, /<div className=\{hasRenderableContent \? 'mt-2\.5' : null\}>/);
  assert.match(chatMessageSource, /opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100/);
  assert.doesNotMatch(chatMessageSource, /showAvatar\?: boolean;/);
  assert.doesNotMatch(chatMessageSource, /reserveAvatarSpace\?: boolean;/);
  assert.doesNotMatch(chatMessageSource, /<Bot className=/);
});

await runTest('sdkwork-claw-chat empty state scales from stacked mobile welcome to a balanced desktop split layout', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const zhLocaleSource = read('packages/sdkwork-claw-i18n/src/locales/zh.json');
  const enLocaleSource = read('packages/sdkwork-claw-i18n/src/locales/en.json');

  assert.match(chatPageSource, /const appName = t\('common\.productName'\);/);
  assert.match(chatPageSource, /className="flex min-h-full flex-1 items-center justify-center px-3 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10"/);
  assert.match(chatPageSource, /style=\{\{\s*paddingBottom: emptyStateBottomPadding,\s*\}\}/);
  assert.match(chatPageSource, /className="grid w-full max-w-6xl gap-4 lg:grid-cols-\[minmax\(0,1\.05fr\)_minmax\(20rem,0\.95fr\)\] lg:items-center xl:gap-6"/);
  assert.match(chatPageSource, /className="flex flex-col items-center rounded-\[2rem\] border border-zinc-200\/70 bg-white\/80 p-6 text-center shadow-\[0_18px_48px_rgba\(15,23,42,0\.08\)\] sm:p-8 lg:items-start lg:p-10 lg:text-left/);
  assert.match(chatPageSource, /className="mb-6 inline-flex items-center rounded-full border border-primary-500\/15 bg-primary-500\/8 px-3 py-1 text-xs font-semibold tracking-\[0\.16em\] text-primary-600/);
  assert.match(chatPageSource, /className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"/);
  assert.match(chatPageSource, /className="group relative flex min-h-\[8\.5rem\] flex-col justify-between overflow-hidden rounded-\[1\.75rem\] border border-zinc-200\/80 bg-white p-5 text-left/);
  assert.match(chatPageSource, /appName,\s*\n\s*}\)/);
  assert.match(zhLocaleSource, /"emptyWithSkill":\s*"我已启用“\{\{skill\}\}”技能，会在 \{\{appName\}\} 中帮你处理与 \{\{category\}\} 相关的任务。"/);
  assert.match(zhLocaleSource, /"emptyDefault":\s*"我会在 \{\{appName\}\} 中帮你编写代码、回答问题、起草邮件，或一起头脑风暴。"/);
  assert.match(enLocaleSource, /"emptyWithSkill":\s*"I have the \\"\{\{skill\}\}\\" skill ready and can help with \{\{category\}\} tasks in \{\{appName\}\}\."/);
  assert.match(enLocaleSource, /"emptyDefault":\s*"I can help you write code, answer questions, draft emails, or brainstorm ideas in \{\{appName\}\}\."/);
  assert.doesNotMatch(zhLocaleSource, /"emptyDefault":\s*"[^"]*\{\{model\}\}[^"]*"/);
  assert.doesNotMatch(enLocaleSource, /"emptyDefault":\s*"[^"]*\{\{model\}\}[^"]*"/);
});
