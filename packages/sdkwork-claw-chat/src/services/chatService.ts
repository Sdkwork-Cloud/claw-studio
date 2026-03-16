import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { useInstanceStore } from '@sdkwork/claw-core';
import { useLLMStore } from '@sdkwork/claw-settings';
import { Agent, Skill } from '@sdkwork/claw-types';
import { ChatModel } from '../types';

const API_KEY_MAP: Record<string, string> = {
  anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
  azure: import.meta.env.VITE_AZURE_API_KEY || '',
  deepseek: import.meta.env.VITE_DEEPSEEK_API_KEY || '',
  google: import.meta.env.VITE_GEMINI_API_KEY || '',
  moonshot: import.meta.env.VITE_MOONSHOT_API_KEY || '',
  openai: import.meta.env.VITE_OPENAI_API_KEY || '',
  qwen: import.meta.env.VITE_QWEN_API_KEY || '',
};

const DEFAULT_SYSTEM_INSTRUCTION =
  'You are Claw Studio AI assistant. You help users manage devices, write automation scripts, and answer questions about the ClawHub ecosystem. Keep your answers concise and helpful.';

const DEFAULT_LLM_CONFIG = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
};

export interface IChatService {
  createChatSession(modelId: string, skill?: Skill, agent?: Agent): any;
  sendMessageStream(
    chatSession: any,
    message: string,
    model: ChatModel,
    skill?: Skill,
    agent?: Agent,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<string, void, unknown>;
}

export function buildSystemInstruction(skill?: Skill, agent?: Agent) {
  let systemInstruction = agent?.systemPrompt ?? DEFAULT_SYSTEM_INSTRUCTION;

  if (skill) {
    systemInstruction += `\n\nYou are currently equipped with the "${skill.name}" skill.\nSkill Description: ${skill.description}\nSkill Category: ${skill.category}\n\nPlease use this skill's context to assist the user. If the user asks you to perform an action related to this skill, simulate the execution and provide a helpful response based on the skill's capabilities.`;
  }

  return systemInstruction;
}

export function buildContextualMessage(message: string, skill?: Skill, agent?: Agent) {
  let contextPrefix = '';

  if (agent) {
    contextPrefix += `[Role: ${agent.systemPrompt}]\n`;
  }

  if (skill) {
    contextPrefix += `[Context: You are equipped with the "${skill.name}" skill. Description: ${skill.description}]\n`;
  }

  return contextPrefix ? `${contextPrefix}\nUser: ${message}` : message;
}

class ChatService implements IChatService {
  private ai: GoogleGenAI | null = null;

  private getClient() {
    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
    }

    return this.ai;
  }

  createChatSession(modelId: string, skill?: Skill, agent?: Agent) {
    return this.getClient().chats.create({
      model: modelId,
      config: {
        systemInstruction: buildSystemInstruction(skill, agent),
      },
    });
  }

  async *sendMessageStream(
    chatSession: any,
    message: string,
    model: ChatModel,
    skill?: Skill,
    agent?: Agent,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<string, void, unknown> {
    const { channels, getInstanceConfig } = useLLMStore.getState();
    const { activeInstanceId } = useInstanceStore.getState();
    const instanceConfig = activeInstanceId ? getInstanceConfig(activeInstanceId) : null;
    const config = instanceConfig?.config ?? DEFAULT_LLM_CONFIG;
    const channel =
      (instanceConfig &&
        channels.find((item) => item.id === instanceConfig.activeChannelId)) ||
      channels.find((item) => item.provider === model.provider);

    const finalMessage =
      model.provider === 'google' ? message : buildContextualMessage(message, skill, agent);

    if (model.provider === 'google' && chatSession) {
      const responseStream = await chatSession.sendMessageStream({ message: finalMessage });
      for await (const chunk of responseStream) {
        if (abortSignal?.aborted) {
          break;
        }

        const responseChunk = chunk as GenerateContentResponse;
        if (responseChunk.text) {
          yield responseChunk.text;
        }
      }
      return;
    }

    if (channel && channel.provider !== 'google') {
      const apiKey = channel.apiKey || API_KEY_MAP[channel.provider];

      if (!apiKey) {
        yield `Error: No API key configured for ${channel.name}. Please set it in the Settings.`;
        return;
      }

      try {
        const response = await fetch(`${channel.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          signal: abortSignal,
          body: JSON.stringify({
            model: model.id,
            messages: [{ role: 'user', content: finalMessage }],
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            top_p: config.topP,
            stream: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          return;
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter((line) => line.trim() !== '');

          for (const line of lines) {
            if (abortSignal?.aborted) {
              return;
            }

            if (line.replace(/^data: /, '') === '[DONE]') {
              return;
            }

            if (!line.startsWith('data: ')) {
              continue;
            }

            try {
              const data = JSON.parse(line.slice(6));
              if (data.choices[0].delta.content) {
                yield data.choices[0].delta.content;
              }
            } catch {
              // Ignore incomplete streaming chunks.
            }
          }
        }
        return;
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          throw error;
        }

        yield `\n\n**Error connecting to ${channel.name}:** ${error.message}\n\nThis is a simulated response since the API call failed.`;
        return;
      }
    }

    const responseText = `Here is a simulated response from **${model.name}**.\n\nI can format text with markdown, like **bold**, *italics*, and \`inline code\`.\n\nI can also write code blocks:\n\n\`\`\`javascript\nfunction greet(name) {\n  console.log(\`Hello, \${name}!\`);\n}\ngreet('Claw Studio User');\n\`\`\`\n\nHow else can I assist you today?`;

    for (let index = 0; index < responseText.length; index += 1) {
      if (abortSignal?.aborted) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 20));
      yield responseText.charAt(index);
    }
  }
}

export const chatService = new ChatService();
