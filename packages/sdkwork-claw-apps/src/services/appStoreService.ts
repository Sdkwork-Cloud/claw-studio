import { type ListParams, type PaginatedResult } from '@sdkwork/claw-types';

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

  // Legacy methods
  getFeaturedApp(): Promise<AppItem>;
  getTopCharts(): Promise<AppItem[]>;
  getCategories(): Promise<AppCategory[]>;
  getApp(id: string): Promise<AppItem>;

  // App Management
  installApp(id: string, onProgress?: (progress: number) => void): Promise<void>;
  uninstallApp(id: string): Promise<void>;
}

class AppStoreServiceImpl implements IAppStoreService {
  async installApp(_id: string, onProgress?: (progress: number) => void): Promise<void> {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 15) + 5;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          onProgress?.(progress);

          setTimeout(() => {
            resolve();
          }, 2000);
        } else {
          onProgress?.(progress);
        }
      }, 200);
    });
  }

  async uninstallApp(_id: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 500);
    });
  }

  async getList(params: ListParams = {}): Promise<PaginatedResult<AppItem>> {
    const res = await fetch('/api/appstore/topcharts');
    if (!res.ok) {
      throw new Error('Failed to fetch apps');
    }
    const items: AppItem[] = await res.json();

    let filtered = items;
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(
        (app) =>
          app.name.toLowerCase().includes(lowerKeyword) ||
          app.developer.toLowerCase().includes(lowerKeyword),
      );
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paginatedItems = filtered.slice(start, start + pageSize);

    return {
      items: paginatedItems,
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

  async create(_data: CreateAppDTO): Promise<AppItem> {
    throw new Error('Method not implemented.');
  }

  async update(_id: string, _data: UpdateAppDTO): Promise<AppItem> {
    throw new Error('Method not implemented.');
  }

  async delete(_id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  async getFeaturedApp(): Promise<AppItem> {
    const res = await fetch('/api/appstore/featured');
    if (!res.ok) {
      throw new Error('Failed to fetch featured app');
    }
    return res.json();
  }

  async getTopCharts(): Promise<AppItem[]> {
    const res = await fetch('/api/appstore/topcharts');
    if (!res.ok) {
      throw new Error('Failed to fetch top charts');
    }
    return res.json();
  }

  async getCategories(): Promise<AppCategory[]> {
    const res = await fetch('/api/appstore/categories');
    if (!res.ok) {
      throw new Error('Failed to fetch categories');
    }
    return res.json();
  }

  async getApp(id: string): Promise<AppItem> {
    const res = await fetch(`/api/appstore/apps/${id}`);
    if (!res.ok) {
      throw new Error('Failed to fetch app');
    }
    return res.json();
  }
}

export const appStoreService = new AppStoreServiceImpl();
