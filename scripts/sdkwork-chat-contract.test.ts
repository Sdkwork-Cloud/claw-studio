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
