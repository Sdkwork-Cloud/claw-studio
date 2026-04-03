import { studio } from '@sdkwork/claw-infrastructure';
import { mapChatSession, mapStudioConversation } from '../chatSessionMapping.ts';
import type { ChatSession } from './useChatStore';

export async function listInstanceConversations(instanceId: string): Promise<ChatSession[]> {
  const records = await studio.listConversations(instanceId);
  return records.map(mapStudioConversation);
}

export async function putInstanceConversation(session: ChatSession): Promise<ChatSession> {
  if (session.transport === 'openclawGateway') {
    throw new Error('OpenClaw Gateway sessions are synchronized from Gateway and are not persisted locally.');
  }

  const record = await studio.putConversation(mapChatSession(session));
  return mapStudioConversation(record);
}

export async function getInstanceConversation(
  instanceId: string,
  id: string,
  session: ChatSession,
): Promise<ChatSession> {
  const records = await studio.listConversations(instanceId);
  const record = records.find((item) => item.id === id);
  return record ? mapStudioConversation(record) : session;
}

export async function deleteInstanceConversation(id: string, instanceId?: string) {
  return studio.deleteConversation(id);
}

export async function resetInstanceConversation(session: ChatSession): Promise<ChatSession> {
  const record = await studio.putConversation(
    mapChatSession({
      ...session,
      messages: [],
      lastMessagePreview: undefined,
    }),
  );
  return mapStudioConversation(record);
}
