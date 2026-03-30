import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { instanceDirectoryService, useInstanceStore } from '@sdkwork/claw-core';
import { useChatStore } from '../store/useChatStore';

const DIRECTORY_REFRESH_MS = 15_000;

export function OpenClawGatewayConnections() {
  const activeInstanceId = useInstanceStore((state) => state.activeInstanceId);
  const connectGatewayInstances = useChatStore((state) => state.connectGatewayInstances);

  const { data: instances = [] } = useQuery({
    queryKey: ['chat', 'gateway-instance-directory'],
    queryFn: () => instanceDirectoryService.listInstances(),
    refetchInterval: DIRECTORY_REFRESH_MS,
    staleTime: 5_000,
  });

  const instanceIds = useMemo(() => {
    const ids = instances.map((instance) => instance.id);
    if (activeInstanceId && !ids.includes(activeInstanceId)) {
      ids.unshift(activeInstanceId);
    }

    return Array.from(new Set(ids.filter(Boolean))).sort();
  }, [activeInstanceId, instances]);

  const instanceSignature = useMemo(() => instanceIds.join('|'), [instanceIds]);

  useEffect(() => {
    if (!instanceSignature) {
      return;
    }

    void connectGatewayInstances(instanceSignature.split('|'));
  }, [connectGatewayInstances, instanceSignature]);

  return null;
}
