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

await runTest('sdkwork-claw-chat reflows chrome before text gets squeezed on smaller screens', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const chatSidebarSource = read('packages/sdkwork-claw-chat/src/components/ChatSidebar.tsx');
  const chatInputSource = read('packages/sdkwork-claw-chat/src/components/ChatInput.tsx');
  const chatMessageSource = read('packages/sdkwork-claw-chat/src/components/ChatMessage.tsx');

  assert.match(chatPageSource, /const \[isSidebarOpen, setIsSidebarOpen\] = useState\(false\);/);
  assert.match(chatPageSource, /className="hidden h-full w-72 shrink-0 lg:flex xl:w-80"/);
  assert.match(chatPageSource, /className="fixed inset-0 z-40 bg-zinc-950\/45 backdrop-blur-sm lg:hidden"/);
  assert.match(chatPageSource, /className="fixed inset-y-0 left-0 z-50 w-\[min\(22rem,calc\(100vw-1rem\)\)\] lg:hidden"/);
  assert.match(chatPageSource, /className="z-10 flex min-h-16 flex-shrink-0 flex-wrap items-center justify-between gap-3/);
  assert.match(chatPageSource, /className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3"/);
  assert.match(chatPageSource, /className="relative min-w-0 max-w-full"/);
  assert.match(chatPageSource, /className="flex-1 space-y-5 px-3 py-6 pb-36 sm:space-y-6 sm:px-4 sm:py-8 sm:pb-40"/);

  assert.match(chatSidebarSource, /onSessionSelect\?: \(\) => void;/);
  assert.match(chatSidebarSource, /onClose\?: \(\) => void;/);
  assert.match(chatSidebarSource, /'flex h-full min-h-0 w-full flex-col border-r border-zinc-200 bg-zinc-50\/50/);
  assert.match(chatSidebarSource, /opacity-100 transition-opacity hover:bg-zinc-200 md:opacity-0 md:group-hover:opacity-100/);

  assert.match(chatInputSource, /const viewportPadding = window\.innerWidth < 640 \? 12 : 16;/);
  assert.match(chatInputSource, /Math\.max\(window\.innerWidth < 640 \? 280 : 320/);
  assert.match(chatInputSource, /className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"/);
  assert.match(chatInputSource, /truncate max-w-\[8\.5rem\] sm:max-w-\[12rem\] lg:max-w-\[16rem\]/);

  assert.match(chatMessageSource, /justify-end pl-4 sm:pl-12 lg:pl-24/);
  assert.match(chatMessageSource, /justify-start pr-4 sm:pr-12 lg:pr-24/);
  assert.match(chatMessageSource, /mb-2 flex flex-wrap items-start justify-between gap-2/);
  assert.match(chatMessageSource, /opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100/);
});

await runTest('sdkwork-claw-chat empty state scales from stacked mobile welcome to a balanced desktop split layout', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const zhLocaleSource = read('packages/sdkwork-claw-i18n/src/locales/zh.json');
  const enLocaleSource = read('packages/sdkwork-claw-i18n/src/locales/en.json');

  assert.match(chatPageSource, /const appName = t\('common\.productName'\);/);
  assert.match(chatPageSource, /className="flex min-h-full flex-1 items-center justify-center px-3 pb-\[calc\(9\.5rem\+env\(safe-area-inset-bottom\)\)\] pt-6 sm:px-6 sm:pb-\[calc\(10\.5rem\+env\(safe-area-inset-bottom\)\)\] sm:pt-8 lg:px-8 lg:pb-\[calc\(11rem\+env\(safe-area-inset-bottom\)\)\] lg:pt-10"/);
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
