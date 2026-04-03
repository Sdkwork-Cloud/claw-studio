import assert from 'node:assert/strict';
import type { PlatformAPI } from '@sdkwork/claw-infrastructure';
import { createChatUploadService } from './chatUploadService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createPlatformBridgeStub(overrides: Partial<PlatformAPI> = {}): PlatformAPI {
  return {
    getPlatform: () => 'web',
    getDeviceId: async () => 'test-device',
    setStorage: async () => {},
    getStorage: async () => null,
    copy: async () => {},
    openExternal: async () => {},
    supportsNativeScreenshot: () => false,
    captureScreenshot: async () => null,
    fetchRemoteUrl: async (url) => {
      throw new Error(`fetchRemoteUrl stub not configured for ${url}`);
    },
    selectFile: async () => [],
    saveFile: async () => {},
    minimizeWindow: async () => {},
    maximizeWindow: async () => {},
    restoreWindow: async () => {},
    isWindowMaximized: async () => false,
    subscribeWindowMaximized: async () => async () => {},
    closeWindow: async () => {},
    listDirectory: async () => [],
    pathExists: async () => false,
    pathExistsForUserTooling: async () => false,
    getPathInfo: async (path) => ({
      path,
      name: path.split(/[\\/]/).pop() || path,
      kind: 'missing',
      size: null,
      extension: null,
      exists: false,
      lastModifiedMs: null,
    }),
    createDirectory: async () => {},
    removePath: async () => {},
    copyPath: async () => {},
    movePath: async () => {},
    readBinaryFile: async () => new Uint8Array(),
    writeBinaryFile: async () => {},
    readFile: async () => '',
    readFileForUserTooling: async () => '',
    writeFile: async () => {},
    ...overrides,
  };
}

await runTest('chatUploadService uploads a blob through the generated upload SDK and normalizes the chat attachment payload', async () => {
  const uploadCalls: Array<{ url: string; init?: RequestInit }> = [];
  const service = createChatUploadService({
    createId: () => 'asset-fixed',
    now: () => new Date('2026-03-22T08:30:00.000Z'),
    fetchFn: async (input, init) => {
      uploadCalls.push({
        url: String(input),
        init,
      });

      return new Response(null, {
        status: 200,
      });
    },
    getClient: () => ({
      upload: {
        getPresignedUrl: async (body: { objectKey?: string }) => ({
          code: '2000',
          data: {
            url: 'https://upload.example.com/presigned-put',
            previewUrl: 'https://cdn.example.com/chat/preview.png',
            objectKey: body.objectKey,
          },
        }),
        registerPresigned: async (body: {
          objectKey: string;
          fileName?: string;
          size: number;
          contentType?: string;
          type?: string;
        }) => ({
          code: '2000',
          data: {
            fileId: 'file-001',
            fileName: body.fileName,
            fileSize: body.size,
            fileType: body.type,
            contentType: body.contentType,
            objectKey: body.objectKey,
            accessUrl: 'https://cdn.example.com/chat/final.png',
          },
        }),
      },
    }),
  });

  const result = await service.uploadFile({
    fileName: 'Screen Shot 2026-03-22.png',
    kind: 'screenshot',
    data: new Blob(['image-bytes'], { type: 'image/png' }),
  });

  assert.equal(uploadCalls.length, 1);
  assert.equal(uploadCalls[0]?.url, 'https://upload.example.com/presigned-put');
  assert.equal(uploadCalls[0]?.init?.method, 'PUT');
  assert.equal(result.id, 'asset-fixed');
  assert.equal(result.kind, 'screenshot');
  assert.equal(result.name, 'Screen Shot 2026-03-22.png');
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.sizeBytes, 11);
  assert.equal(result.fileId, 'file-001');
  assert.equal(result.url, 'https://cdn.example.com/chat/final.png');
  assert.equal(result.previewUrl, 'https://cdn.example.com/chat/final.png');
  assert.match(result.objectKey || '', /^chat\/2026\/03\/22\//);
});

