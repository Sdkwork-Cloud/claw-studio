import { delay } from '../types/service';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'provider';
  text: string;
  time: string;
}

export interface IClawChatService {
  sendMessage(providerId: string, message: string): Promise<ChatMessage>;
  getInitialMessages(providerId: string, welcomeText: string): Promise<ChatMessage[]>;
}

class ClawChatService implements IClawChatService {
  async getInitialMessages(providerId: string, welcomeText: string): Promise<ChatMessage[]> {
    await delay(300);
    return [
      {
        id: Date.now().toString(),
        sender: 'provider',
        text: welcomeText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  }

  async sendMessage(providerId: string, message: string): Promise<ChatMessage> {
    await delay(1500);
    return {
      id: Date.now().toString(),
      sender: 'provider',
      text: 'Thanks for reaching out! Let me check our availability and get right back to you. Do you have any specific requirements?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}

export const clawChatService = new ClawChatService();
