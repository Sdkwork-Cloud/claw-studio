type TranslateFunction = (key: string, options?: Record<string, unknown>) => string;

interface NavigableInstance {
  id: string;
}

export interface BuildInstanceDetailNavigationHandlersArgs {
  instance: NavigableInstance | null | undefined;
  instanceId: string | null | undefined;
  navigate: (href: string) => void;
  setActiveInstanceId: (instanceId: string | null) => void;
}

export function createSharedStatusLabelGetter(t: TranslateFunction) {
  return (status: string) => t(`instances.shared.status.${status}`);
}

export function buildInstanceDetailNavigationHandlers(
  args: BuildInstanceDetailNavigationHandlersArgs,
) {
  return {
    onBackToInstances: () => {
      args.navigate('/instances');
    },
    onOpenProviderCenter: () => {
      args.navigate('/settings?tab=api');
    },
    onOpenAgentMarket: () => {
      const search = args.instanceId
        ? `?instanceId=${encodeURIComponent(args.instanceId)}`
        : '';
      args.navigate(`/agents${search}`);
    },
    onSetActive: () => {
      if (!args.instance?.id) {
        return;
      }

      args.setActiveInstanceId(args.instance.id);
    },
  };
}
