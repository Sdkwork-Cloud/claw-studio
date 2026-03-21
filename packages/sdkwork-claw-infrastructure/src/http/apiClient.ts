import { APP_ENV, getApiUrl, type AppEnvConfig } from '../config/env.ts';
import { readAuthorizationToken } from '../auth/authSession.ts';

export interface ApiEnvelope<T> {
  code?: number | string;
  message?: string;
  msg?: string;
  data?: T | null;
  success?: boolean;
}

export interface ApiRequestOptions extends RequestInit {
  bodyJson?: unknown;
  env?: AppEnvConfig;
  requireAuth?: boolean;
}

function isSuccessCode(code: number | string | undefined) {
  return code === undefined || code === 0 || code === '0' || code === 200 || code === '200';
}

function buildHeaders(options: ApiRequestOptions, env: AppEnvConfig) {
  const headers = new Headers(options.headers ?? {});
  if (!headers.has('Content-Type') && options.bodyJson !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (options.requireAuth !== false) {
    const authToken = readAuthorizationToken() || env.auth.accessToken;
    if (authToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }
  }

  return headers;
}

async function parseResponse<T>(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

export async function requestApi<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const env = options.env ?? APP_ENV;
  const url = getApiUrl(path, env);
  const headers = buildHeaders(options, env);
  const response = await fetch(url, {
    ...options,
    headers,
    body: options.bodyJson !== undefined ? JSON.stringify(options.bodyJson) : options.body,
    signal: options.signal ?? AbortSignal.timeout(env.api.timeout),
  });

  const payload = await parseResponse<ApiEnvelope<T> | T>(response);
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String(payload.message || 'Request failed.')
        : `Request failed: ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  if (!payload || typeof payload !== 'object' || !('data' in payload || 'code' in payload)) {
    return payload as T;
  }

  const envelope = payload as ApiEnvelope<T>;
  if (!isSuccessCode(envelope.code) || envelope.success === false) {
    throw new Error(envelope.message || envelope.msg || 'Request failed.');
  }

  return (envelope.data ?? null) as T;
}

export function getApi<T>(path: string, options: ApiRequestOptions = {}) {
  return requestApi<T>(path, {
    ...options,
    method: 'GET',
  });
}

export function postApi<T>(path: string, bodyJson?: unknown, options: ApiRequestOptions = {}) {
  return requestApi<T>(path, {
    ...options,
    method: 'POST',
    bodyJson,
  });
}

export function putApi<T>(path: string, bodyJson?: unknown, options: ApiRequestOptions = {}) {
  return requestApi<T>(path, {
    ...options,
    method: 'PUT',
    bodyJson,
  });
}
