import { studio } from '@sdkwork/claw-infrastructure';
import { mapChatSession, mapStudioConversation } from '../chatSessionMapping.ts';
import type { ChatSession } from './useChatStore';

export async function listInstanceConversations(instanceId: string) {
  const records = await studio.listConversations(instanceId);
  return records.map(mapStudioConversation);
}

export async function putInstanceConversation(session: ChatSession) {
  if (session.transport === 'openclawGateway') {
    throw new Error('OpenClaw Gateway sessions are synchronized from Gateway and are not persisted locally.');
  }

  const record = await studio.putConversation(mapChatSession(session));
  return mapStudioConversation(record);
}

export async function deleteInstanceConversation(id: string) {
  return studio.deleteConversation(id);
}
