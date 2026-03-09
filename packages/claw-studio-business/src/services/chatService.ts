import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { useLLMStore } from '../stores/useLLMStore';

export interface ChatModel {
  id: string;
  name: string;
  provider: string;
  icon: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const chatService = {
  createChatSession: (modelId: string) => {
    return ai.chats.create({
      model: modelId,
      config: {
        systemInstruction: 'You are Claw Studio AI assistant. You help users manage devices, write automation scripts, and answer questions about the ClawHub ecosystem. Keep your answers concise and helpful.',
      },
    });
  },

  sendMessageStream: async function* (chatSession: any, message: string, model: ChatModel) {
    const { channels, config } = useLLMStore.getState();
    const channel = channels.find(c => c.provider === model.provider);

    if (model.provider === 'google' && chatSession) {
      const responseStream = await chatSession.sendMessageStream({ message });
      for await (const chunk of responseStream) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          yield c.text;
        }
      }
    } else if (channel && channel.provider !== 'google') {
      // Generic OpenAI compatible streaming
      const apiKey = channel.apiKey || process.env[`${channel.provider.toUpperCase()}_API_KEY`];
      
      if (!apiKey) {
        yield `Error: No API key configured for ${channel.name}. Please set it in the Settings.`;
        return;
      }

      try {
        const response = await fetch(`${channel.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model.id,
            messages: [{ role: 'user', content: message }],
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            top_p: config.topP,
            stream: true
          })
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
              if (line.replace(/^data: /, '') === '[DONE]') return;
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.choices[0].delta.content) {
                    yield data.choices[0].delta.content;
                  }
                } catch (e) {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }
          }
        }
      } catch (error: any) {
        yield `\n\n**Error connecting to ${channel.name}:** ${error.message}\n\nThis is a simulated response since the API call failed.`;
      }
    } else {
      // Fallback Simulated Local Model Streaming
      const responseText = `Here is a simulated response from **${model.name}**.\n\nI can format text with markdown, like **bold**, *italics*, and \`inline code\`.\n\nI can also write code blocks:\n\n\`\`\`javascript\nfunction greet(name) {\n  console.log(\`Hello, \${name}!\`);\n}\ngreet('OpenClaw User');\n\`\`\`\n\nHow else can I assist you today?`;
      
      for (let i = 0; i < responseText.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 20));
        yield responseText.charAt(i);
      }
    }
  }
};
