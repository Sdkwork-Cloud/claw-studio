export interface PlatformAPI {
  getPlatform(): 'web' | 'desktop';

  getDeviceId(): Promise<string>;

  setStorage(key: string, value: string): Promise<void>;
  getStorage(key: string): Promise<string | null>;

  copy(text: string): Promise<void>;
  openExternal(url: string): Promise<void>;

  selectFile(options?: { multiple?: boolean }): Promise<string[]>;
  saveFile(data: Blob, filename: string): Promise<void>;

  minimizeWindow(): Promise<void>;
  maximizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;

  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
}
