import { ListParams, PaginatedResult } from '../types/service';

export interface HuggingFaceModel {
  id: string;
  name: string;
  author: string;
  description: string;
  downloads: number;
  tags: string[];
  iconUrl: string;
}

export interface CreateHuggingFaceModelDTO {
  name: string;
  author: string;
  description: string;
  tags: string[];
  iconUrl: string;
}

export interface UpdateHuggingFaceModelDTO extends Partial<CreateHuggingFaceModelDTO> {}

export interface IHuggingFaceService {
  getList(params?: ListParams): Promise<PaginatedResult<HuggingFaceModel>>;
  getById(id: string): Promise<HuggingFaceModel | null>;
  create(data: CreateHuggingFaceModelDTO): Promise<HuggingFaceModel>;
  update(id: string, data: UpdateHuggingFaceModelDTO): Promise<HuggingFaceModel>;
  delete(id: string): Promise<boolean>;
  
  // Legacy methods
  getModels(): Promise<HuggingFaceModel[]>;
  downloadModel(id: string, name: string): Promise<void>;
}

class HuggingFaceService implements IHuggingFaceService {
  async getList(params: ListParams = {}): Promise<PaginatedResult<HuggingFaceModel>> {
    const models = await this.getModels();
    
    let filtered = models;
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(lowerKeyword) || 
        m.description.toLowerCase().includes(lowerKeyword) ||
        m.author.toLowerCase().includes(lowerKeyword)
      );
    }
    
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);
    
    return {
      items,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total
    };
  }

  async getById(id: string): Promise<HuggingFaceModel | null> {
    const models = await this.getModels();
    return models.find(m => m.id === id) || null;
  }

  async create(data: CreateHuggingFaceModelDTO): Promise<HuggingFaceModel> {
    throw new Error('Method not implemented.');
  }

  async update(id: string, data: UpdateHuggingFaceModelDTO): Promise<HuggingFaceModel> {
    throw new Error('Method not implemented.');
  }

  async delete(id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  // Legacy methods
  async getModels(): Promise<HuggingFaceModel[]> {
    // Mock data for frontend development
    return [
      {
        id: '1',
        name: 'Llama-2-7b-chat-hf',
        author: 'meta-llama',
        description: 'Llama 2 is a collection of pretrained and fine-tuned generative text models ranging in scale from 7 billion to 70 billion parameters.',
        downloads: 2500000,
        tags: ['text-generation', 'llama-2', 'nlp'],
        iconUrl: 'https://picsum.photos/seed/llama2/100/100'
      },
      {
        id: '2',
        name: 'stable-diffusion-v1-5',
        author: 'runwayml',
        description: 'Stable Diffusion is a latent text-to-image diffusion model capable of generating photo-realistic images given any text input.',
        downloads: 5000000,
        tags: ['text-to-image', 'stable-diffusion', 'computer-vision'],
        iconUrl: 'https://picsum.photos/seed/sd15/100/100'
      },
      {
        id: '3',
        name: 'whisper-large-v3',
        author: 'openai',
        description: 'Whisper is a pre-trained model for automatic speech recognition (ASR) and speech translation.',
        downloads: 1200000,
        tags: ['automatic-speech-recognition', 'audio', 'whisper'],
        iconUrl: 'https://picsum.photos/seed/whisper/100/100'
      },
      {
        id: '4',
        name: 'Mistral-7B-v0.1',
        author: 'mistralai',
        description: 'The Mistral-7B-v0.1 Large Language Model (LLM) is a pretrained generative text model with 7 billion parameters.',
        downloads: 1800000,
        tags: ['text-generation', 'mistral', 'nlp'],
        iconUrl: 'https://picsum.photos/seed/mistral/100/100'
      },
      {
        id: '5',
        name: 'bert-base-uncased',
        author: 'google-bert',
        description: 'Pretrained model on English language using a masked language modeling (MLM) objective.',
        downloads: 10000000,
        tags: ['fill-mask', 'bert', 'nlp'],
        iconUrl: 'https://picsum.photos/seed/bert/100/100'
      },
      {
        id: '6',
        name: 'clip-vit-large-patch14',
        author: 'openai',
        description: 'CLIP (Contrastive Language-Image Pre-Training) is a neural network trained on a variety of (image, text) pairs.',
        downloads: 800000,
        tags: ['zero-shot-image-classification', 'clip', 'computer-vision'],
        iconUrl: 'https://picsum.photos/seed/clip/100/100'
      }
    ];
  }

  async downloadModel(id: string, name: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

export const huggingfaceService = new HuggingFaceService();
