import { clearAuthSession, writeAuthSession } from '../auth/authSession.ts';
import { postApi } from '../http/apiClient.ts';

const AUTH_BASE_PATH = '/app/v3/api/auth';

export interface LoginRequest {
  username: string;
  password: string;
  captcha?: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  confirmPassword: string;
  email?: string;
  phone?: string;
  verificationCode?: string;
  type?: string;
}

export interface LoginUserInfo {
  id?: number;
  username?: string;
  email?: string;
  phone?: string;
  nickname?: string;
  avatar?: string;
  role?: string;
  status?: string;
}

export interface LoginResult {
  authToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  userInfo?: LoginUserInfo | null;
}

export interface RegisterResult {
  id?: number;
  username?: string;
  email?: string;
  phone?: string;
  nickname?: string;
  avatar?: string;
  role?: string;
  status?: string;
}

export async function login(request: LoginRequest): Promise<LoginResult> {
  const result = await postApi<LoginResult>(`${AUTH_BASE_PATH}/login`, request, {
    requireAuth: false,
  });
  writeAuthSession({
    authToken: result.authToken,
    refreshToken: result.refreshToken,
    tokenType: result.tokenType,
    expiresIn: result.expiresIn,
  });
  return result;
}

export async function register(request: RegisterRequest): Promise<RegisterResult> {
  return postApi<RegisterResult>(`${AUTH_BASE_PATH}/register`, request, {
    requireAuth: false,
  });
}

export async function logout() {
  try {
    await postApi<void>(`${AUTH_BASE_PATH}/logout`);
  } finally {
    clearAuthSession();
  }
}

export async function refreshToken(refreshTokenValue: string): Promise<LoginResult> {
  const result = await postApi<LoginResult>(
    `${AUTH_BASE_PATH}/refresh`,
    { refreshToken: refreshTokenValue },
    { requireAuth: false },
  );
  writeAuthSession({
    authToken: result.authToken,
    refreshToken: result.refreshToken,
    tokenType: result.tokenType,
    expiresIn: result.expiresIn,
  });
  return result;
}

export async function requestPasswordReset(account: string, channel: 'EMAIL' | 'SMS' = 'EMAIL') {
  await postApi<void>(
    `${AUTH_BASE_PATH}/password/reset/request`,
    { account, channel },
    { requireAuth: false },
  );
}
