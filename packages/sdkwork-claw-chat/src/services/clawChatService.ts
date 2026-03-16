import { delay } from '@sdkwork/claw-types';
import { ChatMessageData } from '../types';

export interface IClawChatService {
  sendMessage(providerId: string, message: string): Promise<ChatMessageData>;
  getInitialMessages(providerId: string, welcomeText: string): Promise<ChatMessageData[]>;
}

export interface ClawChatServiceOptions {
  initialDelayMs?: number;
  responseDelayMs?: number;
  now?: () => Date;
}

function formatTime(now: Date) {
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function createClawChatService(
  options: ClawChatServiceOptions = {},
): IClawChatService {
  const initialDelayMs = options.initialDelayMs ?? 300;
  const responseDelayMs = options.responseDelayMs ?? 1500;
  const getNow = () => options.now?.() ?? new Date();

  return {
    async getInitialMessages(providerId: string, welcomeText: string) {
      await delay(initialDelayMs);
      return [
        {
          id: `${providerId}-${Date.now()}`,
          sender: 'provider',
          text: welcomeText,
          time: formatTime(getNow()),
        },
      ];
    },

    async sendMessage(providerId: string, _message: string) {
      await delay(responseDelayMs);
      return {
        id: `${providerId}-${Date.now()}`,
        sender: 'provider',
        text: 'Thanks for reaching out! Let me check our availability and get right back to you. Do you have any specific requirements?',
        time: formatTime(getNow()),
      };
    },
  };
}

export const clawChatService = createClawChatService();
