import { studio } from '@sdkwork/claw-infrastructure';
import { mapChatSession, mapStudioConversation } from '../chatSessionMapping.ts';
import { resolveAuthoritativeInstanceChatRoute } from '../services/store/index.ts';
import type { ChatSession } from './useChatStore';

async function shouldBlockSnapshotConversationAuthority(instanceId: string | null | undefined) {
  if (!instanceId) {
    return false;
  }

  const { instance, route } = await resolveAuthoritativeInstanceChatRoute(instanceId);
  if (!instance) {
    return false;
  }

  return (
    instance.runtimeKind === 'openclaw' &&
    instance.deploymentMode === 'local-managed' &&
    route.mode !== 'instanceOpenClawGatewayWs'
  );
}

export async function listInstanceConversations(instanceId: string): Promise<ChatSession[]> {
  if (await shouldBlockSnapshotConversationAuthority(instanceId)) {
    return [];
  }

  const records = await studio.listConversations(instanceId);
  return records.map(mapStudioConversation);
}

export async function putInstanceConversation(session: ChatSession): Promise<ChatSession> {
  if (session.transport === 'openclawGateway') {
    throw new Error('OpenClaw Gateway sessions are synchronized from Gateway and are not persisted locally.');
  }

  if (await shouldBlockSnapshotConversationAuthority(session.instanceId)) {
    return session;
  }

  const record = await studio.putConversation(mapChatSession(session));
  return mapStudioConversation(record);
}

export async function getInstanceConversation(
  instanceId: string,
  id: string,
  session: ChatSession,
): Promise<ChatSession> {
  if (await shouldBlockSnapshotConversationAuthority(instanceId)) {
    return session;
  }

  const records = await studio.listConversations(instanceId);
  const record = records.find((item) => item.id === id);
  return record ? mapStudioConversation(record) : session;
}

export async function deleteInstanceConversation(id: string, instanceId?: string) {
  if (await shouldBlockSnapshotConversationAuthority(instanceId)) {
    return true;
  }

  return studio.deleteConversation(id);
}

export async function resetInstanceConversation(session: ChatSession): Promise<ChatSession> {
  if (await shouldBlockSnapshotConversationAuthority(session.instanceId)) {
    return {
      ...session,
      messages: [],
      lastMessagePreview: undefined,
    };
  }

  const record = await studio.putConversation(
    mapChatSession({
      ...session,
      messages: [],
      lastMessagePreview: undefined,
    }),
  );
  return mapStudioConversation(record);
}
