import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { instanceDirectoryService, useInstanceStore } from '@sdkwork/claw-core';
import { useChatStore } from '../store/useChatStore';
import {
  resolveOpenClawGatewayWarmPlan,
  shouldWarmOpenClawGatewayConnections,
} from './openClawGatewayConnectionsPolicy.ts';

const DIRECTORY_REFRESH_MS = 15_000;

export function OpenClawGatewayConnections() {
  const location = useLocation();
  const activeInstanceId = useInstanceStore((state) => state.activeInstanceId);
  const connectGatewayInstances = useChatStore((state) => state.connectGatewayInstances);
  const shouldWarmConnections = shouldWarmOpenClawGatewayConnections(location.pathname);
  const prefetchPlan = useMemo(
    () =>
      resolveOpenClawGatewayWarmPlan({
        pathname: location.pathname,
        activeInstanceId,
      }),
    [activeInstanceId, location.pathname],
  );

  const { data: instances = [] } = useQuery({
    queryKey: ['chat', 'gateway-instance-directory'],
    queryFn: () => instanceDirectoryService.listInstances(),
    enabled: prefetchPlan.shouldQueryDirectory,
    refetchInterval: prefetchPlan.shouldQueryDirectory ? DIRECTORY_REFRESH_MS : false,
    staleTime: 5_000,
  });

  const instanceIds = useMemo(() => {
    if (!shouldWarmConnections) {
      return [];
    }

    return resolveOpenClawGatewayWarmPlan({
      pathname: location.pathname,
      activeInstanceId,
      directoryInstanceIds: instances.map((instance) => instance.id),
    }).instanceIds;
  }, [activeInstanceId, instances, location.pathname, shouldWarmConnections]);

  const instanceSignature = useMemo(() => instanceIds.join('|'), [instanceIds]);

  useEffect(() => {
    if (!shouldWarmConnections || !instanceSignature) {
      return;
    }

    void connectGatewayInstances(instanceSignature.split('|'));
  }, [connectGatewayInstances, instanceSignature, shouldWarmConnections]);

  return null;
}
