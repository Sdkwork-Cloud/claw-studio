import type {
  LoginForm,
  LoginVO,
  OAuthAuthUrlForm,
  OAuthLoginForm,
  OAuthUrlVO,
  PasswordResetForm,
  PasswordResetRequestForm,
  PhoneLoginForm,
  QrCodeStatusVO,
  QrCodeVO,
  RegisterForm,
  TokenRefreshForm,
  UserInfoVO,
  VerifyCodeCheckForm,
  VerifyCodeSendForm,
  VerifyResultVO,
} from '@sdkwork/app-sdk';
import {
  clearAppSdkSessionTokens,
  getAppSdkClientConfig,
  getAppSdkClientWithSession,
  persistAppSdkSessionTokens,
  readAppSdkSessionTokens,
  resolveAppSdkAccessToken,
} from '../sdk/useAppSdkClient.ts';
import {
  type AppSdkEnvelope,
  unwrapAppSdkResponse,
} from '../sdk/appSdkResult.ts';

export type AppAuthVerifyType = 'EMAIL' | 'PHONE';
export type AppAuthScene = 'LOGIN' | 'REGISTER' | 'RESET_PASSWORD';
export type AppAuthPasswordResetChannel = 'EMAIL' | 'SMS';
export type AppAuthSocialProvider = string;
export type AppAuthOAuthDeviceType = 'web' | 'desktop' | 'android' | 'ios';
export type AppAuthLoginQrCodeStatus = 'pending' | 'scanned' | 'confirmed' | 'expired';

export interface AppAuthLoginInput {
  username: string;
  password: string;
  remember?: boolean;
}

export interface AppAuthRegisterInput {
  username: string;
  password: string;
  confirmPassword?: string;
  email?: string;
  phone?: string;
  type?: 'DEFAULT' | 'EMAIL' | 'PHONE';
  name?: string;
  verificationCode?: string;
}

export interface AppAuthPhoneLoginInput {
  phone: string;
  code: string;
  deviceId?: string;
  deviceType?: AppAuthOAuthDeviceType;
  deviceName?: string;
  appVersion?: string;
}

export interface AppAuthEmailLoginInput {
  email: string;
  code: string;
  deviceId?: string;
  deviceType?: AppAuthOAuthDeviceType;
  deviceName?: string;
  appVersion?: string;
}

export interface AppAuthSendVerifyCodeInput {
  target: string;
  verifyType: AppAuthVerifyType;
  scene: AppAuthScene;
}

export interface AppAuthVerifyCodeInput extends AppAuthSendVerifyCodeInput {
  code: string;
}

export interface AppAuthPasswordResetRequestInput {
  account: string;
  channel: AppAuthPasswordResetChannel;
}

export interface AppAuthPasswordResetInput {
  account: string;
  code: string;
  newPassword: string;
  confirmPassword?: string;
}

export interface AppAuthOAuthAuthorizationInput {
  provider: AppAuthSocialProvider;
  redirectUri: string;
  scope?: string;
  state?: string;
}

export interface AppAuthOAuthLoginInput {
  provider: AppAuthSocialProvider;
  code: string;
  state?: string;
  deviceId?: string;
  deviceType?: AppAuthOAuthDeviceType;
}

export interface AppAuthSession {
  authToken: string;
  accessToken: string;
  refreshToken?: string;
  userInfo?: UserInfoVO;
}

export interface AppAuthLoginQrCode {
  type?: string;
  title?: string;
  description?: string;
  qrKey: string;
  qrUrl?: string;
  qrContent?: string;
  expireTime?: number;
}

export interface AppAuthLoginQrCodeStatusResult {
  status: AppAuthLoginQrCodeStatus;
  session?: AppAuthSession;
  userInfo?: UserInfoVO;
}

interface AppAuthEmailLoginForm {
  email: string;
  code: string;
  deviceId?: string;
  deviceType?: AppAuthOAuthDeviceType;
  deviceName?: string;
  appVersion?: string;
}

interface AppAuthClientCompat {
  emailLogin?: (
    body: AppAuthEmailLoginForm,
  ) => Promise<LoginVO | AppSdkEnvelope<LoginVO> | null | undefined>;
  createSendSmsCode?: (
    body: VerifyCodeSendForm,
  ) => Promise<void | AppSdkEnvelope<void> | null | undefined>;
  verifySmsCode?: (
    body: VerifyCodeCheckForm,
  ) => Promise<VerifyResultVO | AppSdkEnvelope<VerifyResultVO> | null | undefined>;
}

