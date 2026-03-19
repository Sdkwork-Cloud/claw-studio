import { getI18n } from 'react-i18next';
import {
  localizedText,
  normalizeLanguage,
  resolveLocalizedText,
  type LocalizedText,
} from '@sdkwork/claw-i18n';
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

type ExtensionSeed = Omit<Extension, 'description'> & {
  description: LocalizedText;
};

function resolveCurrentLanguage() {
  return normalizeLanguage(getI18n()?.resolvedLanguage ?? getI18n()?.language);
}

function materializeExtension(extension: ExtensionSeed): Extension {
  return {
    ...extension,
    description: resolveLocalizedText(extension.description, resolveCurrentLanguage()),
  };
}

const MOCK_EXTENSIONS: ExtensionSeed[] = [
  {
    id: 'ext-1',
    name: 'VS Code Integration',
    description: localizedText(
      'Connect your local VS Code editor directly to Claw instances for seamless remote development.',
      '\u5c06\u672c\u5730 VS Code \u7f16\u8f91\u5668\u76f4\u63a5\u8fde\u63a5\u5230 Claw \u5b9e\u4f8b\uff0c\u5b9e\u73b0\u65e0\u7f1d\u8fdc\u7a0b\u5f00\u53d1\u3002',
    ),
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
    description: localizedText(
      'Visual interface for managing Docker containers, images, and volumes on your instances.',
      '\u901a\u8fc7\u53ef\u89c6\u5316\u754c\u9762\u7ba1\u7406\u5b9e\u4f8b\u4e0a\u7684 Docker \u5bb9\u5668\u3001\u955c\u50cf\u548c\u5377\u3002',
    ),
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
    description: localizedText(
      'Automatically sync your instance state with a Git repository for infrastructure as code.',
      '\u5c06\u5b9e\u4f8b\u72b6\u6001\u81ea\u52a8\u540c\u6b65\u5230 Git \u4ed3\u5e93\uff0c\u652f\u6301\u57fa\u7840\u8bbe\u65bd\u5373\u4ee3\u7801\u3002',
    ),
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
    description: localizedText(
      'Advanced CPU and memory profiling tools to identify bottlenecks in your applications.',
      '\u4f7f\u7528\u9ad8\u7ea7 CPU \u548c\u5185\u5b58\u5206\u6790\u5de5\u5177\u627e\u51fa\u5e94\u7528\u4e2d\u7684\u6027\u80fd\u74f6\u9888\u3002',
    ),
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
    description: localizedText(
      'Universal database client supporting PostgreSQL, MySQL, Redis, and MongoDB.',
      '\u901a\u7528\u6570\u636e\u5e93\u5ba2\u6237\u7aef\uff0c\u652f\u6301 PostgreSQL\u3001MySQL\u3001Redis \u548c MongoDB\u3002',
    ),
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
    description: localizedText(
      'Enhanced log viewer with syntax highlighting, advanced filtering, and alert triggers.',
      '\u589e\u5f3a\u578b\u65e5\u5fd7\u67e5\u770b\u5668\uff0c\u652f\u6301\u8bed\u6cd5\u9ad8\u4eae\u3001\u9ad8\u7ea7\u7b5b\u9009\u548c\u544a\u8b66\u89e6\u53d1\u3002',
    ),
    author: 'LogMaster',
    version: '2.2.0',
    rating: 4.4,
    downloads: 19500,
    icon: 'https://picsum.photos/seed/logs/100/100',
    installed: false,
  },
];

export function createExtensionService(seedExtensions: ExtensionSeed[] = MOCK_EXTENSIONS): ExtensionService {
  const extensions = [...seedExtensions];

  return {
    async getExtensions(params: ListParams = {}) {
      return new Promise((resolve) => {
        setTimeout(() => {
          let filtered = extensions.map(materializeExtension);

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
