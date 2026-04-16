export function shouldLoadChatSkills({
  isRouteSupported = true,
  isSessionContextDrawerOpen,
  selectedSkillId,
}: {
  isRouteSupported?: boolean;
  isSessionContextDrawerOpen: boolean;
  selectedSkillId: string | null;
}) {
  if (!isRouteSupported) {
    return false;
  }

  return isSessionContextDrawerOpen || Boolean(selectedSkillId);
}

export function shouldLoadChatDirectAgents({
  activeInstanceId,
  isRouteSupported = true,
  isOpenClawGateway,
  isSessionContextDrawerOpen,
  selectedAgentId,
}: {
  activeInstanceId: string | null | undefined;
  isRouteSupported?: boolean;
  isOpenClawGateway: boolean;
  isSessionContextDrawerOpen: boolean;
  selectedAgentId: string | null;
}) {
  if (!isRouteSupported || isOpenClawGateway || !activeInstanceId) {
    return false;
  }

  return isSessionContextDrawerOpen || Boolean(selectedAgentId);
}
