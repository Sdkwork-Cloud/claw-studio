import type {
  StudioConversationAttachment,
  StudioConversationMessage,
  StudioConversationRecord,
} from '@sdkwork/claw-types';
import { hydrateLocalChatKernelProjection } from './services/store/index.ts';
import type { ChatSession, Message } from './store/useChatStore';

function normalizeMessageStatus(_message: Message): StudioConversationMessage['status'] {
  return 'complete';
}

function normalizeStudioConversationRole(
  role: Message['role'],
): StudioConversationMessage['role'] {
  return role === 'tool' ? 'assistant' : role;
}

export function mapStudioMessage(message: StudioConversationMessage): Message {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.createdAt,
    model: message.model,
    attachments: message.attachments?.map((attachment) => ({ ...attachment })),
  };
}

export function mapStudioConversation(record: StudioConversationRecord): ChatSession {
  const session: ChatSession = {
    id: record.id,
    title: record.title,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    messages: record.messages.map(mapStudioMessage),
    model: record.messages.find((message) => message.model)?.model || 'unknown',
    instanceId: record.primaryInstanceId,
    transport: 'local',
    sessionKind: 'direct',
  };

  return hydrateLocalChatKernelProjection({
    session,
  });
}

export function mapChatSession(session: ChatSession): StudioConversationRecord {
  if (session.transport === 'openclawGateway') {
    throw new Error('OpenClaw Gateway sessions must not be persisted through the studio conversation store.');
  }

  const messages = session.messages.map((message) => ({
    id: message.id,
    conversationId: session.id,
    role: normalizeStudioConversationRole(message.role),
    content: message.content,
    createdAt: message.timestamp,
    updatedAt: message.timestamp,
    model: message.model,
    senderInstanceId: session.instanceId || null,
    status: normalizeMessageStatus(message),
    attachments: message.attachments?.map(
      (attachment): StudioConversationAttachment => ({
        ...attachment,
      }),
    ),
  }));

  return {
    id: session.id,
    title: session.title,
    primaryInstanceId: session.instanceId || 'local-built-in',
    participantInstanceIds: session.instanceId ? [session.instanceId] : ['local-built-in'],
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: messages.length,
    lastMessagePreview: messages[messages.length - 1]?.content.slice(0, 120) || '',
    messages,
  };
}
