import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { instanceDirectoryService, useInstanceStore } from '@sdkwork/claw-core';
import { useChatStore } from '../store/useChatStore';

const DIRECTORY_REFRESH_MS = 15_000;

export function OpenClawGatewayConnections() {
  const location = useLocation();
  const activeInstanceId = useInstanceStore((state) => state.activeInstanceId);
  const connectGatewayInstances = useChatStore((state) => state.connectGatewayInstances);
  const isChatRoute =
    location.pathname === '/chat' || location.pathname.startsWith('/chat/');

  const { data: instances = [] } = useQuery({
    queryKey: ['chat', 'gateway-instance-directory'],
    queryFn: () => instanceDirectoryService.listInstances(),
    enabled: isChatRoute,
    refetchInterval: isChatRoute ? DIRECTORY_REFRESH_MS : false,
    staleTime: DIRECTORY_REFRESH_MS,
    refetchOnWindowFocus: false,
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
    if (!isChatRoute || !instanceSignature) {
      return;
    }

    void connectGatewayInstances(instanceSignature.split('|'));
  }, [connectGatewayInstances, instanceSignature, isChatRoute]);

  return null;
}
