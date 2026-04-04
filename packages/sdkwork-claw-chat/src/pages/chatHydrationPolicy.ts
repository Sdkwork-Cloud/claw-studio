export function shouldLoadChatSkills({
  isSessionContextDrawerOpen,
  selectedSkillId,
}: {
  isSessionContextDrawerOpen: boolean;
  selectedSkillId: string | null;
}) {
  return isSessionContextDrawerOpen || Boolean(selectedSkillId);
}

export function shouldLoadChatDirectAgents({
  activeInstanceId,
  isOpenClawGateway,
  isSessionContextDrawerOpen,
  selectedAgentId,
}: {
  activeInstanceId: string | null | undefined;
  isOpenClawGateway: boolean;
  isSessionContextDrawerOpen: boolean;
  selectedAgentId: string | null;
}) {
  if (isOpenClawGateway || !activeInstanceId) {
    return false;
  }

  return isSessionContextDrawerOpen || Boolean(selectedAgentId);
}
