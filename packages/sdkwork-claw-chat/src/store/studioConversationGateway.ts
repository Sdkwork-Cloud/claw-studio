import { studio } from '@sdkwork/claw-infrastructure';
import { mapChatSession, mapStudioConversation } from '../chatSessionMapping.ts';
import { openClawConversationGateway } from '../services/index.ts';
import type { ChatSession } from './useChatStore';

async function usesOpenClawGateway(instanceId: string) {
  const instance = await studio.getInstance(instanceId);
  return instance?.runtimeKind === 'openclaw';
}

export async function listInstanceConversations(instanceId: string): Promise<ChatSession[]> {
  if (await usesOpenClawGateway(instanceId)) {
    return openClawConversationGateway.listConversations(instanceId);
  }

  const records = await studio.listConversations(instanceId);
  return records.map(mapStudioConversation);
}

export async function putInstanceConversation(session: ChatSession): Promise<ChatSession> {
  if (session.transport === 'openclawGateway') {
    throw new Error('OpenClaw Gateway sessions are synchronized from Gateway and are not persisted locally.');
  }

  if (session.instanceId && (await usesOpenClawGateway(session.instanceId))) {
    return openClawConversationGateway.upsertConversation(session);
  }

  const record = await studio.putConversation(mapChatSession(session));
  return mapStudioConversation(record);
}

export async function getInstanceConversation(
  instanceId: string,
  id: string,
  session: ChatSession,
): Promise<ChatSession> {
  if (await usesOpenClawGateway(instanceId)) {
    return openClawConversationGateway.hydrateConversation(session);
  }

  const records = await studio.listConversations(instanceId);
  const record = records.find((item) => item.id === id);
  return record ? mapStudioConversation(record) : session;
}

export async function deleteInstanceConversation(id: string, instanceId?: string) {
  if (instanceId && (await usesOpenClawGateway(instanceId))) {
    return openClawConversationGateway.deleteConversation(instanceId, id);
  }

  return studio.deleteConversation(id);
}

export async function resetInstanceConversation(session: ChatSession): Promise<ChatSession> {
  if (session.instanceId && (await usesOpenClawGateway(session.instanceId))) {
    return openClawConversationGateway.resetConversation(session);
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
