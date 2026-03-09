export interface AppCategory {
  title: string;
  subtitle: string;
  apps: AppItem[];
}

export interface AppItem {
  id: string;
  name: string;
  developer: string;
  category: string;
  description?: string;
  banner?: string;
  icon: string;
  rating: number;
  rank?: number;
}

export interface IAppStoreService {
  getFeaturedApp(): Promise<AppItem>;
  getTopCharts(): Promise<AppItem[]>;
  getCategories(): Promise<AppCategory[]>;
  getApp(id: string): Promise<AppItem>;
}

const FEATURED_APP: AppItem = {
  id: 'app-1',
  name: 'Claw AI Studio',
  developer: 'Claw Studio Inc.',
  category: 'AI Development',
  description: 'The ultimate IDE for building and fine-tuning OpenClaw AI skills. Features intelligent code completion, visual prompt debugging, and one-click model deployment.',
  banner: 'https://picsum.photos/seed/clawstudio_banner/1200/600?blur=2',
  icon: 'https://picsum.photos/seed/clawstudio/200/200',
  rating: 5.0
};

const TOP_CHARTS: AppItem[] = [
  { id: 'app-2', name: 'AutoGPT Agent', developer: 'AI Labs', category: 'Autonomous Agents', rating: 4.9, icon: 'https://picsum.photos/seed/autogpt/200/200', rank: 1 },
  { id: 'app-4', name: 'Vision Processor', developer: 'Neural Inc', category: 'Computer Vision', rating: 4.8, icon: 'https://picsum.photos/seed/vision/200/200', rank: 2 },
  { id: 'app-5', name: 'Voice Synth Pro', developer: 'AudioAI', category: 'Generative Audio', rating: 4.9, icon: 'https://picsum.photos/seed/voice/200/200', rank: 3 },
  { id: 'app-9', name: 'Data Scraper AI', developer: 'DataMinds', category: 'Data Processing', rating: 4.8, icon: 'https://picsum.photos/seed/scraper/200/200', rank: 4 },
  { id: 'app-10', name: 'Local LLM Runner', developer: 'EdgeAI', category: 'Infrastructure', rating: 4.6, icon: 'https://picsum.photos/seed/llmrunner/200/200', rank: 5 },
];

const CATEGORIES: AppCategory[] = [
  {
    title: 'Essential AI Tools',
    subtitle: 'Must-have applications for your AI workflows',
    apps: [
      { id: 'app-2', name: 'AutoGPT Agent', developer: 'AI Labs', category: 'Autonomous Agents', rating: 4.9, icon: 'https://picsum.photos/seed/autogpt/200/200' },
      { id: 'app-3', name: 'Prompt Engineer', developer: 'PromptCraft', category: 'Developer Tools', rating: 4.5, icon: 'https://picsum.photos/seed/prompt/200/200' },
      { id: 'app-4', name: 'Vision Processor', developer: 'Neural Inc', category: 'Computer Vision', rating: 4.8, icon: 'https://picsum.photos/seed/vision/200/200' },
      { id: 'app-5', name: 'Voice Synth Pro', developer: 'AudioAI', category: 'Generative Audio', rating: 4.9, icon: 'https://picsum.photos/seed/voice/200/200' },
      { id: 'app-10', name: 'Local LLM Runner', developer: 'EdgeAI', category: 'Infrastructure', rating: 4.6, icon: 'https://picsum.photos/seed/llmrunner/200/200' },
    ]
  },
  {
    title: 'Generative Creativity',
    subtitle: 'Unleash creativity with AI-powered generators',
    apps: [
      { id: 'app-6', name: 'Image Gen Pro', developer: 'PixelAI', category: 'Generative Art', rating: 4.6, icon: 'https://picsum.photos/seed/imagegen/200/200' },
      { id: 'app-7', name: 'Code Copilot', developer: 'DevAI', category: 'Developer Tools', rating: 4.4, icon: 'https://picsum.photos/seed/copilot/200/200' },
      { id: 'app-8', name: 'Story Weaver', developer: 'NarrativeAI', category: 'Writing', rating: 4.7, icon: 'https://picsum.photos/seed/story/200/200' },
      { id: 'app-9', name: 'Music Composer', developer: 'AudioAI', category: 'Generative Audio', rating: 4.8, icon: 'https://picsum.photos/seed/music/200/200' },
    ]
  }
];

class AppStoreServiceImpl implements IAppStoreService {
  async getFeaturedApp(): Promise<AppItem> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return FEATURED_APP;
  }

  async getTopCharts(): Promise<AppItem[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return TOP_CHARTS;
  }

  async getCategories(): Promise<AppCategory[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return CATEGORIES;
  }

  async getApp(id: string): Promise<AppItem> {
    await new Promise(resolve => setTimeout(resolve, 300));
    if (id === FEATURED_APP.id) return FEATURED_APP;
    const chartApp = TOP_CHARTS.find(a => a.id === id);
    if (chartApp) return chartApp;
    for (const cat of CATEGORIES) {
      const catApp = cat.apps.find(a => a.id === id);
      if (catApp) return catApp;
    }
    throw new Error('App not found');
  }
}

export const appStoreService = new AppStoreServiceImpl();
