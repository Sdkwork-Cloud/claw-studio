export interface ChatMessageData {
  id: string;
  sender: 'user' | 'provider';
  text: string;
  time: string;
}

export type ClawChatMessage = ChatMessageData;

export interface ChatModel {
  id: string;
  name: string;
  provider: string;
  icon: string;
}
