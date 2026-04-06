import assert from 'node:assert/strict';
import {
  resolveOpenClawDraftSessionId,
  resolveNewChatSessionModel,
  resolveChatSendSessionId,
  resolveChatSessionViewState,
  resolveGatewayVisibleSessionSyncTarget,
} from './chatSessionViewPolicy.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'resolveChatSessionViewState keeps the selected openclaw agent main session visible alongside its user-facing sessions',
  () => {
    const sessions = [
      { id: 'agent:research:main' },
      { id: 'agent:research:main:thread:claw-studio:session-1' },
      { id: 'agent:ops:main:thread:claw-studio:session-2' },
      { id: 'thread:claw-studio:legacy-session' },
    ];

    assert.deepEqual(
      resolveChatSessionViewState({
        sessions,
        activeSessionId: 'agent:research:main:thread:claw-studio:session-1',
        isOpenClawGateway: true,
        openClawAgentId: 'research',
      }),
      {
        visibleSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:claw-studio:session-1' },
          { id: 'thread:claw-studio:legacy-session' },
        ],
        selectableSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:claw-studio:session-1' },
          { id: 'thread:claw-studio:legacy-session' },
        ],
        effectiveActiveSessionId: 'agent:research:main:thread:claw-studio:session-1',
      },
    );
  },
);

await runTest(
  'resolveChatSessionViewState keeps legacy and unscoped gateway sessions visible alongside the selected agent main session',
  () => {
    const sessions = [
      { id: 'agent:research:main' },
      { id: 'agent:research:main:thread:claw-studio:session-1' },
      { id: 'thread:claw-studio:legacy-session' },
      { id: 'claw-studio:instance-a:session-2' },
      { id: 'agent:ops:main:thread:claw-studio:session-3' },
    ];

    assert.deepEqual(
      resolveChatSessionViewState({
        sessions,
        activeSessionId: 'thread:claw-studio:legacy-session',
        isOpenClawGateway: true,
        openClawAgentId: 'research',
      }),
      {
        visibleSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:claw-studio:session-1' },
          { id: 'thread:claw-studio:legacy-session' },
          { id: 'claw-studio:instance-a:session-2' },
        ],
        selectableSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:claw-studio:session-1' },
          { id: 'thread:claw-studio:legacy-session' },
          { id: 'claw-studio:instance-a:session-2' },
        ],
        effectiveActiveSessionId: 'thread:claw-studio:legacy-session',
      },
    );
  },
);

await runTest(
  'resolveChatSessionViewState hides non-current global unknown and cron gateway sessions to match the openclaw control ui session picker',
  () => {
    const sessions = [
      { id: 'agent:research:main' },
      { id: 'agent:research:main:thread:claw-studio:session-1' },
      { id: 'thread:claw-studio:legacy-session', sessionKind: 'direct' },
      { id: 'global:shared-session', sessionKind: 'global' },
      { id: 'unknown:shared-session', sessionKind: 'unknown' },
      { id: 'cron:nightly-roundup', sessionKind: 'direct' },
      { id: 'agent:research:cron:job-1', sessionKind: 'direct' },
    ];

    assert.deepEqual(
      resolveChatSessionViewState({
        sessions,
        activeSessionId: 'agent:research:main',
        isOpenClawGateway: true,
        openClawAgentId: 'research',
      }),
      {
        visibleSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:claw-studio:session-1' },
          { id: 'thread:claw-studio:legacy-session', sessionKind: 'direct' },
        ],
        selectableSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:claw-studio:session-1' },
          { id: 'thread:claw-studio:legacy-session', sessionKind: 'direct' },
        ],
        effectiveActiveSessionId: 'agent:research:main',
      },
    );
  },
);

await runTest(
  'resolveChatSessionViewState keeps the current global or cron session visible even when those sessions are normally hidden from the gateway list',
  () => {
    const sessions = [
      { id: 'agent:research:main' },
      { id: 'agent:research:main:thread:claw-studio:session-1' },
      { id: 'thread:claw-studio:legacy-session', sessionKind: 'direct' },
      { id: 'global:shared-session', sessionKind: 'global' },
      { id: 'cron:nightly-roundup', sessionKind: 'direct' },
    ];

    assert.deepEqual(
      resolveChatSessionViewState({
        sessions,
        activeSessionId: 'global:shared-session',
        isOpenClawGateway: true,
        openClawAgentId: 'research',
      }),
      {
        visibleSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:claw-studio:session-1' },
          { id: 'thread:claw-studio:legacy-session', sessionKind: 'direct' },
          { id: 'global:shared-session', sessionKind: 'global' },
        ],
        selectableSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:claw-studio:session-1' },
          { id: 'thread:claw-studio:legacy-session', sessionKind: 'direct' },
          { id: 'global:shared-session', sessionKind: 'global' },
        ],
        effectiveActiveSessionId: 'global:shared-session',
      },
    );

    assert.deepEqual(
      resolveChatSessionViewState({
        sessions,
        activeSessionId: 'cron:nightly-roundup',
        isOpenClawGateway: true,
        openClawAgentId: 'research',
      }),
      {
        visibleSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:claw-studio:session-1' },
          { id: 'thread:claw-studio:legacy-session', sessionKind: 'direct' },
          { id: 'cron:nightly-roundup', sessionKind: 'direct' },
        ],
        selectableSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:claw-studio:session-1' },
          { id: 'thread:claw-studio:legacy-session', sessionKind: 'direct' },
          { id: 'cron:nightly-roundup', sessionKind: 'direct' },
        ],
        effectiveActiveSessionId: 'cron:nightly-roundup',
      },
    );
  },
);

