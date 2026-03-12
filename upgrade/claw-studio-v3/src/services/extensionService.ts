import { ListParams, PaginatedResult } from '../types/service';

export interface Extension {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  rating: number;
  downloads: number;
  icon: string;
  installed: boolean;
}

export interface IExtensionService {
  getExtensions(params?: ListParams): Promise<PaginatedResult<Extension>>;
  installExtension(id: string): Promise<void>;
  uninstallExtension(id: string): Promise<void>;
}

const MOCK_EXTENSIONS: Extension[] = [
  {
    id: 'ext-1',
    name: 'VS Code Integration',
    description: 'Connect your local VS Code editor directly to Claw instances for seamless remote development.',
    author: 'ClawOfficial',
    version: '1.2.4',
    rating: 4.9,
    downloads: 45200,
    icon: 'https://picsum.photos/seed/vscode/100/100',
    installed: true,
  },
  {
    id: 'ext-2',
    name: 'Docker Manager',
    description: 'Visual interface for managing Docker containers, images, and volumes on your instances.',
    author: 'DevTools',
    version: '2.0.1',
    rating: 4.7,
    downloads: 32100,
    icon: 'https://picsum.photos/seed/docker/100/100',
    installed: false,
  },
  {
    id: 'ext-3',
    name: 'GitOps Sync',
    description: 'Automatically sync your instance state with a Git repository for infrastructure as code.',
    author: 'CloudNative',
    version: '0.9.5',
    rating: 4.5,
    downloads: 12800,
    icon: 'https://picsum.photos/seed/gitops/100/100',
    installed: false,
  },
  {
    id: 'ext-4',
    name: 'Performance Profiler',
    description: 'Advanced CPU and memory profiling tools to identify bottlenecks in your applications.',
    author: 'SysAdminPro',
    version: '3.1.0',
    rating: 4.8,
    downloads: 28400,
    icon: 'https://picsum.photos/seed/profiler/100/100',
    installed: true,
  },
  {
    id: 'ext-5',
    name: 'Database Explorer',
    description: 'Universal database client supporting PostgreSQL, MySQL, Redis, and MongoDB.',
    author: 'DataTools',
    version: '1.5.2',
    rating: 4.6,
    downloads: 56000,
    icon: 'https://picsum.photos/seed/db/100/100',
    installed: false,
  },
  {
    id: 'ext-6',
    name: 'Log Viewer Plus',
    description: 'Enhanced log viewer with syntax highlighting, advanced filtering, and alert triggers.',
    author: 'LogMaster',
    version: '2.2.0',
    rating: 4.4,
    downloads: 19500,
    icon: 'https://picsum.photos/seed/logs/100/100',
    installed: false,
  }
];

class ExtensionService implements IExtensionService {
  private extensions = [...MOCK_EXTENSIONS];

  async getExtensions(params: ListParams = {}): Promise<PaginatedResult<Extension>> {
    return new Promise((resolve) => {
      setTimeout(() => {
        let filtered = [...this.extensions];
        
        if (params.keyword) {
          const lowerKeyword = params.keyword.toLowerCase();
          filtered = filtered.filter(e => 
            e.name.toLowerCase().includes(lowerKeyword) || 
            e.description.toLowerCase().includes(lowerKeyword)
          );
        }
        
        const page = params.page || 1;
        const pageSize = params.pageSize || 10;
        const total = filtered.length;
        const start = (page - 1) * pageSize;
        const items = filtered.slice(start, start + pageSize);
        
        resolve({
          items,
          total,
          page,
          pageSize,
          hasMore: start + pageSize < total
        });
      }, 300);
    });
  }

  async installExtension(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = this.extensions.findIndex(e => e.id === id);
        if (index !== -1) {
          this.extensions[index] = { ...this.extensions[index], installed: true };
          resolve();
        } else {
          reject(new Error('Extension not found'));
        }
      }, 500);
    });
  }

  async uninstallExtension(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = this.extensions.findIndex(e => e.id === id);
        if (index !== -1) {
          this.extensions[index] = { ...this.extensions[index], installed: false };
          resolve();
        } else {
          reject(new Error('Extension not found'));
        }
      }, 500);
    });
  }
}

export const extensionService = new ExtensionService();
