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

export type CommunityCategory =
  | 'job-seeking'
  | 'recruitment'
  | 'services'
  | 'partnerships'
  | 'news';

export type CommunityPublisherType = 'personal' | 'company' | 'official';

export type CommunityServiceLine =
  | 'legal'
  | 'tax'
  | 'design'
  | 'development'
  | 'marketing'
  | 'translation'
  | 'operations'
  | 'training'
  | 'consulting'
  | 'content'
  | 'data'
  | 'hr';

export type CommunityDeliveryMode = 'online' | 'hybrid' | 'onsite';

export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  author: {
    name: string;
    avatar: string;
    role: string;
    bio?: string;
  };
  category: CommunityCategory;
  publisherType: CommunityPublisherType;
  tags: string[];
  stats: {
    likes: number;
    comments: number;
    views: number;
  };
  createdAt: string;
  coverImage?: string;
  location?: string;
  compensation?: string;
  company?: string;
  employmentType?: string;
  contactPreference?: string;
  serviceLine?: CommunityServiceLine;
  deliveryMode?: CommunityDeliveryMode;
  turnaround?: string;
  isFeatured?: boolean;
  assistantActions?: string[];
}

export interface CommunityComment {
  id: string;
  author: {
    name: string;
    avatar: string;
  };
  content: string;
  createdAt: string;
  likes: number;
}

export interface CreatePostDTO {
  title: string;
  content: string;
  category: CommunityCategory;
  tags: string[];
  coverImage?: string;
  publisherType?: CommunityPublisherType;
  location?: string;
  compensation?: string;
  company?: string;
  employmentType?: string;
  contactPreference?: string;
  serviceLine?: CommunityServiceLine;
  deliveryMode?: CommunityDeliveryMode;
  turnaround?: string;
  isFeatured?: boolean;
  assistantActions?: string[];
}

export interface UpdatePostDTO extends Partial<CreatePostDTO> {}

