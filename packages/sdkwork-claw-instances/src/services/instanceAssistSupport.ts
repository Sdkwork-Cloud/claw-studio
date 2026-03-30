interface AssistSupportInstanceLike {
  runtimeKind?: string | null;
  isBuiltIn?: boolean | null;
}

export function supportsInstanceAssist(instance: AssistSupportInstanceLike | null | undefined) {
  if (!instance) {
    return false;
  }

  return !(instance.runtimeKind === 'openclaw' && instance.isBuiltIn);
}
