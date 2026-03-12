import { PlatformAPI } from '../platform';

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

  async openExternal(url: string): Promise<void> {
    window.open(url, '_blank');
  }

  async selectFile(options?: { multiple?: boolean }): Promise<string[]> {
    console.warn('selectFile not fully supported in web without user interaction');
    return [];
  }

  async saveFile(data: Blob, filename: string): Promise<void> {
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

  async closeWindow(): Promise<void> {
    window.close();
  }

  async readFile(path: string): Promise<string> {
    throw new Error('readFile not supported in web');
  }

  async writeFile(path: string, content: string): Promise<void> {
    throw new Error('writeFile not supported in web');
  }
}
