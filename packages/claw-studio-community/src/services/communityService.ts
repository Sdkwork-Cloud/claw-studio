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
    id: 'post-1',
    title: 'Getting Started with OpenClaw: A Comprehensive Guide',
    content: `
Welcome to OpenClaw! This guide will walk you through the essential steps to get your environment up and running.

## 1. Installation

First, you'll need to install the Claw Studio application. You can download it directly from our website or use the command line:

\`\`\`bash
curl -sSL https://openclaw.dev/install | bash
\`\`\`

## 2. Configuring Your First Instance

Once installed, navigate to the **Instances** tab. Click on "Create Instance" and select the "Starter Pack" template. This will automatically provision a local environment with all the necessary dependencies.

### Key Configuration Options:
- **Memory Allocation**: We recommend at least 8GB for smooth operation.
- **Port Mapping**: Ensure port 3000 is available.

## 3. Writing Your First Automation

Open the built-in IDE and create a new file called \`hello.ts\`. Paste the following code:

\`\`\`typescript
import { Claw } from '@openclaw/sdk';

const claw = new Claw();

claw.on('ready', () => {
  console.log('OpenClaw is ready to automate!');
});

claw.start();
\`\`\`

Run the script using the terminal, and you should see the success message!

## Conclusion

This is just the beginning. Explore the ClawHub marketplace to find pre-built skills, or dive into the documentation to learn how to build your own complex workflows.
    `,
    author: {
      name: 'Alex Chen',
      avatar: 'https://picsum.photos/seed/alex/100/100',
      role: 'Core Contributor',
      bio: 'Building the future of open-source automation.',
    },
    category: 'Tutorials',
    tags: ['Beginner', 'Setup', 'Guide'],
    stats: { likes: 342, comments: 56, views: 1205 },
    createdAt: '2 hours ago',
    coverImage: 'https://picsum.photos/seed/post1/1200/500',
  },
  {
    id: 'post-2',
    title: 'How to optimize vision models for real-time processing',
    content: 'Vision models require careful optimization...',
    author: {
      name: 'Sarah Jenkins',
      avatar: 'https://picsum.photos/seed/sarah/100/100',
      role: 'AI Researcher',
    },
    category: 'Discussions',
    tags: ['Computer Vision', 'Performance'],
    stats: { likes: 128, comments: 34, views: 890 },
    createdAt: '5 hours ago',
  },
  {
    id: 'post-3',
    title: "Announcing OpenClaw v2.0: What's New",
    content: 'We are thrilled to announce the release of OpenClaw v2.0...',
    author: {
      name: 'OpenClaw Team',
      avatar: 'https://picsum.photos/seed/team/100/100',
      role: 'Official',
    },
    category: 'Announcements',
    tags: ['Release', 'Update'],
    stats: { likes: 892, comments: 145, views: 5400 },
    createdAt: '1 day ago',
    coverImage: 'https://picsum.photos/seed/release/1200/500',
  },
];

const commentsData: Record<string, CommunityComment[]> = {
  'post-1': [
    {
      id: 'comment-1',
      author: { name: 'Sarah Jenkins', avatar: 'https://picsum.photos/seed/sarah/100/100' },
      content: 'This is exactly what I needed! The CLI installation method is so much faster.',
      createdAt: '1 hour ago',
      likes: 12,
    },
    {
      id: 'comment-2',
      author: { name: 'David Kim', avatar: 'https://picsum.photos/seed/david/100/100' },
      content: 'Quick question: Does the starter pack include the vision processing modules by default?',
      createdAt: '45 mins ago',
      likes: 3,
    },
  ],
};

function clonePost(post: CommunityPost): CommunityPost {
  return {
    ...post,
    author: { ...post.author },
    tags: [...post.tags],
    stats: { ...post.stats },
  };
}

function cloneComment(comment: CommunityComment): CommunityComment {
  return {
    ...comment,
    author: { ...comment.author },
  };
}

class CommunityServiceImpl implements ICommunityService {
  async getList(params: ListParams & { category?: string } = {}): Promise<PaginatedResult<CommunityPost>> {
    const posts = await this.getPosts(params.category, params.keyword);
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const total = posts.length;
    const start = (page - 1) * pageSize;

    return {
      items: posts.slice(start, start + pageSize),
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
    throw new Error('Method not implemented.');
  }

  async delete(id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  async getPosts(category?: string, query?: string): Promise<CommunityPost[]> {
    await delay(50);

    let posts = postsData.map(clonePost);
    if (category && category !== 'latest' && category !== 'popular') {
      const categoryLower = category.toLowerCase();
      posts = posts.filter((post) => post.category.toLowerCase() === categoryLower);
    }

    if (query) {
      const search = query.toLowerCase();
      posts = posts.filter(
        (post) =>
          post.title.toLowerCase().includes(search) ||
          post.content.toLowerCase().includes(search) ||
          post.tags.some((tag) => tag.toLowerCase().includes(search)),
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
  }

  async bookmarkPost(id: string): Promise<void> {
    await delay(25);
  }

  async addComment(postId: string, content: string): Promise<CommunityComment> {
    await delay(50);
    const comment: CommunityComment = {
      id: `comment-${Date.now()}`,
      author: {
        name: 'Current User',
        avatar: 'https://picsum.photos/seed/user/100/100',
      },
      content,
      createdAt: 'Just now',
      likes: 0,
    };

    const postComments = commentsData[postId] ?? [];
    postComments.push(comment);
    commentsData[postId] = postComments;

    return cloneComment(comment);
  }

  async createPost(post: Omit<CommunityPost, 'id' | 'author' | 'stats' | 'createdAt'>): Promise<CommunityPost> {
    await delay(50);
    const newPost: CommunityPost = {
      ...post,
      id: `post-${Date.now()}`,
      author: {
        name: 'Current User',
        avatar: 'https://picsum.photos/seed/user/100/100',
        role: 'Member',
      },
      stats: {
        likes: 0,
        comments: 0,
        views: 0,
      },
      createdAt: 'Just now',
    };

    postsData.unshift(newPost);
    return clonePost(newPost);
  }
}

export const communityService = new CommunityServiceImpl();

