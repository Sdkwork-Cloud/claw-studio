export function shouldLoadChatSkills({
  showSkillDropdown,
  selectedSkillId,
}: {
  showSkillDropdown: boolean;
  selectedSkillId: string | null;
}) {
  return showSkillDropdown || Boolean(selectedSkillId);
}

export function shouldLoadChatDirectAgents({
  activeInstanceId,
  isOpenClawGateway,
  showAgentDropdown,
  selectedAgentId,
}: {
  activeInstanceId: string | null | undefined;
  isOpenClawGateway: boolean;
  showAgentDropdown: boolean;
  selectedAgentId: string | null;
}) {
  if (isOpenClawGateway || !activeInstanceId) {
    return false;
  }

  return showAgentDropdown || Boolean(selectedAgentId);
}