export interface ICommunityService {
  getList(params?: ListParams & { category?: string }): Promise<PaginatedResult<CommunityPost>>;
  getById(id: string): Promise<CommunityPost | null>;
  create(data: CreatePostDTO): Promise<CommunityPost>;
  update(id: string, data: UpdatePostDTO): Promise<CommunityPost>;
  delete(id: string): Promise<boolean>;
  getPosts(category?: string, query?: string): Promise<CommunityPost[]>;
  getPost(id: string): Promise<CommunityPost>;
  getComments(postId: string): Promise<CommunityComment[]>;
  likePost(id: string): Promise<void>;
  bookmarkPost(id: string): Promise<void>;
  addComment(postId: string, content: string): Promise<CommunityComment>;
  createPost(post: Omit<CommunityPost, 'id' | 'author' | 'stats' | 'createdAt'>): Promise<CommunityPost>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDefaultAssistantActions(category: CommunityCategory): string[] {
  switch (category) {
    case 'job-seeking':
      return ['\u8ba9 openclaw \u6da6\u8272\u6c42\u804c\u6458\u8981', '\u751f\u6210\u591a\u7248\u672c\u6295\u9012\u6587\u6848', '\u5339\u914d\u66f4\u5408\u9002\u7684\u5c97\u4f4d'];
    case 'recruitment':
      return ['\u4f18\u5316\u5c97\u4f4d\u4eae\u70b9', '\u751f\u6210\u5019\u9009\u4eba\u521d\u7b5b\u95ee\u9898', '\u540c\u6b65\u5230\u66f4\u591a\u6e20\u9053'];
    case 'services':
      return ['\u7ed3\u6784\u5316\u670d\u52a1\u6e05\u5355', '\u751f\u6210\u62a5\u4ef7\u4e0e\u4ea4\u4ed8\u7248\u672c', '\u6574\u7406\u5ba2\u6237\u8ddf\u8fdb\u52a8\u4f5c'];
    case 'partnerships':
      return ['\u751f\u6210\u5408\u4f5c\u63d0\u6848', '\u6574\u7406\u5408\u4f5c\u6761\u6b3e', '\u63a8\u8350\u6f5c\u5728\u4f19\u4f34'];
    case 'news':
      return ['\u751f\u6210\u6458\u8981', '\u63d0\u70bc\u91cd\u70b9', '\u540c\u6b65\u5230\u9891\u9053'];
    default:
      return ['\u8ba9 openclaw \u4f18\u5316\u6807\u9898', '\u751f\u6210\u66f4\u591a\u6295\u653e\u7248\u672c'];
  }
}

function getPublisherRole(post: Omit<CommunityPost, 'id' | 'author' | 'stats' | 'createdAt'>) {
  if (post.publisherType === 'official') {
    return 'Official';
  }

  if (post.publisherType === 'company' && post.category === 'services') {
    return 'Service Partner';
  }

  if (post.publisherType === 'company' && post.category === 'partnerships') {
    return 'Business Dev';
  }

  if (post.publisherType === 'company') {
    return 'Company';
  }

  return 'Member';
}

function getPublisherName(post: Omit<CommunityPost, 'id' | 'author' | 'stats' | 'createdAt'>) {
  if (post.publisherType === 'official') {
    return 'OpenClaw Official';
  }

  if (post.company) {
    return post.company;
  }

  return 'Current User';
}

function getPublisherBio(post: Omit<CommunityPost, 'id' | 'author' | 'stats' | 'createdAt'>) {
  if (post.publisherType === 'official') {
    return '\u5e73\u53f0\u5b98\u65b9\u53d1\u5e03';
  }

  if (post.publisherType === 'company' && post.category === 'recruitment') {
    return '\u4f01\u4e1a\u62db\u8058\u53d1\u5e03\u8005';
  }

  if (post.publisherType === 'company' && post.category === 'services') {
    return '\u7ebf\u4e0a\u670d\u52a1\u63d0\u4f9b\u65b9';
  }

  if (post.publisherType === 'company' && post.category === 'partnerships') {
    return '\u5546\u52a1\u5408\u4f5c\u53d1\u8d77\u65b9';
  }

  return '\u4e2a\u4eba\u53d1\u5e03\u8005';
}

const now = Date.now();

const postsData: CommunityPost[] = [
  {
    id: '1',
    title: '\u6025\u62db AI \u4ea7\u54c1\u524d\u7aef\u5de5\u7a0b\u5e08\uff0c\u652f\u6301\u4e0a\u6d77 / \u8fdc\u7a0b\u534f\u4f5c',
    content:
      '# \u5c97\u4f4d\u4eae\u70b9\n\n\u6211\u4eec\u6b63\u5728\u4e3a OpenClaw \u5206\u7c7b\u4fe1\u606f\u5165\u53e3\u62db\u52df\u524d\u7aef\u5de5\u7a0b\u5e08\uff0c\u8d1f\u8d23\u62db\u8058/\u6c42\u804c\u53d1\u5e03\u5de5\u4f5c\u53f0\u3001\u667a\u80fd\u6295\u653e\u548c\u8fd0\u8425\u4f4d\u5efa\u8bbe\u3002\n\n## \u4f60\u5c06\u53c2\u4e0e\n\n- \u62db\u8058\u548c\u6c42\u804c\u53cc\u8fb9\u4fe1\u606f\u6d41\u4f53\u9a8c\n- OpenClaw \u667a\u80fd\u53d1\u5e03\u80fd\u529b\n- \u4f01\u4e1a\u52a0\u901f\u4e0e\u7cbe\u9009\u63a8\u8350\u4f4d\n\n\u6b22\u8fce\u719f\u6089 React\u3001TypeScript \u548c AI \u4ea7\u54c1\u8bbe\u8ba1\u7684\u540c\u5b66\u6295\u9012\u3002',
    author: {
      name: 'OpenClaw Talent',
      avatar: 'https://i.pravatar.cc/150?u=openclaw-talent',
      role: 'Official',
      bio: 'OpenClaw \u4eba\u624d\u5408\u4f5c\u4e0e\u5c97\u4f4d\u53d1\u5e03\u56e2\u961f',
    },
    category: 'recruitment',
    publisherType: 'company',
    tags: ['react', 'typescript', 'ai-product'],
    stats: { likes: 286, comments: 19, views: 4200 },
    createdAt: new Date(now - 1000 * 60 * 90).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-recruitment/1200/640',
    location: '\u4e0a\u6d77 / \u8fdc\u7a0b',
    compensation: '30k-45k x 14',
    company: 'OpenClaw',
    employmentType: '\u5168\u804c',
    contactPreference: '\u8ba9 openclaw \u5e2e\u4f60\u6574\u7406\u7b80\u5386\u5e76\u4ee3\u53d1',
    isFeatured: true,
    assistantActions: ['\u4f18\u5316\u5c97\u4f4d\u4eae\u70b9', '\u751f\u6210\u5019\u9009\u4eba\u521d\u7b5b\u95ee\u9898', '\u540c\u6b65\u5230\u66f4\u591a\u6e20\u9053'],
  },
  {
    id: '2',
    title: '\u4e94\u5e74 AI \u5e94\u7528\u7ecf\u9a8c\u4ea7\u54c1\u7ecf\u7406\u6c42\u804c\uff0c\u4f18\u5148\u676d\u5dde / \u8fdc\u7a0b',
    content:
      '# \u6c42\u804c\u753b\u50cf\n\n\u6709 AI SaaS\u3001\u4ee3\u7406\u5de5\u4f5c\u6d41\u548c\u5185\u5bb9\u5e73\u53f0\u7ecf\u9a8c\uff0c\u64c5\u957f\u4ece 0 \u5230 1 \u6253\u78e8\u4fe1\u606f\u6d41\u3001\u8ba2\u9605\u548c\u8f6c\u5316\u94fe\u8def\u3002\n\n## \u76ee\u6807\u5c97\u4f4d\n\n- AI \u4ea7\u54c1\u7ecf\u7406\n- \u589e\u957f\u4ea7\u54c1\u8d1f\u8d23\u4eba\n- \u667a\u80fd\u52a9\u624b\u65b9\u5411\u4ea7\u54c1 Owner\n\n\u5e0c\u671b\u627e\u5230\u80fd\u628a\u4ea7\u54c1\u548c\u5546\u4e1a\u4e00\u8d77\u505a\u6df1\u7684\u56e2\u961f\u3002',
    author: {
      name: 'Lin Chen',
      avatar: 'https://i.pravatar.cc/150?u=lin-chen',
      role: 'Member',
      bio: 'AI \u5e94\u7528\u4ea7\u54c1\u7ecf\u7406\uff0c\u957f\u671f\u5173\u6ce8\u62db\u8058\u4e0e\u672c\u5730\u670d\u52a1\u5e73\u53f0',
    },
    category: 'job-seeking',
    publisherType: 'personal',
    tags: ['product', 'growth', 'ai-agent'],
    stats: { likes: 154, comments: 12, views: 2680 },
    createdAt: new Date(now - 1000 * 60 * 60 * 6).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-jobseeking/1200/640',
    location: '\u676d\u5dde / \u8fdc\u7a0b',
    compensation: '\u671f\u671b 25k-35k',
    employmentType: '\u5168\u804c',
    contactPreference: '\u8ba9 openclaw \u5148\u5e2e\u6211\u5339\u914d\u5408\u9002\u5c97\u4f4d',
    isFeatured: true,
    assistantActions: ['\u6da6\u8272\u6c42\u804c\u6458\u8981', '\u751f\u6210\u6295\u9012\u7248\u672c', '\u5339\u914d\u76f8\u8fd1\u5c97\u4f4d'],
  },
  {
    id: '3',
    title: '\u96c7\u4e3b\u54c1\u724c\u77ed\u89c6\u9891\u7b56\u5212\u4e0e\u8fdc\u7a0b\u4ee3\u8fd0\u8425\uff0c\u53ef\u914d\u5408\u62db\u8058\u573a\u666f',
    content:
      '# \u670d\u52a1\u4ecb\u7ecd\n\n\u4e3a\u62db\u8058\u9879\u76ee\u3001SaaS \u4ea7\u54c1\u4e0e\u4f01\u4e1a\u589e\u957f\u56e2\u961f\u63d0\u4f9b\u96c7\u4e3b\u54c1\u724c\u77ed\u89c6\u9891\u7b56\u5212\u3001\u811a\u672c\u64b0\u5199\u3001\u8fdc\u7a0b\u526a\u8f91\u4e0e\u8d26\u53f7\u4ee3\u8fd0\u8425\u3002\n\n## \u4ea4\u4ed8\u65b9\u5f0f\n\n- \u8fdc\u7a0b\u7b56\u5212\u4e0e\u811a\u672c\u5de5\u4f5c\u574a\n- \u4ea4\u4ed8\u62db\u8058\u4e3b\u89c6\u9891\u4e0e\u7d20\u6750\u5305\n- \u5982\u6709\u9700\u8981\u53ef\u5b89\u6392 1 \u5929\u4e0a\u95e8\u62cd\u6444',
    author: {
      name: 'Studio Moss',
      avatar: 'https://i.pravatar.cc/150?u=studio-moss',
      role: 'Service Partner',
      bio: '\u9762\u5411\u521b\u4e1a\u56e2\u961f\u7684\u54c1\u724c\u5185\u5bb9\u4e0e\u89c6\u9891\u8fd0\u8425\u56e2\u961f',
    },
    category: 'services',
    publisherType: 'company',
    tags: ['marketing', 'employer-brand', 'video', 'remote'],
    stats: { likes: 98, comments: 8, views: 1390 },
    createdAt: new Date(now - 1000 * 60 * 60 * 14).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-services/1200/640',
    location: '\u5168\u56fd\u7ebf\u4e0a / \u5fc5\u8981\u65f6\u53ef\u4e0a\u95e8',
    compensation: '\u9879\u76ee\u5957\u9910 6k \u8d77',
    company: 'Studio Moss',
    employmentType: '\u6309\u9879\u76ee\u5408\u4f5c',
    contactPreference: '\u8ba9 openclaw \u5148\u5e2e\u6211\u68b3\u7406\u62db\u8058\u573a\u666f\u4e0e\u53d1\u5e03\u8282\u594f',
    serviceLine: 'marketing',
    deliveryMode: 'hybrid',
    turnaround: '3 \u4e2a\u5de5\u4f5c\u65e5\u4ea4\u4ed8\u9996\u7248\u89c6\u89c9\u65b9\u6848',
    assistantActions: ['\u751f\u6210\u670d\u52a1\u6e05\u5355', '\u6574\u7406\u5ba2\u6237\u9700\u6c42', '\u63a8\u8350\u914d\u5957\u6295\u653e\u8282\u594f'],
  },
  {
    id: '6',
    title: '\u7ebf\u4e0a SaaS \u5408\u540c\u5ba1\u6838\u4e0e\u52b3\u52a8\u5408\u89c4\u987e\u95ee\uff0c48 \u5c0f\u65f6\u5185\u4ea4\u4ed8\u9996\u7248',
    content:
      '# \u6cd5\u5f8b\u670d\u52a1\n\n\u63d0\u4f9b SaaS \u670d\u52a1\u534f\u8bae\u3001\u9690\u79c1\u653f\u7b56\u3001\u7528\u5de5\u534f\u8bae\u3001\u5916\u5305\u5408\u540c\u548c\u57fa\u7840\u5408\u89c4\u6e05\u5355\u7684\u8fdc\u7a0b\u5ba1\u6838\u4e0e\u4fee\u8ba2\u5efa\u8bae\u3002\n\n## \u9002\u5408\u573a\u666f\n\n- \u521b\u4e1a\u516c\u53f8\u7b7e\u7ea6\u524d\u6cd5\u5f8b\u98ce\u9669\u68b3\u7406\n- \u96c7\u4e3b\u62db\u8058\u3001\u5916\u5305\u4e0e\u81ea\u7531\u804c\u4e1a\u8005\u534f\u4f5c\n- \u7f51\u7ad9 / App \u9690\u79c1\u4e0e\u6761\u6b3e\u57fa\u7840\u66f4\u65b0',
    author: {
      name: 'Claw Legal Desk',
      avatar: 'https://i.pravatar.cc/150?u=claw-legal-desk',
      role: 'Service Partner',
      bio: '\u4e3a AI \u516c\u53f8\u4e0e\u4e92\u8054\u7f51\u4e1a\u52a1\u63d0\u4f9b\u8fdc\u7a0b\u6cd5\u5f8b\u652f\u6301',
    },
    category: 'services',
    publisherType: 'company',
    tags: ['legal', 'contracts', 'compliance', 'online'],
    stats: { likes: 187, comments: 16, views: 2280 },
    createdAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-legal/1200/640',
    location: '\u5168\u56fd\u7ebf\u4e0a',
    compensation: '\u5355\u4efd 899 \u5143\u8d77 / \u5305\u6708 4.5k \u8d77',
    company: 'Claw Legal Desk',
    employmentType: '\u6309\u6b21 / \u5305\u6708',
    contactPreference: '\u8ba9 openclaw \u5148\u6574\u7406\u5408\u540c\u573a\u666f\u3001\u98ce\u9669\u70b9\u548c\u671f\u671b\u4ea4\u4ed8\u7bc4\u56f4',
    serviceLine: 'legal',
    deliveryMode: 'online',
    turnaround: '48 \u5c0f\u65f6\u5185\u4ea4\u4ed8\u5ba1\u6838\u4e0e\u4fee\u6539\u5efa\u8bae',
    isFeatured: true,
    assistantActions: ['\u7ed3\u6784\u5316\u5408\u540c\u9700\u6c42', '\u751f\u6210\u98ce\u9669\u70b9\u6458\u8981', '\u51c6\u5907\u62a5\u4ef7\u4e0e\u540e\u7eed\u6e05\u5355'],
  },
  {
    id: '7',
    title: '\u8fdc\u7a0b\u8d22\u7a0e\u4ee3\u8d26\u4e0e\u62a5\u7a0e\u652f\u6301\uff0c\u9762\u5411\u4e2a\u4f53\u4e0e\u521d\u521b\u56e2\u961f',
    content:
      '# \u8d22\u7a0e\u670d\u52a1\n\n\u63d0\u4f9b\u7ebf\u4e0a\u8bb0\u8d26\u3001\u53d1\u7968\u6574\u7406\u3001\u62a5\u7a0e\u8f85\u5bfc\u3001\u793e\u4fdd\u516c\u79ef\u91d1\u57fa\u7840\u7b54\u7591\u4e0e\u7ecf\u8425\u6570\u636e\u770b\u677f\u3002\n\n## \u4ea4\u4ed8\u5185\u5bb9\n\n- \u6708\u5ea6\u8d22\u7a0e\u6e05\u5355\n- \u7ebf\u4e0a\u62a5\u7a0e\u8282\u70b9\u63d0\u9192\n- \u4f01\u4e1a / \u4e2a\u4eba\u5408\u89c4\u64cd\u4f5c\u6307\u5f15',
    author: {
      name: 'Ledger Lane',
      avatar: 'https://i.pravatar.cc/150?u=ledger-lane',
      role: 'Service Partner',
      bio: '\u9762\u5411\u5c0f\u5fae\u4e1a\u52a1\u7684\u8fdc\u7a0b\u8d22\u7a0e\u652f\u6301\u56e2\u961f',
    },
    category: 'services',
    publisherType: 'company',
    tags: ['tax', 'bookkeeping', 'finance', 'online'],
    stats: { likes: 131, comments: 9, views: 1720 },
    createdAt: new Date(now - 1000 * 60 * 60 * 8).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-tax/1200/640',
    location: '\u5168\u56fd\u7ebf\u4e0a',
    compensation: '\u6708\u5ea6\u6258\u7ba1 599 \u5143\u8d77',
    company: 'Ledger Lane',
    employmentType: '\u5305\u6708\u6258\u7ba1',
    contactPreference: '\u8ba9 openclaw \u5148\u6574\u7406\u5f00\u7968\u9891\u7387\u3001\u7eb3\u7a0e\u4e3b\u4f53\u548c\u5f53\u524d\u75db\u70b9',
    serviceLine: 'tax',
    deliveryMode: 'online',
    turnaround: '24 \u5c0f\u65f6\u5185\u786e\u8ba4\u670d\u52a1\u6e05\u5355\uff0c72 \u5c0f\u65f6\u5185\u4ea4\u4ed8\u9996\u8f6e\u8d22\u7a0e\u68b3\u7406',
    assistantActions: ['\u751f\u6210\u62a5\u7a0e\u6e05\u5355', '\u68b3\u7406\u5408\u89c4\u8282\u70b9', '\u51c6\u5907\u6258\u7ba1\u62a5\u4ef7'],
  },
  {
    id: '8',
    title: '\u54c1\u724c\u89c6\u89c9\u7cfb\u7edf\u4e0e\u878d\u8d44 Deck \u8bbe\u8ba1\uff0c\u5168\u7a0b\u8fdc\u7a0b\u534f\u4f5c',
    content:
      '# \u8bbe\u8ba1\u670d\u52a1\n\n\u652f\u6301 Logo \u65b9\u5411\u7a3f\u3001\u54c1\u724c\u8272\u7cfb\u3001\u4ea7\u54c1\u5b98\u7f51\u9996\u5c4f\u3001\u8def\u6f14 Deck \u4e0e\u8d44\u6599\u6a21\u7248\u5305\u4ea4\u4ed8\u3002\n\n## \u9002\u5408\u573a\u666f\n\n- \u521d\u521b\u516c\u53f8 0 \u5230 1 \u54c1\u724c\u5305\u88c5\n- \u62db\u8058 / \u878d\u8d44 / \u5ba2\u6237\u63d0\u6848\u89c6\u89c9\u5347\u7ea7\n- \u7ebf\u4e0a\u6d3b\u52a8\u4e3b\u89c6\u89c9\u4e0e\u793e\u5a92\u7269\u6599',
    author: {
      name: 'North Canvas',
      avatar: 'https://i.pravatar.cc/150?u=north-canvas',
      role: 'Service Partner',
      bio: '\u4e13\u6ce8 AI \u4ea7\u54c1\u4e0e\u521b\u4e1a\u56e2\u961f\u7684\u8fdc\u7a0b\u54c1\u724c\u8bbe\u8ba1',
    },
    category: 'services',
    publisherType: 'company',
    tags: ['design', 'branding', 'deck', 'online'],
    stats: { likes: 115, comments: 11, views: 1600 },
    createdAt: new Date(now - 1000 * 60 * 60 * 11).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-design/1200/640',
    location: '\u5168\u56fd\u7ebf\u4e0a',
    compensation: '\u6807\u51c6\u5305 3.2k \u8d77',
    company: 'North Canvas',
    employmentType: '\u6309\u5957\u9910 / \u6309\u9879\u76ee',
    contactPreference: '\u8ba9 openclaw \u5148\u68b3\u7406\u54c1\u724c\u9636\u6bb5\u3001\u76ee\u6807\u7528\u9014\u548c\u6240\u9700\u7d20\u6750',
    serviceLine: 'design',
    deliveryMode: 'online',
    turnaround: '72 \u5c0f\u65f6\u5185\u4ea4\u4ed8\u9996\u6279\u65b9\u5411\u7a3f',
    assistantActions: ['\u6574\u7406\u8bbe\u8ba1 brief', '\u751f\u6210\u7d20\u6750\u6e05\u5355', '\u51c6\u5907\u4ea4\u4ed8\u8282\u70b9'],
  },
  {
    id: '9',
    title: 'AI \u5de5\u4f5c\u6d41\u81ea\u52a8\u5316\u4e0e\u62db\u8058\u843d\u5730\u9875\u5f00\u53d1\uff0c7 \u5929\u5185\u53ef\u4ea4\u4ed8 MVP',
    content:
      '# \u5f00\u53d1\u670d\u52a1\n\n\u63d0\u4f9b AI \u5de5\u4f5c\u6d41\u8bbe\u8ba1\u3001\u8868\u5355\u81ea\u52a8\u5316\u3001\u62db\u8058 / \u9500\u552e\u843d\u5730\u9875\u5f00\u53d1\u3001CRM \u8fde\u63a5\u4e0e\u673a\u5668\u4eba\u524d\u53f0\u642d\u5efa\u3002\n\n## \u5e38\u89c1\u4ea4\u4ed8\n\n- \u53ef\u53d1\u5e03\u7684\u7740\u9646\u9875\u9762\n- \u81ea\u52a8\u5316\u7ebf\u7d22\u63a5\u5165\u4e0e\u5206\u914d\u89c4\u5219\n- OpenClaw \u53ef\u7528\u7684\u53d1\u5e03 / \u8ddf\u8fdb\u811a\u672c',
    author: {
      name: 'FlowForge Studio',
      avatar: 'https://i.pravatar.cc/150?u=flowforge',
      role: 'Service Partner',
      bio: '\u4e3a\u589e\u957f\u56e2\u961f\u4ea4\u4ed8\u81ea\u52a8\u5316\u5de5\u4f5c\u6d41\u4e0e\u8fd0\u8425\u5de5\u5177',
    },
    category: 'services',
    publisherType: 'company',
    tags: ['development', 'automation', 'landing-page', 'online'],
    stats: { likes: 203, comments: 14, views: 2550 },
    createdAt: new Date(now - 1000 * 60 * 60 * 4).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-development/1200/640',
    location: '\u5168\u7403\u8fdc\u7a0b',
    compensation: '\u5c0f\u578b MVP 8k \u8d77',
    company: 'FlowForge Studio',
    employmentType: '\u6309\u9879\u76ee',
    contactPreference: '\u8ba9 openclaw \u5148\u68b3\u7406\u73b0\u6709\u6d41\u7a0b\u3001\u671f\u671b\u81ea\u52a8\u5316\u8282\u70b9\u548c\u76ee\u6807\u8f6c\u5316',
    serviceLine: 'development',
    deliveryMode: 'online',
    turnaround: '3 \u5929\u5185\u8f93\u51fa\u6280\u672f\u65b9\u6848\uff0c7 \u5929\u5185\u53ef\u4ea4\u4ed8 MVP',
    isFeatured: true,
    assistantActions: ['\u751f\u6210\u9700\u6c42\u6d41\u7a0b\u56fe', '\u62c6\u89e3 MVP \u4ea4\u4ed8\u8303\u56f4', '\u51c6\u5907\u6280\u672f\u62a5\u4ef7'],
  },
  {
    id: '10',
    title: '\u5b98\u7f51 SEO \u5185\u5bb9\u4e0e\u7ebf\u7d22\u8f6c\u5316\u8425\u9500\uff0c\u652f\u6301 B2B \u4ea7\u54c1\u7ebf\u4e0a\u83b7\u5ba2',
    content:
      '# \u8425\u9500\u670d\u52a1\n\n\u63d0\u4f9b\u5185\u5bb9\u7b56\u7565\u3001SEO \u4e13\u9898\u9875\u3001\u4ea7\u54c1 case study \u5305\u88c5\u3001EDM \u6d41\u7a0b\u8bbe\u8ba1\u4e0e\u9500\u552e\u7ebf\u7d22\u57f9\u80b2\u3002\n\n## \u4ea7\u51fa\u7269\n\n- \u5173\u952e\u8bcd\u4e3b\u9898\u96c6\u7fa4\n- \u5b98\u7f51\u5217\u8868\u9875 / \u7740\u9646\u9875\u4f18\u5316\n- \u7ebf\u7d22\u9ad8\u610f\u5411\u8ddf\u8fdb\u8bdd\u672f',
    author: {
      name: 'Signal Harbor',
      avatar: 'https://i.pravatar.cc/150?u=signal-harbor',
      role: 'Service Partner',
      bio: '\u9762\u5411 B2B \u4e0e AI \u4ea7\u54c1\u7684\u589e\u957f\u8425\u9500\u56e2\u961f',
    },
    category: 'services',
    publisherType: 'company',
    tags: ['marketing', 'seo', 'growth', 'online'],
    stats: { likes: 126, comments: 7, views: 1505 },
    createdAt: new Date(now - 1000 * 60 * 60 * 9).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-growth/1200/640',
    location: '\u5168\u7403\u8fdc\u7a0b',
    compensation: '\u6708\u5ea6\u987e\u95ee 4k \u8d77',
    company: 'Signal Harbor',
    employmentType: '\u987e\u95ee / \u5305\u6708',
    contactPreference: '\u8ba9 openclaw \u5148\u6574\u7406\u4ea7\u54c1\u9636\u6bb5\u3001\u76ee\u6807\u5ba2\u6237\u548c\u8f6c\u5316\u6307\u6807',
    serviceLine: 'marketing',
    deliveryMode: 'online',
    turnaround: '5 \u4e2a\u5de5\u4f5c\u65e5\u5185\u4ea4\u4ed8\u9996\u8f6e\u5185\u5bb9\u4e0e\u6295\u653e\u8ba1\u5212',
    assistantActions: ['\u751f\u6210\u589e\u957f brief', '\u62c6\u89e3\u6f0f\u6597\u8282\u70b9', '\u51c6\u5907\u6295\u653e\u8bdd\u672f'],
  },
  {
    id: '11',
    title: '\u4e2d\u82f1\u53cc\u8bed\u4ea7\u54c1\u4e0e\u6cd5\u5f8b\u6587\u6863\u7ffb\u8bd1\uff0c\u5305\u62ec\u5b98\u7f51\u4e0e\u5e2e\u52a9\u4e2d\u5fc3\u672c\u5730\u5316',
    content:
      '# \u7ffb\u8bd1\u4e0e\u672c\u5730\u5316\n\n\u652f\u6301\u4ea7\u54c1\u9875\u9762\u3001\u5b98\u7f51\u6587\u6848\u3001\u7528\u6237\u534f\u8bae\u3001\u9690\u79c1\u653f\u7b56\u3001\u5ba2\u670d SOP \u4e0e Help Center \u7684\u4e2d\u82f1\u7ffb\u8bd1\u4e0e\u672c\u5730\u5316\u9002\u914d\u3002',
    author: {
      name: 'Bridge Locale',
      avatar: 'https://i.pravatar.cc/150?u=bridge-locale',
      role: 'Service Partner',
      bio: '\u805a\u7126\u4ea7\u54c1\u6587\u6863\u3001\u6cd5\u5f8b\u6587\u4ef6\u4e0e\u8fd0\u8425\u6587\u6848\u7684\u53cc\u8bed\u672c\u5730\u5316',
    },
    category: 'services',
    publisherType: 'company',
    tags: ['translation', 'localization', 'documentation', 'legal'],
    stats: { likes: 142, comments: 10, views: 1890 },
    createdAt: new Date(now - 1000 * 60 * 60 * 7).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-translation/1200/640',
    location: '\u5168\u7403\u8fdc\u7a0b',
    compensation: '\u6587\u6863\u5957\u9910 699 \u5143\u8d77',
    company: 'Bridge Locale',
    employmentType: '\u6309\u5b57\u6570 / \u6309\u5957\u9910',
    contactPreference: '\u8ba9 openclaw \u5148\u6574\u7406\u8bed\u8a00\u5bf9\u3001\u6587\u6863\u7c7b\u578b\u548c\u4ea4\u4ed8\u683c\u5f0f',
    serviceLine: 'translation',
    deliveryMode: 'online',
    turnaround: '48 \u5c0f\u65f6\u5185\u4ea4\u4ed8\u9996\u6279\u53cc\u8bed\u7248\u672c',
    assistantActions: ['\u6574\u7406\u672c\u5730\u5316\u6e05\u5355', '\u751f\u6210\u672f\u8bed\u8868', '\u51c6\u5907\u4ea4\u4ed8\u68c0\u67e5\u9879'],
  },
  {
    id: '12',
    title: '\u8fdc\u7a0b\u5ba2\u670d\u4e0e\u793e\u533a\u8fd0\u8425 SOP \u642d\u5efa\uff0c\u5e2e\u56e2\u961f\u628a\u54cd\u5e94\u901f\u5ea6\u63d0\u4e0a\u6765',
    content:
      '# \u8fd0\u8425\u670d\u52a1\n\n\u4e3a SaaS\u3001AI \u52a9\u624b\u4e0e\u5185\u5bb9\u5e73\u53f0\u63d0\u4f9b\u8fdc\u7a0b\u5ba2\u670d SOP\u3001FAQ \u4f53\u7cfb\u3001\u793e\u533a\u54cd\u5e94\u673a\u5236\u4e0e\u503c\u73ed\u6392\u73ed\u5efa\u8bae\u3002',
    author: {
      name: 'ReplyOps',
      avatar: 'https://i.pravatar.cc/150?u=replyops',
      role: 'Service Partner',
      bio: '\u805a\u7126\u54cd\u5e94\u4f53\u7cfb\u3001SOP \u4e0e\u8fd0\u8425\u8ddf\u8fdb\u7684\u8fdc\u7a0b\u56e2\u961f',
    },
    category: 'services',
    publisherType: 'company',
    tags: ['operations', 'support', 'community', 'online'],
    stats: { likes: 104, comments: 6, views: 1330 },
    createdAt: new Date(now - 1000 * 60 * 60 * 13).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-operations/1200/640',
    location: '\u5168\u7403\u8fdc\u7a0b',
    compensation: '\u6708\u5ea6 SOP \u987e\u95ee 3k \u8d77',
    company: 'ReplyOps',
    employmentType: '\u987e\u95ee / \u6279\u6b21\u4ea4\u4ed8',
    contactPreference: '\u8ba9 openclaw \u5148\u68b3\u7406\u5ba2\u670d\u538b\u529b\u70b9\u3001\u5de5\u5355\u6d41\u7a0b\u548c\u65e2\u6709\u8bdd\u672f',
    serviceLine: 'operations',
    deliveryMode: 'online',
    turnaround: '5 \u4e2a\u5de5\u4f5c\u65e5\u5185\u4ea4\u4ed8 SOP \u521d\u7a3f',
    assistantActions: ['\u62c6\u89e3\u54cd\u5e94\u6d41\u7a0b', '\u751f\u6210 SOP \u6e05\u5355', '\u6392\u5e03\u8ddf\u8fdb\u8282\u70b9'],
  },
  {
    id: '13',
    title: 'AI \u4ea7\u54c1\u4e0e\u9500\u552e\u56e2\u961f\u7ebf\u4e0a\u5185\u8bad\uff0c\u5305\u542b\u5de5\u4f5c\u6d41\u6f14\u793a\u4e0e\u843d\u5730\u811a\u672c',
    content:
      '# \u57f9\u8bad\u670d\u52a1\n\n\u63d0\u4f9b AI \u5de5\u5177\u4e0a\u624b\u57f9\u8bad\u3001\u9500\u552e\u548c\u8fd0\u8425\u56e2\u961f Prompt \u5de5\u4f5c\u5757\u3001\u5de5\u4f5c\u6d41\u6f14\u793a\u4e0e\u843d\u5730\u6587\u6863\u3002\n\n## \u4ea4\u4ed8\u6210\u679c\n\n- 90 \u5206\u949f\u7ebf\u4e0a\u5185\u8bad\u8bfe\u7a0b\n- \u73b0\u573a\u95ee\u9898\u6c60\u4e0e\u64cd\u4f5c\u624b\u518c\n- \u540e\u7eed 2 \u5468\u7b54\u7591\u652f\u6301',
    author: {
      name: 'PromptCamp',
      avatar: 'https://i.pravatar.cc/150?u=promptcamp',
      role: 'Service Partner',
      bio: '\u4e13\u6ce8 AI \u4ea7\u54c1\u3001\u9500\u552e\u548c\u8fd0\u8425\u5185\u8bad\u7684\u8fdc\u7a0b\u987e\u95ee\u56e2\u961f',
    },
    category: 'services',
    publisherType: 'company',
    tags: ['training', 'ai-workflow', 'enablement', 'online'],
    stats: { likes: 119, comments: 5, views: 1410 },
    createdAt: new Date(now - 1000 * 60 * 60 * 10).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-training/1200/640',
    location: '\u5168\u7403\u8fdc\u7a0b',
    compensation: '\u5355\u573a\u57f9\u8bad 2.8k \u8d77',
    company: 'PromptCamp',
    employmentType: '\u5355\u573a / \u8fde\u7eed\u8f85\u5bfc',
    contactPreference: '\u8ba9 openclaw \u5148\u6536\u96c6\u53c2\u8bad\u89d2\u8272\u3001\u671f\u671b\u80fd\u529b\u63d0\u5347\u548c\u5f53\u524d\u5de5\u4f5c\u6d41',
    serviceLine: 'training',
    deliveryMode: 'online',
    turnaround: '72 \u5c0f\u65f6\u5185\u4ea4\u4ed8\u57f9\u8bad\u5927\u7eb2\u4e0e\u8bfe\u540e\u8d44\u6599\u65b9\u6848',
    assistantActions: ['\u751f\u6210\u57f9\u8bad brief', '\u68b3\u7406\u8bfe\u7a0b\u5927\u7eb2', '\u51c6\u5907\u8bfe\u540e\u884c\u52a8\u9879'],
  },
  {
    id: '14',
    title: '\u5546\u6807\u68c0\u7d22\u3001IP \u98ce\u9669\u5907\u5fd8\u4e0e\u4e0a\u7ebf\u524d\u6cd5\u5f8b\u68b3\u7406\uff0c\u5168\u7a0b\u53ef\u8fdc\u7a0b\u4ea4\u4ed8',
    content:
      '# \u77e5\u8bc6\u4ea7\u6743\u4e0e\u4e0a\u7ebf\u6cd5\u5f8b\u670d\u52a1\n\n\u9762\u5411\u65b0\u4ea7\u54c1\u3001\u54c1\u724c\u4e0a\u7ebf\u548c\u56fd\u5185\u5916\u6ce8\u518c\u573a\u666f\uff0c\u63d0\u4f9b trademark \u68c0\u7d22\u3001\u5b57\u6807\u547d\u540d\u98ce\u9669\u8bf4\u660e\u3001IP \u4f7f\u7528\u8fb9\u754c\u7b14\u8bb0\u4e0e\u53d1\u5e03\u524d\u98ce\u9669 checklist\u3002\n\n## \u4ea4\u4ed8\u7269\n\n- trademark \u68c0\u7d22\u7ed3\u679c\u6458\u8981\n- \u4ea7\u54c1 / \u54c1\u724c\u4e0a\u7ebf\u98ce\u9669\u5907\u5fd8\u5f55\n- \u53d1\u5e03\u524d\u6cd5\u5f8b\u68c0\u67e5\u6e05\u5355',
    author: {
      name: 'Claw IP Counsel',
      avatar: 'https://i.pravatar.cc/150?u=claw-ip-counsel',
      role: 'Service Partner',
      bio: '\u805a\u7126\u5546\u6807\u3001IP \u4e0e\u4ea7\u54c1\u4e0a\u7ebf\u5408\u89c4\u7684\u8fdc\u7a0b\u6cd5\u5f8b\u987e\u95ee',
    },
    category: 'services',
    publisherType: 'company',
    tags: ['legal', 'trademark', 'ip', 'online'],
    stats: { likes: 96, comments: 7, views: 1320 },
    createdAt: new Date(now - 1000 * 60 * 60 * 12).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-legal-ip/1200/640',
    location: '\u5168\u7403\u8fdc\u7a0b',
    compensation: '\u5355\u9879 1299 \u5143\u8d77',
    company: 'Claw IP Counsel',
    employmentType: '\u6309\u9879\u76ee',
    contactPreference: '\u8ba9 openclaw \u5148\u6574\u7406\u4ea7\u54c1\u540d\u79f0\u3001\u4e0a\u7ebf\u5e02\u573a\u548c\u65e2\u6709\u6750\u6599',
    serviceLine: 'legal',
    deliveryMode: 'online',
    turnaround: '72 \u5c0f\u65f6\u5185\u4ea4\u4ed8 trademark \u68c0\u7d22\u4e0e\u98ce\u9669\u8bf4\u660e',
    assistantActions: ['\u6574\u7406 IP brief', '\u751f\u6210\u68c0\u7d22 checklist', '\u51c6\u5907\u6cd5\u5f8b\u98ce\u9669\u6458\u8981'],
  },
  {
    id: '15',
    title: 'AI \u4ea7\u54c1 GTM \u4e0e\u5b9a\u4ef7\u7b56\u7565\u987e\u95ee\uff0c\u53ef\u8f93\u51fa\u5546\u4e1a\u5316\u65b9\u6848\u4e0e\u843d\u5730\u8def\u7ebf',
    content:
      '# \u54a8\u8be2\u987e\u95ee\u670d\u52a1\n\n\u9762\u5411 AI \u4ea7\u54c1\u3001SaaS \u56e2\u961f\u548c\u65b0\u9879\u76ee\uff0c\u63d0\u4f9b GTM \u7b56\u7565\u3001\u5b9a\u4ef7\u6a21\u578b\u3001\u5546\u4e1a\u8def\u5f84\u68b3\u7406\u4e0e BP \u5927\u7eb2\u8f93\u51fa\u3002\n\n## \u4ea4\u4ed8\u5185\u5bb9\n\n- \u9636\u6bb5\u6027 GTM \u8def\u7ebf\u56fe\n- \u5b9a\u4ef7\u65b9\u6848\u4e0e\u8bd5\u8fd0\u884c\u5efa\u8bae\n- \u521b\u59cb\u4eba / \u9500\u552e / \u8fd0\u8425\u534f\u540c\u53d8\u91cf\u6e05\u5355',
    author: {
      name: 'North Peak Advisory',
      avatar: 'https://i.pravatar.cc/150?u=north-peak-advisory',
      role: 'Service Partner',
      bio: '\u4e3a AI \u548c SaaS \u56e2\u961f\u63d0\u4f9b\u5546\u4e1a\u5316\u4e0e GTM \u987e\u95ee',
    },
    category: 'services',
    publisherType: 'company',
    tags: ['consulting', 'gtm', 'pricing', 'strategy'],
    stats: { likes: 111, comments: 8, views: 1480 },
    createdAt: new Date(now - 1000 * 60 * 60 * 15).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-consulting/1200/640',
    location: '\u5168\u7403\u8fdc\u7a0b',
    compensation: '\u8bca\u65ad\u5957\u9910 4.8k \u8d77',
    company: 'North Peak Advisory',
    employmentType: '\u77ed\u671f\u987e\u95ee / \u9879\u76ee\u5236',
    contactPreference: '\u8ba9 openclaw \u5148\u6536\u96c6\u4ea7\u54c1\u9636\u6bb5\u3001\u76ee\u6807\u5ba2\u6237\u548c\u5f53\u524d\u589e\u957f\u74f6\u9888',
    serviceLine: 'consulting',
    deliveryMode: 'online',
    turnaround: '5 \u4e2a\u5de5\u4f5c\u65e5\u5185\u4ea4\u4ed8\u8bca\u65ad\u7ed3\u8bba\u4e0e GTM \u8def\u7ebf\u521d\u7a3f',
    assistantActions: ['\u751f\u6210\u8bca\u65ad\u95ee\u5377', '\u68b3\u7406\u5546\u4e1a\u5316\u53d8\u91cf', '\u51c6\u5907\u4ea4\u4ed8\u7ed3\u8bba'],
  },
  {
    id: '16',
    title: '\u5b98\u7f51\u957f\u6587\u6848\u3001\u767d\u76ae\u4e66\u4e0e Help Center \u4ee3\u5199\uff0c\u652f\u6301 AI \u4ea7\u54c1\u5185\u5bb9\u4ea4\u4ed8',
    content:
      '# \u5185\u5bb9\u4ee3\u5199\u670d\u52a1\n\n\u63d0\u4f9b\u5b98\u7f51\u9996\u9875\u6587\u6848\u3001\u4ea7\u54c1\u4ecb\u7ecd\u9875\u3001\u767d\u76ae\u4e66\u3001\u5e2e\u52a9\u4e2d\u5fc3\u3001\u64cd\u4f5c\u624b\u518c\u4e0e webinar \u811a\u672c\u7684\u5185\u5bb9\u4ee3\u5199\u4e0e\u7ed3\u6784\u5316\u6574\u7406\u3002',
    author: {
      name: 'Script Harbor',
      avatar: 'https://i.pravatar.cc/150?u=script-harbor',
      role: 'Service Partner',
      bio: '\u9762\u5411 AI \u548c B2B \u4ea7\u54c1\u7684\u5185\u5bb9\u4ee3\u5199\u4e0e\u77e5\u8bc6\u5e93\u6784\u5efa\u56e2\u961f',
    },
    category: 'services',
    publisherType: 'company',
    tags: ['content', 'copywriting', 'help-center', 'online'],
    stats: { likes: 102, comments: 6, views: 1370 },
    createdAt: new Date(now - 1000 * 60 * 60 * 16).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-content/1200/640',
    location: '\u5168\u7403\u8fdc\u7a0b',
    compensation: '\u4e13\u9898\u5305 2.2k \u8d77',
    company: 'Script Harbor',
    employmentType: '\u6309\u4e13\u9898 / \u6309\u6708',
    contactPreference: '\u8ba9 openclaw \u5148\u6536\u96c6\u54c1\u724c tone\u3001\u76ee\u6807\u8bfb\u8005\u548c\u5df2\u6709\u6750\u6599',
    serviceLine: 'content',
    deliveryMode: 'online',
    turnaround: '72 \u5c0f\u65f6\u5185\u4ea4\u4ed8\u9996\u7248\u6587\u6848\u5927\u7eb2\u4e0e\u793a\u4f8b\u7bc7\u7ae0',
    assistantActions: ['\u751f\u6210\u5185\u5bb9 brief', '\u62c6\u89e3\u4ea7\u51fa\u7ed3\u6784', '\u51c6\u5907\u4ea4\u4ed8\u6e05\u5355'],
  },
  {
    id: '17',
    title: '\u589e\u957f dashboard \u3001BI \u770b\u677f\u4e0e\u7528\u6237\u6570\u636e\u5206\u6790\u62a5\u544a\uff0c\u652f\u6301\u5468\u5ea6\u8fdc\u7a0b\u4ea4\u4ed8',
    content:
      '# \u6570\u636e\u670d\u52a1\n\n\u4e3a\u589e\u957f\u56e2\u961f\u3001\u9500\u552e\u56e2\u961f\u548c\u4ea7\u54c1\u56e2\u961f\u63d0\u4f9b dashboard \u8bbe\u8ba1\u3001BI \u770b\u677f\u642d\u5efa\u3001\u6f0f\u6597\u62a5\u8868\u3001\u4f7f\u7528\u8005\u5206\u6790\u5907\u5fd8\u5f55\u4e0e\u5468\u62a5\u6a21\u7248\u3002',
    author: {
      name: 'Metric Foundry',
      avatar: 'https://i.pravatar.cc/150?u=metric-foundry',
      role: 'Service Partner',
      bio: '\u4e13\u6ce8 dashboard\u3001BI \u770b\u677f\u548c\u4e1a\u52a1\u6570\u636e\u89e3\u8bfb\u7684\u8fdc\u7a0b\u56e2\u961f',
    },
    category: 'services',
    publisherType: 'company',
    tags: ['data', 'dashboard', 'bi', 'analysis'],
    stats: { likes: 109, comments: 9, views: 1435 },
    createdAt: new Date(now - 1000 * 60 * 60 * 17).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-data/1200/640',
    location: '\u5168\u7403\u8fdc\u7a0b',
    compensation: '\u5468\u5ea6\u4ea4\u4ed8 3.6k \u8d77',
    company: 'Metric Foundry',
    employmentType: '\u4ee5\u5468\u4e3a\u5355\u4f4d',
    contactPreference: '\u8ba9 openclaw \u5148\u6536\u96c6\u6570\u636e\u6765\u6e90\u3001\u6838\u5fc3\u6307\u6807\u548c\u60f3\u8981\u7684 dashboard \u573a\u666f',
    serviceLine: 'data',
    deliveryMode: 'online',
    turnaround: '5 \u4e2a\u5de5\u4f5c\u65e5\u5185\u4ea4\u4ed8 dashboard \u7ed3\u6784\u548c\u9996\u6279\u5206\u6790\u62a5\u544a',
    assistantActions: ['\u6574\u7406\u6307\u6807\u5b57\u5178', '\u751f\u6210 dashboard brief', '\u51c6\u5907\u6d1e\u5bdf\u7ed3\u8bba'],
  },
  {
    id: '18',
    title: '\u7b80\u5386\u4f18\u5316\u3001\u9762\u8bd5\u8f85\u5bfc\u4e0e\u62db\u8058\u6d41\u7a0b\u8bbe\u8ba1\uff0c\u4e2a\u4eba\u4e0e\u4f01\u4e1a\u5747\u53ef\u8fdc\u7a0b\u4ea4\u4ed8',
    content:
      '# \u4eba\u624d\u670d\u52a1\n\n\u652f\u6301\u500b\u4eba\u7b80\u5386\u4f18\u5316\u3001LinkedIn / Boss \u4e2a\u4eba\u4ecb\u7ecd\u6253\u78e8\u3001\u6a21\u62df\u9762\u8bd5\uff0c\u4e5f\u652f\u6301\u4f01\u4e1a\u7b80\u5386\u7b5b\u9009 SOP\u3001\u9762\u8bd5\u6d41\u7a0b\u8868\u548c offer \u6c9f\u901a\u6a21\u677f\u3002',
    author: {
      name: 'Talent Sprint',
      avatar: 'https://i.pravatar.cc/150?u=talent-sprint',
      role: 'Service Partner',
      bio: '\u5bf9\u4e2a\u4eba\u6c42\u804c\u548c\u4f01\u4e1a\u62db\u8058\u6d41\u7a0b\u90fd\u80fd\u8fdb\u884c\u8fdc\u7a0b\u8d4b\u80fd\u7684\u4eba\u624d\u987e\u95ee',
    },
    category: 'services',
    publisherType: 'company',
    tags: ['hr', 'resume', 'interview', 'recruitment'],
    stats: { likes: 145, comments: 11, views: 1760 },
    createdAt: new Date(now - 1000 * 60 * 60 * 18).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-hr/1200/640',
    location: '\u5168\u7403\u8fdc\u7a0b',
    compensation: '\u5355\u6b21\u8f85\u5bfc 499 \u5143\u8d77 / \u4f01\u4e1a\u5957\u9910 3k \u8d77',
    company: 'Talent Sprint',
    employmentType: '\u5355\u6b21 / \u5957\u9910',
    contactPreference: '\u8ba9 openclaw \u5148\u6536\u96c6\u76ee\u6807\u5c97\u4f4d\u3001\u5f53\u524d\u7b80\u5386\u548c\u9762\u8bd5 / \u7b5b\u9009\u75db\u70b9',
    serviceLine: 'hr',
    deliveryMode: 'online',
    turnaround: '24 \u5c0f\u65f6\u5185\u786e\u8ba4\u8f85\u5bfc\u8ba1\u5212\uff0c48 \u5c0f\u65f6\u5185\u4ea4\u4ed8\u7b80\u5386\u6216 SOP \u9996\u7248',
    assistantActions: ['\u6574\u7406\u7b80\u5386 brief', '\u751f\u6210\u9762\u8bd5\u95ee\u9898\u96c6', '\u51c6\u5907\u8ddf\u8fdb\u6d41\u7a0b'],
  },
  {
    id: '4',
    title: '\u5bfb\u627e\u793e\u533a\u56e2\u8d2d\u548c\u672c\u5730\u751f\u6d3b\u6e20\u9053\u5408\u4f5c\u4f19\u4f34',
    content:
      '# \u5408\u4f5c\u65b9\u5411\n\n\u8ba1\u5212\u8054\u5408\u672c\u5730\u751f\u6d3b\u5546\u5bb6\u3001\u62db\u8058\u670d\u52a1\u5546\u548c AI \u8fd0\u8425\u5de5\u5177\u56e2\u961f\uff0c\u5171\u540c\u63a8\u51fa\u7ebf\u7d22\u64ae\u5408\u4e0e\u4ed8\u8d39\u63a8\u8350\u65b9\u6848\u3002\n\n\u6b22\u8fce\u6709\u7ebf\u4e0b\u6e20\u9053\u3001\u62db\u8058 SaaS \u6216\u5546\u5bb6\u6d41\u91cf\u7684\u4f19\u4f34\u4ea4\u6d41\u3002',
    author: {
      name: 'River Ops',
      avatar: 'https://i.pravatar.cc/150?u=river-ops',
      role: 'Business Dev',
      bio: '\u957f\u671f\u8d1f\u8d23\u672c\u5730\u670d\u52a1\u4e0e\u7ebf\u7d22\u4e1a\u52a1\u5408\u4f5c',
    },
    category: 'partnerships',
    publisherType: 'company',
    tags: ['local-commerce', 'lead-gen', 'partnership'],
    stats: { likes: 76, comments: 5, views: 980 },
    createdAt: new Date(now - 1000 * 60 * 60 * 28).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-partnerships/1200/640',
    location: '\u5168\u56fd',
    compensation: '\u6309\u7ebf\u7d22\u5206\u6210 / \u8054\u8425',
    company: 'River Ops',
    employmentType: '\u5546\u52a1\u5408\u4f5c',
    contactPreference: '\u8ba9 openclaw \u5e2e\u6211\u5148\u505a\u5408\u4f5c\u68b3\u7406',
    assistantActions: ['\u751f\u6210\u5408\u4f5c\u63d0\u6848', '\u6574\u7406\u5408\u4f5c\u6761\u6b3e', '\u63a8\u8350\u6f5c\u5728\u4f19\u4f34'],
  },
  {
    id: '5',
    title: '\u5e73\u53f0\u5feb\u8baf\uff1aOpenClaw \u5df2\u652f\u6301\u4e2a\u4eba\u6c42\u804c\u4e0e\u4f01\u4e1a\u62db\u8058\u667a\u80fd\u4ee3\u53d1',
    content:
      '# \u5e73\u53f0\u66f4\u65b0\n\nOpenClaw \u793e\u533a\u5165\u53e3\u73b0\u5728\u652f\u6301\u4e24\u7c7b\u6838\u5fc3\u53d1\u5e03\u80fd\u529b\uff1a\n\n- \u4e2a\u4eba\u627e\u5de5\u4f5c\u4fe1\u606f\u667a\u80fd\u6574\u7406\u4e0e\u4ee3\u53d1\n- \u4f01\u4e1a\u62db\u8058\u4fe1\u606f\u7ed3\u6784\u5316\u53d1\u5e03\u4e0e\u4eae\u70b9\u751f\u6210\n\n\u540e\u7eed\u8fd8\u4f1a\u7ee7\u7eed\u5f00\u653e\u7cbe\u9009\u63a8\u8350\u4f4d\u3001\u4f01\u4e1a\u6025\u8058\u52a0\u901f\u548c\u7ebf\u7d22\u8ddf\u8fdb\u52a9\u624b\u3002',
    author: {
      name: 'OpenClaw Newsroom',
      avatar: 'https://i.pravatar.cc/150?u=openclaw-newsroom',
      role: 'Official',
      bio: 'OpenClaw \u5b98\u65b9\u8d44\u8baf\u4e0e\u4ea7\u54c1\u66f4\u65b0',
    },
    category: 'news',
    publisherType: 'official',
    tags: ['product-update', 'news', 'openclaw'],
    stats: { likes: 342, comments: 27, views: 5620 },
    createdAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
    coverImage: 'https://picsum.photos/seed/openclaw-news/1200/640',
    location: '\u5e73\u53f0\u516c\u544a',
    compensation: '\u5b98\u65b9\u8d44\u8baf',
    company: 'OpenClaw',
    employmentType: '\u8d44\u8baf',
    contactPreference: '\u67e5\u770b news \u8be6\u60c5',
    isFeatured: true,
    assistantActions: ['\u751f\u6210\u6458\u8981', '\u63d0\u70bc\u91cd\u70b9', '\u540c\u6b65\u5230\u9891\u9053'],
  },
];

const commentsData: Record<string, CommunityComment[]> = {
  '1': [
    {
      id: 'c1',
      author: { name: '\u5019\u9009\u4eba A', avatar: 'https://i.pravatar.cc/150?u=candidate-a' },
      content: '\u8fd9\u4e2a\u5c97\u4f4d\u652f\u6301\u5b8c\u5168\u8fdc\u7a0b\u5417\uff1f\u5982\u679c\u9700\u8981\u6211\u53ef\u4ee5\u8ba9 openclaw \u5148\u5e2e\u6211\u6574\u7406\u4e00\u7248\u6295\u9012\u4fe1\u606f\u3002',
      createdAt: new Date(now - 1000 * 60 * 45).toISOString(),
      likes: 6,
    },
    {
      id: 'c2',
      author: { name: '\u62db\u8058\u8fd0\u8425', avatar: 'https://i.pravatar.cc/150?u=recruitment-ops' },
      content: '\u652f\u6301\u6df7\u5408\u529e\u516c\uff0c\u4e5f\u6b22\u8fce\u5148\u6295\u9012\u8fdc\u7a0b\u5408\u4f5c\u8bd5\u7528\u9879\u76ee\u3002',
      createdAt: new Date(now - 1000 * 60 * 120).toISOString(),
      likes: 3,
    },
  ],
};

function clonePost(post: CommunityPost): CommunityPost {
  return {
    ...post,
    author: { ...post.author },
    stats: { ...post.stats },
    tags: [...post.tags],
    assistantActions: post.assistantActions ? [...post.assistantActions] : undefined,
  };
}

function cloneComment(comment: CommunityComment): CommunityComment {
  return {
    ...comment,
    author: { ...comment.author },
  };
}

function matchesCategory(post: CommunityPost, category?: string) {
  if (!category || category === 'all' || category === 'latest' || category === 'popular') {
    return true;
  }

  if (category === 'featured') {
    return post.isFeatured === true;
  }

  if (category === 'news') {
    return post.category === 'news';
  }

  return post.category === category;
}

function sortPosts(posts: CommunityPost[], category?: string) {
  const sorted = [...posts];

  if (category === 'popular') {
    sorted.sort((left, right) => right.stats.likes - left.stats.likes);
    return sorted;
  }

  sorted.sort((left, right) => {
    const leftFeatured = left.isFeatured ? 1 : 0;
    const rightFeatured = right.isFeatured ? 1 : 0;
    const createdAtDelta = Date.parse(right.createdAt) - Date.parse(left.createdAt);

    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    return rightFeatured - leftFeatured;
  });

  return sorted;
}

class CommunityServiceImpl implements ICommunityService {
  async getList(params: ListParams & { category?: string } = {}): Promise<PaginatedResult<CommunityPost>> {
    const posts = await this.getPosts(params.category, params.keyword);
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = posts.length;
    const start = (page - 1) * pageSize;
    const items = posts.slice(start, start + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  }

  async getById(id: string): Promise<CommunityPost | null> {
    try {
      return await this.getPost(id);
    } catch {
      return null;
    }
  }

  async create(data: CreatePostDTO): Promise<CommunityPost> {
    return this.createPost({
      ...data,
      publisherType: data.publisherType ?? 'personal',
      assistantActions: data.assistantActions ?? getDefaultAssistantActions(data.category),
    });
  }

  async update(id: string, data: UpdatePostDTO): Promise<CommunityPost> {
    const index = postsData.findIndex((post) => post.id === id);
    if (index === -1) {
      throw new Error('Post not found');
    }

    postsData[index] = {
      ...postsData[index],
      ...data,
      author: { ...postsData[index].author },
      stats: { ...postsData[index].stats },
      tags: data.tags ? [...data.tags] : [...postsData[index].tags],
      assistantActions: data.assistantActions
        ? [...data.assistantActions]
        : postsData[index].assistantActions
          ? [...postsData[index].assistantActions!]
          : undefined,
    };

    return clonePost(postsData[index]);
  }

  async delete(id: string): Promise<boolean> {
    const index = postsData.findIndex((post) => post.id === id);
    if (index === -1) {
      return false;
    }

    postsData.splice(index, 1);
    delete commentsData[id];
    return true;
  }

  async getPosts(category?: string, query?: string): Promise<CommunityPost[]> {
    await delay(50);

    let posts = sortPosts(postsData.map(clonePost).filter((post) => matchesCategory(post, category)), category);

    if (query) {
      const lowerQuery = query.toLowerCase();
      posts = posts.filter(
        (post) =>
          post.title.toLowerCase().includes(lowerQuery) ||
          post.content.toLowerCase().includes(lowerQuery) ||
          post.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
          post.author.name.toLowerCase().includes(lowerQuery) ||
          (post.company ?? '').toLowerCase().includes(lowerQuery) ||
          (post.location ?? '').toLowerCase().includes(lowerQuery) ||
          (post.compensation ?? '').toLowerCase().includes(lowerQuery) ||
          (post.serviceLine ?? '').toLowerCase().includes(lowerQuery) ||
          (post.deliveryMode ?? '').toLowerCase().includes(lowerQuery) ||
          (post.turnaround ?? '').toLowerCase().includes(lowerQuery),
      );
    }

    return posts;
  }

  async getPost(id: string): Promise<CommunityPost> {
    await delay(50);
    const post = postsData.find((item) => item.id === id);
    if (!post) {
      throw new Error('Post not found');
    }

    return clonePost(post);
  }

  async getComments(postId: string): Promise<CommunityComment[]> {
    await delay(50);
    return (commentsData[postId] ?? []).map(cloneComment);
  }

  async likePost(id: string): Promise<void> {
    await delay(25);
    const post = postsData.find((item) => item.id === id);
    if (post) {
      post.stats.likes += 1;
    }
  }

  async bookmarkPost(_id: string): Promise<void> {
    await delay(25);
  }

  async addComment(postId: string, content: string): Promise<CommunityComment> {
    await delay(50);
    const comment: CommunityComment = {
      id: `c${Date.now()}`,
      author: { name: 'Current User', avatar: 'https://i.pravatar.cc/150?u=current' },
      content,
      createdAt: new Date().toISOString(),
      likes: 0,
    };

    const postComments = commentsData[postId] ?? [];
    postComments.unshift(comment);
    commentsData[postId] = postComments;

    const post = postsData.find((item) => item.id === postId);
    if (post) {
      post.stats.comments += 1;
    }

    return cloneComment(comment);
  }

  async createPost(post: Omit<CommunityPost, 'id' | 'author' | 'stats' | 'createdAt'>): Promise<CommunityPost> {
    await delay(50);

    const newPost: CommunityPost = {
      ...post,
      id: `p${Date.now()}`,
      author: {
        name: getPublisherName(post),
        avatar: 'https://i.pravatar.cc/150?u=current',
        role: getPublisherRole(post),
        bio: getPublisherBio(post),
      },
      stats: { likes: 0, comments: 0, views: 0 },
      createdAt: new Date().toISOString(),
      assistantActions: post.assistantActions ?? getDefaultAssistantActions(post.category),
    };

    postsData.unshift(newPost);
    return clonePost(newPost);
  }
}

export const communityService = new CommunityServiceImpl();
