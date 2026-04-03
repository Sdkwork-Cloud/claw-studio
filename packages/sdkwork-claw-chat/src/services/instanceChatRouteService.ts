import type { StudioInstanceRecord } from '@sdkwork/claw-types';

export type InstanceChatRouteMode =
  | 'directLlm'
  | 'instanceOpenClawGatewayWs'
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

const OPENCLAW_HTTP_ENDPOINT_SUFFIXES = [
  '/v1/chat/completions',
  '/chat/completions',
  '/v1/responses',
  '/responses',
] as const;

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

function buildWebsocketUrl(
  baseUrl: string | null,
  websocketUrl: string | null,
  suffixesToTrim: string[] = [...OPENCLAW_HTTP_ENDPOINT_SUFFIXES],
) {
  const normalizedCandidate = normalizeUrl(websocketUrl ?? baseUrl);
  if (!normalizedCandidate) {
    return undefined;
  }

  try {
    const url = new URL(normalizedCandidate);
    if (suffixesToTrim.some((suffix) => url.pathname.endsWith(suffix))) {
      const matchedSuffix = suffixesToTrim.find((suffix) => url.pathname.endsWith(suffix));
      url.pathname = matchedSuffix
        ? url.pathname.slice(0, -matchedSuffix.length) || '/'
        : url.pathname;
      url.search = '';
      url.hash = '';
    }

    if (url.protocol === 'http:' || url.protocol === 'ws:') {
      url.protocol = 'ws:';
    } else if (url.protocol === 'https:' || url.protocol === 'wss:') {
      url.protocol = 'wss:';
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

function buildExplicitOpenClawHttpEndpoint(baseUrl: string | null) {
  const normalizedBaseUrl = normalizeUrl(baseUrl);
  if (!normalizedBaseUrl) {
    return undefined;
  }

  return OPENCLAW_HTTP_ENDPOINT_SUFFIXES.some((suffix) => normalizedBaseUrl.endsWith(suffix))
    ? normalizedBaseUrl
    : undefined;
}

function buildOpenClawGatewayWebsocketUrl(
  baseUrl: string | null,
  websocketUrl: string | null,
) {
  const baseCandidate = buildWebsocketUrl(baseUrl, baseUrl, [
    '/ws',
    ...OPENCLAW_HTTP_ENDPOINT_SUFFIXES,
  ]);
  const websocketCandidate = buildWebsocketUrl(null, websocketUrl, [
    '/ws',
    ...OPENCLAW_HTTP_ENDPOINT_SUFFIXES,
  ]);

  if (baseCandidate && websocketCandidate) {
    try {
      const base = new URL(baseCandidate);
      const provided = new URL(websocketCandidate);

      if (base.protocol !== provided.protocol || base.host !== provided.host) {
        return baseCandidate;
      }
    } catch {
      return baseCandidate;
    }
  }

  return websocketCandidate ?? baseCandidate;
}

export function resolveInstanceChatRoute(
  instance: StudioInstanceRecord | null | undefined,
): InstanceChatRoute {
  if (!instance) {
    return { mode: 'directLlm' };
  }

  const baseUrl = normalizeUrl(instance.baseUrl ?? instance.config?.baseUrl ?? null);
  const websocketUrl = normalizeUrl(
    instance.websocketUrl ?? instance.config?.websocketUrl ?? null,
  );

  const shared = {
    runtimeKind: instance.runtimeKind,
    transportKind: instance.transportKind,
    deploymentMode: instance.deploymentMode,
  } as const;

  if (instance.runtimeKind === 'openclaw') {
    if (websocketUrl || baseUrl) {
      return {
        ...shared,
        mode: 'instanceOpenClawGatewayWs',
        endpoint: buildExplicitOpenClawHttpEndpoint(baseUrl),
        websocketUrl: buildOpenClawGatewayWebsocketUrl(baseUrl, websocketUrl),
      };
    }

    return {
      ...shared,
      mode: 'unsupported',
      reason: 'OpenClaw instances must publish a gateway HTTP or WebSocket endpoint.',
    };
  }

  switch (instance.transportKind) {
    case 'openclawGatewayWs':
      if (websocketUrl || baseUrl) {
        return {
          ...shared,
          mode: 'instanceOpenClawGatewayWs',
          endpoint: buildExplicitOpenClawHttpEndpoint(baseUrl),
          websocketUrl: buildOpenClawGatewayWebsocketUrl(baseUrl, websocketUrl),
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
