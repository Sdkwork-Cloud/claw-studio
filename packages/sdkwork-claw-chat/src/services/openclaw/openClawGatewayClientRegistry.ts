import { studio } from '@sdkwork/claw-infrastructure';
import { OpenClawGatewayClient } from './openClawGatewayClient.ts';
import { resolveInstanceChatRoute } from '../instanceChatRouteService.ts';

type CachedOpenClawClientEntry = {
  client: OpenClawGatewayClient;
  authToken: string | null;
  websocketUrl: string;
};

const openClawClientByInstance = new Map<string, CachedOpenClawClientEntry>();

export async function getSharedOpenClawGatewayClient(instanceId: string) {
  const instance = await studio.getInstance(instanceId);
  if (!instance) {
    throw new Error(`Unable to resolve OpenClaw instance: ${instanceId}`);
  }
  const route = resolveInstanceChatRoute(instance);
  if (route.mode !== 'instanceOpenClawGatewayWs' || !route.websocketUrl) {
    throw new Error('The selected instance is not backed by an OpenClaw Gateway WebSocket.');
  }

  const authToken = instance.config.authToken ?? null;
  const cached = openClawClientByInstance.get(instanceId);
  if (
    cached &&
    cached.websocketUrl === route.websocketUrl &&
    cached.authToken === authToken
  ) {
    return cached.client;
  }

  cached?.client.disconnect();
  const client = new OpenClawGatewayClient({
    url: route.websocketUrl,
    authToken,
    instanceId,
  });

  openClawClientByInstance.set(instanceId, {
    client,
    authToken,
    websocketUrl: route.websocketUrl,
  });
  return client;
}
