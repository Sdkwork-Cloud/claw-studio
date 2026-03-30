import { resolveOpenClawInstanceAuthToken } from './openClawInstanceAuthToken.ts';
import { studio } from '@sdkwork/claw-infrastructure';
import { OpenClawGatewayClient } from './openClawGatewayClient.ts';
import { resolveInstanceChatRoute } from '../instanceChatRouteService.ts';

type CachedOpenClawClientEntry = {
  client: OpenClawGatewayClient;
  websocketUrl: string;
};

const openClawClientByInstance = new Map<string, CachedOpenClawClientEntry>();

export async function getSharedOpenClawGatewayClient(instanceId: string) {
  const instance = await studio.getInstance(instanceId);
  const route = resolveInstanceChatRoute(instance);
  if (route.mode !== 'instanceOpenClawGatewayWs' || !route.websocketUrl) {
    throw new Error('The selected instance is not backed by an OpenClaw Gateway WebSocket.');
  }

  const cached = openClawClientByInstance.get(instanceId);
  if (cached && cached.websocketUrl === route.websocketUrl) {
    return cached.client;
  }

  cached?.client.disconnect();
  const authToken = await resolveOpenClawInstanceAuthToken(instance);
  const client = new OpenClawGatewayClient({
    url: route.websocketUrl,
    authToken,
    resolveAuthToken: async () => {
      const latestInstance = await studio.getInstance(instanceId);
      return resolveOpenClawInstanceAuthToken(latestInstance);
    },
    instanceId,
  });

  openClawClientByInstance.set(instanceId, {
    client,
    websocketUrl: route.websocketUrl,
  });
  return client;
}
