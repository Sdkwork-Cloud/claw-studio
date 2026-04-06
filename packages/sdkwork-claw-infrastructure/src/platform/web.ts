import type {
  PlatformAPI,
  PlatformFetchedRemoteUrl,
  PlatformFileEntry,
  PlatformNotificationRequest,
  PlatformPathInfo,
  PlatformSaveFileOptions,
  PlatformSelectFileOptions,
} from './types.ts';

function deriveFileNameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split('/').filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : undefined;
  } catch {
    return undefined;
  }
}

function deriveFileNameFromContentDisposition(header: string | null) {
  if (!header) {
    return undefined;
  }

  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }

  const asciiMatch = header.match(/filename="?([^";]+)"?/i);
  return asciiMatch?.[1]?.trim() || undefined;
}

export class WebPlatform implements PlatformAPI {
  getPlatform(): 'web' | 'desktop' {
    return 'web';
  }

  async getDeviceId(): Promise<string> {
    let id = localStorage.getItem('device_id');
    if (!id) {
      id = 'web-device-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('device_id', id);
    }
    return id;
  }

  async setStorage(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async getStorage(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async copy(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
  }

  async showNotification(notification: PlatformNotificationRequest): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (window.Notification.permission === 'default') {
      try {
        await window.Notification.requestPermission();
      } catch {
        return;
      }
    }

    if (window.Notification.permission !== 'granted') {
      return;
    }

    void new window.Notification(notification.title, {
      body: notification.body,
      tag: notification.tag,
    });
  }

  async openExternal(url: string): Promise<void> {
    window.open(url, '_blank');
  }

  supportsNativeScreenshot(): boolean {
    return false;
  }

  async captureScreenshot() {
    return null;
  }

  async fetchRemoteUrl(url: string): Promise<PlatformFetchedRemoteUrl> {
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`.trim());
    }

    const resolvedUrl = response.url || url;
    const bytes = new Uint8Array(await response.arrayBuffer());

    return {
      url: resolvedUrl,
      bytes,
      contentType: response.headers.get('content-type')?.trim() || undefined,
      fileName:
        deriveFileNameFromContentDisposition(response.headers.get('content-disposition')) ||
        deriveFileNameFromUrl(resolvedUrl),
    };
  }

  async selectFile(options?: PlatformSelectFileOptions): Promise<string[]> {
    void options;
    console.warn('selectFile not fully supported in web without user interaction');
    return [];
  }

  async saveFile(data: Blob, filename: string, options?: PlatformSaveFileOptions): Promise<void> {
    void options;
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async minimizeWindow(): Promise<void> {
    console.warn('minimizeWindow not supported in web');
  }

  async maximizeWindow(): Promise<void> {
    console.warn('maximizeWindow not supported in web');
  }

  async restoreWindow(): Promise<void> {
    console.warn('restoreWindow not supported in web');
  }

  async isWindowMaximized(): Promise<boolean> {
    return false;
  }

  async subscribeWindowMaximized(_listener: (isMaximized: boolean) => void): Promise<() => void> {
    return () => {};
  }

  async closeWindow(): Promise<void> {
    window.close();
  }

  async listDirectory(_path = ''): Promise<PlatformFileEntry[]> {
    throw new Error('listDirectory not supported in web');
  }

  async pathExists(_path: string): Promise<boolean> {
    throw new Error('pathExists not supported in web');
  }

  async pathExistsForUserTooling(_path: string): Promise<boolean> {
    throw new Error('pathExistsForUserTooling not supported in web');
  }

  async getPathInfo(_path: string): Promise<PlatformPathInfo> {
    throw new Error('getPathInfo not supported in web');
  }

  async createDirectory(_path: string): Promise<void> {
    throw new Error('createDirectory not supported in web');
  }

  async removePath(_path: string): Promise<void> {
    throw new Error('removePath not supported in web');
  }

  async copyPath(_sourcePath: string, _destinationPath: string): Promise<void> {
    throw new Error('copyPath not supported in web');
  }

  async movePath(_sourcePath: string, _destinationPath: string): Promise<void> {
    throw new Error('movePath not supported in web');
  }

  async readBinaryFile(_path: string): Promise<Uint8Array> {
    throw new Error('readBinaryFile not supported in web');
  }

  async writeBinaryFile(_path: string, _content: Uint8Array | number[]): Promise<void> {
    throw new Error('writeBinaryFile not supported in web');
  }

  async readFile(_path: string): Promise<string> {
    throw new Error('readFile not supported in web');
  }

  async readFileForUserTooling(_path: string): Promise<string> {
    throw new Error('readFileForUserTooling not supported in web');
  }

  async writeFile(_path: string, _content: string): Promise<void> {
    throw new Error('writeFile not supported in web');
  }
}
