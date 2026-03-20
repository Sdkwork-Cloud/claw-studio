import { studio } from '@sdkwork/claw-infrastructure';
import { mapChatSession, mapStudioConversation } from '../chatSessionMapping.ts';
import type { ChatSession } from '../store/useChatStore';

class StudioConversationService {
  async listConversations(instanceId: string) {
    const records = await studio.listConversations(instanceId);
    return records.map(mapStudioConversation);
  }

  async putConversation(session: ChatSession) {
    const record = await studio.putConversation(mapChatSession(session));
    return mapStudioConversation(record);
  }

  async deleteConversation(id: string) {
    return studio.deleteConversation(id);
  }
}

export const studioConversationService = new StudioConversationService();
