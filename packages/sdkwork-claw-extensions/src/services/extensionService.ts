import type { ListParams, PaginatedResult } from './serviceTypes.ts';

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

export interface ExtensionService {
  getExtensions(params?: ListParams): Promise<PaginatedResult<Extension>>;
  installExtension(id: string, instanceId?: string): Promise<void>;
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
  },
];

export function createExtensionService(seedExtensions: Extension[] = MOCK_EXTENSIONS): ExtensionService {
  const extensions = [...seedExtensions];

  return {
    async getExtensions(params: ListParams = {}) {
      return new Promise((resolve) => {
        setTimeout(() => {
          let filtered = [...extensions];

          if (params.keyword) {
            const keyword = params.keyword.toLowerCase();
            filtered = filtered.filter((extension) =>
              extension.name.toLowerCase().includes(keyword) ||
              extension.description.toLowerCase().includes(keyword),
            );
          }

          const page = params.page || 1;
          const pageSize = params.pageSize || 10;
          const total = filtered.length;
          const start = (page - 1) * pageSize;

          resolve({
            items: filtered.slice(start, start + pageSize),
            total,
            page,
            pageSize,
            hasMore: start + pageSize < total,
          });
        }, 300);
      });
    },

    async installExtension(id: string, instanceId?: string) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const index = extensions.findIndex((extension) => extension.id === id);
          if (index === -1) {
            reject(new Error('Extension not found'));
            return;
          }

          extensions[index] = { ...extensions[index], installed: true };
          resolve();
        }, 500);
      });
    },

    async uninstallExtension(id) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const index = extensions.findIndex((extension) => extension.id === id);
          if (index === -1) {
            reject(new Error('Extension not found'));
            return;
          }

          extensions[index] = { ...extensions[index], installed: false };
          resolve();
        }, 500);
      });
    },
  };
}

export const extensionService = createExtensionService();