export interface IAppAuthService {
  login(input: AppAuthLoginInput): Promise<AppAuthSession>;
  loginWithPhone(input: AppAuthPhoneLoginInput): Promise<AppAuthSession>;
  loginWithEmail(input: AppAuthEmailLoginInput): Promise<AppAuthSession>;
  register(input: AppAuthRegisterInput): Promise<AppAuthSession>;
  logout(): Promise<void>;
  refreshToken(refreshToken?: string): Promise<AppAuthSession>;
  sendVerifyCode(input: AppAuthSendVerifyCodeInput): Promise<void>;
  verifyCode(input: AppAuthVerifyCodeInput): Promise<boolean>;
  requestPasswordReset(input: AppAuthPasswordResetRequestInput): Promise<void>;
  resetPassword(input: AppAuthPasswordResetInput): Promise<void>;
  getOAuthAuthorizationUrl(input: AppAuthOAuthAuthorizationInput): Promise<string>;
  loginWithOAuth(input: AppAuthOAuthLoginInput): Promise<AppAuthSession>;
  generateLoginQrCode(): Promise<AppAuthLoginQrCode>;
  checkLoginQrCodeStatus(qrKey: string): Promise<AppAuthLoginQrCodeStatusResult>;
  getCurrentSession(): Promise<AppAuthSession | null>;
}

function mapScene(scene: AppAuthScene): VerifyCodeSendForm['type'] {
  if (scene === 'REGISTER') {
    return 'REGISTER';
  }
  if (scene === 'RESET_PASSWORD') {
    return 'RESET_PASSWORD';
  }
  return 'LOGIN';
}

function mapVerifyType(type: AppAuthVerifyType): VerifyCodeSendForm['verifyType'] {
  return type === 'EMAIL' ? 'EMAIL' : 'PHONE';
}

function mapSocialProvider(provider: AppAuthSocialProvider): OAuthAuthUrlForm['provider'] {
  const normalized = provider.trim().replace(/[\s-]+/g, '_').toUpperCase();
  if (!normalized) {
    throw new Error('OAuth provider is required.');
  }
  return normalized as OAuthAuthUrlForm['provider'];
}

function mapQrStatus(status?: QrCodeStatusVO['status']): AppAuthLoginQrCodeStatus {
  if (status === 'scanned' || status === 'confirmed' || status === 'expired') {
    return status;
  }
  return 'pending';
}

function readOptionalString(value?: string | null): string | undefined {
  const normalized = (value || '').trim();
  return normalized || undefined;
}

function readOptionalDeviceType(
  value?: AppAuthOAuthDeviceType | null,
): AppAuthOAuthDeviceType | undefined {
  return value ? value : undefined;
}

function resolveRegisterType(input: AppAuthRegisterInput): RegisterForm['type'] | undefined {
  if (input.type) {
    return input.type;
  }
  if (input.email && !input.phone) {
    return 'EMAIL';
  }
  if (!input.email && input.phone) {
    return 'PHONE';
  }
  return undefined;
}

function mapSession(loginData: LoginVO): AppAuthSession {
  const authToken = (loginData.authToken || '').trim();
  if (!authToken) {
    throw new Error('Auth token is missing.');
  }

  return {
    authToken,
    accessToken: resolveAppSdkAccessToken(),
    refreshToken: (loginData.refreshToken || '').trim() || undefined,
    userInfo: loginData.userInfo,
  };
}

function persistSession(session: AppAuthSession): AppAuthSession {
  persistAppSdkSessionTokens(session);
  return session;
}

function resolveAppSdkApiUrl(pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const apiPath = `/app/v3/api${normalizedPath}`;
  const baseUrl = getAppSdkClientConfig()?.baseUrl?.trim();

  if (!baseUrl) {
    return apiPath;
  }

  return `${baseUrl.replace(/\/+$/, '')}${apiPath}`;
}