await runTest('chatUploadService can fetch a remote URL, upload it, and preserve the original source URL in metadata', async () => {
  const fetchCalls: string[] = [];
  const service = createChatUploadService({
    createId: () => 'asset-url',
    now: () => new Date('2026-03-22T09:00:00.000Z'),
    fetchFn: async (input, init) => {
      const url = String(input);
      fetchCalls.push(url);

      if (url === 'https://remote.example.com/demo.mp3') {
        return new Response(new Blob(['voice-bytes'], { type: 'audio/mpeg' }), {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
          },
        });
      }

      assert.equal(init?.method, 'PUT');
      return new Response(null, {
        status: 200,
      });
    },
    getClient: () => ({
      upload: {
        getPresignedUrl: async (body: { objectKey?: string }) => ({
          code: '2000',
          data: {
            url: 'https://upload.example.com/presigned-audio',
            previewUrl: 'https://cdn.example.com/audio-preview.mp3',
            objectKey: body.objectKey,
          },
        }),
        registerPresigned: async (body: {
          objectKey: string;
          fileName?: string;
          size: number;
          contentType?: string;
          type?: string;
        }) => ({
          code: '2000',
          data: {
            fileId: 'file-audio',
            fileName: body.fileName,
            fileSize: body.size,
            fileType: body.type,
            contentType: body.contentType,
            objectKey: body.objectKey,
            accessUrl: 'https://cdn.example.com/audio-final.mp3',
          },
        }),
      },
    }),
  });

  const result = await service.uploadRemoteUrl({
    url: 'https://remote.example.com/demo.mp3',
    fileName: 'demo.mp3',
    kind: 'audio',
  });

  assert.deepEqual(fetchCalls, [
    'https://remote.example.com/demo.mp3',
    'https://upload.example.com/presigned-audio',
  ]);
  assert.equal(result.kind, 'audio');
  assert.equal(result.originalUrl, 'https://remote.example.com/demo.mp3');
  assert.equal(result.url, 'https://cdn.example.com/audio-final.mp3');
});

