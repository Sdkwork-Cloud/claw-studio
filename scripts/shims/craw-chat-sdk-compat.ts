export * from '../../../craw-chat/sdks/sdkwork-craw-chat-sdk/sdkwork-craw-chat-sdk-typescript/composed/dist/index.js';

import {
  CrawChatSdkClient,
  type CrawChatSdkClientOptions,
} from '../../../craw-chat/sdks/sdkwork-craw-chat-sdk/sdkwork-craw-chat-sdk-typescript/composed/dist/index.js';

type CrawChatCompatContext = {
  getAuthToken?: () => string | undefined;
};

type CrawChatCompatBackendClient = {
  setAuthToken?: (token: string) => void;
};

type CrawChatCompatOptions = CrawChatSdkClientOptions & {
  backendClient?: CrawChatCompatBackendClient;
};

function resolveInitialAuthToken(options: CrawChatSdkClientOptions): string | undefined {
  if (typeof options.authToken === 'string' && options.authToken.trim()) {
    return options.authToken;
  }

  const backendAuthToken = (
    options as CrawChatSdkClientOptions & {
      backendConfig?: {
        authToken?: string;
      };
    }
  ).backendConfig?.authToken;
  return typeof backendAuthToken === 'string' && backendAuthToken.trim()
    ? backendAuthToken
    : undefined;
}

export class CrawChatClient extends CrawChatSdkClient {
  readonly backendClient?: CrawChatCompatBackendClient;
  private currentAuthToken: string | undefined;

  constructor(options: CrawChatCompatOptions) {
    super(options);
    this.backendClient = options.backendClient;

    const initialAuthToken = resolveInitialAuthToken(options);
    if (initialAuthToken) {
      this.setAuthToken(initialAuthToken);
    }
  }

  setAuthToken(token: string): void {
    if (typeof token === 'string' && token.trim()) {
      this.auth.useToken(token);
      this.currentAuthToken = token;
      return;
    }

    this.auth.clearToken();
    this.currentAuthToken = '';
  }

  clearAuthToken(): void {
    this.auth.clearToken();
    this.currentAuthToken = '';
  }

  getAuthToken(): string | undefined {
    return this.currentAuthToken
      ?? (this as unknown as { context?: CrawChatCompatContext }).context?.getAuthToken?.();
  }
}

export default CrawChatClient;
