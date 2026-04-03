import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { instanceDirectoryService, useInstanceStore } from '@sdkwork/claw-core';
import { useChatStore } from '../store/useChatStore';
import { shouldWarmOpenClawGatewayConnections } from './openClawGatewayConnectionsPolicy.ts';

const DIRECTORY_REFRESH_MS = 15_000;

export function OpenClawGatewayConnections() {
  const location = useLocation();
  const activeInstanceId = useInstanceStore((state) => state.activeInstanceId);
  const connectGatewayInstances = useChatStore((state) => state.connectGatewayInstances);
  const shouldWarmConnections = shouldWarmOpenClawGatewayConnections(location.pathname);

  const { data: instances = [] } = useQuery({
    queryKey: ['chat', 'gateway-instance-directory'],
    queryFn: () => instanceDirectoryService.listInstances(),
    enabled: shouldWarmConnections,
    refetchInterval: shouldWarmConnections ? DIRECTORY_REFRESH_MS : false,
    staleTime: 5_000,
  });

  const instanceIds = useMemo(() => {
    if (!shouldWarmConnections) {
      return [];
    }

    const ids = instances.map((instance) => instance.id);
    if (activeInstanceId && !ids.includes(activeInstanceId)) {
      ids.unshift(activeInstanceId);
    }

    return Array.from(new Set(ids.filter(Boolean))).sort();
  }, [activeInstanceId, instances, shouldWarmConnections]);

  const instanceSignature = useMemo(() => instanceIds.join('|'), [instanceIds]);

  useEffect(() => {
    if (!shouldWarmConnections || !instanceSignature) {
      return;
    }

    void connectGatewayInstances(instanceSignature.split('|'));
  }, [connectGatewayInstances, instanceSignature, shouldWarmConnections]);

  return null;
}
