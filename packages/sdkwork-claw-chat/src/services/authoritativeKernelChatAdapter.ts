import {
  createHermesKernelChatAdapter,
} from './adapters/hermesKernelChatAdapter.ts';
import {
  createOpenClawGatewayKernelChatAdapter,
} from './adapters/openClawGatewayKernelChatAdapter.ts';
import {
  createTransportBackedKernelChatAdapter,
} from './adapters/transportBackedKernelChatAdapter.ts';
import {
  createKernelChatAdapterRegistry,
} from './kernelChatAdapterRegistry.ts';
import { resolveAuthoritativeInstanceChatRoute } from './store/index.ts';

const EMPTY_OPENCLAW_GATEWAY_STORE = {
  async hydrateInstance(_instanceId: string) {},
  getSnapshot(_instanceId: string) {
    return {
      sessions: [],
    };
  },
};

const authoritativeKernelChatAdapterRegistry = createKernelChatAdapterRegistry({
  async resolveInstance(instanceId) {
    return (await resolveAuthoritativeInstanceChatRoute(instanceId)).instance;
  },
  createOpenClawGatewayAdapter() {
    return createOpenClawGatewayKernelChatAdapter({
      gatewayStore: EMPTY_OPENCLAW_GATEWAY_STORE,
    });
  },
  createTransportBackedAdapter(instance) {
    return createTransportBackedKernelChatAdapter({
      instance,
    });
  },
  createHermesAdapter() {
    return createHermesKernelChatAdapter();
  },
});

export async function resolveAuthoritativeInstanceKernelChatAdapter(
  instanceId: string | null | undefined,
) {
  if (!instanceId) {
    return null;
  }

  return authoritativeKernelChatAdapterRegistry.resolveForInstance(instanceId);
}
