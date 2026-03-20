import type { StudioInstanceRecord } from '@sdkwork/claw-types';

export type InstanceChatRouteMode =
  | 'directLlm'
  | 'instanceOpenAiHttp'
  | 'instanceSseHttp'
  | 'instanceWebSocket'
  | 'unsupported';

export interface InstanceChatRoute {
  mode: InstanceChatRouteMode;
  runtimeKind?: StudioInstanceRecord['runtimeKind'];
  transportKind?: StudioInstanceRecord['transportKind'];
  deploymentMode?: StudioInstanceRecord['deploymentMode'];
  endpoint?: string;
  websocketUrl?: string;
  reason?: string;
}

function normalizeUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : null;
}

function buildEndpoint(
  baseUrl: string | null,
  suffix: string,
  acceptedSuffixes: string[] = [suffix],
) {
  if (!baseUrl) {
    return undefined;
  }

  const normalizedBaseUrl = normalizeUrl(baseUrl);
  if (!normalizedBaseUrl) {
    return undefined;
  }

  if (acceptedSuffixes.some((candidate) => normalizedBaseUrl.endsWith(candidate))) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}${suffix}`;
}

export function resolveInstanceChatRoute(
  instance: StudioInstanceRecord | null | undefined,
): InstanceChatRoute {
  if (!instance) {
    return { mode: 'directLlm' };
  }

  const baseUrl = normalizeUrl(instance.baseUrl ?? instance.config.baseUrl ?? null);
  const websocketUrl = normalizeUrl(
    instance.websocketUrl ?? instance.config.websocketUrl ?? null,
  );

  const shared = {
    runtimeKind: instance.runtimeKind,
    transportKind: instance.transportKind,
    deploymentMode: instance.deploymentMode,
  } as const;

  switch (instance.transportKind) {
    case 'openclawGatewayWs':
      if (baseUrl) {
        return {
          ...shared,
          mode: 'instanceOpenAiHttp',
          endpoint: buildEndpoint(baseUrl, '/v1/chat/completions', [
            '/v1/chat/completions',
            '/chat/completions',
          ]),
          websocketUrl: websocketUrl ?? undefined,
        };
      }

      if (websocketUrl) {
        return {
          ...shared,
          mode: 'instanceWebSocket',
          websocketUrl,
          reason: 'OpenClaw gateway currently exposes only a websocket endpoint.',
        };
      }

      return {
        ...shared,
        mode: 'unsupported',
        reason: 'OpenClaw instance is missing both HTTP and WebSocket endpoints.',
      };
    case 'zeroclawHttp':
    case 'openaiHttp':
    case 'customHttp':
      if (!baseUrl) {
        return {
          ...shared,
          mode: 'unsupported',
          reason: 'HTTP runtime instances must publish a base URL.',
        };
      }

      return {
        ...shared,
        mode: 'instanceOpenAiHttp',
        endpoint: buildEndpoint(baseUrl, '/chat/completions'),
      };
    case 'ironclawWeb':
      if (!baseUrl) {
        return {
          ...shared,
          mode: 'unsupported',
          reason: 'IronClaw web instances must publish an HTTP endpoint.',
        };
      }

      return {
        ...shared,
        mode: 'instanceSseHttp',
        endpoint: buildEndpoint(baseUrl, '/api/chat/completions'),
      };
    case 'customWs':
      if (websocketUrl) {
        return {
          ...shared,
          mode: 'instanceWebSocket',
          websocketUrl,
        };
      }

      return {
        ...shared,
        mode: 'unsupported',
        reason: 'Custom WebSocket instances must publish a WebSocket URL.',
      };
    default:
      return {
        ...shared,
        mode: 'unsupported',
        reason: 'This instance transport does not expose a supported chat route yet.',
      };
  }
}
