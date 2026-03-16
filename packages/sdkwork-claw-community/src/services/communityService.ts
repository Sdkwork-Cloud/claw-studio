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
  category: string;
  tags: string[];
  stats: {
    likes: number;
    comments: number;
    views: number;
  };
  createdAt: string;
  coverImage?: string;
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
  category: string;
  tags: string[];
  coverImage?: string;
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

const postsData: CommunityPost[] = [
  {
    id: '1',
    title: 'How to optimize your AI agent for faster response times',
    content: '# Optimizing AI Agents\n\nHere are some tips to make your AI agents faster...',
    author: {
      name: 'Alex Johnson',
      avatar: 'https://i.pravatar.cc/150?u=alex',
      role: 'AI Researcher',
      bio: 'Passionate about building fast and reliable AI systems.',
    },
    category: 'tutorials',
    tags: ['optimization', 'performance', 'agents'],
    stats: { likes: 120, comments: 15, views: 1500 },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    coverImage: 'https://picsum.photos/seed/ai-opt/800/400',
  },
  {
    id: '2',
    title: 'New release: Claw Framework v2.0 is here!',
    content: '# Claw Framework v2.0\n\nWe are excited to announce the release of Claw Framework v2.0...',
    author: {
      name: 'Claw Team',
      avatar: 'https://i.pravatar.cc/150?u=claw',
      role: 'Official',
      bio: 'The official team behind the Claw Framework.',
    },
    category: 'announcements',
    tags: ['release', 'v2.0', 'framework'],
    stats: { likes: 350, comments: 42, views: 5000 },
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    coverImage: 'https://picsum.photos/seed/claw-v2/800/400',
  },
  {
    id: '3',
    title: 'Discussion: What are the best use cases for autonomous agents?',
    content:
      'I have been experimenting with autonomous agents lately and I am curious to know what you all think are the best use cases for them. Share your thoughts below!',
    author: {
      name: 'Sarah Smith',
      avatar: 'https://i.pravatar.cc/150?u=sarah',
      role: 'Developer',
      bio: 'Building cool things with AI.',
    },
    category: 'discussions',
    tags: ['autonomous', 'use-cases', 'brainstorming'],
    stats: { likes: 85, comments: 28, views: 900 },
    createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
];

const commentsData: Record<string, CommunityComment[]> = {
  '1': [
    {
      id: 'c1',
      author: { name: 'User A', avatar: 'https://i.pravatar.cc/150?u=usera' },
      content: 'Great post! Very helpful.',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      likes: 5,
    },
    {
      id: 'c2',
      author: { name: 'User B', avatar: 'https://i.pravatar.cc/150?u=userb' },
      content: 'I have a question about the second point...',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      likes: 2,
    },
  ],
};

function clonePost(post: CommunityPost): CommunityPost {
  return {
    ...post,
    author: { ...post.author },
    stats: { ...post.stats },
    tags: [...post.tags],
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

  if (category === 'posts') {
    return post.category !== 'announcements';
  }

  if (category === 'news') {
    return post.category === 'announcements';
  }

  return post.category === category;
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
    return this.createPost(data);
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

    let posts = postsData.map(clonePost).filter((post) => matchesCategory(post, category));

    if (query) {
      const lowerQuery = query.toLowerCase();
      posts = posts.filter(
        (post) =>
          post.title.toLowerCase().includes(lowerQuery) ||
          post.content.toLowerCase().includes(lowerQuery) ||
          post.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)),
      );
    }

    if (category === 'popular') {
      posts.sort((left, right) => right.stats.likes - left.stats.likes);
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

  async bookmarkPost(id: string): Promise<void> {
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
      author: { name: 'Current User', avatar: 'https://i.pravatar.cc/150?u=current', role: 'Member' },
      stats: { likes: 0, comments: 0, views: 0 },
      createdAt: new Date().toISOString(),
    };

    postsData.unshift(newPost);
    return clonePost(newPost);
  }
}

export const communityService = new CommunityServiceImpl();
