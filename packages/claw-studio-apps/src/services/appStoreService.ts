export interface ListParams {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

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
  banner?: string | null;
  icon: string;
  rating: number;
  rank?: number | null;
  reviewsCount?: string;
  screenshots?: string[];
  version?: string;
  size?: string;
  releaseDate?: string;
  compatibility?: string;
  ageRating?: string;
}

export interface CreateAppDTO {
  name: string;
  developer: string;
  category: string;
  icon: string;
  description?: string;
}

export interface UpdateAppDTO extends Partial<CreateAppDTO> {}

export interface IAppStoreService {
  getList(params?: ListParams): Promise<PaginatedResult<AppItem>>;
  getById(id: string): Promise<AppItem | null>;
  create(data: CreateAppDTO): Promise<AppItem>;
  update(id: string, data: UpdateAppDTO): Promise<AppItem>;
  delete(id: string): Promise<boolean>;
  getFeaturedApp(): Promise<AppItem>;
  getTopCharts(): Promise<AppItem[]>;
  getCategories(): Promise<AppCategory[]>;
  getApp(id: string): Promise<AppItem>;
  installApp(id: string, onProgress?: (progress: number) => void): Promise<void>;
  uninstallApp(id: string): Promise<void>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateExtendedData(id: string, name: string) {
  return {
    reviewsCount: '12.4K',
    screenshots: [
      `https://picsum.photos/seed/${id}_1/800/500`,
      `https://picsum.photos/seed/${id}_2/800/500`,
      `https://picsum.photos/seed/${id}_3/800/500`,
    ],
    version: '2.1.0',
    size: '342 MB',
    releaseDate: 'Oct 24, 2023',
    compatibility: 'macOS 12.0 or later, Windows 11, Linux',
    ageRating: '4+',
    description: `This is a detailed description for ${name}. It includes all the features and capabilities of the application. It is designed to be highly performant and easy to use.`,
  };
}

const FEATURED_APP: AppItem = {
  id: 'app-1',
  name: 'Claw AI Studio',
  developer: 'Claw Studio Inc.',
  category: 'AI Development',
  description:
    'The ultimate IDE for building and fine-tuning OpenClaw AI skills. Features intelligent code completion, visual prompt debugging, and one-click model deployment.',
  banner: 'https://picsum.photos/seed/clawstudio_banner/1200/600?blur=2',
  icon: 'https://picsum.photos/seed/clawstudio/200/200',
  rating: 5.0,
  rank: null,
  ...generateExtendedData('app-1', 'Claw AI Studio'),
};

const TOP_CHARTS: AppItem[] = [
  {
    id: 'app-2',
    name: 'AutoGPT Agent',
    developer: 'AI Labs',
    category: 'Autonomous Agents',
    rating: 4.9,
    icon: 'https://picsum.photos/seed/autogpt/200/200',
    rank: 1,
    banner: null,
    ...generateExtendedData('app-2', 'AutoGPT Agent'),
  },
  {
    id: 'app-4',
    name: 'Vision Processor',
    developer: 'Neural Inc',
    category: 'Computer Vision',
    rating: 4.8,
    icon: 'https://picsum.photos/seed/vision/200/200',
    rank: 2,
    banner: null,
    ...generateExtendedData('app-4', 'Vision Processor'),
  },
  {
    id: 'app-5',
    name: 'Voice Synth Pro',
    developer: 'AudioAI',
    category: 'Generative Audio',
    rating: 4.9,
    icon: 'https://picsum.photos/seed/voice/200/200',
    rank: 3,
    banner: null,
    ...generateExtendedData('app-5', 'Voice Synth Pro'),
  },
  {
    id: 'app-9',
    name: 'Data Scraper AI',
    developer: 'DataMinds',
    category: 'Data Processing',
    rating: 4.8,
    icon: 'https://picsum.photos/seed/scraper/200/200',
    rank: 4,
    banner: null,
    ...generateExtendedData('app-9', 'Data Scraper AI'),
  },
  {
    id: 'app-10',
    name: 'Local LLM Runner',
    developer: 'EdgeAI',
    category: 'Infrastructure',
    rating: 4.6,
    icon: 'https://picsum.photos/seed/llmrunner/200/200',
    rank: 5,
    banner: null,
    ...generateExtendedData('app-10', 'Local LLM Runner'),
  },
];

const OTHER_APPS: AppItem[] = [
  {
    id: 'app-3',
    name: 'Prompt Engineer',
    developer: 'PromptCraft',
    category: 'Developer Tools',
    rating: 4.5,
    icon: 'https://picsum.photos/seed/prompt/200/200',
    rank: null,
    banner: null,
    ...generateExtendedData('app-3', 'Prompt Engineer'),
  },
  {
    id: 'app-6',
    name: 'Image Gen Pro',
    developer: 'PixelAI',
    category: 'Generative Art',
    rating: 4.6,
    icon: 'https://picsum.photos/seed/imagegen/200/200',
    rank: null,
    banner: null,
    ...generateExtendedData('app-6', 'Image Gen Pro'),
  },
  {
    id: 'app-7',
    name: 'Code Copilot',
    developer: 'DevAI',
    category: 'Developer Tools',
    rating: 4.4,
    icon: 'https://picsum.photos/seed/copilot/200/200',
    rank: null,
    banner: null,
    ...generateExtendedData('app-7', 'Code Copilot'),
  },
  {
    id: 'app-8',
    name: 'Story Weaver',
    developer: 'NarrativeAI',
    category: 'Writing',
    rating: 4.7,
    icon: 'https://picsum.photos/seed/story/200/200',
    rank: null,
    banner: null,
    ...generateExtendedData('app-8', 'Story Weaver'),
  },
];

const ALL_APPS = [FEATURED_APP, ...TOP_CHARTS, ...OTHER_APPS];

const APPS_BY_ID = new Map(ALL_APPS.map((app) => [app.id, app]));

const CATEGORIES: AppCategory[] = [
  {
    title: 'Essential AI Tools',
    subtitle: 'Must-have applications for your AI workflows',
    apps: ['app-2', 'app-3', 'app-4', 'app-5', 'app-10']
      .map((id) => APPS_BY_ID.get(id))
      .filter((app): app is AppItem => Boolean(app)),
  },
  {
    title: 'Generative Creativity',
    subtitle: 'Unleash creativity with AI-powered generators',
    apps: ['app-6', 'app-7', 'app-8', 'app-9']
      .map((id) => APPS_BY_ID.get(id))
      .filter((app): app is AppItem => Boolean(app)),
  },
];

function cloneApp(app: AppItem): AppItem {
  return {
    ...app,
    screenshots: app.screenshots ? [...app.screenshots] : undefined,
  };
}

function cloneCategory(category: AppCategory): AppCategory {
  return {
    ...category,
    apps: category.apps.map(cloneApp),
  };
}

class AppStoreServiceImpl implements IAppStoreService {
  async installApp(id: string, onProgress?: (progress: number) => void): Promise<void> {
    let progress = 0;

    while (progress < 100) {
      await delay(50);
      progress = Math.min(100, progress + 25);
      onProgress?.(progress);
    }

    await delay(100);
  }

