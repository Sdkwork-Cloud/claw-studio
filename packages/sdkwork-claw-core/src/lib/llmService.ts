import { GoogleGenAI } from '@google/genai';

export interface AIRequestOptions {
  prompt: string;
  context?: string;
  systemInstruction?: string;
  onChunk?: (text: string) => void;
}

export interface ILLMService {
  generateContent(options: AIRequestOptions): Promise<string>;
  generateContentStream(options: AIRequestOptions): Promise<string>;
}

class LLMService implements ILLMService {
  private ai: GoogleGenAI | null = null;

  private getAI() {
    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key is not configured.');
      }
      this.ai = new GoogleGenAI({ apiKey });
    }
    return this.ai;
  }

  async generateContent(options: AIRequestOptions): Promise<string> {
    const ai = this.getAI();

    let fullPrompt = options.prompt;
    if (options.context) {
      fullPrompt = `Context:\n"""\n${options.context}\n"""\n\nUser Request: ${options.prompt}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: fullPrompt,
      config: {
        systemInstruction:
          options.systemInstruction ||
          'You are an expert AI assistant helping a user write and edit content. Provide helpful, accurate, and concise responses.',
      },
    });

    return response.text || '';
  }

  async generateContentStream(options: AIRequestOptions): Promise<string> {
    const ai = this.getAI();

    let fullPrompt = options.prompt;
    if (options.context) {
      fullPrompt = `Context:\n"""\n${options.context}\n"""\n\nUser Request: ${options.prompt}`;
    }

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: fullPrompt,
      config: {
        systemInstruction:
          options.systemInstruction ||
          'You are an expert AI assistant helping a user write and edit content. Provide helpful, accurate, and concise responses.',
      },
    });

    let fullText = '';
    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        if (options.onChunk) {
          options.onChunk(text);
        }
      }
    }

    return fullText;
  }
}

export const llmService = new LLMService();
