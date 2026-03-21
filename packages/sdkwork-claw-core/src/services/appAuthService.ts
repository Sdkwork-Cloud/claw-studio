import type {
  LoginForm,
  LoginVO,
  PasswordResetRequestForm,
  RegisterForm,
  TokenRefreshForm,
  UserInfoVO,
  VerifyCodeCheckForm,
  VerifyCodeSendForm,
  VerifyResultVO,
} from '@sdkwork/app-sdk';
import {
  clearAppSdkSessionTokens,
  getAppSdkClientWithSession,
  persistAppSdkSessionTokens,
  readAppSdkSessionTokens,
  resolveAppSdkAccessToken,
} from '../sdk/useAppSdkClient.ts';
import { unwrapAppSdkResponse } from '../sdk/appSdkResult.ts';

export type AppAuthVerifyType = 'EMAIL' | 'PHONE';
export type AppAuthScene = 'LOGIN' | 'REGISTER' | 'RESET_PASSWORD';
export type AppAuthPasswordResetChannel = 'EMAIL' | 'SMS';

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
  name?: string;
  verificationCode?: string;
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

export interface AppAuthSession {
  authToken: string;
  accessToken: string;
  refreshToken?: string;
  userInfo?: UserInfoVO;
}

export interface IAppAuthService {
  login(input: AppAuthLoginInput): Promise<AppAuthSession>;
  register(input: AppAuthRegisterInput): Promise<AppAuthSession>;
  logout(): Promise<void>;
  refreshToken(refreshToken?: string): Promise<AppAuthSession>;
  sendVerifyCode(input: AppAuthSendVerifyCodeInput): Promise<void>;
  verifyCode(input: AppAuthVerifyCodeInput): Promise<boolean>;
  requestPasswordReset(input: AppAuthPasswordResetRequestInput): Promise<void>;
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
    const session = mapSession(loginData);
    persistAppSdkSessionTokens(session);
    return session;
  },

  async register(input: AppAuthRegisterInput): Promise<AppAuthSession> {
    const client = getAppSdkClientWithSession();
    const request: RegisterForm = {
      username: input.username.trim(),
      password: input.password,
      confirmPassword: input.confirmPassword || input.password,
      email: input.email?.trim(),
      phone: input.phone?.trim(),
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
    persistAppSdkSessionTokens(session);
    return session;
  },

  async sendVerifyCode(input: AppAuthSendVerifyCodeInput): Promise<void> {
    const client = getAppSdkClientWithSession();
    const request: VerifyCodeSendForm = {
      target: input.target.trim(),
      type: mapScene(input.scene),
      verifyType: mapVerifyType(input.verifyType),
    };
    unwrapAppSdkResponse(await client.auth.sendSmsCode(request), 'Failed to send verify code.');
  },

  async verifyCode(input: AppAuthVerifyCodeInput): Promise<boolean> {
    const client = getAppSdkClientWithSession();
    const request: VerifyCodeCheckForm = {
      target: input.target.trim(),
      type: mapScene(input.scene),
      verifyType: mapVerifyType(input.verifyType),
      code: input.code.trim(),
    };
    const result = unwrapAppSdkResponse<VerifyResultVO>(
      await client.auth.verifySmsCode(request),
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