async function postAppSdkAuthFallback<T>(
  pathname: string,
  body: unknown,
): Promise<T | AppSdkEnvelope<T>> {
  const response = await fetch(resolveAppSdkApiUrl(pathname), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return (await response.json()) as T;
}

export const appAuthService: IAppAuthService = {
  async login(input: AppAuthLoginInput): Promise<AppAuthSession> {
    const client = getAppSdkClientWithSession();
    const request: LoginForm = {
      username: input.username.trim(),
      password: input.password,
    };
    const loginData = unwrapAppSdkResponse<LoginVO>(
      await client.auth.login(request),
      'Failed to sign in.',
    );
    return persistSession(mapSession(loginData));
  },

  async loginWithPhone(input: AppAuthPhoneLoginInput): Promise<AppAuthSession> {
    const client = getAppSdkClientWithSession();
    const request: PhoneLoginForm = {
      phone: input.phone.trim(),
      code: input.code.trim(),
      deviceId: readOptionalString(input.deviceId),
      deviceType: readOptionalString(input.deviceType),
      deviceName: readOptionalString(input.deviceName),
      appVersion: readOptionalString(input.appVersion),
    };
    const loginData = unwrapAppSdkResponse<LoginVO>(
      await client.auth.phoneLogin(request),
      'Failed to complete phone code login.',
    );
    return persistSession(mapSession(loginData));
  },

  async loginWithEmail(input: AppAuthEmailLoginInput): Promise<AppAuthSession> {
    const client = getAppSdkClientWithSession();
    const authClient = client.auth as typeof client.auth & AppAuthClientCompat;
    const request: AppAuthEmailLoginForm = {
      email: input.email.trim(),
      code: input.code.trim(),
      deviceId: readOptionalString(input.deviceId),
      deviceType: readOptionalDeviceType(input.deviceType),
      deviceName: readOptionalString(input.deviceName),
      appVersion: readOptionalString(input.appVersion),
    };
    const loginData = unwrapAppSdkResponse<LoginVO>(
      authClient.emailLogin
        ? await authClient.emailLogin(request)
        : await postAppSdkAuthFallback<LoginVO>('/auth/email/login', request),
      'Failed to complete email code login.',
    );
    return persistSession(mapSession(loginData));
  },

  async register(input: AppAuthRegisterInput): Promise<AppAuthSession> {
    const client = getAppSdkClientWithSession();
    const request: RegisterForm = {
      username: input.username.trim(),
      password: input.password,
      confirmPassword: input.confirmPassword || input.password,
      email: readOptionalString(input.email),
      phone: readOptionalString(input.phone),
      type: resolveRegisterType(input),
      verificationCode: readOptionalString(input.verificationCode),
    };
    unwrapAppSdkResponse(await client.auth.register(request), 'Failed to register.');

    return this.login({
      username: request.username,
      password: input.password,
    });
  },

  async logout(): Promise<void> {
    const client = getAppSdkClientWithSession();
    try {
      unwrapAppSdkResponse(await client.auth.logout(), 'Failed to sign out.');
    } finally {
      clearAppSdkSessionTokens();
    }
  },

  async refreshToken(refreshToken?: string): Promise<AppAuthSession> {
    const client = getAppSdkClientWithSession();
    const storedTokens = readAppSdkSessionTokens();
    const nextRefreshToken = (refreshToken || storedTokens.refreshToken || '').trim();
    if (!nextRefreshToken) {
      throw new Error('Refresh token is required.');
    }

    const request: TokenRefreshForm = {
      refreshToken: nextRefreshToken,
    };
    const loginData = unwrapAppSdkResponse<LoginVO>(
      await client.auth.refreshToken(request),
      'Failed to refresh session.',
    );
    const session = {
      ...mapSession(loginData),
      refreshToken: (loginData.refreshToken || nextRefreshToken).trim() || undefined,
    };
    return persistSession(session);
  },

  async sendVerifyCode(input: AppAuthSendVerifyCodeInput): Promise<void> {
    const client = getAppSdkClientWithSession();
    const authClient = client.auth as typeof client.auth & AppAuthClientCompat;
    const request: VerifyCodeSendForm = {
      target: input.target.trim(),
      type: mapScene(input.scene),
      verifyType: mapVerifyType(input.verifyType),
    };
    unwrapAppSdkResponse(
      authClient.createSendSmsCode
        ? await authClient.createSendSmsCode(request)
        : await postAppSdkAuthFallback<void>('/auth/verify/send', request),
      'Failed to send verify code.',
    );
  },

  async verifyCode(input: AppAuthVerifyCodeInput): Promise<boolean> {
    const client = getAppSdkClientWithSession();
    const authClient = client.auth as typeof client.auth & AppAuthClientCompat;
    const request: VerifyCodeCheckForm = {
      target: input.target.trim(),
      type: mapScene(input.scene),
      verifyType: mapVerifyType(input.verifyType),
      code: input.code.trim(),
    };
    const result = unwrapAppSdkResponse<VerifyResultVO>(
      authClient.verifySmsCode
        ? await authClient.verifySmsCode(request)
        : await postAppSdkAuthFallback<VerifyResultVO>('/auth/verify/check', request),
      'Failed to verify code.',
    );
    return Boolean(result?.valid);
  },

  async requestPasswordReset(input: AppAuthPasswordResetRequestInput): Promise<void> {
    const client = getAppSdkClientWithSession();
    const request: PasswordResetRequestForm = {
      account: input.account.trim(),
      channel: input.channel,
    };
    unwrapAppSdkResponse(
      await client.auth.requestPasswordResetChallenge(request),
      'Failed to request password reset.',
    );
  },

  async resetPassword(input: AppAuthPasswordResetInput): Promise<void> {
    const client = getAppSdkClientWithSession();
    const request: PasswordResetForm = {
      account: input.account.trim(),
      code: input.code.trim(),
      newPassword: input.newPassword,
      confirmPassword: input.confirmPassword || input.newPassword,
    };
    unwrapAppSdkResponse(
      await client.auth.resetPassword(request),
      'Failed to reset password.',
    );
  },

  async getOAuthAuthorizationUrl(input: AppAuthOAuthAuthorizationInput): Promise<string> {
    const client = getAppSdkClientWithSession();
    const request: OAuthAuthUrlForm = {
      provider: mapSocialProvider(input.provider),
      redirectUri: input.redirectUri.trim(),
      scope: readOptionalString(input.scope),
      state: readOptionalString(input.state),
    };
    const oauthUrl = unwrapAppSdkResponse<OAuthUrlVO>(
      await client.auth.getOauthUrl(request),
      'Failed to start OAuth login.',
    );
    const authUrl = (oauthUrl?.authUrl || '').trim();
    if (!authUrl) {
      throw new Error('OAuth authorization URL is missing.');
    }
    return authUrl;
  },

  async loginWithOAuth(input: AppAuthOAuthLoginInput): Promise<AppAuthSession> {
    const client = getAppSdkClientWithSession();
    const request: OAuthLoginForm = {
      provider: mapSocialProvider(input.provider),
      code: input.code.trim(),
      state: readOptionalString(input.state),
      deviceId: readOptionalString(input.deviceId),
      deviceType: readOptionalString(input.deviceType),
    };
    const loginData = unwrapAppSdkResponse<LoginVO>(
      await client.auth.oauthLogin(request),
      'Failed to complete OAuth login.',
    );
    return persistSession(mapSession(loginData));
  },

  async generateLoginQrCode(): Promise<AppAuthLoginQrCode> {
    const client = getAppSdkClientWithSession();
    const qrCode = unwrapAppSdkResponse<QrCodeVO>(
      await client.auth.generateQrCode(),
      'Failed to generate login QR code.',
    );
    const qrKey = (qrCode?.qrKey || '').trim();
    if (!qrKey) {
      throw new Error('QR code key is missing.');
    }
    return {
      type: readOptionalString(qrCode.type),
      title: readOptionalString(qrCode.title),
      description: readOptionalString(qrCode.description),
      qrKey,
      qrUrl: readOptionalString(qrCode.qrUrl),
      qrContent: readOptionalString(qrCode.qrContent),
      expireTime: typeof qrCode.expireTime === 'number' ? qrCode.expireTime : undefined,
    };
  },

  async checkLoginQrCodeStatus(qrKey: string): Promise<AppAuthLoginQrCodeStatusResult> {
    const client = getAppSdkClientWithSession();
    const qrCodeStatus = unwrapAppSdkResponse<QrCodeStatusVO>(
      await client.auth.checkQrCodeStatus(qrKey.trim()),
      'Failed to check login QR code status.',
    );
    const status = mapQrStatus(qrCodeStatus?.status);

    if (status !== 'confirmed' || !qrCodeStatus?.token) {
      return {
        status,
        userInfo: qrCodeStatus?.userInfo,
      };
    }

    const session = persistSession(mapSession(qrCodeStatus.token));
    return {
      status,
      session,
      userInfo: qrCodeStatus.userInfo || qrCodeStatus.token.userInfo,
    };
  },

  async getCurrentSession(): Promise<AppAuthSession | null> {
    const tokens = readAppSdkSessionTokens();
    const authToken = (tokens.authToken || '').trim();
    if (!authToken) {
      return null;
    }

    return {
      authToken,
      accessToken: resolveAppSdkAccessToken(),
      refreshToken: tokens.refreshToken,
    };
  },
};