await runTest(
  'resolveChatSessionViewState falls back to the selected agent main session when the raw active session is hidden or outside the selected agent scope',
  () => {
    const sessions = [
      { id: 'agent:research:main' },
      { id: 'agent:research:main:thread:claw-studio:session-1' },
      { id: 'agent:research:main:thread:claw-studio:session-2' },
    ];

    assert.deepEqual(
      resolveChatSessionViewState({
        sessions,
        activeSessionId: 'agent:research:main',
        isOpenClawGateway: true,
        openClawAgentId: 'research',
      }),
      {
        visibleSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:claw-studio:session-1' },
          { id: 'agent:research:main:thread:claw-studio:session-2' },
        ],
        selectableSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:claw-studio:session-1' },
          { id: 'agent:research:main:thread:claw-studio:session-2' },
        ],
        effectiveActiveSessionId: 'agent:research:main',
      },
    );
  },
);

await runTest(
  'resolveChatSessionViewState leaves direct chat sessions unchanged',
  () => {
    const sessions = [{ id: 'session-a' }, { id: 'session-b' }];

    assert.deepEqual(
      resolveChatSessionViewState({
        sessions,
        activeSessionId: 'session-b',
        isOpenClawGateway: false,
        openClawAgentId: 'research',
      }),
      {
        visibleSessions: sessions,
        selectableSessions: sessions,
        effectiveActiveSessionId: 'session-b',
      },
    );
  },
);

await runTest('resolveChatSendSessionId uses the effective visible session for openclaw gateway sends', () => {
  assert.equal(
    resolveChatSendSessionId({
      activeSessionId: 'agent:research:main',
      effectiveActiveSessionId: null,
      isOpenClawGateway: true,
    }),
    null,
  );

  assert.equal(
    resolveChatSendSessionId({
      activeSessionId: 'agent:ops:main',
      effectiveActiveSessionId: 'agent:research:main',
      isOpenClawGateway: true,
    }),
    'agent:research:main',
  );
});

await runTest('resolveChatSendSessionId keeps the raw active session for direct chat sends', () => {
  assert.equal(
    resolveChatSendSessionId({
      activeSessionId: 'session-a',
      effectiveActiveSessionId: null,
      isOpenClawGateway: false,
    }),
    'session-a',
  );
});

await runTest('resolveNewChatSessionModel keeps the active gateway model id for new openclaw threads', () => {
  assert.equal(
    resolveNewChatSessionModel({
      isOpenClawGateway: true,
      activeModelId: 'anthropic/claude-3-7-sonnet',
      activeModelName: 'Claude 3.7 Sonnet',
    }),
    'anthropic/claude-3-7-sonnet',
  );
});

await runTest('resolveNewChatSessionModel keeps the active local model name for direct chats', () => {
  assert.equal(
    resolveNewChatSessionModel({
      isOpenClawGateway: false,
      activeModelId: 'google/gemini-2.5-pro',
      activeModelName: 'Gemini 2.5 Pro',
    }),
    'Gemini 2.5 Pro',
  );
});

await runTest('resolveNewChatSessionModel returns undefined when no active model is available', () => {
  assert.equal(
    resolveNewChatSessionModel({
      isOpenClawGateway: true,
      activeModelId: '',
      activeModelName: '',
    }),
    undefined,
  );
});

await runTest(
  'resolveOpenClawDraftSessionId targets the selected agent main session for new gateway sends',
  () => {
    assert.equal(
      resolveOpenClawDraftSessionId({
        isOpenClawGateway: true,
        openClawAgentId: 'research',
      }),
      'agent:research:main',
    );

    assert.equal(
      resolveOpenClawDraftSessionId({
        isOpenClawGateway: true,
        openClawAgentId: null,
      }),
      'agent:main:main',
    );

    assert.equal(
      resolveOpenClawDraftSessionId({
        isOpenClawGateway: false,
        openClawAgentId: 'research',
      }),
      undefined,
    );
  },
);

await runTest(
  'resolveGatewayVisibleSessionSyncTarget keeps the raw gateway session untouched when the current one is hidden by agent scope',
  () => {
    assert.equal(
      resolveGatewayVisibleSessionSyncTarget({
        isOpenClawGateway: true,
        activeSessionId: 'agent:research:main:thread:claw-studio:session-1',
        effectiveActiveSessionId: 'agent:ops:main',
      }),
      null,
    );
  },
);

await runTest(
  'resolveGatewayVisibleSessionSyncTarget stays idle when the active gateway session already matches the visible session or when the route is not gateway-backed',
  () => {
    assert.equal(
      resolveGatewayVisibleSessionSyncTarget({
        isOpenClawGateway: true,
        activeSessionId: 'agent:ops:main',
        effectiveActiveSessionId: 'agent:ops:main',
      }),
      null,
    );

    assert.equal(
      resolveGatewayVisibleSessionSyncTarget({
        isOpenClawGateway: false,
        activeSessionId: 'session-a',
        effectiveActiveSessionId: 'session-b',
      }),
      null,
    );

    assert.equal(
      resolveGatewayVisibleSessionSyncTarget({
        isOpenClawGateway: true,
        activeSessionId: null,
        effectiveActiveSessionId: null,
      }),
      null,
    );
  },
);