  async uninstallApp(id: string): Promise<void> {
    await delay(100);
  }

  async getList(params: ListParams = {}): Promise<PaginatedResult<AppItem>> {
    await delay(50);

    let items = ALL_APPS.map(cloneApp);
    if (params.keyword) {
      const keyword = params.keyword.toLowerCase();
      items = items.filter(
        (app) =>
          app.name.toLowerCase().includes(keyword) ||
          app.developer.toLowerCase().includes(keyword) ||
          app.category.toLowerCase().includes(keyword),
      );
    }

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const total = items.length;
    const start = (page - 1) * pageSize;

    return {
      items: items.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  }

  async getById(id: string): Promise<AppItem | null> {
    try {
      return await this.getApp(id);
    } catch {
      return null;
    }
  }

  async create(data: CreateAppDTO): Promise<AppItem> {
    throw new Error('Method not implemented.');
  }

  async update(id: string, data: UpdateAppDTO): Promise<AppItem> {
    throw new Error('Method not implemented.');
  }

  async delete(id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  async getFeaturedApp(): Promise<AppItem> {
    await delay(50);
    return cloneApp(FEATURED_APP);
  }

  async getTopCharts(): Promise<AppItem[]> {
    await delay(50);
    return TOP_CHARTS.map(cloneApp);
  }

  async getCategories(): Promise<AppCategory[]> {
    await delay(50);
    return CATEGORIES.map(cloneCategory);
  }

  async getApp(id: string): Promise<AppItem> {
    await delay(50);
    const app = APPS_BY_ID.get(id);
    if (!app) {
      throw new Error('App not found');
    }
    return cloneApp(app);
  }
}

export const appStoreService = new AppStoreServiceImpl();

