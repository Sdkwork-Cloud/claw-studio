import assert from 'node:assert/strict';
import test from 'node:test';

type TestWindow = {
  __TAURI_INTERNALS__?: unknown;
};

type TestDocument = {
  documentElement?: {
    getAttribute(name: string): string | null;
  };
};

test('shows desktop window controls when platform bridge already reports desktop', async () => {
  const { shouldRenderDesktopWindowControls } = await import('./desktopWindowControlsRuntime.ts');

  assert.equal(
    shouldRenderDesktopWindowControls('desktop'),
    true,
  );
});

test('shows desktop window controls when the desktop host marks the document before shell render', async () => {
  const { shouldRenderDesktopWindowControls } = await import('./desktopWindowControlsRuntime.ts');

  const runtimeDocument: TestDocument = {
    documentElement: {
      getAttribute(name: string) {
        return name === 'data-app-platform' ? 'desktop' : null;
      },
    },
  };

  assert.equal(
    shouldRenderDesktopWindowControls('web', {
      runtimeDocument: runtimeDocument as Document,
    }),
    true,
  );
});

test('shows desktop window controls when Tauri internals are available even if the bridge still looks like web', async () => {
  const { shouldRenderDesktopWindowControls } = await import('./desktopWindowControlsRuntime.ts');

  const runtimeWindow: TestWindow = {
    __TAURI_INTERNALS__: {},
  };

  assert.equal(
    shouldRenderDesktopWindowControls('web', {
      runtimeWindow: runtimeWindow as Window,
    }),
    true,
  );
});

test('keeps desktop window controls hidden in the plain web host', async () => {
  const { shouldRenderDesktopWindowControls } = await import('./desktopWindowControlsRuntime.ts');

  assert.equal(
    shouldRenderDesktopWindowControls('web', {
      runtimeWindow: {} as Window,
      runtimeDocument: {
        documentElement: {
          getAttribute() {
            return null;
          },
        },
      } as Document,
    }),
    false,
  );
});
