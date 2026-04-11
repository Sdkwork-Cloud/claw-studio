type Setter<T> = (value: T) => void;

export interface InstanceDetailAgentMutationStateBindings {
  dismissAgentDialog: () => void;
  clearAgentDeleteId: () => void;
}

export function createInstanceDetailAgentMutationStateBindings(args: {
  setIsAgentDialogOpen: Setter<boolean>;
  setEditingAgentId: Setter<string | null>;
  setAgentDeleteId: Setter<string | null>;
}): InstanceDetailAgentMutationStateBindings {
  return {
    dismissAgentDialog: () => {
      args.setIsAgentDialogOpen(false);
      args.setEditingAgentId(null);
    },
    clearAgentDeleteId: () => args.setAgentDeleteId(null),
  };
}