await runTest('chatUploadService prefers the desktop native remote fetch bridge for URL imports when available', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
  const originalBridge = getPlatformBridge();
  const nativeFetchCalls: string[] = [];
  const uploadCalls: string[] = [];

  configurePlatformBridge({
    platform: createPlatformBridgeStub({
      getPlatform: () => 'desktop',
      fetchRemoteUrl: async (url) => {
        nativeFetchCalls.push(url);
        return {
          url,
          fileName: 'native-demo.mp3',
          contentType: 'audio/mpeg',
          bytes: new TextEncoder().encode('native-voice-bytes'),
        };
      },
    }),
  });

  try {
    const service = createChatUploadService({
      createId: () => 'asset-native-url',
      now: () => new Date('2026-03-22T09:30:00.000Z'),
      fetchFn: async (input, init) => {
        uploadCalls.push(String(input));
        assert.equal(init?.method, 'PUT');
        return new Response(null, {
          status: 200,
        });
      },
      getClient: () => ({
        upload: {
          getPresignedUrl: async (body: { objectKey?: string }) => ({
            code: '2000',
            data: {
              url: 'https://upload.example.com/presigned-native-audio',
              objectKey: body.objectKey,
            },
          }),
          registerPresigned: async (body: {
            objectKey: string;
            fileName?: string;
            size: number;
            contentType?: string;
            type?: string;
          }) => ({
            code: '2000',
            data: {
              fileId: 'file-native-audio',
              fileName: body.fileName,
              fileSize: body.size,
              fileType: body.type,
              contentType: body.contentType,
              objectKey: body.objectKey,
              accessUrl: 'https://cdn.example.com/audio-native.mp3',
            },
          }),
        },
      }),
    });

    const result = await service.uploadRemoteUrl({
      url: 'https://remote.example.com/native-demo.mp3',
      kind: 'audio',
    });

    assert.deepEqual(nativeFetchCalls, ['https://remote.example.com/native-demo.mp3']);
    assert.deepEqual(uploadCalls, ['https://upload.example.com/presigned-native-audio']);
    assert.equal(result.name, 'native-demo.mp3');
    assert.equal(result.mimeType, 'audio/mpeg');
    assert.equal(result.originalUrl, 'https://remote.example.com/native-demo.mp3');
    assert.equal(result.url, 'https://cdn.example.com/audio-native.mp3');
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('chatUploadService resolves the desktop native remote fetch bridge at call time instead of service creation time', async () => {
  const { configurePlatformBridge, getPlatformBridge } = await import('@sdkwork/claw-infrastructure');
  const originalBridge = getPlatformBridge();
  const nativeFetchCalls: string[] = [];
  const browserFetchCalls: string[] = [];

  const service = createChatUploadService({
    createId: () => 'asset-late-native-url',
    now: () => new Date('2026-03-22T10:00:00.000Z'),
    fetchFn: async (input, init) => {
      const url = String(input);

      if (url === 'https://remote.example.com/late-native.mp3') {
        browserFetchCalls.push(url);
        return new Response(new Blob(['browser-voice'], { type: 'audio/mpeg' }), {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
          },
        });
      }

      assert.equal(init?.method, 'PUT');
      return new Response(null, {
        status: 200,
      });
    },
    getClient: () => ({
      upload: {
        getPresignedUrl: async (body: { objectKey?: string }) => ({
          code: '2000',
          data: {
            url: 'https://upload.example.com/presigned-late-native-audio',
            objectKey: body.objectKey,
          },
        }),
        registerPresigned: async (body: {
          objectKey: string;
          fileName?: string;
          size: number;
          contentType?: string;
          type?: string;
        }) => ({
          code: '2000',
          data: {
            fileId: 'file-late-native-audio',
            fileName: body.fileName,
            fileSize: body.size,
            fileType: body.type,
            contentType: body.contentType,
            objectKey: body.objectKey,
            accessUrl: 'https://cdn.example.com/audio-late-native.mp3',
          },
        }),
      },
    }),
  });

  configurePlatformBridge({
    platform: createPlatformBridgeStub({
      getPlatform: () => 'desktop',
      fetchRemoteUrl: async (url) => {
        nativeFetchCalls.push(url);
        return {
          url,
          fileName: 'late-native.mp3',
          contentType: 'audio/mpeg',
          bytes: new TextEncoder().encode('native-after-create'),
        };
      },
    }),
  });

  try {
    const result = await service.uploadRemoteUrl({
      url: 'https://remote.example.com/late-native.mp3',
      kind: 'audio',
    });

    assert.deepEqual(nativeFetchCalls, ['https://remote.example.com/late-native.mp3']);
    assert.deepEqual(browserFetchCalls, []);
    assert.equal(result.name, 'late-native.mp3');
    assert.equal(result.originalUrl, 'https://remote.example.com/late-native.mp3');
    assert.equal(result.url, 'https://cdn.example.com/audio-late-native.mp3');
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('chatUploadService surfaces a helpful error when the presigned PUT fails', async () => {
  const service = createChatUploadService({
    fetchFn: async () =>
      new Response('upload failed', {
        status: 403,
        statusText: 'Forbidden',
      }),
    getClient: () => ({
      upload: {
        getPresignedUrl: async (body: { objectKey?: string }) => ({
          code: '2000',
          data: {
            url: 'https://upload.example.com/rejected-put',
            previewUrl: 'https://cdn.example.com/rejected-preview.png',
            objectKey: body.objectKey,
          },
        }),
        registerPresigned: async () => {
          throw new Error('registerPresigned should not run after a failed PUT');
        },
      },
    }),
  });

  await assert.rejects(
    () =>
      service.uploadFile({
        fileName: 'rejected.png',
        kind: 'image',
        data: new Blob(['bad'], { type: 'image/png' }),
      }),
    /rejected\.png/i,
  );
});
