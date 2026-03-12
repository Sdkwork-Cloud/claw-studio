import { ListParams, PaginatedResult } from '../types/service';

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
  
  // Legacy methods
  getPosts(category?: string, query?: string): Promise<CommunityPost[]>;
  getPost(id: string): Promise<CommunityPost>;
  getComments(postId: string): Promise<CommunityComment[]>;
  likePost(id: string): Promise<void>;
  bookmarkPost(id: string): Promise<void>;
  addComment(postId: string, content: string): Promise<CommunityComment>;
  createPost(post: Omit<CommunityPost, 'id' | 'author' | 'stats' | 'createdAt'>): Promise<CommunityPost>;
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
      hasMore: start + pageSize < total
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
    throw new Error('Method not implemented.');
  }

  async delete(id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  // Legacy methods
  async getPosts(category?: string, query?: string): Promise<CommunityPost[]> {
    // Mock data for frontend development
    let posts: CommunityPost[] = [
      {
        id: '1',
        title: 'How to optimize your AI agent for faster response times',
        content: '# Optimizing AI Agents\n\nHere are some tips to make your AI agents faster...',
        author: {
          name: 'Alex Johnson',
          avatar: 'https://i.pravatar.cc/150?u=alex',
          role: 'AI Researcher',
          bio: 'Passionate about building fast and reliable AI systems.'
        },
        category: 'tutorials',
        tags: ['optimization', 'performance', 'agents'],
        stats: { likes: 120, comments: 15, views: 1500 },
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        coverImage: 'https://picsum.photos/seed/ai-opt/800/400'
      },
      {
        id: '2',
        title: 'New release: Claw Framework v2.0 is here!',
        content: '# Claw Framework v2.0\n\nWe are excited to announce the release of Claw Framework v2.0...',
        author: {
          name: 'Claw Team',
          avatar: 'https://i.pravatar.cc/150?u=claw',
          role: 'Core Team',
          bio: 'The official team behind the Claw Framework.'
        },
        category: 'announcements',
        tags: ['release', 'v2.0', 'framework'],
        stats: { likes: 350, comments: 42, views: 5000 },
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        coverImage: 'https://picsum.photos/seed/claw-v2/800/400'
      },
      {
        id: '3',
        title: 'Discussion: What are the best use cases for autonomous agents?',
        content: 'I have been experimenting with autonomous agents lately and I am curious to know what you all think are the best use cases for them. Share your thoughts below!',
        author: {
          name: 'Sarah Smith',
          avatar: 'https://i.pravatar.cc/150?u=sarah',
          role: 'Developer',
          bio: 'Building cool things with AI.'
        },
        category: 'discussions',
        tags: ['autonomous', 'use-cases', 'brainstorming'],
        stats: { likes: 85, comments: 28, views: 900 },
        createdAt: new Date(Date.now() - 259200000).toISOString()
      }
    ];

    if (category && category !== 'all') {
      posts = posts.filter(p => p.category === category);
    }
    
    if (query) {
      const lowerQuery = query.toLowerCase();
      posts = posts.filter(p => 
        p.title.toLowerCase().includes(lowerQuery) || 
        p.content.toLowerCase().includes(lowerQuery) ||
        p.tags.some(t => t.toLowerCase().includes(lowerQuery))
      );
    }

    return posts;
  }

  async getPost(id: string): Promise<CommunityPost> {
    const posts = await this.getPosts();
    const post = posts.find(p => p.id === id);
    if (!post) throw new Error('Post not found');
    return post;
  }

  async getComments(postId: string): Promise<CommunityComment[]> {
    // Mock comments
    return [
      {
        id: 'c1',
        author: { name: 'User A', avatar: 'https://i.pravatar.cc/150?u=usera' },
        content: 'Great post! Very helpful.',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        likes: 5
      },
      {
        id: 'c2',
        author: { name: 'User B', avatar: 'https://i.pravatar.cc/150?u=userb' },
        content: 'I have a question about the second point...',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        likes: 2
      }
    ];
  }

  async likePost(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  async bookmarkPost(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  async addComment(postId: string, content: string): Promise<CommunityComment> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      id: `c${Date.now()}`,
      author: { name: 'Current User', avatar: 'https://i.pravatar.cc/150?u=current' },
      content,
      createdAt: new Date().toISOString(),
      likes: 0
    };
  }

  async createPost(post: Omit<CommunityPost, 'id' | 'author' | 'stats' | 'createdAt'>): Promise<CommunityPost> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      ...post,
      id: `p${Date.now()}`,
      author: { name: 'Current User', avatar: 'https://i.pravatar.cc/150?u=current', role: 'Member' },
      stats: { likes: 0, comments: 0, views: 0 },
      createdAt: new Date().toISOString()
    };
  }
}

export const communityService = new CommunityServiceImpl();
