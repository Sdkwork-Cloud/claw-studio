import { PlatformAPI, PlatformFileEntry, PlatformPathInfo, PlatformSaveFileOptions, PlatformSelectFileOptions } from './types';

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

  async closeWindow(): Promise<void> {
    window.close();
  }

  async listDirectory(_path = ''): Promise<PlatformFileEntry[]> {
    throw new Error('listDirectory not supported in web');
  }

  async pathExists(_path: string): Promise<boolean> {
    throw new Error('pathExists not supported in web');
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

  async writeFile(_path: string, _content: string): Promise<void> {
    throw new Error('writeFile not supported in web');
  }
}
