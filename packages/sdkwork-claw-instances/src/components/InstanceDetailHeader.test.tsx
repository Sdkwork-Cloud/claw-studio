import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InstanceDetailHeader } from './InstanceDetailHeader.tsx';

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

await runTest(
  'InstanceDetailHeader keeps status badges and instance-level actions inside the dedicated header boundary',
  () => {
    const markup = renderToStaticMarkup(
      <InstanceDetailHeader
        activeInstanceId="instance-1"
        instance={{
          id: 'instance-1',
          name: 'OpenClaw Desktop',
          status: 'online',
          ip: '127.0.0.1',
          uptime: '2h',
          type: 'builtin',
          version: '2026.4.8',
        } as any}
        runtimeStatus="healthy"
        canSetActive
        canOpenOpenClawConsole
        canControlLifecycle
        canRestartLifecycle
        canStopLifecycle
        canStartLifecycle={false}
        canDelete
        t={(key, options) => (options ? `${key}:${JSON.stringify(options)}` : key)}
        getSharedStatusLabel={(status) => `status:${status}`}
        getStatusBadge={(status) => `status-badge:${status}`}
        getRuntimeStatusTone={(status) => `runtime-tone:${status}`}
        onSetActive={() => undefined}
        onOpenOpenClawConsole={() => undefined}
        onRestart={() => undefined}
        onStop={() => undefined}
        onStart={() => undefined}
        onDelete={() => undefined}
      />,
    );

    assert.match(markup, /OpenClaw Desktop/);
    assert.match(markup, /instances\.detail\.activeBadge/);
    assert.match(markup, /status:online/);
    assert.match(markup, /instances\.detail\.instanceWorkbench\.runtimeStates\.healthy/);
    assert.match(markup, /instances\.detail\.uptime:\{&quot;value&quot;:&quot;2h&quot;\}/);
    assert.match(markup, /instances\.detail\.actions\.openOpenClawConsole/);
    assert.match(markup, /instances\.detail\.actions\.restart/);
    assert.match(markup, /instances\.detail\.actions\.stop/);
    assert.match(markup, /instances\.detail\.actions\.uninstallInstance/);
    assert.doesNotMatch(markup, /instances\.detail\.actions\.setAsActive/);
  },
);

await runTest(
  'InstanceDetailHeader keeps the control-page action visible for built-in instances while suppressing uninstall',
  () => {
    const markup = renderToStaticMarkup(
      <InstanceDetailHeader
        activeInstanceId={null}
        instance={{
          id: 'local-built-in',
          name: 'Built-In OpenClaw',
          status: 'online',
          ip: '127.0.0.1',
          uptime: '9m',
          type: 'builtin',
          version: '2026.4.14',
        } as any}
        runtimeStatus="healthy"
        canSetActive={false}
        canOpenOpenClawConsole
        canControlLifecycle
        canRestartLifecycle
        canStopLifecycle
        canStartLifecycle={false}
        canDelete={false}
        t={(key) =>
          key === 'instances.detail.actions.openOpenClawConsole'
            ? '打开控制页面'
            : key === 'instances.detail.actions.uninstallInstance'
              ? '卸载实例'
              : key
        }
        getSharedStatusLabel={(status) => `status:${status}`}
        getStatusBadge={(status) => `status-badge:${status}`}
        getRuntimeStatusTone={(status) => `runtime-tone:${status}`}
        onSetActive={() => undefined}
        onOpenOpenClawConsole={() => undefined}
        onRestart={() => undefined}
        onStop={() => undefined}
        onStart={() => undefined}
        onDelete={() => undefined}
      />,
    );

    assert.match(markup, /打开控制页面/);
    assert.doesNotMatch(markup, /卸载实例/);
  },
);
